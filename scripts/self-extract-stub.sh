#!/usr/bin/env bash
# Polarity-Slack-Bot – self-extracting installer
set -euo pipefail

info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

ARCHIVE_MARK="__ARCHIVE_BEGIN__"
SIG_BEGIN="__SIG_BEGIN__"
SIG_END="__SIG_END__"
CRT_BEGIN="__CRT_BEGIN__"
CRT_END="__CRT_END__"
EXPECTED_SHA256="@@PAYLOAD_SHA256@@"

SKIP_VERIFY=0
for arg in "$@"; do
  case "$arg" in
    --no-signature-verification) SKIP_VERIFY=1 ;;
    -h|--help) echo "usage: $0 [--no-signature-verification]"; exit 0 ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

SELF="$0"
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT

# ── extract embedded sig & cert ─────────────────────────────────────
extract_block() { awk "/^$1\$/ {f=1;next} /^$2\$/ {f=0} f" "$SELF" > "$3"; }
extract_block "$SIG_BEGIN" "$SIG_END" "$workdir/installer.sig"
extract_block "$CRT_BEGIN" "$CRT_END" "$workdir/installer.pem"
chmod 644 "$workdir/installer."{sig,pem}   # make readable for cosign container

# ── extract payload tar.gz ──────────────────────────────────────────
payload="$workdir/payload.tgz"
pl=$(grep -a -n "^${ARCHIVE_MARK}\$" "$SELF" | cut -d: -f1)
tail -n +"$((pl+1))" "$SELF" > "$payload"

# ── integrity verification ─────────────────────────────────────────
if [[ $SKIP_VERIFY -eq 0 ]]; then
  info "Verifying signature with cosign…"
  COSIGN_IMG="ghcr.io/sigstore/cosign/cosign:latest"
  if ! docker run --rm -v "$workdir:/w" -w /w -e COSIGN_EXPERIMENTAL=1 \
         "$COSIGN_IMG" verify-blob \
         --signature installer.sig \
         --certificate installer.pem \
         --certificate-identity "https://github.com/polarityio/polarity-slack-bot/.github/workflows/docker-release.yml@refs/heads/main" \
         --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
         payload.tgz; then
    warn "cosign verification failed – falling back to SHA-256"
    echo "${EXPECTED_SHA256}  $payload" | sha256sum -c - || error "SHA-256 check failed"
  fi
else
  warn "Signature verification DISABLED via flag"
fi

# ── unpack payload ─────────────────────────────────────────────────
info "Extracting Polarity Slack Bot bundle…"
tar -xzf "$payload"
chmod u+x polarity-slack-bot/*.sh
info "Done.  cd polarity-slack-bot && ./update-bot.sh"
exit 0

# ── embedded data below ────────────────────────────────────────────
${SIG_BEGIN}
${SIG_END}
${CRT_BEGIN}
${CRT_END}
${ARCHIVE_MARK}
