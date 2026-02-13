# Sitemap (SEO) – Vinahentai.online

## Mục tiêu
- Có **1 sitemap index** duy nhất để submit lên Google Search Console.
- Chia nhỏ sitemap theo **logic crawl budget** (hub → taxonomy → detail → chapter).
- URL luôn **canonical, HTTPS**, không query dư thừa.
- Không đưa URL admin/nội bộ/legacy redirect/noindex.

## Cấu trúc sitemap triển khai
- `sitemap_index_fun.xml` (index)
  - `sitemap-static_fun.xml` (home + hub pages)
  - `sitemap-rankings_fun.xml` (leaderboard pages – daily/weekly/monthly là tab trong 1 URL canonical)
  - `sitemap-genres_fun.xml` (khoảng ~200 genre)
  - `sitemap-comics_fun.xml` (~3k manga detail)
  - `sitemap-chapters-1_fun.xml`, `sitemap-chapters-2_fun.xml`, ... (~30k chapter read URLs, split 10k/file)
  - `sitemap-users_fun.xml` (subset profile user – mặc định top 1000 để tránh thin/spam)
  - `sitemap-entities_fun.xml` (authors/translators/characters/doujinshi – page 1 canonical, không query)

## Cập nhật sitemap (thủ công)
- Sitemap hiện được **duy trì thủ công** bằng cách chỉnh sửa trực tiếp các file XML trong `build/client` (hoặc `public` nếu cần).
- Khi có cập nhật lớn (truyện mới/chapters mới/genre mới), hãy cập nhật các file sitemap tương ứng và thay `lastmod`.
- Không có cron/job hoặc script tự động trong hệ thống.

## Robots
- `public/robots.txt` trỏ tới `https://vinahentai.online/sitemap_index_fun.xml`

## Gợi ý submit lên GSC
- Chỉ submit **1 URL**: `https://vinahentai.online/sitemap_index_fun.xml`
- Khi có thay đổi lớn (migrate domain/CDN, đổi cấu trúc URL): regenerate ngay và kiểm tra lỗi trong GSC.

## Lỗi thường gặp
- Đưa URL redirect/duplicate vào sitemap (Google sẽ đánh giá chất lượng thấp).
- Cho vào URL có query params `?page=...&sort=...`.
- Sitemap quá lớn không chia file (50k URL / 50MB).
- lastmod sai (tương lai/không phải ISO 8601) → bị bỏ qua.
- Đưa trang yêu cầu login hoặc nội dung mỏng quá nhiều (profile/user) → lãng phí crawl budget.
