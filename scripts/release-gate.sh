#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node >=20 required (current: $(node -v))"
  exit 1
fi

echo "[1/5] TypeScript build"
npm run build

echo "[2/5] Test suite"
npm test

echo "[3/5] Local conformance profile"
npm run conformance:local

echo "[4/5] Safety checks"
npm run safety

echo "[5/5] Boundary leak scan"
if grep -RInE "(figena|fidelock|Fidelock-Web)" src docs spec templates test conformance README.md CHANGELOG.md ROADMAP.md SUPPORT.md .github --exclude-dir=node_modules --exclude-dir=dist; then
  echo "Blocked: product-specific marker found in public assets."
  exit 1
fi

echo "Release gate passed."
