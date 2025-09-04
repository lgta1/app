#!/bin/bash
# manage.sh - Script quản lý PM2 instances

case "$1" in
  start)
    pm2 start ecosystem.config.cjs
    ;;
  stop)
    pm2 stop all
    ;;
  restart)
    pm2 restart all
    ;;
  reload)
    pm2 reload all
    ;;
  status)
    pm2 status
    ;;
  logs)
    pm2 logs
    ;;
  monitor)
    pm2 monit
    ;;
  scale)
    # Scale up/down số instances
    echo "Updating to $2 instances..."
    # Update số instances trong ecosystem.config.cjs
    sed -i "s/const instances = [0-9]*/const instances = $2/" ecosystem.config.cjs
    pm2 delete all
    pm2 start ecosystem.config.cjs
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|reload|status|logs|monitor|scale <number>}"
    exit 1
    ;;
esac
