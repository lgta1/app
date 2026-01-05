# ww-new — Runbook vận hành (prod)

## Tiêu chuẩn
- App chạy qua PM2, user: `devuser`, nhiều instances (hiện tại: 2)
- Ports nội bộ: `3001`, `3002` (tăng thêm khi scale)
- Nginx reverse-proxy + load-balance tới các port nội bộ
- Kiểm chứng nhanh: `curl -sS http://127.0.0.1:3001/api/genres/debug | jq` (hoặc `:3002`)

## Lệnh thường dùng
# trạng thái
pm2 ls
pm2 logs ww-1 --lines 200

# restart sau deploy build mới
pm2 restart all --update-env && pm2 save

# xem listener
ss -ltnp | grep -E ':(3001|3002)'

## Nginx flow (tóm tắt)
- Client -> Nginx (80/443)
- Nginx -> upstream (127.0.0.1:3001, :3002, ...)

## ENV chuẩn (.env.production)
- MONGO_URL / MONGODB_URI / MONGO_URI / MONGODB_URL / DATABASE_URL
  đều trỏ: `...mongodb.net/ww?...`
- DB_NAME=ww, NODE_ENV=production
- Tuning pool (để scale an toàn hơn):
  - `MONGO_MAX_POOL_SIZE` (mặc định: 100)
  - `MONGO_MIN_POOL_SIZE` (mặc định: 0)

## Ghi chú quan trọng về env của PM2
- PM2 chỉ nhận env khi start/restart với `--update-env`.
- Nếu đang dùng `.env.production`, cần đảm bảo host MongoDB resolve được DNS trước khi restart.

## Ghi chú
- Không dùng `node build/server/index.js` trực tiếp (không mở HTTP).
- Không chạy song song react-router-serve/PM2 ở user `root`.
