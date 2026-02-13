#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[1/4] Checking for accidental env files"
if find . -type f \( -name ".env" -o -name ".env.*" \) | grep -q .; then
  echo "Found .env files. Remove them before release."
  exit 1
fi

echo "[2/4] Checking for common secret patterns"
if grep -RInE "(AKIA[0-9A-Z]{16}|BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY|xox[baprs]-|ghp_[A-Za-z0-9]{36,})" . --exclude-dir=.git --exclude='*.png' --exclude='*.jpg' --exclude='*.svg'; then
  echo "Potential secret detected."
  exit 1
fi

echo "[3/4] Checking for forbidden private markers"
if grep -RInE "(service\\.figena\\.local|DIRECT_DATABASE_URL=|DATABASE_URL=postgres)" . --exclude-dir=.git --exclude='safety-check.sh'; then
  echo "Potential private environment detail found."
  exit 1
fi

echo "[4/4] Basic markdown lint guard"
if ! find docs -type f -name '*.md' | grep -q .; then
  echo "No docs found under docs/."
  exit 1
fi

echo "Safety checks passed."
