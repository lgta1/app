# 🔒 File Storage Integration cho React Router V7

Hỗ trợ cả **MinIO** và **Cloudflare R2** với single bucket + prefix path approach và
unified functions.

## Quick Start

### 1. Cài đặt Storage

#### Option A: MinIO (Self-hosted)

```bash
docker run -d -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  quay.io/minio/minio server /data --console-address ":9001"
```

#### Option B: Cloudflare R2 (Recommended)

1. Đăng nhập Cloudflare Dashboard → R2 Object Storage
2. Tạo bucket (ví dụ: `my-app-storage`)
3. Tạo R2 API Token với quyền Object Read/Write
4. Copy Account ID, Access Key, Secret Key

### 2. Tạo file .env (Server-only)

#### MinIO Configuration:

```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_DEFAULT_BUCKET=uploads
```

#### Cloudflare R2 Configuration:

```env
MINIO_ENDPOINT=account-id.r2.cloudflarestorage.com
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your_r2_access_key
MINIO_SECRET_KEY=your_r2_secret_key
MINIO_DEFAULT_BUCKET=my-app-storage
# PORT không cần thiết cho R2
```

## Architecture

### File Structure

```
app/
├── .server/configs/
│   └── minio.config.ts      # ✅ Config thuần túy
└── utils/
    └── minio.utils.ts       # ✅ Tất cả logic functions
```

### Code Organization

```typescript
// minio.utils.ts structure:
├── 📦 CONSTANTS & TYPES
│   ├── Error helpers
│   ├── MIME types (60+ formats)
│   └── Interfaces
├── ⚙️ UTILITY HELPERS
│   ├── createFullPath() / parseFullPath()
│   ├── generateUniqueFileName()
│   ├── getMimeTypeFromExtension()
│   └── Validation functions
├── 🔌 CLIENT & CONNECTION
│   ├── getMinioClient() - Unified client
│   └── isUsingCloudflareR2()
├── 🌐 URL GENERATION
│   ├── getPublicFileUrl() - Auto-detect MinIO/R2
│   └── getFileUrl() - Unified presigned URLs
└── 📁 CORE FILE OPERATIONS
    ├── uploadToPublicBucket() / uploadFile()
    ├── downloadFile() / deleteFile(s)
    ├── getFileInfo() / listFiles()
    └── fileExists() / copyFile() / moveFile()
```

## File Organization

### Single Bucket + Prefix Path Approach

Thay vì sử dụng nhiều buckets, hệ thống sử dụng **1 bucket duy nhất** với **prefix paths**
để phân loại:

```
├── images/avatars/user-123-avatar.jpg
├── images/covers/manga-456-cover.png
├── documents/pdfs/user-guide.pdf
├── videos/trailers/anime-trailer.mp4
└── temp/uploads/processing-file.jpg
```

**Lợi ích:**

- ✅ Tương thích tốt với Cloudflare R2
- ✅ Dễ quản lý và backup
- ✅ URL structure rõ ràng
- ✅ Unified functions cho cả MinIO & R2
- ✅ Không cần setup nhiều buckets

## Core Functions

### Unified Storage Functions

All functions automatically detect and handle both MinIO and Cloudflare R2:

```typescript
import {
  getMinioClient,
  isUsingCloudflareR2,
  getPublicFileUrl,
  getFileUrl,
  uploadToPublicBucket,
  uploadFile,
  downloadFile,
  deleteFile,
  getFileInfo,
  listFiles,
} from "~/utils/minio.utils";

// Auto-detect storage type
const isR2 = isUsingCloudflareR2(); // true for R2, false for MinIO

// Unified URL generation
const publicUrl = getPublicFileUrl("images/avatar.jpg");
// MinIO: http://localhost:9000/uploads/images/avatar.jpg
// R2: https://pub-bucket.r2.dev/images/avatar.jpg

const privateUrl = await getFileUrl("documents/private.pdf", {
  expires: 3600,
  isPublic: false,
});
// Presigned URL works for both MinIO & R2

// Unified upload
const result = await uploadToPublicBucket(file, "avatar.jpg", {
  prefixPath: "images/avatars",
  generateUniqueFileName: true,
});
```

### Utility Helpers

