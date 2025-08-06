#!/usr/bin/env bash
#
# Helper script to build and run the Polarity Slack bot in Docker
#
# Usage:
#   ./run-polarity.sh [-e|--env-file PATH] [-c|--ca-file PATH] [-n|--network MODE] [-b|--build-local] [-h|--help]
#
# Options:
#   -e, --env-file PATH   Path to .env file (default: .env)
#   -c, --ca-file  PATH   Path to extra CA bundle (optional)
#   -n, --network  MODE   Docker network mode (e.g. host, bridge) (optional; if omitted, no --network flag is passed)
#   -b, --build-local     Build and run image from current source (developer mode)
#   -d, --detach          Run container in background (adds -d to docker run)
#   -h, --help            Show this help and exit
#
# Optional ENV:
#   LOG_MAX_SIZE – rotate when file reaches this size (default 10m)
#   LOG_MAX_FILE – number of rotated files to keep (default 3)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

usage() {
  grep '^#' "$0" | cut -c 3-
}

BUILD_LOCAL=0
IMAGE_NAME="polarity-slack-bot"   # default; may change to polarity-bot in dev mode
ENV_FILE=".env"
CA_FILE=""
NETWORK_MODE=""
DETACH=0
LOG_MAX_SIZE="${LOG_MAX_SIZE:-10m}"
LOG_MAX_FILE="${LOG_MAX_FILE:-3}"

# ── Parse CLI options ────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    -c|--ca-file)
      CA_FILE="$2"
      shift 2
      ;;
    -n|--network)
      NETWORK_MODE="$2"
      shift 2
      ;;
    -b|--build-local)
      BUILD_LOCAL=1
      shift
      ;;
    -d|--detach)
      DETACH=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ $BUILD_LOCAL -eq 1 ]]; then
  IMAGE_NAME="polarity-bot"
  echo "🔧 Building Docker image ${IMAGE_NAME}…"
  docker build -t "${IMAGE_NAME}" .
else
  # ensure pre-built image is present
  if ! docker image inspect "${IMAGE_NAME}:latest" >/dev/null 2>&1; then
    echo "✖ ${IMAGE_NAME} image not found. Please run ./update-bot.sh first." >&2
    exit 1
  fi
fi

# ── Assemble docker run args ─────────────────────────────────
DOCKER_ARGS=(
  --rm
  --name polarity_slack_bot
  --env-file "${ENV_FILE}"
  --log-driver json-file
  --log-opt "max-size=${LOG_MAX_SIZE}"
  --log-opt "max-file=${LOG_MAX_FILE}"
)

if [[ -n "${NETWORK_MODE}" ]]; then
  DOCKER_ARGS+=( --network "${NETWORK_MODE}" )
fi
if [[ $DETACH -eq 1 ]]; then
  DOCKER_ARGS+=( -d )
fi

if [[ -n "${CA_FILE}" ]]; then
  if [[ ! -f "${CA_FILE}" ]]; then
    echo "✖ CA file '${CA_FILE}' not found" >&2
    exit 1
  fi
  DOCKER_ARGS+=( -v "${CA_FILE}:/tmp/extra-ca.pem:ro" )
  DOCKER_ARGS+=( -e NODE_EXTRA_CA_CERTS=/tmp/extra-ca.pem )
fi

echo "🚀 Running ${IMAGE_NAME}…"
docker run "${DOCKER_ARGS[@]}" "${IMAGE_NAME}"
