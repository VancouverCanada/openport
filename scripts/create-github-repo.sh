#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-openport}"
VISIBILITY="${2:-public}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in. Run: gh auth login"
  exit 1
fi

if [ ! -d .git ]; then
  echo "Run this script from a git repository root."
  exit 1
fi

if [ "$VISIBILITY" != "public" ] && [ "$VISIBILITY" != "private" ]; then
  echo "Visibility must be: public or private"
  exit 1
fi

gh repo create "$REPO_NAME" --"$VISIBILITY" --source=. --remote=origin --push

echo "Repository created and pushed: $REPO_NAME"
