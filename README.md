# Welcome to React Router!

A modern, production-ready template for building full-stack React applications using React
Router.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 💻 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker,
including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is
production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a
simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.

## Share Image Backfill

Tạo lại ảnh chia sẻ (OG 1200×630) cho các truyện hiện có:

```bash
# Chạy thực tế trên toàn bộ dữ liệu
npm run backfill:share-images

# Chạy thử 10 phần tử đầu để kiểm tra
npm run backfill:share-images -- --limit=10 --dry-run

# Ép regenerate ngay cả khi shareImage đã tồn tại
npm run backfill:share-images -- --force
```

Tùy chọn CLI:

- `--dry-run`: chỉ log, không upload hoặc cập nhật DB.
- `--limit=<number>`: giới hạn số truyện xử lý (mặc định tất cả).
- `--force`: bỏ qua điều kiện thiếu `shareImage`, phù hợp khi muốn dựng lại 100% kho truyện.

Script sẽ tự kết nối MongoDB bằng `ENV.MONGO.URI`, dùng Sharp để render và MinIO/R2 để upload thông qua `uploadToPublicBucket`. Luồng chạy tuần tự để tránh quá tải dịch vụ ảnh.

## Auto-import truyện từ vi-hentai.pro

Script `scripts/import-vi-hentai.ts` cho phép admin kéo metadata (tiêu đề, mô tả, ảnh bìa, tag, nhóm dịch, view, số chương) từ một trang truyện `https://vi-hentai.pro/...` rồi tạo bản ghi `Manga` trong MongoDB.

```bash
# Chạy thử mà không ghi DB
npm run import:vi-hentai -- \
	--url=https://vi-hentai.pro/truyen/... \
	--owner=<mongoUserId> \
	--dry-run

# Tạo thật và auto-approve
npm run import:vi-hentai -- \
	--url=https://vi-hentai.pro/truyen/... \
	--owner=<mongoUserId> \
	--translation-team="học viện 2 ten" \
	--approve
```

Tùy chọn CLI chính:

- `--url`: URL truyện nguồn (bắt buộc).
- `--owner`/`--owner-id`: Mongo `ownerId` sẽ đứng tên truyện (bắt buộc).
- `--translation-team`: override tên nhóm dịch nếu trang nguồn thiếu.
- `--dry-run`: chỉ log payload, không insert DB.
- `--approve`: set `status = APPROVED` ngay sau khi import.
- `--skip-if-exists`: bỏ qua nếu đã có manga trùng `title` trong DB.
- `--user-status=completed|ongoing`: ép trạng thái người dùng, mặc định auto-map theo text "Tình trạng".
- `--content-type=cosplay|manga`: chọn `contentType`, mặc định `MANGA`.
- `--slug=<custom>`: dùng slug tùy chỉnh (mặc định auto-generate).

Script dùng `fetch` + `cheerio` để đọc OG meta/DOM nên tránh spam nhiều request liên tiếp (bị Cloudflare chặn). Nếu remote tag không khớp với `data/genres-full.json` script sẽ log và bỏ qua, yêu cầu còn lại ít nhất một tag hợp lệ.

## Admin: Chuyển quyền sở hữu truyện
## Role mới: Dịch giả (`DICHGIA`)

Mục đích: Gắn danh hiệu cho người dùng có vai trò dịch giả và mở khóa bulk-upload/bulk-download chương khi họ là chủ sở hữu truyện.

### Đặc điểm
- Quyền chung: giống hệt `USER` (không có quyền duyệt, ban, xóa, v.v.).
- Unlock bulk: khi `role === DICHGIA` và user là `ownerId` của manga đã được `APPROVED`.
- Badge hiển thị: mọi nơi hiển thị tên → thêm chuỗi “– Dịch giả” gradient tím chuyển động.

### Backend
- Thêm constant `ROLES.DICHGIA`.
- Helper mới: `isDichGia(role)` và `canBulkDownloadChapters(role, isOwner, status)`.
- Bulk logic sửa tại `manga.preview.$id.tsx`: `canBulk = canBulkDownloadChapters(userRole, isOwner, status)`.
- Route gán quyền: `POST /admin/roles/set-dichgia` (file `admin.roles.set-dichgia.tsx`). Chỉ `ADMIN`.
- Log: ghi vào `AdminActionLog` với action `SET_ROLE_DICHGIA`.

### UI Quản trị
- Tab mới “Dịch giả” tại `/admin/member?tab=dichgia`.
- Nút “Thêm” mở form nhập `userId`, submit gọi API trên.
- Danh sách: avatar – tên – badge.

### Test Cases
1. Admin/mod: luôn thấy bulk.
2. Dịch giả là owner + manga approved: thấy bulk.
3. Dịch giả không phải owner: không thấy bulk.
4. User thường (không phải owner): không thấy bulk.
5. Badge hiển thị nhất quán ở: chi tiết truyện (uploader), bình luận, trang quản trị thành viên.

### Auto-Approve
- Khi user có role `DICHGIA` tự đăng truyện (ownerId = user.id) thì truyện được tạo với `status = APPROVED` (bỏ qua quy trình duyệt).
- Log hành động: `AUTO_APPROVE_DICHGIA` trong `AdminActionLog`.

### Mở Rộng (tùy chọn sau này)
- Thêm revoke endpoint (`/admin/roles/unset-dichgia`).
- Thống kê số dịch giả.
- Badge động tinh chỉnh độ sáng trong dark mode.

Tính năng cho phép ADMIN chuyển quyền sở hữu (owner) của một truyện sang user khác.

### Endpoint (server action)

Gửi POST form tới route quản trị `'/admin/manga'` với các field:

```
action=transfer-owner
mangaId=<ID truyện>
newOwnerId=<ID user mới>
```

### Điều kiện & Bảo mật
- Chỉ `ADMIN` (không cho `MOD`).
- Kiểm tra sự tồn tại của manga và user mới, user mới không bị xóa hoặc ban.
- Từ chối nếu `newOwnerId` trùng với `ownerId` hiện tại.
- Cập nhật `ownerId` của manga + điều chỉnh `mangasCount` (−1 chủ cũ, +1 chủ mới).
- Ghi log vào collection `AdminActionLog` với action `TRANSFER_MANGA_OWNER`.

### UI
- Tại bảng `/admin/manga`, cột "Người đăng" có nút `Sửa`.
- Khi bấm `Sửa` sẽ hiện input nhập `ID user` và nút `Xác nhận` (kèm hộp thoại `confirm`).

### Phản hồi JSON
```
{ success: boolean, message: string }
```

### Lưu ý mở rộng
- Nếu sau này cần phân quyền chi tiết hơn, thay đổi logic kiểm tra từ `userInfo.role === 'ADMIN'` sang bảng quyền hoặc danh sách đặc biệt.
- Có thể mở rộng log (IP, userAgent) bằng cách thêm field trong model `AdminActionLog`.
