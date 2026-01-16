#!/usr/bin/env bash
set -Eeuo pipefail

PM2_USER="${PM2_USER:-devuser}"

# Safety: never deploy/build/run PM2 as root (or any other user) by accident.
if [[ "$(id -un)" != "$PM2_USER" ]]; then
	script_path="$(readlink -f "${BASH_SOURCE[0]}")"
	echo "[deploy] Re-exec as $PM2_USER (current: $(id -un))" >&2
	exec sudo -iu "$PM2_USER" bash -lc "$(printf '%q' "$script_path")"
fi

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
