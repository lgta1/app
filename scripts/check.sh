#!/bin/bash

echo "=== Kiểm tra môi trường Ubuntu ==="

# Kiểm tra Node.js
echo "Node.js version:"
node --version || echo "❌ Node.js chưa được cài đặt"

# Kiểm tra npm
echo "npm version:"
npm --version || echo "❌ npm chưa được cài đặt"

# Kiểm tra PM2
echo "PM2 version:"
pm2 --version || echo "❌ PM2 chưa được cài đặt"

# Kiểm tra build folder
echo "Kiểm tra build folder:"
if [ -d "./build" ]; then
    echo "✅ Build folder tồn tại"
    ls -la ./build/
else
    echo "❌ Build folder không tồn tại - cần chạy npm run build"
fi

# Kiểm tra server file
echo "Kiểm tra server file:"
if [ -f "./build/server/index.js" ]; then
    echo "✅ Server file tồn tại"
else
    echo "❌ Server file không tồn tại"
fi

# Kiểm tra dependencies
echo "Kiểm tra node_modules:"
if [ -d "./node_modules" ]; then
    echo "✅ node_modules tồn tại"
else
    echo "❌ node_modules không tồn tại - cần chạy npm install"
fi

# Kiểm tra port 3000
echo "Kiểm tra port 3000:"
if lsof -i :3000 > /dev/null 2>&1; then
    echo "⚠️ Port 3000 đang được sử dụng"
    lsof -i :3000
else
    echo "✅ Port 3000 trống"
fi

echo "=== Kết thúc kiểm tra ==="