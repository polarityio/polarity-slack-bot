#!/usr/bin/env bash
#
# Stop the Polarity Slack bot container started by run-polarity.sh
#
# Usage:
#   ./stop-bot.sh
#
# Optional ENV:
#   CONTAINER_NAME – override the default container name (default: polarity_slack_bot)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-polarity_slack_bot}"

# Check if a container with the exact name is running
container_id=$(docker ps -q --filter "name=^/${CONTAINER_NAME}$")

if [[ -z "${container_id}" ]]; then
  echo "🛑 No running container named ${CONTAINER_NAME} found."
  exit 0
fi

echo "🔻 Stopping ${CONTAINER_NAME} (${container_id})…"
docker stop "${container_id}"
