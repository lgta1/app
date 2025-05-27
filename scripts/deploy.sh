#!/bin/bash

echo "=== Deploy ứng dụng lên Ubuntu Server ==="

# Dừng PM2 nếu đang chạy
echo "Dừng PM2..."
pm2 stop ww 2>/dev/null || echo "PM2 chưa chạy"
pm2 delete ww 2>/dev/null || echo "Process ww không tồn tại"

# Tạo thư mục logs
echo "Tạo thư mục logs..."
mkdir -p logs

# Kiểm tra build
if [ ! -f "./build/server/index.js" ]; then
    echo "❌ Build thất bại - server file không tồn tại"
    exit 1
fi

# Khởi động PM2
echo "Khởi động PM2..."
pm2 start ecosystem.config.cjs

# Kiểm tra status
echo "Kiểm tra status..."
sleep 5
pm2 status

# Hiển thị logs
echo "Logs gần đây:"
pm2 logs ww --nostream --lines 10

echo "=== Deploy hoàn tất ==="
echo "Kiểm tra ứng dụng tại: http://localhost:3000"