#!/usr/bin/env bash
#
# Helper script to build and run the Polarity Slack bot in Docker
# Usage: ./run-polarity.sh [path/to/.env]
# Optional ENV:
#   LOG_MAX_SIZE – rotate when file reaches this size (default 10m)
#   LOG_MAX_FILE – number of rotated files to keep (default 3)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

IMAGE_NAME="polarity-bot"
ENV_FILE="${1:-.env}"
LOG_MAX_SIZE="${LOG_MAX_SIZE:-10m}"
LOG_MAX_FILE="${LOG_MAX_FILE:-3}"

echo "🔧 Building Docker image ${IMAGE_NAME}…"
docker build -t "${IMAGE_NAME}" .

echo "🚀 Running ${IMAGE_NAME}…"
docker run --rm \
  --network host \
  --env-file "${ENV_FILE}" \
  --log-driver json-file \
  --log-opt "max-size=${LOG_MAX_SIZE}" \
  --log-opt "max-file=${LOG_MAX_FILE}" \
  "${IMAGE_NAME}"
