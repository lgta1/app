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

## Vi-hentai auto-update bị “enqueued mãi” (kẹt lock)
### Triệu chứng
- Job auto-update/auto-download không chạy, queue cứ ở trạng thái `queued/enqueued` lâu.
- Nguyên nhân hay gặp: lock hệ thống `SystemLock` bị kẹt (crash/restart giữa chừng).

### Kiểm tra nhanh
Chạy dưới user `devuser` (khuyến nghị):

```bash
npm run ops:inspect-vi-hentai-jobs
```

### Clear lock nhanh (best-effort)
Nếu xác định không có queue/job thật sự đang chạy, có thể clear lock để cron lấy lại:

```bash
npm run ops:clear-system-lock -- vi-hentai-auto-update
```

Dry-run (chỉ xem trước, không ghi DB):

```bash
npm run ops:clear-system-lock -- vi-hentai-auto-update --dry-run
```

## ENV chuẩn (.env.production)
- MONGO_URL / MONGODB_URI / MONGO_URI / MONGODB_URL / DATABASE_URL
  đều trỏ: `...mongodb.net/ww?...`
- DB_NAME=ww, NODE_ENV=production, PORT=3000

## Ghi chú
- Không dùng `node build/server/index.js` trực tiếp (không mở HTTP).
- Không chạy song song react-router-serve/PM2 ở user `root`.

## Hợp nhất www & non-www (ưu tiên cao)
### Hiện tượng
- Nếu cả `vinahentai.online` và `www.vinahentai.online` đều serve nội dung, analytics có thể ghi nhận **self-referral** (2 hostname coi như 2 site).
- Cookie session dạng **host-only** (không set `Domain=`) có thể làm user bị “logout” khi nhảy qua hostname khác.

### Mục tiêu
- Chọn canonical: **non-www** `https://vinahentai.online`
- Ép redirect **301 triệt để**: `https://www.vinahentai.online/*` → `https://vinahentai.online/*`

### Cách 1: Nginx 301 (khuyến nghị)
Tách riêng server block cho `www` để redirect về non-www. Ví dụ (giữ nguyên ACME path):

```nginx
# 1) HTTP -> HTTPS + hợp nhất www
server {
  listen 80;
  server_name www.vinahentai.online;
  location ~ /.well-known/acme-challenge { allow all; root /var/www/html; }
  return 301 https://vinahentai.online$request_uri;
}

server {
  listen 80;
  server_name vinahentai.online;
  location ~ /.well-known/acme-challenge { allow all; root /var/www/html; }
  return 301 https://vinahentai.online$request_uri;
}

# 2) HTTPS hợp nhất www
server {
  listen 443 ssl;
  server_name www.vinahentai.online;
  location ~ /.well-known/acme-challenge { allow all; root /var/www/html; }
  return 301 https://vinahentai.online$request_uri;
}

# 3) HTTPS canonical (proxy về app)
server {
  listen 443 ssl;
  server_name vinahentai.online;
  location ~ /.well-known/acme-challenge { allow all; root /var/www/html; }
  location / {
    proxy_pass http://ww_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

### Cách 2: Cloudflare Redirect Rule (nếu dùng CF trước Nginx)
- Rule: If hostname equals `www.vinahentai.online` → 301 to `https://vinahentai.online${uri}`

### Ghi chú về “logout”
- Có thể xảy ra **một lần** khi user đang ở `www` mà cookie được set ở `vinahentai.com` (hoặc ngược lại).
- Sau khi redirect triệt để, user sẽ ổn định trên canonical host và đăng nhập lại là xong.

### Kiểm tra sau khi áp dụng
```bash
curl -I https://www.vinahentai.online/ | head
curl -I https://www.vinahentai.online/danh-sach | head
```
- Kỳ vọng: status `301` và `Location: https://vinahentai.online/...`

## Checklist đổi domain + CDN (để làm nhanh lần sau)
### 1) Cloudflare (ưu tiên cao)
- Redirect Rules:
  - `www.vinahentai.online/*` → `https://vinahentai.online${uri}` (301)
  - (migrate domain) `vinahentai.top/*` → `https://vinahentai.online${uri}` (301) và `www.vinahentai.top/*` tương tự
  - (migrate domain) `vinahentai.xyz/*` → `https://vinahentai.online${uri}` (301) và `www.vinahentai.xyz/*` tương tự
  - (migrate domain) `vinahentai.com/*` → `https://vinahentai.online${uri}` (301) và `www.vinahentai.com/*` tương tự
- DNS:
  - `@` và `www` ở zone mới phải **proxied** (orange cloud) nếu muốn rules áp dụng ở edge

