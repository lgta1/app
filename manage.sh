#!/bin/bash
# manage.sh - Script quản lý PM2 instances

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

PM2_USER="${PM2_USER:-devuser}"
RATE_LIMIT_SECONDS="${RATE_LIMIT_SECONDS:-600}"
RATE_LIMIT_STATE_FILE="${RATE_LIMIT_STATE_FILE:-/tmp/ww-manage-last-run}"
RATE_LIMIT_LOCK_FILE="${RATE_LIMIT_LOCK_FILE:-/tmp/ww-manage-lock}"

rate_limit_guard() {
  # Allow override for emergency operations
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
    echo "[guard] Recent manage.sh run detected. Try again in ${remaining}s (or set FORCE=1)." >&2
    exit 2
  fi

  echo "$now" > "$RATE_LIMIT_STATE_FILE"
}

with_lock() {
  # Prevent concurrent or rapid repeated runs
  exec 200>"$RATE_LIMIT_LOCK_FILE"
  if ! flock -n 200; then
    echo "[guard] Another manage.sh is running. Exiting." >&2
    exit 2
  fi
  rate_limit_guard
}

pm2_exec() {
  if [[ "$(id -un)" == "$PM2_USER" ]]; then
    pm2 "$@"
    return
  fi

  local cmd
  cmd="cd $(printf '%q' "$PROJECT_DIR") && pm2"
  for arg in "$@"; do
    cmd+=" $(printf '%q' "$arg")"
  done

  sudo -u "$PM2_USER" -H bash -lc "$cmd"
}

get_instances() {
  # Read from ecosystem.config.cjs: `const instances = N;`
  local n
  n=$(grep -E '^\s*const\s+instances\s*=\s*[0-9]+' ecosystem.config.cjs | head -n 1 | grep -Eo '[0-9]+' | head -n 1 || true)
  if [[ -z "$n" ]]; then
    echo 4
    return
  fi
  echo "$n"
}

app_names() {
  local n
  n=$(get_instances)
  local i
  for ((i=1; i<=n; i++)); do
    echo "ww-$i"
  done
}

rolling_pm2() {
  local action="$1"; shift
  local delay_s="${1:-5}"; shift || true

  local names=()
  while IFS= read -r name; do
    names+=("$name")
  done < <(app_names)

  local i
  for ((i=0; i<${#names[@]}; i++)); do
    local name="${names[$i]}"
    echo "[rolling] $action $name (${i}/${#names[@]})"
    # --update-env ensures refreshed env values from ecosystem/config
    if [[ "$action" == "start" ]]; then
      pm2_exec start ecosystem.config.cjs --only "$name" --update-env
    else
      pm2_exec "$action" "$name" --update-env
    fi
    if (( i < ${#names[@]} - 1 )); then
      sleep "$delay_s"
    fi
  done
}

case "$1" in
  start)
    with_lock
    # PM2 đôi khi bị trạng thái lỗi (process id bị lệch/mất), gây crash khi restart theo ecosystem.
    # Start theo kiểu idempotent: xoá instances cũ của dự án rồi start lại.
    pm2_exec delete ww-1 ww-2 ww-3 ww-4 >/dev/null 2>&1 || true
    pm2_exec start ecosystem.config.cjs
    ;;
  stop)
    pm2_exec stop all
    ;;
  restart)
    with_lock
    pm2_exec restart all
    ;;
  reload)
    with_lock
    pm2_exec reload all
    ;;
  rolling-restart)
    with_lock
    # Sequential restart ww-1..ww-N with delay (seconds, default=5)
    rolling_pm2 restart "${2:-5}"
    ;;
  rolling-start)
    with_lock
    # Sequential start ww-1..ww-N with delay (seconds, default=5)
    pm2_exec delete $(app_names) >/dev/null 2>&1 || true
    rolling_pm2 start "${2:-5}"
    ;;
  rolling-reload)
    with_lock
    # Sequential reload ww-1..ww-N with delay (seconds, default=5)
    rolling_pm2 reload "${2:-5}"
    ;;
  status)
    pm2_exec status
    ;;
  logs)
    pm2_exec logs
    ;;
  monitor)
    pm2_exec monit
    ;;
  scale)
    # Scale up/down số instances
    echo "Updating to $2 instances..."
    # Update số instances trong ecosystem.config.cjs
    sed -i "s/const instances = [0-9]*/const instances = $2/" ecosystem.config.cjs
    pm2_exec delete all
    pm2_exec start ecosystem.config.cjs
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|reload|rolling-start [delay_s]|rolling-restart [delay_s]|rolling-reload [delay_s]|status|logs|monitor|scale <number>}"
    exit 1
    ;;
esac
