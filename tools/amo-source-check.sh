#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
echo "Node.js : $(node --version)"
command -v zip >/dev/null 2>&1 || { echo "zip manquant"; exit 1; }
zip -v | head -2
node tools/package.mjs
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum dist/uniconv-2.9.10.xpi
else
  shasum -a 256 dist/uniconv-2.9.10.xpi
fi
