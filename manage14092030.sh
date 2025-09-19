#!/usr/bin/env bash
set -Eeuo pipefail
cd /home/devuser/ww-new

# Nạp ENV chuẩn nếu có (khóa Atlas /ww, PORT=3000…)
if [ -f ./.env.production ]; then
  set -a
  . ./.env.production
  set +a
fi
: "${PORT:=3000}"   # mặc định 3000 nếu chưa đặt

case "$1" in
  start)
    # chạy đúng runner đang ổn định
    pm2 start /home/devuser/ww-new/node_modules/.bin/react-router-serve --name ww -- \
      /home/devuser/ww-new/build/server/index.js --port "$PORT"
    pm2 save
    ;;
  stop)
    pm2 stop ww || true
    ;;
  restart)
    pm2 restart ww --update-env || pm2 start /home/devuser/ww-new/node_modules/.bin/react-router-serve --name ww -- \
      /home/devuser/ww-new/build/server/index.js --port "$PORT"
    pm2 save
    ;;
  reload)
    pm2 reload ww || true
    ;;
  status)
    pm2 describe ww || pm2 ls
    ;;
  logs)
    pm2 logs ww
    ;;
  monitor)
    pm2 monit
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|reload|status|logs|monitor}"
    exit 1
    ;;
esac

