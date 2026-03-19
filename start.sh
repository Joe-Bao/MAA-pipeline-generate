#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [[ -x "./node/bin/node" ]]; then
  echo "Using bundled Node: ./node/bin/node"
  exec "./node/bin/node" server.mjs
fi

if command -v node >/dev/null 2>&1; then
  exec node server.mjs
fi

echo "Node.js not found. Install from https://nodejs.org or run:"
echo "  node scripts/download-portable-node.mjs linux-x64   # or darwin-x64 / darwin-arm64"
exit 1
