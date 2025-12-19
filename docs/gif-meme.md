# GIF Meme Picker (Nhóm + Manifest)

Picker cho phép chọn GIF lưu trên CDN và đính kèm vào bình luận. Client chỉ cần đọc `manifest.json`; không cần build lại app khi thêm GIF mới.

## Vị trí & Thứ tự ưu tiên
1. CDN: `<CDN_BASE>/gif-meme/manifest.json` (nên dùng)
2. Fallback local: `/public/gif-meme/manifest.json`

## 3 Kiểu Manifest Hỗ Trợ
1. Legacy (mảng):
```json
[
  "troll-face.gif",
  "rage-angry.gif"
]
```
2. Legacy (object):
```json
{ "files": ["troll-face.gif", "rage-angry.gif"] }
```
3. Grouped (khuyên dùng):
```json
{
  "version": 2,
  "groups": [
    { "id": "rage", "title": "Rage Faces", "thumb": "rage-thumb.webp", "items": ["troll-face.gif", "rage-angry.gif"] },
    { "id": "anime", "title": "Anime Emotes", "thumb": "anime-thumb.webp", "items": ["waifu-happy.gif", "waifu-sad.gif"] }
  ]
}
```
Ghi chú:
- `thumb` có thể là URL tuyệt đối hoặc tương đối (so với thư mục `gif-meme/`).
- Bỏ `thumb` nếu chưa có thumbnail: picker sẽ hiển thị text rút gọn.

## Quy Ước Tên File
- Dùng `-` thay cho khoảng trắng (ví dụ: `troll-face.gif`).
- Chỉ GIF: không đưa PNG/JPG nếu không dùng.

## Thêm GIF Mới
1. Upload GIF vào CDN: thư mục `gif-meme/`.
2. Cập nhật file manifest JSON (thêm vào `items` nhóm tương ứng).
3. Purge cache CDN cho `manifest.json` (rất quan trọng).
4. Mở lại picker (đóng/mở) hoặc hard refresh.

## Script Tạo Manifest Tự Động (mẫu)
```js
// generate-gif-manifest.mjs
import { readdirSync, writeFileSync } from 'fs';
const baseDir = './public/gif-meme';
const files = readdirSync(baseDir).filter(f => f.endsWith('.gif'));
const groups = [{ id: 'all', title: 'Tất cả', items: files }];
writeFileSync(baseDir + '/manifest.json', JSON.stringify({ version: 2, groups }, null, 2));
console.log('Manifest generated with', files.length, 'GIF');
```

## Debug Nếu Không Hiện GIF
| Vấn đề | Kiểm tra | Hướng xử lý |
|--------|----------|-------------|
| Không thấy GIF mới | Mở URL manifest trực tiếp | Chưa cập nhật hoặc chưa purge cache |
| Picker trống | Sai từ khóa hoặc nhóm rỗng | Xóa ô tìm kiếm / kiểm tra manifest |
| Thumbnail mất | Sai tên `thumb` | Mở URL thumbnail để kiểm tra |

## Bảo Trì & Hiệu Năng
- Giữ mỗi nhóm vài chục tới vài trăm GIF; quá lớn → tách nhóm.
- Dùng thumbnail WebP nhẹ thay cho GIF gốc ở phần chọn nhóm.
- Thêm trường `updatedAt` (optional) nếu muốn tracer thời điểm cập nhật.

## Bảo Mật
- Client chỉ render GIF khớp pattern `/gif-meme/*.gif` để tránh lạm dụng.

## TL;DR
Upload GIF → Sửa `manifest.json` nhóm → Purge cache → Reload picker.

> Format cũ vẫn chạy; nâng cấp lên format nhóm để có UI thumbnail ở trên.

