#!/usr/bin/env bash
set -Eeuo pipefail
cd /home/devuser/ww-new

# 1) cập nhật mã
git pull --ff-only

# 2) cài deps & build
npm ci
npm run build

# 3) restart duy nhất app ww qua PM2
pm2 restart ww --update-env
pm2 save

# 4) smoke test nhanh
curl -sS http://127.0.0.1:3000/api/genres/debug | jq
