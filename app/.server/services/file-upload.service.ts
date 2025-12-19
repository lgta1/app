import type { AllowedFileFormat, UploadResult } from "~/types/minio.types";

import { BusinessError } from "~/helpers/errors.helper";
import { getMimeTypeFromExtension, uploadToPublicBucket, validateFileSize } from "~/utils/minio.utils";

const DEFAULT_PREFIX_PATH = "uploads";
const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const FILENAME_MAX_LENGTH = 140;
const PREFIX_SEGMENT_MAX_LENGTH = 48;
const DEFAULT_ALLOWED_FORMATS: AllowedFileFormat[] = [
  "jpeg",
  "jpg",
  "png",
  "gif",
  "webp",
  "svg",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "mp4",
  "avi",
  "mov",
  "wmv",
  "flv",
  "webm",
  "mp3",
  "wav",
  "ogg",
  "aac",
  "flac",
];

const stripDiacritics = (value: string): string => {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
};

const coerceSafeString = (value: unknown, fallback = "unknown"): string => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

interface UploadBufferOptions {
  buffer: Buffer;
  originalFilename: string;
  prefixPath?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  maxSizeInBytes?: number;
  allowedFormats?: AllowedFileFormat[];
  generateUniqueFileName?: boolean;
}

interface UploadWithValidationResult extends UploadResult {
  sanitizedFilename: string;
  wasRenamed: boolean;
}

export function encodeForMetadata(value: unknown, fallback = "unknown"): string {
  const asString = coerceSafeString(value, fallback);
  return Buffer.from(asString, "utf8").toString("base64");
}

export function sanitizePrefixPath(prefixPath?: string | null): string {
  if (!prefixPath) return DEFAULT_PREFIX_PATH;

  const normalized = prefixPath.replace(/\\/g, "/");
  const segments = normalized
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const stripped = stripDiacritics(segment);
      const asciiOnly = stripped.replace(/[^a-zA-Z0-9-_]/g, "-");
      const collapsed = asciiOnly.replace(/-+/g, "-");
      const trimmed = collapsed.replace(/^[-_]+|[-_]+$/g, "");
      return trimmed.toLowerCase().slice(0, PREFIX_SEGMENT_MAX_LENGTH);
    })
    .filter(Boolean);

  const sanitized = segments.join("/");

  if (!sanitized || sanitized.includes("..")) {
    return DEFAULT_PREFIX_PATH;
  }

  return sanitized;
}

export function smartSanitizeFilename(originalName?: string | null): {
  sanitized: string;
  needsFallback: boolean;
} {
  const fallbackBase = `file-${Date.now()}`;
  const fallbackExtension = ".bin";

  if (!originalName) {
    return { sanitized: `${fallbackBase}${fallbackExtension}`, needsFallback: true };
  }

  const trimmed = originalName.trim();
  if (!trimmed) {
    return { sanitized: `${fallbackBase}${fallbackExtension}`, needsFallback: true };
  }

  const normalized = stripDiacritics(trimmed.replace(/\\/g, "/"));
  const lastSegment = normalized.split("/").pop() ?? trimmed;

  const lastDot = lastSegment.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < lastSegment.length - 1;

  const baseNameRaw = hasExtension ? lastSegment.slice(0, lastDot) : lastSegment;
  const extensionRaw = hasExtension ? lastSegment.slice(lastDot).toLowerCase() : fallbackExtension;

  const baseAscii = baseNameRaw.replace(/[^a-zA-Z0-9._-]/g, "-");
  const baseCollapsed = baseAscii.replace(/-+/g, "-");
  const baseTrimmed = baseCollapsed.replace(/^[-_.]+|[-_.]+$/g, "");
  const baseName = (baseTrimmed || fallbackBase).toLowerCase();

  const extension = extensionRaw.replace(/[^a-z0-9.]/g, "") || fallbackExtension;

  const maxBaseLength = Math.max(8, FILENAME_MAX_LENGTH - extension.length);
  const safeBase = baseName.slice(0, maxBaseLength);

  const sanitized = `${safeBase}${extension}`;
  const needsFallback = sanitized !== trimmed;

  return { sanitized, needsFallback };
}

function getExtensionWithoutDot(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === fileName.length - 1) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
}

export async function uploadBufferWithValidation({
  buffer,
  originalFilename,
  prefixPath,
  contentType,
  metadata,
  maxSizeInBytes,
  allowedFormats,
  generateUniqueFileName = true,
}: UploadBufferOptions): Promise<UploadWithValidationResult> {
  if (!buffer || buffer.length === 0) {
    throw new BusinessError("Không có dữ liệu để tải lên.");
  }

  const effectiveMaxSize = maxSizeInBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  if (!validateFileSize(buffer.length, effectiveMaxSize)) {
    const maxInMb = (effectiveMaxSize / (1024 * 1024)).toFixed(0);
    throw new BusinessError(`File vượt quá kích thước tối đa ${maxInMb}MB.`);
  }

  const { sanitized: sanitizedFilename } = smartSanitizeFilename(originalFilename);
  const extension = getExtensionWithoutDot(sanitizedFilename);
  const formats = allowedFormats ?? DEFAULT_ALLOWED_FORMATS;

  if (formats.length > 0 && (!extension || !formats.includes(extension as AllowedFileFormat))) {
    throw new BusinessError(
      `Định dạng file không được hỗ trợ. Cho phép: ${formats.join(", ")}.`,
    );
  }

  const targetPrefix = sanitizePrefixPath(prefixPath);
  const resolvedContentType = contentType || getMimeTypeFromExtension(sanitizedFilename);

  try {
    const result = await uploadToPublicBucket(buffer, sanitizedFilename, {
      prefixPath: targetPrefix,
      contentType: resolvedContentType,
      metadata,
      generateUniqueFileName,
    });

    return {
      ...result,
      sanitizedFilename,
      wasRenamed: sanitizedFilename !== originalFilename,
    };
  } catch (error) {
    if (error instanceof BusinessError) {
      throw error;
    }

    throw new BusinessError(
      error instanceof Error ? error.message : "Không thể tải file lên. Vui lòng thử lại.",
    );
  }
}
