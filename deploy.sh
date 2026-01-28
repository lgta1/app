#!/usr/bin/env bash
set -Eeuo pipefail

PM2_USER="${PM2_USER:-devuser}"
RATE_LIMIT_SECONDS="${RATE_LIMIT_SECONDS:-600}"
RATE_LIMIT_STATE_FILE="${RATE_LIMIT_STATE_FILE:-/tmp/ww-deploy-last-run}"
RATE_LIMIT_LOCK_FILE="${RATE_LIMIT_LOCK_FILE:-/tmp/ww-deploy-lock}"

rate_limit_guard() {
	if [[ "${FORCE:-}" == "1" || "${FORCE:-}" == "true" ]]; then
		return
	fi

	local now last
	now=$(date +%s)
	last=0
	if [[ -f "$RATE_LIMIT_STATE_FILE" ]]; then
		last=$(cat "$RATE_LIMIT_STATE_FILE" 2>/dev/null || echo 0)
	fi

	if (( now - last < RATE_LIMIT_SECONDS )); then
		local remaining=$(( RATE_LIMIT_SECONDS - (now - last) ))
		echo "[guard] Recent deploy detected. Try again in ${remaining}s (or set FORCE=1)." >&2
		exit 2
	fi

	echo "$now" > "$RATE_LIMIT_STATE_FILE"
}

with_lock() {
	exec 200>"$RATE_LIMIT_LOCK_FILE"
	if ! flock -n 200; then
		echo "[guard] Another deploy is running. Exiting." >&2
		exit 2
	fi
	rate_limit_guard
}

# Safety: never deploy/build/run PM2 as root (or any other user) by accident.
if [[ "$(id -un)" != "$PM2_USER" ]]; then
	script_path="$(readlink -f "${BASH_SOURCE[0]}")"
	echo "[deploy] Re-exec as $PM2_USER (current: $(id -un))" >&2
	exec sudo -iu "$PM2_USER" bash -lc "$(printf '%q' "$script_path")"
fi

with_lock

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
