#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-v0.1.0}"
RAW_VERSION="${VERSION#v}"

if ! [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-rc\.[0-9]+)?$ ]]; then
  echo "Invalid version format: $VERSION"
  echo "Expected: vX.Y.Z or vX.Y.Z-rc.N"
  exit 1
fi

if ! grep -q "## \[$RAW_VERSION\]" CHANGELOG.md; then
  echo "Missing changelog section for $RAW_VERSION in CHANGELOG.md"
  exit 1
fi

if [ ! -f "docs/releases/$RAW_VERSION.md" ]; then
  echo "Missing release notes file: docs/releases/$RAW_VERSION.md"
  exit 1
fi

echo "[1/2] Running release gate"
npm run gate

echo "[2/2] Release preparation commands"
echo "git add -A"
echo "git commit -m \"chore(release): prepare $VERSION\""
echo "git push origin main"
echo "git tag -a $VERSION -m \"OpenPort $VERSION\""
echo "git push origin $VERSION"
echo "gh release create $VERSION --title \"OpenPort $VERSION\" --notes-file docs/releases/$RAW_VERSION.md"
