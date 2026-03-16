#!/usr/bin/env bash
set -euo pipefail

current_major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"
if [ "${current_major}" -ge 20 ]; then
  exec "$@"
fi

find_candidate() {
  local candidate
  for candidate in \
    "$HOME/.nvm/versions/node/v22.21.1/bin" \
    "$HOME/.nvm/versions/node/v22.20.0/bin" \
    "$HOME/.nvm/versions/node/v20.18.0/bin" \
    "/opt/homebrew/opt/node@20/bin"
  do
    if [ -x "${candidate}/node" ]; then
      local major
      major="$("${candidate}/node" -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"
      if [ "${major}" -ge 20 ]; then
        echo "${candidate}"
        return 0
      fi
    fi
  done
  return 1
}

modern_bin="$(find_candidate || true)"
if [ -z "${modern_bin}" ]; then
  echo "[openport] unable to locate Node >=20" >&2
  exit 1
fi

export PATH="${modern_bin}:$PATH"
exec "$@"
