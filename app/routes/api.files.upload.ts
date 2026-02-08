import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/api.files.upload";

import { isBusinessError } from "~/helpers/errors.helper";
import {
  encodeForMetadata,
  sanitizePrefixPath,
  smartSanitizeFilename,
  uploadBufferWithValidation,
} from "~/.server/services/file-upload.service";
import { applyWatermark } from "~/.server/utils/watermark.utils";
import { getCdnBase } from "~/.server/utils/cdn-url";
import { rewriteCdnHostsDeepInPlace } from "~/.server/utils/cdn-host-rewrite";
import { isDichGia } from "~/helpers/user.helper";

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

    return { message, statusCode: 500 };
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
    let watermarkFlagRaw: FormDataEntryValue | null = null;
    let watermarkVariantRaw: FormDataEntryValue | null = null;
    let watermarkStyleRaw: FormDataEntryValue | null = null;
    let watermarkSkipRaw: FormDataEntryValue | null = null;

    try {
      formData = await request.formData();
      file = formData.get("file") as File;
      prefixPath = (formData.get("prefixPath") as string) || "uploads";
      watermarkFlagRaw = formData.get("watermark");
      watermarkVariantRaw = formData.get("watermarkVariant");
      watermarkStyleRaw = formData.get("watermarkStyle");
      watermarkSkipRaw = formData.get("watermarkSkip");
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

    const originalFilename = file.name || "unnamed_file";
    const { sanitized: previewSanitizedName, needsFallback } = smartSanitizeFilename(originalFilename);

    if (needsFallback || previewSanitizedName !== originalFilename) {
      console.log(`Filename auto-fixed: "${originalFilename}" → "${previewSanitizedName}"`);
    }

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

    const validPrefixPath = sanitizePrefixPath(prefixPath as string);

    // Apply server-side watermark only for manga page uploads when explicitly requested
    const shouldWatermark =
      validPrefixPath.startsWith("manga-images") ||
      validPrefixPath.startsWith("tmp/manga-images");
    const watermarkRequested = typeof watermarkFlagRaw === "string" && ["true", "1", "yes"].includes(watermarkFlagRaw.toLowerCase());
    const watermarkSkipRequested =
      typeof watermarkSkipRaw === "string" && ["true", "1", "yes"].includes(watermarkSkipRaw.toLowerCase());
    const canSkipWatermark = Boolean(userInfo?.canSkipWatermark) && isDichGia(String(userInfo?.role || ""));
    const allowSkipWatermark = shouldWatermark && watermarkSkipRequested && canSkipWatermark;
    const watermarkVariant =
      typeof watermarkVariantRaw === "string" && /^\d+$/.test(watermarkVariantRaw)
        ? Number.parseInt(watermarkVariantRaw, 10)
        : undefined;
    const watermarkStyle =
      typeof watermarkStyleRaw === "string" && ["glow", "stroke"].includes(watermarkStyleRaw)
        ? (watermarkStyleRaw as "glow" | "stroke")
        : undefined;
    const watermarkResult =
      shouldWatermark && watermarkRequested && !allowSkipWatermark
        ? await applyWatermark(buffer, {
            variant: watermarkVariant === 2 ? 2 : watermarkVariant === 1 ? 1 : undefined,
            style: watermarkStyle,
          })
        : { buffer, applied: false };
    const effectiveBuffer = watermarkResult.buffer;
    const effectiveContentType =
      watermarkResult.applied && watermarkResult.format
        ? `image/${watermarkResult.format === "jpg" ? "jpeg" : watermarkResult.format}`
        : file.type || "application/octet-stream";

    const metadata = {
      "original-name-encoded": encodeForMetadata(originalFilename),
      "original-name-sanitized": previewSanitizedName,
      "was-renamed": (previewSanitizedName !== originalFilename).toString(),
      "upload-date": new Date().toISOString(),
      "uploaded-by": userInfo.id,
      size: effectiveBuffer.length.toString(),
      "content-type": file.type,
      "user-agent": encodeForMetadata(request.headers.get("user-agent") || "unknown"),
      "upload-timestamp": Date.now().toString(),
      "watermark-applied": watermarkResult.applied ? "true" : "false",
      ...(watermarkResult.applied && watermarkStyle ? { "watermark-style": watermarkStyle } : {}),
    } satisfies Record<string, string>;

    const result = await uploadBufferWithValidation({
      buffer: effectiveBuffer,
      originalFilename,
      prefixPath: validPrefixPath,
      contentType: effectiveContentType,
      metadata,
    });

    const payload = {
      success: true,
      data: {
        objectName: result.objectName,
        fullPath: result.fullPath,
        url: result.url,
        prefixPath: validPrefixPath,
        size: effectiveBuffer.length,
        type: effectiveContentType,
        originalName: originalFilename,
        sanitizedName: result.sanitizedFilename,
        isRenamed: result.wasRenamed,
        isPublic: true,
      },
      message: "Tải file lên thành công",
    };

    try {
      rewriteCdnHostsDeepInPlace(payload as any, getCdnBase(request as any));
    } catch {}

    return Response.json(payload);
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
