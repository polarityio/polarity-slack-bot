#!/usr/bin/env bash
#
# Remove all polarity-slack-bot Docker images from the local machine.
#
# Behaviour
#   • Lists images whose repository is `polarity-slack-bot` or `polarity-slack-bot-dev`.
#   • If none exist → exits.
#   • If any running containers are based on these images → instructs the user to run
#     ./stop-bot.sh first and aborts (no force-removal).
#   • Otherwise prompts for confirmation and deletes the images.
#
# Requirements: bash, docker
# ──────────────────────────────────────────────────────────────
set -euo pipefail

IMAGE_REPOS=(polarity-slack-bot polarity-slack-bot-dev)

info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

# ── Gather images ─────────────────────────────────────────────
# Build a safe grep pattern like ^(polarity-slack-bot|polarity-slack-bot-dev):
pattern="^($(IFS='|'; echo "${IMAGE_REPOS[*]}")):"

mapfile -t images < <(
  docker images --format "{{.Repository}}:{{.Tag}}\t{{.ID}}" |
    grep -E "$pattern"
)

if [[ ${#images[@]} -eq 0 ]]; then
  info "No polarity-slack-bot images found. Nothing to do."
  exit 0
fi

# ── Check for running containers ──────────────────────────────
running=()
for repo in "${IMAGE_REPOS[@]}"; do
  while read -r cid; do
    [[ -n $cid ]] && running+=("$cid")
  done < <(docker ps -q --filter "ancestor=${repo}")
done

if [[ ${#running[@]} -gt 0 ]]; then
  warn "One or more containers based on these images are running:"
  printf '  %s\n' "${running[@]}"
  warn "Please stop them first:"
  echo "  ./stop-bot.sh"
  exit 1
fi

# ── Prompt user ───────────────────────────────────────────────
echo "The following images will be removed:"
for line in "${images[@]}"; do
  printf '  %s\n' "${line}"
done
read -r -p "Proceed? [y/N] " answer
[[ "$answer" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }

# ── Remove images ─────────────────────────────────────────────
info "Removing images…"
for line in "${images[@]}"; do
  img=${line%%$'\t'*}
  docker rmi "$img"
done

info "Done."
