#!/bin/bash

echo "=== Test từng cấu hình để tìm nguyên nhân ==="

# Dừng tất cả PM2
pm2 stop all
pm2 delete all

# Test 1: Script node trực tiếp
echo "1. Test script node trực tiếp..."
pm2 start ecosystem.test1.config.cjs
sleep 15
pm2 status
echo "Test HTTP port 3000:"
curl -s http://localhost:3000 > /dev/null && echo "✅ OK" || echo "❌ FAIL"
pm2 stop ww-test1
pm2 delete ww-test1

# Test 2: Autorestart true
echo "2. Test autorestart true..."
pm2 start ecosystem.test2.config.cjs
sleep 15
pm2 status
echo "Test HTTP port 3001:"
curl -s http://localhost:3001 > /dev/null && echo "✅ OK" || echo "❌ FAIL"
pm2 stop ww-test2
pm2 delete ww-test2

# Test 3: Memory và timeout settings
echo "3. Test memory và timeout settings..."
pm2 start ecosystem.test3.config.cjs
sleep 15
pm2 status
echo "Test HTTP port 3002:"
curl -s http://localhost:3002 > /dev/null && echo "✅ OK" || echo "❌ FAIL"
pm2 stop ww-test3
pm2 delete ww-test3

# Test 4: NODE_OPTIONS
echo "4. Test NODE_OPTIONS..."
pm2 start ecosystem.test4.config.cjs
sleep 15
pm2 status
echo "Test HTTP port 3003:"
curl -s http://localhost:3003 > /dev/null && echo "✅ OK" || echo "❌ FAIL"
pm2 stop ww-test4
pm2 delete ww-test4

echo "=== Kết thúc test ==="
echo "Kiểm tra kết quả để xem config nào gây lỗi" 