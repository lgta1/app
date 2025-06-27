# 🔒 MinIO Integration cho React Router V7

## Quick Start

### 1. Cài đặt MinIO Server

```bash
docker run -d -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  quay.io/minio/minio server /data --console-address ":9001"
```

### 2. Tạo file .env (Server-only)

```env
# MinIO credentials - CHỈ Ở SERVER, KHÔNG lộ ra client
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_DEFAULT_BUCKET=uploads
```

- `category`: File category (optional, default: "general")

**Response**:

```typescript
{
  success: boolean;
  data: {
    objectName: string;
    url: string;
    bucket: string;
    size: number;
    type: string;
    originalName: string;
  }
  message: string;
}
```

### 2. List Files

**Route**: `GET /api/files/list`

**Query Parameters**:

- `bucket`: Bucket name (default: "uploads")
- `prefix`: File prefix filter (default: "")
- `limit`: Max files to return (default: 100)
- `recursive`: Recursive listing (default: false)

**Response**:

```typescript
{
  success: boolean;
  data: FileInfo[];
  message: string;
  meta: {
    bucket: string;
    prefix: string;
    count: number;
    limit: number;
  };
}
```

### 3. Delete File(s)

**Route**: `POST /api/files/delete`

**Parameters**:

- `objectName`: Single file name (for single delete)
- `objectNames`: JSON array of file names (for bulk delete)
- `bucket`: Bucket name (optional, default: "uploads")

**Response**:

```typescript
{
  success: boolean;
  data: {
    deletedCount: number;
    deletedItems: string[];
    bucket: string;
  };
  message: string;
}
```

### 4. Download File

**Route**: `GET /api/files/download`

**Query Parameters**:

- `objectName`: File name (required)
- `bucket`: Bucket name (default: "uploads")
- `download`: Set to "true" for direct download (default: false)
- `expires`: URL expiration in seconds (default: 7 days, max: 7 days)

**Response**:

- If `download=true`: File stream
- If `download=false`: Presigned URL

```typescript
{
  success: boolean;
  data: {
    downloadUrl: string;
    objectName: string;
    bucket: string;
    expires: number;
    fileInfo: {
      name: string;
      size: number;
      contentType: string;
      lastModified: string;
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
      bucket: "images",
      category: "avatar",
      onSuccess: (data) => {
        console.log("Upload success:", data);
      },
      onError: (error) => {
        console.error("Upload error:", error);
      },
    });
  };

  // Delete file
  const handleDelete = (fileName: string) => {
    deleteFile(fileName, {
      bucket: "images",
      onSuccess: () => {
        // Refresh file list
      },
    });
  };

  // Download file
  const handleDownload = (fileName: string) => {
    downloadFile(fileName, "images");
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
      bucket="uploads"
      category="user-files"
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

   - File type whitelist
   - File size limits (default: 10MB)
   - Content-Type validation

2. **Authentication**:

   - Tất cả endpoints yêu cầu đăng nhập
   - User ID được log trong metadata

3. **Rate Limiting**:

   - Bulk delete giới hạn 100 files
   - Download URL expiration (max 7 days)

4. **Error Handling**:
   - Comprehensive error messages
   - Type-safe error responses
   - Toast notifications

## Example Usage

Xem file `/app/routes/secure-files.tsx` để có ví dụ đầy đủ về cách sử dụng hệ thống.

## Development

1. Đảm bảo MinIO server đang chạy
2. Cấu hình connection trong `~/configs/minio.config.ts`
3. Chạy `npm run dev` để development
4. Truy cập `/secure-files` để test

## Best Practices

1. **Always validate files**: Sử dụng `allowedTypes` và `maxFileSize`
2. **Handle errors gracefully**: Implement `onError` callbacks
3. **Show loading states**: Sử dụng `isUploading`, `isDeleting`
4. **Refresh lists**: Gọi lại API list sau khi upload/delete
5. **Use TypeScript**: Tận dụng type safety của hệ thống
