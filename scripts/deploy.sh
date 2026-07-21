#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$APP_ROOT"

echo "[majid-backend] Installing dependencies"
npm ci

echo "[majid-backend] Building app"
npm run build

echo "[majid-backend] Restarting PM2 process"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "[majid-backend] Deployment finished"