```typescript
import {
  createFullPath,
  parseFullPath,
  generateUniqueFileName,
  getMimeTypeFromExtension,
  validateFileFormat,
  validateFileSize,
} from "~/utils/minio.utils";

// Path helpers
const fullPath = createFullPath("avatar.jpg", "images/users");
// → "images/users/avatar.jpg"

const { fileName, prefixPath } = parseFullPath("images/users/avatar.jpg");
// → { fileName: "avatar.jpg", prefixPath: "images/users" }

// File helpers
const uniqueName = generateUniqueFileName("photo.jpg");
// → "photo-1640995200000-abc123.jpg"

const mimeType = getMimeTypeFromExtension("document.pdf");
// → "application/pdf"

// Validation
const isValidFormat = validateFileFormat("image.jpg", ["jpg", "png"]);
const isValidSize = validateFileSize(1024000, 10485760); // 1MB <= 10MB
```

## API Reference

### 1. Upload File

**Route**: `POST /api/files/upload`

**Parameters**:

- `file`: File to upload (multipart/form-data)
- `prefixPath`: Directory path (optional, default: "uploads")

**Response**:

```typescript
{
  success: boolean;
  data: {
    objectName: string; // Original filename
    fullPath: string; // Complete path (prefixPath/filename)
    url: string; // Public URL
    prefixPath: string; // Directory path
    size: number;
    type: string;
    originalName: string;
    isPublic: boolean;
  }
  message: string;
}
```

### 2. List Files

**Route**: `GET /api/files/list`

**Query Parameters**:

- `prefixPath`: Directory path filter (default: "")
- `limit`: Max files to return (default: 100)
- `recursive`: Recursive listing (default: false)

**Response**:

```typescript
{
  success: boolean;
  data: FileInfo[];
  message: string;
  meta: {
    prefixPath: string;
    count: number;
    limit: number;
  };
}
```

### 3. Delete File(s)

**Route**: `POST /api/files/delete`

**Parameters**:

- `fullPath`: Single file path (for single delete)
- `fullPaths`: JSON array of file paths (for bulk delete)

**Response**:

```typescript
{
  success: boolean;
  data: {
    deletedCount: number;
    deletedItems: string[]; // Full paths of deleted files
  };
  message: string;
}
```

### 4. Download File

**Route**: `GET /api/files/download`

**Query Parameters**:

- `fullPath`: File path (required)
- `download`: Set to "true" for direct download (default: false)

**Response**:

- If `download=true`: File stream
- If `download=false`: Public URL

```typescript
{
  success: boolean;
  data: {
    downloadUrl: string;
    fullPath: string;
    isPublic: boolean;
    fileInfo: {
      name: string;
      fullPath: string;
      size: number;
      contentType: string;
      lastModified: string;
      url: string;
      prefixPath?: string;
    }
  }
  message: string;
}
```

## Hook Usage

### useFileOperations

```typescript
import { useFileOperations } from "~/hooks/use-file-operations";

function MyComponent() {
  const {
    uploadFile, // Với navigation
    uploadFileWithFetcher, // Không có navigation
    deleteFile,
    deleteFiles,
    downloadFile,
    isUploading,
    isDeleting,
    isLoading,
  } = useFileOperations();

  // Upload file
  const handleUpload = (file: File) => {
    uploadFileWithFetcher(file, {
      prefixPath: "images/avatars",
      onSuccess: (data) => {
        console.log("Upload success:", data);
        console.log("Full path:", data.fullPath); // images/avatars/user-content/filename.jpg
      },
      onError: (error) => {
        console.error("Upload error:", error);
      },
    });
  };

  // Delete file
  const handleDelete = (fullPath: string) => {
    deleteFile(fullPath, {
      onSuccess: () => {
        // Refresh file list
      },
    });
  };

  // Download file
  const handleDownload = (fullPath: string) => {
    downloadFile(fullPath);
  };
}
```

## Component Usage

### FileManager Component

```typescript
import { FileManager } from "~/components/file-manager";

function MyPage() {
  return (
    <FileManager
      prefixPath="documents"
      allowMultiple={true}
      maxFileSize={10} // MB
      allowedTypes={[
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "text/plain",
      ]}
    />
  );
}
```

### Example File Paths

```typescript
// Upload với prefixPath
uploadFile(file, {
  prefixPath: "images/avatars",
});
// Kết quả: images/avatars/profile/filename-timestamp-uuid.jpg

// List files theo prefix
listFiles({ prefixPath: "images/avatars" });
// Trả về: tất cả files trong thư mục images/avatars/

// Delete file bằng full path
deleteFile("images/avatars/profile/user-123-avatar.jpg");
```

## Storage Platform Features

### MinIO vs Cloudflare R2

