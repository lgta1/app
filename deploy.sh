#!/usr/bin/env bash
set -Eeuo pipefail
cd /home/devuser/ww-new

# 1) cập nhật mã
git pull --ff-only

# 2) cài deps & build
npm ci
npm run build

# 3) reload app qua PM2 (multi-instance: ww-1..ww-4)
./manage.sh rolling-restart 5

# 4) smoke test nhanh
curl -sS http://127.0.0.1:3001/api/genres/debug | jq
