import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/api.files.upload";

import { isBusinessError } from "~/helpers/errors.helper";
import { uploadToPublicBucket } from "~/utils/minio.utils";

// Utility functions for filename handling
function smartSanitizeFilename(filename: string): {
  sanitized: string;
  needsFallback: boolean;
} {
  // Get file extension first
  const lastDotIndex = filename.lastIndexOf(".");
  const extension =
    lastDotIndex > 0 ? filename.substring(lastDotIndex).toLowerCase() : "";
  const nameWithoutExt =
    lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;

  // Sanitize the name part only, preserving Vietnamese diacritics and common chars
  let sanitized = nameWithoutExt
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "") // Remove dangerous filesystem characters
    .replace(/[^\w\s\-\.\u00C0-\u024F\u1E00-\u1EFF]/g, "") // Keep alphanumeric, spaces, hyphens, dots, Vietnamese chars
    .replace(/\s+/g, "_") // Replace spaces with underscores for better compatibility
    .replace(/_{2,}/g, "_") // Remove multiple underscores
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .substring(0, 200); // Leave room for extension

  // If sanitized name is empty, we need a fallback
  const needsFallback = sanitized.length === 0;

  if (needsFallback) {
    sanitized = `file_${Date.now()}`;
  }

  return {
    sanitized: (sanitized + extension).substring(0, 255),
    needsFallback,
  };
}

function encodeForMetadata(value: string): string {
  // Encode to Base64 to handle special characters in S3 metadata
  return Buffer.from(value, "utf-8").toString("base64");
}

function isAllowedFileExtension(filename: string): boolean {
  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".pdf",
    ".txt",
    ".doc",
    ".docx",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
  ];
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1) return false;

  const ext = filename.substring(lastDotIndex).toLowerCase();
  return allowedExtensions.includes(ext);
}

function getErrorMessage(error: unknown): { message: string; statusCode: number } {
  if (isBusinessError(error)) {
    const message = error.message;

    // Handle specific S3/MinIO errors
    if (message.includes("NoSuchBucket")) {
      return {
        message: "Hệ thống lưu trữ không khả dụng. Vui lòng thử lại sau.",
        statusCode: 503,
      };
    }
    if (message.includes("AccessDenied")) {
      return { message: "Không có quyền truy cập hệ thống lưu trữ.", statusCode: 403 };
    }
    if (message.includes("Invalid character in header")) {
      return { message: "Tên file chứa ký tự không hợp lệ.", statusCode: 400 };
    }
    if (message.includes("RequestTimeout") || message.includes("timeout")) {
      return {
        message: "Quá thời gian chờ khi tải file. Vui lòng thử lại.",
        statusCode: 408,
      };
    }
    if (message.includes("ServiceUnavailable")) {
      return { message: "Dịch vụ lưu trữ tạm thời không khả dụng.", statusCode: 503 };
    }
    if (message.includes("InternalError")) {
      return { message: "Lỗi hệ thống lưu trữ. Vui lòng thử lại sau.", statusCode: 500 };
    }

    return { message: `Lỗi lưu trữ: ${message}`, statusCode: 500 };
  }

  if (error instanceof Error) {
    const message = error.message;

    // Handle network errors
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
      return { message: "Không thể kết nối đến hệ thống lưu trữ.", statusCode: 503 };
    }
    if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
      return {
        message: "Quá thời gian chờ khi tải file. Vui lòng thử lại.",
        statusCode: 408,
      };
    }
    if (message.includes("ECONNRESET")) {
      return { message: "Kết nối bị ngắt. Vui lòng thử lại.", statusCode: 500 };
    }

    return { message: `Lỗi không xác định: ${message}`, statusCode: 500 };
  }

  return { message: "Đã xảy ra lỗi không xác định.", statusCode: 500 };
}