### 2) App env (PM2)
- `CANONICAL_ORIGIN=https://vinahentai.online`
- `VITE_CANONICAL_ORIGIN=https://vinahentai.online`
- `COOKIE_DOMAIN=` (để trống, dùng host-only cookie)
- `CDN_BASE=https://cdn.vinahentai.online`
- `VITE_CDN_BASE=https://cdn.vinahentai.online`

### 3) Xử lý dữ liệu legacy CDN trong DB
- Chạy migration rewrite URL (mặc định dry-run):
  - `npm run migrate:cdn-host`
- Sau khi xác nhận dry-run đúng, chạy bản cập nhật thật (bỏ `--dry-run`) theo hướng dẫn trong script:
  - `scripts/migrate-cdn-host.ts`

### 4) Verify (bắt buộc)
- Redirect:
  - `curl -I https://www.vinahentai.online/` phải ra 301
  - `curl -I https://vinahentai.top/` phải ra 301
  - `curl -I https://vinahentai.xyz/` phải ra 301
  - `curl -I https://vinahentai.com/` phải ra 301 (nếu còn giữ domain cũ)
- HTML không còn leak host cũ:
  - `curl -sS https://vinahentai.online/ | grep -Eo 'cdn\.vinahentai\.(top|xyz|com)|cdn\.hoangsatruongsalacuavietnam\.site|www\.vinahentai\.(top|xyz|com)' | head`
- Cookie/session:
  - Kiểm tra `Set-Cookie` không có `Domain=` (host-only, prod)

## Cloudflare cache (thực tế sau thay đổi)
### HTML (cache theo từng trang)
- Origin đã trả `Cache-Control` cho HTML (chỉ áp dụng khi ẩn danh; nếu có cookie `__session` thì luôn `private, no-store`).
- TTL edge (s-maxage) đang là:
  - `/` : 2 phút
  - `/danh-sach` : 10 phút
  - `/genres` : 1 giờ
  - `/genres/*` : 20 phút
  - `/truyen-hentai` : 1 giờ
  - `/truyen-hentai/:slug` : 5 phút
  - `/truyen-hentai/:mangaSlug/:chapterSlug` : 30 phút

### Lưu ý quan trọng
  - Condition: path thuộc allowlist ở trên **và** `http.request.headers["cookie"]` **không** chứa `__session=`
  - Action: Eligible for cache (Cache Everything)
  - Edge TTL: Respect origin
  - Browser TTL: Respect origin

### Endpoint API user-state của chapter
- Route: `/api/chapter/user-state*`
- Mục tiêu: **anonymous cache ở edge**, còn request có `__session` thì **bypass cache** (dynamic/personalized).
- Rule gợi ý trên Cloudflare:
  - Rule 1 (ưu tiên cao): If `http.request.uri.path starts_with "/api/chapter/user-state"` AND `http.cookie contains "__session="` → **Bypass cache**
  - Rule 2: If `http.request.uri.path starts_with "/api/chapter/user-state"` → **Eligible for cache**
  - Origin header hiện tại đã trả `public, s-maxage=120, stale-while-revalidate=60` cho anonymous và `no-store` cho logged-in.
  - Nếu chưa có 2 rule trên, DevTools thường sẽ thấy `CF-Cache-Status: DYNAMIC` dù response có header cache.

### /__manifest (request “nóng”)
- `/__manifest?...` là request do React Router lazy route discovery.
- Hiện tại app đã cấu hình `routeDiscovery: { mode: "initial" }` nên HTML không còn tham chiếu tới `/__manifest` nữa (giảm hẳn request “nóng”).
- Endpoint `/__manifest` vẫn có thể trả `204`, nhưng không còn là hotspot nếu client không gọi.

## Cloudflare Insights / beacon.min.js bị lỗi (trên trình duyệt)
- Script `https://static.cloudflareinsights.com/beacon.min.js` là Cloudflare Web Analytics.
- Nó đang xuất hiện trên **domain thật** nhưng **không** xuất hiện khi gọi trực tiếp origin nội bộ → khả năng cao được chèn bởi Cloudflare (Web Analytics/Zaraz).
- Trên Brave/Adblock thường bị chặn (ERR_BLOCKED_BY_CLIENT) nên Network sẽ đỏ ở mọi trang.
- Ảnh hưởng: **không hỏng website**, chỉ mất dữ liệu analytics cho những người dùng chặn tracker và thêm 1 request fail.
- Cách “fix để hết lỗi” (cần thao tác trên Cloudflare dashboard): tắt Cloudflare Web Analytics snippet (hoặc Zaraz/HTML injection) để không chèn script nữa.
