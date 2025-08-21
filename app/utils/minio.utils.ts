import * as Minio from "minio";
import type { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";

import { MINIO_CONFIG } from "@/configs/minio.config";

import { BusinessError } from "~/helpers/errors.helper";
import type {
  AllowedFileFormat,
  DeleteOptions,
  DownloadOptions,
  FileInfo,
  ListObjectsOptions,
  UploadOptions,
  UploadResult,
} from "~/types/minio.types";

// =============================================================================
// CONSTANTS & TYPES
// =============================================================================

// Error helper functions
const getBucketNotExistsError = (bucket: string) =>
  `Bucket '${bucket}' does not exist. Please contact administrator.`;
const getAccessDeniedError = () => "Access denied. Please check storage permissions.";
const getFileNotExistsError = (filePath: string) => `File '${filePath}' does not exist.`;

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  // Images
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  // Documents
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".rtf": "application/rtf",
  // Videos
  ".mp4": "video/mp4",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".webm": "video/webm",
  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  // Archives
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  // Other
  ".json": "application/json",
  ".xml": "application/xml",
  ".csv": "text/csv",
};

// =============================================================================
// INTERFACES
// =============================================================================

interface ExtendedDownloadOptions extends DownloadOptions {
  isPublic?: boolean;
}

interface ExtendedListOptions extends ListObjectsOptions {
  isPublic?: boolean;
}

// =============================================================================
// UTILITY HELPERS
// =============================================================================

/**
 * Tạo full path từ prefix và file name
 */
export const createFullPath = (fileName: string, prefixPath?: string): string => {
  if (!prefixPath) return fileName;

  // Normalize paths
  const normalizedPrefix = prefixPath.replace(/^\/+|\/+$/g, "");
  const normalizedFileName = fileName.replace(/^\/+/, "");

  return normalizedPrefix
    ? `${normalizedPrefix}/${normalizedFileName}`
    : normalizedFileName;
};

/**
 * Parse full path thành file name và prefix path
 */
export const parseFullPath = (
  fullPath: string,
): { fileName: string; prefixPath?: string } => {
  const lastSlashIndex = fullPath.lastIndexOf("/");

  if (lastSlashIndex === -1) {
    return { fileName: fullPath };
  }

  const fileName = fullPath.substring(lastSlashIndex + 1);
  const prefixPath = fullPath.substring(0, lastSlashIndex);

  return { fileName, prefixPath: prefixPath || undefined };
};

/**
 * Tạo unique filename với timestamp và UUID
 */
export const generateUniqueFileName = (originalFileName: string): string => {
  const extension = originalFileName.substring(originalFileName.lastIndexOf("."));
  const nameWithoutExt = originalFileName.substring(0, originalFileName.lastIndexOf("."));
  const timestamp = Date.now();
  const uuid = uuidv4().split("-")[0]; // Short UUID

  return `${nameWithoutExt}-${timestamp}-${uuid}${extension}`;
};

/**
 * Lấy MIME type từ file extension
 */
export const getMimeTypeFromExtension = (fileName: string): string => {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf("."));
  return MIME_TYPES[extension] || "application/octet-stream";
};

/**
 * Validate file format
 */
export const validateFileFormat = (
  fileName: string,
  allowedFormats?: AllowedFileFormat[],
): boolean => {
  if (!allowedFormats || allowedFormats.length === 0) return true;

  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf(".") + 1);
  return allowedFormats.includes(extension as AllowedFileFormat);
};

/**
 * Validate file size
 */
export const validateFileSize = (fileSize: number, maxSize?: number): boolean => {
  if (!maxSize) return true;
  return fileSize <= maxSize;
};

// =============================================================================
// CLIENT & CONNECTION
// =============================================================================

// Singleton MinIO client instance
let minioClient: Minio.Client | null = null;

/**
 * Kiểm tra xem có đang sử dụng Cloudflare R2 không
 */
export const isUsingCloudflareR2 = (): boolean => {
  return MINIO_CONFIG.ENDPOINT.includes(".r2.cloudflarestorage.com");
};

/**
 * Tạo và trả về MinIO client instance
 * Hỗ trợ cả MinIO và Cloudflare R2
 */
export const getMinioClient = (): Minio.Client => {
  if (!minioClient) {
    const config: Minio.ClientOptions = {
      endPoint: MINIO_CONFIG.ENDPOINT,
      useSSL: MINIO_CONFIG.USE_SSL,
      accessKey: MINIO_CONFIG.ACCESS_KEY,
      secretKey: MINIO_CONFIG.SECRET_KEY,
    };

    // Chỉ set port nếu không phải Cloudflare R2
    if (!MINIO_CONFIG.ENDPOINT.includes(".r2.cloudflarestorage.com")) {
      config.port = MINIO_CONFIG.PORT;
    }

    minioClient = new Minio.Client(config);
  }
  return minioClient;
};