export async function action({ request }: Route.ActionArgs) {
  try {
    // Kiểm tra authentication - required user login
    const userInfo = await getUserInfoFromSession(request);

    if (!userInfo) {
      return Response.json(
        {
          success: false,
          error: "Bạn cần đăng nhập để thực hiện hành động này",
        },
        { status: 401 },
      );
    }

    // Check content type
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("multipart/form-data")) {
      return Response.json(
        {
          success: false,
          error: "Content-Type phải là multipart/form-data",
        },
        { status: 400 },
      );
    }

    // Parse form data with error handling
    let formData: FormData;
    let file: File;
    let prefixPath: string;

    try {
      formData = await request.formData();
      file = formData.get("file") as File;
      prefixPath = (formData.get("prefixPath") as string) || "uploads";
    } catch (error) {
      console.error("Error parsing form data:", error);
      return Response.json(
        {
          success: false,
          error: "Dữ liệu form không hợp lệ",
          details: error instanceof Error ? error.message : "Unknown parsing error",
        },
        { status: 400 },
      );
    }

    // Validate file exists and has content
    if (!file || !(file instanceof File)) {
      return Response.json(
        {
          success: false,
          error: "Không có file được cung cấp",
        },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return Response.json(
        {
          success: false,
          error: "File trống, không thể tải lên",
        },
        { status: 400 },
      );
    }

    // Smart filename handling - auto-fix instead of rejecting
    const originalFilename = file.name || "unnamed_file";
    const { sanitized: sanitizedFilename, needsFallback } =
      smartSanitizeFilename(originalFilename);

    // Check if file extension is allowed (this is a hard business rule)
    if (!isAllowedFileExtension(sanitizedFilename)) {
      return Response.json(
        {
          success: false,
          error:
            "Định dạng file không được phép. Chỉ chấp nhận: jpg, png, gif, webp, svg, pdf, txt, doc, docx, mp4, webm, mp3, wav",
        },
        { status: 400 },
      );
    }

    // Log if filename was changed for debugging
    if (needsFallback || sanitizedFilename !== originalFilename) {
      console.log(`Filename auto-fixed: "${originalFilename}" → "${sanitizedFilename}"`);
    }

    // File size limit (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return Response.json(
        {
          success: false,
          error: `File quá lớn. Kích thước tối đa: ${maxSize / 1024 / 1024}MB`,
        },
        { status: 400 },
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "video/mp4",
      "video/webm",
      "audio/mpeg",
      "audio/wav",
    ];

    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        {
          success: false,
          error: "Loại file không được phép",
        },
        { status: 400 },
      );
    }

    // Convert file to buffer with error handling
    let buffer: Buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        return Response.json(
          {
            success: false,
            error: "Không thể đọc nội dung file",
          },
          { status: 400 },
        );
      }
    } catch (error) {
      console.error("Error converting file to buffer:", error);
      return Response.json(
        {
          success: false,
          error: "Không thể xử lý file",
          details: error instanceof Error ? error.message : "Buffer conversion error",
        },
        { status: 400 },
      );
    }

    // Validate prefix path
    const validPrefixPath = prefixPath
      .replace(/[^a-zA-Z0-9\-_\/]/g, "")
      .substring(0, 100);

    // Upload to default bucket with prefix path and metadata including userId
    // Fix: Encode filename for metadata to handle special characters
    const result = await uploadToPublicBucket(buffer, sanitizedFilename, {
      prefixPath: validPrefixPath,
      generateUniqueFileName: true,
      contentType: file.type,
      metadata: {
        // Encode original filename with special characters to Base64
        "original-name-encoded": encodeForMetadata(originalFilename),
        "original-name-sanitized": sanitizedFilename,
        "was-renamed": (sanitizedFilename !== originalFilename).toString(),
        "upload-date": new Date().toISOString(),
        "uploaded-by": userInfo.id,
        size: file.size.toString(),
        "content-type": file.type,
        "user-agent": encodeForMetadata(request.headers.get("user-agent") || "unknown"),
        "upload-timestamp": Date.now().toString(),
      },
    });

    return Response.json({
      success: true,
      data: {
        objectName: result.objectName,
        fullPath: result.fullPath,
        url: result.url, // Direct public URL
        prefixPath: prefixPath,
        size: file.size,
        type: file.type,
        originalName: originalFilename,
        sanitizedName: sanitizedFilename,
        isRenamed: sanitizedFilename !== originalFilename,
        isPublic: true,
      },
      message: "Tải file lên thành công",
    });
  } catch (error) {
    console.error("Upload error:", error);

    // Handle redirect errors (authentication)
    if (error instanceof Response) {
      throw error;
    }

    // Use comprehensive error handling
    const { message, statusCode } = getErrorMessage(error);

    return Response.json(
      {
        success: false,
        error: message,
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: statusCode },
    );
  }
}