| Feature            | MinIO                  | Cloudflare R2              |
| ------------------ | ---------------------- | -------------------------- |
| **Connection**     | Requires port config   | Auto HTTPS (443)           |
| **Public URLs**    | Direct MinIO endpoint  | `pub-bucket.r2.dev` domain |
| **Presigned URLs** | ✅ Supported           | ✅ Supported               |
| **Client Library** | ✅ Native MinIO client | ✅ S3-compatible           |
| **Costs**          | Self-hosted            | $0.015/GB/month            |
| **Egress**         | Bandwidth costs        | **Free egress** 🎉         |

### Auto-Detection

```typescript
import { isUsingCloudflareR2 } from "~/utils/minio.utils";

if (isUsingCloudflareR2()) {
  console.log("🚀 Using Cloudflare R2");
  // R2-specific optimizations
} else {
  console.log("🏠 Using MinIO");
  // MinIO-specific optimizations
}
```

### R2 Public Access Setup

1. **Cloudflare Dashboard** → **R2** → **Your Bucket**
2. **Settings** → **Public Access** → **Allow Access**
3. Copy public domain: `pub-<bucket>.r2.dev`
4. Test: `https://pub-<bucket>.r2.dev/path/to/file.jpg`

## Authentication

Tất cả API routes đều sử dụng `requireLogin()` để đảm bảo user đã đăng nhập:

```typescript
import { requireLogin } from "~/helpers/auth.server";

export async function action({ request }: Route.ActionArgs) {
  // Kiểm tra authentication - required user login
  const userId = await requireLogin(request);

  // API logic here...
}
```

Nếu user chưa đăng nhập, sẽ tự động redirect về `/login`.

## Security Features

1. **File Validation**:

   - File type whitelist (60+ MIME types supported)
   - File size limits (default: 10MB)
   - Content-Type validation

2. **Authentication**:

   - Tất cả endpoints yêu cầu đăng nhập
   - User ID được log trong metadata

3. **Rate Limiting**:

   - Bulk delete giới hạn 100 files
   - Download URL expiration (max 7 days)

4. **Error Handling**:
   - Comprehensive error messages với specific error types
   - Type-safe error responses
   - Toast notifications

## Error Handling

### Centralized Error Management

```typescript
// Automatic error detection và user-friendly messages
try {
  await uploadFile(file, fileName, options);
} catch (error) {
  // Auto-handled errors:
  // - NoSuchBucket → "Bucket 'bucket-name' does not exist. Please contact administrator."
  // - AccessDenied → "Access denied. Please check storage permissions."
  // - NoSuchKey → "File 'path/file.ext' does not exist."
}
```

## Best Practices

### File Organization

```typescript
// Recommended prefix structure
uploads/
├── images/
│   ├── avatars/        // User profile pictures
│   ├── covers/         // Manga/book covers
│   └── thumbnails/     // Generated thumbnails
├── documents/
│   ├── pdfs/          // PDF files
│   └── docs/          // Word documents
├── videos/
│   └── trailers/      // Video content
└── temp/              // Temporary files
```

### Development Tips

1. **Use unified functions**: Tận dụng functions chung cho cả MinIO & R2
2. **Always validate files**: Sử dụng `allowedTypes` và `maxFileSize`
3. **Handle errors gracefully**: Implement `onError` callbacks
4. **Show loading states**: Sử dụng `isUploading`, `isDeleting`
5. **Refresh lists**: Gọi lại API list sau khi upload/delete
6. **Use TypeScript**: Tận dụng type safety của hệ thống
7. **Use prefixPath**: Tổ chức files theo folder structure rõ ràng
8. **Monitor storage**: Track file sizes và costs (đặc biệt với R2)
9. **Leverage auto-detection**: Functions tự động detect MinIO/R2

### Performance Tips

1. **Unique filenames**: Sử dụng `generateUniqueFileName: true` để tránh conflicts
2. **Proper MIME types**: Auto-detection từ file extensions
3. **Presigned URLs**: Dùng cho private files thay vì stream through server
4. **Batch operations**: Sử dụng `deleteFiles()` cho bulk delete
5. **Prefix filtering**: List files theo specific `prefixPath` để improve performance

## Example Usage

Xem file `/app/routes/secure-files.tsx` để có ví dụ đầy đủ về cách sử dụng hệ thống.

## Development

1. Đảm bảo MinIO server đang chạy (nếu dùng MinIO)
2. Cấu hình connection trong `~/configs/minio.config.ts`
3. Chạy `npm run dev` để development
4. Truy cập `/secure-files` để test
5. Functions sẽ tự động detect và switch giữa MinIO/R2
