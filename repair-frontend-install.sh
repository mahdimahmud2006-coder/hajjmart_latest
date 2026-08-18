#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/Frontend"
LOCK_FILE="$FRONTEND_DIR/package-lock.json"

[ -f "$FRONTEND_DIR/package.json" ] || {
    echo "ERROR: Frontend/package.json was not found." >&2
    exit 1
}

if [ -f "$LOCK_FILE" ]; then
    sed -i \
        's#https://packages\.applied-caas-gateway1\.internal\.api\.openai\.org/artifactory/api/npm/npm-public/#https://registry.npmjs.org/#g' \
        "$LOCK_FILE"
fi

cat > "$FRONTEND_DIR/.npmrc" <<'NPMRC'
registry=https://registry.npmjs.org/
replace-registry-host=never
fetch-retries=2
fetch-retry-factor=2
fetch-retry-mintimeout=1000
fetch-retry-maxtimeout=30000
fetch-timeout=60000
audit=false
fund=false
progress=true
NPMRC

rm -rf "$FRONTEND_DIR/node_modules"
cd "$FRONTEND_DIR"

if [ -f package-lock.json ]; then
    npm ci \
        --registry=https://registry.npmjs.org/ \
        --replace-registry-host=never \
        --no-audit \
        --no-fund \
        --progress=true \
        --loglevel=notice
else
    npm install \
        --registry=https://registry.npmjs.org/ \
        --replace-registry-host=never \
        --no-audit \
        --no-fund \
        --progress=true \
        --loglevel=notice
fi

echo "Frontend dependencies installed. Run ./dev1.sh from the project root."
