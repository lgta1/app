# ww-new — Runbook vận hành (prod)

## Tiêu chuẩn
- 1 app duy nhất qua PM2, user: `devuser`, port: `3000`
- DB: Atlas `ww` (URI có đuôi `/ww`)
- Kiểm chứng nhanh: `curl -sS http://127.0.0.1:3000/api/genres/debug | jq` → count = 111

## Lệnh thường dùng
# trạng thái
pm2 ls
pm2 logs ww --lines 200

# restart sau deploy build mới
pm2 restart ww --update-env && pm2 save

# xem listener
ss -ltnp | grep ':3000'

## ENV chuẩn (.env.production)
- MONGO_URL / MONGODB_URI / MONGO_URI / MONGODB_URL / DATABASE_URL
  đều trỏ: `...mongodb.net/ww?...`
- DB_NAME=ww, NODE_ENV=production, PORT=3000

## Ghi chú
- Không dùng `node build/server/index.js` trực tiếp (không mở HTTP).
- Không chạy song song react-router-serve/PM2 ở user `root`.
