#!/usr/bin/env bash
# Update or install the polarity-slack-bot Docker image from the latest GitHub release.
#
# Requirements:
#   - bash, curl, jq, gzip, docker
#   - optional $GITHUB_TOKEN to raise GitHub API rate-limits
#
# Behaviour:
#   • If the image is absent → prompt to install the latest version.
#   • If present and outdated → prompt to update.
#   • If already at latest     → inform user and exit.
set -euo pipefail

REPO_OWNER="polarityio"
REPO_NAME="polarity-slack-bot"
IMAGE_NAME="polarity-slack-bot"
# Absolute path to this script’s directory
SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

tmp_dir=
cleanup() {
  [[ -n "${tmp_dir:-}" && -d "$tmp_dir" ]] && rm -rf "$tmp_dir"
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Fetch latest release metadata
# ---------------------------------------------------------------------------
info "Fetching latest release information…"
AUTH_HEADER=""
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  AUTH_HEADER="Authorization: token $GITHUB_TOKEN"
fi

api_json=$(curl -sSLH "Accept: application/vnd.github+json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest")

latest_tag=$(jq -r '.tag_name' <<<"$api_json")
if [[ "$latest_tag" == "null" || -z "$latest_tag" ]]; then
  error "Unable to retrieve latest version tag"; exit 1
fi
latest_version="${latest_tag#v}"
tgz_name="${IMAGE_NAME}-${latest_version}.tgz"

# ──────────────────────────────────────────────────────────────
# Check for cached image matching latest version
# ──────────────────────────────────────────────────────────────
LOCAL_IMAGE_DIR="${SCRIPT_DIR}/docker-images"
LOCAL_IMAGE_TGZ="${LOCAL_IMAGE_DIR}/${IMAGE_NAME}-${latest_version}.image.tgz"
LOCAL_SHA="${LOCAL_IMAGE_TGZ}.sha256"

if [[ -f "$LOCAL_IMAGE_TGZ" && -f "$LOCAL_SHA" ]]; then
  if (cd "$LOCAL_IMAGE_DIR" && sha256sum -c "$(basename "$LOCAL_SHA")" >/dev/null 2>&1); then
    info "Using cached Docker image version ${latest_version} located in docker-images/ (checksum OK) – no download needed."

    info "Loading Docker image (this may take a moment)…"
    gzip -dc "$LOCAL_IMAGE_TGZ" | docker load

    info "Tagging image as latest…"
    docker tag "${IMAGE_NAME}:${latest_version}" "${IMAGE_NAME}:latest"

    info "Done! ${IMAGE_NAME}:${latest_version} is ready."
    exit 0
  else
    warn "Cached image checksum failed – downloading fresh copy…"
  fi
fi
download_url=$(jq -r --arg FILE "$tgz_name" '.assets[] | select(.name==$FILE) | .browser_download_url' <<<"$api_json")

if [[ -z "$download_url" ]]; then
  error "Could not find asset $tgz_name in latest release"; exit 1
fi
info "Latest version is $latest_version"

# ---------------------------------------------------------------------------
# Determine installed version (if any)
# ---------------------------------------------------------------------------
installed_tags=($(docker images --format "{{.Repository}}:{{.Tag}}" "$IMAGE_NAME" 2>/dev/null | grep "^${IMAGE_NAME}:" || true))

installed_version=""
if [[ ${#installed_tags[@]} -gt 0 ]]; then
  versions=()
  for tag in "${installed_tags[@]}"; do
    v=${tag#${IMAGE_NAME}:}
    [[ "$v" != "latest" ]] && versions+=("$v")
  done
  if [[ ${#versions[@]} -gt 0 ]]; then
    IFS=$'\n' installed_version=$(printf '%s\n' "${versions[@]}" | sort -V | tail -n1)
  fi
fi

if [[ -z "$installed_version" ]]; then
  warn "The ${IMAGE_NAME} image is not installed."
  read -r -p "Install version ${latest_version}? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }
elif [[ "$installed_version" == "$latest_version" ]]; then
  info "You already have the latest version (${installed_version}). Nothing to do."
  exit 0
else
  warn "Installed version: ${installed_version}"
  warn "Latest available:  ${latest_version}"
  read -r -p "Update to ${latest_version}? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }
fi

# ---------------------------------------------------------------------------
# Download, extract, and load the image
# ---------------------------------------------------------------------------
tmp_dir=$(mktemp -d)
chmod 755 "$tmp_dir"   # ensure container user can access the mounted directory
tgz_path="${tmp_dir}/${tgz_name}"
info "Downloading ${tgz_name}…"
curl -L ${AUTH_HEADER:+-H "$AUTH_HEADER"} -o "$tgz_path" "$download_url"

# ---------------------------------------------------------------------------
# Verify integrity / authenticity – prefer cosign via Docker, fallback SHA-256
# ---------------------------------------------------------------------------
COSIGN_TAG="latest"                                # public tag on GHCR
COSIGN_IMAGE="ghcr.io/sigstore/cosign/cosign:${COSIGN_TAG}"

if command -v docker >/dev/null 2>&1; then
  sig_path="${tmp_dir}/${tgz_name}.sig"
  cert_path="${tmp_dir}/${tgz_name}.pem"

  info "Downloading signature & certificate…"
  curl -L ${AUTH_HEADER:+-H "$AUTH_HEADER"} -o "$sig_path"  "${download_url}.sig"
  curl -L ${AUTH_HEADER:+-H "$AUTH_HEADER"} -o "$cert_path" "${download_url}.pem"
  info "Signature & certificate saved to $tmp_dir"

  info "Verifying signature with cosign (container)…"
  docker run --rm \
    -e COSIGN_EXPERIMENTAL=1 \
    -v "${tmp_dir}:/work" -w /work \
    "${COSIGN_IMAGE}" \
    verify-blob \
      --signature "$(basename "$sig_path")" \
      --certificate "$(basename "$cert_path")" \
      --certificate-identity "https://github.com/${REPO_OWNER}/${REPO_NAME}/.github/workflows/docker-release.yml@refs/heads/main" \
      --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
      "$(basename "$tgz_path")" \
    || { error "Signature verification failed!"; exit 1; }
else
  info "Docker not available for cosign – falling back to SHA-256 checksum verification."
  checksum_path="${tmp_dir}/${tgz_name}.sha256"
  curl -L ${AUTH_HEADER:+-H "$AUTH_HEADER"} -o "$checksum_path" "${download_url}.sha256"
  info "Verifying checksum…"
  (cd "$tmp_dir" && sha256sum -c "$(basename "$checksum_path")") || { error "Checksum verification failed!"; exit 1; }
fi

info "Extracting bundle…"
bundle_extract="$tmp_dir/bundle"
mkdir -p "$bundle_extract"
tar -xzf "$tgz_path" -C "$bundle_extract"

image_tgz=$(find "$bundle_extract"/polarity-slack-bot/docker-images -name '*.tgz' | head -n1)
if [[ -z "$image_tgz" ]]; then
  error "Docker image not found inside bundle"; exit 1
fi

info "Loading Docker image (this may take a moment)…"
gzip -dc "$image_tgz" | docker load

# If running from a local installation (bundle extracted), refresh docker-images/
if [[ -d "${SCRIPT_DIR}/docker-images" ]]; then
  dest_dir="${SCRIPT_DIR}/docker-images"
  info "Updating local docker-images directory…"
  rm -f "${dest_dir}"/*.tgz
  cp "$image_tgz" "$dest_dir/"
fi

info "Tagging image as latest…"
docker tag "${IMAGE_NAME}:${latest_version}" "${IMAGE_NAME}:latest"

info "Done! ${IMAGE_NAME}:${latest_version} is ready."