// =============================================================================
// URL GENERATION
// =============================================================================

/**
 * Tạo public URL cho file - Hỗ trợ cả MinIO và Cloudflare R2
 */
export const getPublicFileUrl = (fullPath: string): string => {
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;

  // Nếu sử dụng Cloudflare R2, dùng R2 public URL format
  if (isUsingCloudflareR2()) {
    // R2 public URL format với r2.dev subdomain
    // Lưu ý: Cần enable public access trong Cloudflare Dashboard
    return `https://pub-${bucket}.r2.dev/${fullPath}`;
  }

  // MinIO public URL format
  const protocol = MINIO_CONFIG.USE_SSL ? "https" : "http";
  const port =
    MINIO_CONFIG.PORT !== 443 && MINIO_CONFIG.PORT !== 80 ? `:${MINIO_CONFIG.PORT}` : "";

  return `${protocol}://${MINIO_CONFIG.ENDPOINT}${port}/${bucket}/${fullPath}`;
};

/**
 * Lấy URL để download file - Hỗ trợ cả public và private, MinIO và R2
 */
export const getFileUrl = async (
  fullPath: string,
  options: ExtendedDownloadOptions = {},
): Promise<string> => {
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;

  // Nếu là public, trả về direct URL
  if (options.isPublic) {
    return getPublicFileUrl(fullPath);
  }

  // Nếu là private, dùng presigned URL (cả MinIO và R2 đều hỗ trợ)
  const expires = options.expires || 7 * 24 * 60 * 60; // 7 days default

  try {
    const client = getMinioClient();
    return await client.presignedGetObject(bucket, fullPath, expires);
  } catch (error) {
    console.error("Error generating file URL:", error);
    if (error instanceof Error) {
      // More specific error handling based on error type
      if (error.message.includes("NoSuchBucket")) {
        throw new BusinessError(getBucketNotExistsError(bucket));
      }
      if (error.message.includes("NoSuchKey")) {
        throw new BusinessError(getFileNotExistsError(fullPath));
      }
      if (error.message.includes("AccessDenied")) {
        throw new BusinessError(getAccessDeniedError());
      }
    }
    throw new BusinessError(`Failed to generate file URL: ${(error as Error).message}`);
  }
};

// =============================================================================
// CORE FILE OPERATIONS
// =============================================================================

/**
 * Upload file lên default bucket với prefix path
 * Hỗ trợ cả MinIO và Cloudflare R2
 */
export const uploadToPublicBucket = async (
  file: Buffer | Readable | string,
  fileName: string,
  options: UploadOptions = {},
): Promise<UploadResult> => {
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;

  // Generate unique filename if requested
  const actualFileName = options.generateUniqueFileName
    ? generateUniqueFileName(fileName)
    : fileName;

  // Create full path with prefix
  const fullPath = createFullPath(actualFileName, options.prefixPath);

  // Set content type
  const contentType = options.contentType || getMimeTypeFromExtension(fileName);

  const client = getMinioClient();

  try {
    const result = await client.putObject(bucket, fullPath, file, undefined, {
      "Content-Type": contentType,
      ...options.metadata,
    });

    // Generate public URL
    const url = getPublicFileUrl(fullPath);

    return {
      objectName: actualFileName,
      fullPath,
      etag: result.etag,
      url,
      versionId: result.versionId || undefined,
    };
  } catch (error) {
    console.error("Error uploading to bucket:", error);
    if (error instanceof Error) {
      // More specific error handling based on error type
      if (error.message.includes("NoSuchBucket")) {
        throw new BusinessError(getBucketNotExistsError(bucket));
      }
      if (error.message.includes("AccessDenied")) {
        throw new BusinessError(getAccessDeniedError());
      }
    }
    throw new BusinessError(`Failed to upload file: ${(error as Error).message}`);
  }
};

/**
 * Upload file lên default bucket (private)
 */
