# Sitemap (SEO) – Vinahentai.top

## Mục tiêu
- Có **1 sitemap index** duy nhất để submit lên Google Search Console.
- Chia nhỏ sitemap theo **logic crawl budget** (hub → taxonomy → detail → chapter).
- URL luôn **canonical, HTTPS**, không query dư thừa.
- Không đưa URL admin/nội bộ/legacy redirect/noindex.

## Cấu trúc sitemap triển khai
- `sitemap_index.xml` (index)
  - `sitemap-static.xml` (home + hub pages)
  - `sitemap-rankings.xml` (leaderboard pages – daily/weekly/monthly là tab trong 1 URL canonical)
  - `sitemap-genres.xml` (khoảng ~200 genre)
  - `sitemap-comics.xml` (~3k manga detail)
  - `sitemap-chapters-1.xml`, `sitemap-chapters-2.xml`, ... (~30k chapter read URLs, split 10k/file)
  - `sitemap-users.xml` (subset profile user – mặc định top 1000 để tránh thin/spam)
  - `sitemap-entities.xml` (authors/translators/characters/doujinshi – page 1 canonical, không query)

## Generate sitemap
### Chạy thủ công
- `npm run sitemap:generate`

Mặc định script sẽ ghi vào thư mục `build/client` (static root của `react-router-serve`).
Nếu chưa có `build/client`, nó sẽ fallback ghi vào `public`.

### Tuỳ chọn env
- `SITEMAP_OUTPUT_DIR`: thư mục output (ví dụ: `build/client`)
- `SITEMAP_CHAPTERS_PER_FILE`: mặc định `10000`
- `SITEMAP_MAX_USER_PROFILES`: mặc định `1000`

## Tự động cập nhật (cron trong app)
- Job `initSitemapScheduler()` chạy **mỗi giờ** (phút 15) ở 1 instance primary:
  - Primary được xác định bởi `SITEMAP_SCHEDULER=1` hoặc `LEADERBOARD_SCHEDULER=1` hoặc `PORT=3001`.

## Robots
- `public/robots.txt` trỏ tới `https://vinahentai.top/sitemap_index.xml`

## Gợi ý submit lên GSC
- Chỉ submit **1 URL**: `https://vinahentai.top/sitemap_index.xml`
- Khi có thay đổi lớn (migrate domain/CDN, đổi cấu trúc URL): regenerate ngay và kiểm tra lỗi trong GSC.

## Lỗi thường gặp
- Đưa URL redirect/duplicate vào sitemap (Google sẽ đánh giá chất lượng thấp).
- Cho vào URL có query params `?page=...&sort=...`.
- Sitemap quá lớn không chia file (50k URL / 50MB).
- lastmod sai (tương lai/không phải ISO 8601) → bị bỏ qua.
- Đưa trang yêu cầu login hoặc nội dung mỏng quá nhiều (profile/user) → lãng phí crawl budget.
