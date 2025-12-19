#!/bin/bash
# manage.sh - Script quản lý PM2 instances

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

PM2_USER="${PM2_USER:-devuser}"

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

case "$1" in
  start)
    # PM2 đôi khi bị trạng thái lỗi (process id bị lệch/mất), gây crash khi restart theo ecosystem.
    # Start theo kiểu idempotent: xoá instances cũ của dự án rồi start lại.
    pm2_exec delete ww-1 ww-2 >/dev/null 2>&1 || true
    pm2_exec start ecosystem.config.cjs
    ;;
  stop)
    pm2_exec stop all
    ;;
  restart)
    pm2_exec restart all
    ;;
  reload)
    pm2_exec reload all
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
    echo "Usage: $0 {start|stop|restart|reload|status|logs|monitor|scale <number>}"
    exit 1
    ;;
esac