export const uploadFile = async (
  file: Buffer | Readable | string,
  fileName: string,
  options: UploadOptions = {},
): Promise<UploadResult> => {
  const client = getMinioClient();
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;

  // Generate unique filename if requested
  const actualFileName = options.generateUniqueFileName
    ? generateUniqueFileName(fileName)
    : fileName;

  // Create full path with prefix
  const fullPath = createFullPath(actualFileName, options.prefixPath);

  // Set content type
  const contentType = options.contentType || getMimeTypeFromExtension(fileName);

  try {
    const result = await client.putObject(bucket, fullPath, file, undefined, {
      "Content-Type": contentType,
      ...options.metadata,
    });

    // Generate private URL (presigned)
    const url = await getFileUrl(fullPath);

    return {
      objectName: actualFileName,
      fullPath,
      etag: result.etag,
      url,
      versionId: result.versionId || undefined,
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    if (error instanceof Error) {
      // More specific error handling based on error type
      if (error.message.includes("NoSuchBucket")) {
        throw new BusinessError(getBucketNotExistsError(bucket));
      }
      if (error.message.includes("AccessDenied")) {
        throw new BusinessError(getAccessDeniedError());
      }
    }
    throw new BusinessError(`Failed to upload file: ${(error as Error).message}`);
  }
};

/**
 * Download file từ default bucket
 */
export const downloadFile = async (
  fullPath: string,
  _options: DownloadOptions = {},
): Promise<Readable> => {
  const client = getMinioClient();
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;

  try {
    return await client.getObject(bucket, fullPath);
  } catch (error) {
    console.error("Error downloading file:", error);
    if (error instanceof Error) {
      // More specific error handling based on error type
      if (error.message.includes("NoSuchBucket")) {
        throw new BusinessError(getBucketNotExistsError(bucket));
      }
      if (error.message.includes("NoSuchKey")) {
        throw new BusinessError(getFileNotExistsError(fullPath));
      }
      if (error.message.includes("AccessDenied")) {
        throw new BusinessError(getAccessDeniedError());
      }
    }
    throw new BusinessError(`Failed to download file: ${(error as Error).message}`);
  }
};

/**
 * Xóa file từ default bucket
 */
export const deleteFile = async (
  fullPath: string,
  _options: DeleteOptions = {},
): Promise<void> => {
  const client = getMinioClient();
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;

  try {
    await client.removeObject(bucket, fullPath);
  } catch (error) {
    console.error("Error deleting file:", error);
    if (error instanceof Error) {
      // More specific error handling based on error type
      if (error.message.includes("NoSuchBucket")) {
        throw new BusinessError(getBucketNotExistsError(bucket));
      }
      if (error.message.includes("AccessDenied")) {
        throw new BusinessError(getAccessDeniedError());
      }
    }
    throw new BusinessError(`Failed to delete file: ${(error as Error).message}`);
  }
};

/**
 * Xóa nhiều files cùng lúc từ default bucket
 */
export const deleteFiles = async (
  fullPaths: string[],
  _options: DeleteOptions = {},
): Promise<void> => {
  const client = getMinioClient();
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;

  try {
    await client.removeObjects(bucket, fullPaths);
  } catch (error) {
    console.error("Error deleting files:", error);
    if (error instanceof Error) {
      // More specific error handling based on error type
      if (error.message.includes("NoSuchBucket")) {
        throw new BusinessError(getBucketNotExistsError(bucket));
      }
      if (error.message.includes("AccessDenied")) {
        throw new BusinessError(getAccessDeniedError());
      }
    }
    throw new BusinessError(`Failed to delete files: ${(error as Error).message}`);
  }
};

/**
 * Lấy thông tin file từ default bucket
 */
export const getFileInfo = async (
  fullPath: string,
  options: ExtendedDownloadOptions = {},
): Promise<FileInfo> => {
  const client = getMinioClient();
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;

  try {
    const stat = await client.statObject(bucket, fullPath);
    const { fileName, prefixPath } = parseFullPath(fullPath);

    // Lấy URL phù hợp
    const url = options.isPublic
      ? getPublicFileUrl(fullPath)
      : await getFileUrl(fullPath, { ...options, isPublic: false });

    return {
      name: fileName,
      fullPath,
      lastModified: stat.lastModified,
      etag: stat.etag,
      size: stat.size,
      url,
      contentType: stat.metaData?.["content-type"],
      metadata: stat.metaData,
      prefixPath,
    };
  } catch (error) {
    console.error("Error getting file info:", error);
    if (error instanceof Error) {
      // More specific error handling based on error type
      if (error.message.includes("NoSuchBucket")) {
        throw new BusinessError(getBucketNotExistsError(bucket));
      }
      if (error.message.includes("NoSuchKey")) {
        throw new BusinessError(getFileNotExistsError(fullPath));
      }
      if (error.message.includes("AccessDenied")) {
        throw new BusinessError(getAccessDeniedError());
      }
    }
    throw new BusinessError(`Failed to get file info: ${(error as Error).message}`);
  }
};

/**
 * List objects trong default bucket
 */
export const listFiles = async (
  options: ExtendedListOptions = {},
): Promise<FileInfo[]> => {
  const client = getMinioClient();
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;

  try {
    const files: FileInfo[] = [];
    const stream = client.listObjects(bucket, options.prefixPath, options.recursive);

    return new Promise((resolve, reject) => {
      stream.on("data", async (obj) => {
        try {
          const { fileName, prefixPath } = parseFullPath(obj.name!);

          // Lấy URL phù hợp
          const url = options.isPublic
            ? getPublicFileUrl(obj.name!)
            : await getFileUrl(obj.name!, { isPublic: false });

          files.push({
            name: fileName,
            fullPath: obj.name!,
            lastModified: obj.lastModified!,
            etag: obj.etag!,
            size: obj.size!,
            url,
            prefixPath,
          });
        } catch (error) {
          console.error(`Error processing object ${obj.name}:`, error);
        }
      });

      stream.on("end", () => resolve(files));
      stream.on("error", (error) => {
        console.error("Error listing files:", error);
        if (error instanceof Error) {
          // More specific error handling based on error type
          if (error.message.includes("NoSuchBucket")) {
            reject(new BusinessError(getBucketNotExistsError(bucket)));
          } else if (error.message.includes("AccessDenied")) {
            reject(new BusinessError(getAccessDeniedError()));
          } else {
            reject(new BusinessError(`Failed to list files: ${error.message}`));
          }
        } else {
          reject(new BusinessError(`Failed to list files: ${String(error)}`));
        }
      });
    });
  } catch (error) {
    console.error("Error listing files:", error);
    if (error instanceof Error) {
      // More specific error handling based on error type
      if (error.message.includes("NoSuchBucket")) {
        throw new BusinessError(getBucketNotExistsError(bucket));
      }
      if (error.message.includes("AccessDenied")) {
        throw new BusinessError(getAccessDeniedError());
      }
    }
    throw new BusinessError(`Failed to list files: ${(error as Error).message}`);
  }
};

/**
 * Kiểm tra file có tồn tại không trong default bucket
 */
export const fileExists = async (
  fullPath: string,
  _options: DeleteOptions = {},
): Promise<boolean> => {
  const client = getMinioClient();
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;

  try {
    await client.statObject(bucket, fullPath);
    return true;
  } catch (error) {
    // For fileExists, we only return false for "not found" errors
    // Other errors should be thrown as they indicate real problems
    if (error instanceof Error) {
      if (error.message.includes("NoSuchKey") || error.message.includes("NotFound")) {
        return false;
      }
      if (error.message.includes("NoSuchBucket")) {
        throw new BusinessError(getBucketNotExistsError(bucket));
      }
      if (error.message.includes("AccessDenied")) {
        throw new BusinessError(getAccessDeniedError());
      }
    }
    // For other unknown errors, return false (assume file doesn't exist)
    return false;
  }
};

/**
 * Copy file trong default bucket (change prefix path)
 */
export const copyFile = async (
  sourceFullPath: string,
  destinationFullPath: string,
  _options: {
    metadata?: Record<string, string>;
  } = {},
): Promise<void> => {
  const client = getMinioClient();
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;

  try {
    await client.copyObject(bucket, destinationFullPath, `${bucket}/${sourceFullPath}`);
  } catch (error) {
    console.error("Error copying file:", error);
    if (error instanceof Error) {
      // More specific error handling based on error type
      if (error.message.includes("NoSuchBucket")) {
        throw new BusinessError(getBucketNotExistsError(bucket));
      }
      if (error.message.includes("NoSuchKey")) {
        throw new BusinessError(getFileNotExistsError(sourceFullPath));
      }
      if (error.message.includes("AccessDenied")) {
        throw new BusinessError(getAccessDeniedError());
      }
    }
    throw new BusinessError(`Failed to copy file: ${(error as Error).message}`);
  }
};

// =============================================================================
// PUBLIC HELPER FUNCTIONS
// =============================================================================

export const getPublicFileInfo = (fullPath: string) => {
  return getFileInfo(fullPath, { isPublic: true });
};

export const listPublicFiles = (options: ExtendedListOptions = {}) => {
  return listFiles({ ...options, isPublic: true });
};

export const deletePublicFile = (fullPath: string) => {
  return deleteFile(fullPath);
};

export const deletePublicFiles = (fullPaths: string[]) => {
  return deleteFiles(fullPaths);
};

export const moveFile = async (
  sourceFullPath: string,
  destinationFullPath: string,
  options?: { metadata?: Record<string, string> },
): Promise<void> => {
  await copyFile(sourceFullPath, destinationFullPath, options);
  await deleteFile(sourceFullPath);
};
