import { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";

import { ENV } from "@/configs/env.config";
import {
  ensureBucketExists,
  ensurePublicBucketExists,
  getMinioClient,
} from "@/configs/minio.config";

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

// Thêm interface mới cho public bucket options
interface PublicBucketOptions {
  bucket?: string;
  isPublic?: boolean;
}

interface ExtendedDownloadOptions extends DownloadOptions {
  isPublic?: boolean;
}

interface ExtendedListOptions extends ListObjectsOptions {
  isPublic?: boolean;
}

/**
 * Lấy MIME type từ file extension
 */
export const getMimeTypeFromExtension = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    // Images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",

    // Documents
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",

    // Video
    mp4: "video/mp4",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    wmv: "video/x-ms-wmv",
    flv: "video/x-flv",
    webm: "video/webm",

    // Audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    aac: "audio/aac",
    flac: "audio/flac",
  };

  return mimeTypes[ext || ""] || "application/octet-stream";
};

/**
 * Tạo tên file unique
 */
export const generateUniqueFileName = (originalName: string): string => {
  const ext = originalName.split(".").pop();
  const nameWithoutExt = ext ? originalName.replace(`.${ext}`, "") : originalName;
  const timestamp = Date.now();
  const uuid = uuidv4().substring(0, 8);

  return ext
    ? `${nameWithoutExt}-${timestamp}-${uuid}.${ext}`
    : `${nameWithoutExt}-${timestamp}-${uuid}`;
};

/**
 * Validate file format
 */
export const isValidFileFormat = (
  filename: string,
  allowedFormats?: AllowedFileFormat[],
): boolean => {
  if (!allowedFormats) return true;

  const ext = filename.split(".").pop()?.toLowerCase() as AllowedFileFormat;
  return allowedFormats.includes(ext);
};

/**
 * Tạo public URL trực tiếp cho file trong public bucket
 */
export const getPublicFileUrl = (objectName: string, bucketName?: string): string => {
  const bucket = bucketName || ENV.MINIO.DEFAULT_BUCKET;
  const protocol = ENV.MINIO.USE_SSL ? "https" : "http";
  const port =
    ENV.MINIO.PORT !== 443 && ENV.MINIO.PORT !== 80 ? `:${ENV.MINIO.PORT}` : "";

  return `${protocol}://${ENV.MINIO.ENDPOINT}${port}/${bucket}/${objectName}`;
};

/**
 * Upload file lên public bucket
 */
export const uploadToPublicBucket = async (
  file: Buffer | Readable | string,
  fileName: string,
  options: UploadOptions & { bucket?: string } = {},
): Promise<UploadResult> => {
  const bucket = options.bucket || ENV.MINIO.DEFAULT_BUCKET;

  // Ensure public bucket exists
  await ensurePublicBucketExists(bucket);

  // Generate unique filename if requested
  const objectName = options.generateUniqueFileName
    ? generateUniqueFileName(fileName)
    : fileName;

  // Set content type
  const contentType = options.contentType || getMimeTypeFromExtension(fileName);

  const client = getMinioClient();

  try {
    const result = await client.putObject(bucket, objectName, file, undefined, {
      "Content-Type": contentType,
      ...options.metadata,
    });

    // Generate public URL (không cần presigned)
    const url = getPublicFileUrl(objectName, bucket);

    return {
      bucket,
      objectName,
      etag: result.etag,
      url,
      versionId: result.versionId || undefined,
    };
  } catch (error) {
    console.error("Error uploading to public bucket:", error);
    throw new BusinessError(
      `Failed to upload to public bucket: ${(error as Error).message}`,
    );
  }
};

/**
 * Upload file lên MinIO
 */
export const uploadFile = async (
  file: Buffer | Readable | string,
  fileName: string,
  options: UploadOptions = {},
): Promise<UploadResult> => {
  const client = getMinioClient();
  const bucket = options.bucket || ENV.MINIO.DEFAULT_BUCKET;

  // Ensure bucket exists
  await ensureBucketExists(bucket);

  // Generate unique filename if requested
  const objectName = options.generateUniqueFileName
    ? generateUniqueFileName(fileName)
    : fileName;

  // Set content type
  const contentType = options.contentType || getMimeTypeFromExtension(fileName);

  try {
    const result = await client.putObject(bucket, objectName, file, undefined, {
      "Content-Type": contentType,
      ...options.metadata,
    });

    // Generate public URL
    const url = await getFileUrl(objectName, { bucket });

    return {
      bucket,
      objectName,
      etag: result.etag,
      url,
      versionId: result.versionId || undefined,
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    throw new BusinessError(`Failed to upload file: ${(error as Error).message}`);
  }
};

/**
 * Lấy URL để download file (hỗ trợ cả public và private bucket)
 */
export const getFileUrl = async (
  objectName: string,
  options: ExtendedDownloadOptions = {},
): Promise<string> => {
  const bucket = options.bucket || ENV.MINIO.DEFAULT_BUCKET;

  // Nếu là public bucket, trả về direct URL
  if (options.isPublic) {
    return getPublicFileUrl(objectName, bucket);
  }

  // Nếu là private bucket, dùng presigned URL
  const client = getMinioClient();
  const expires = options.expires || 7 * 24 * 60 * 60; // 7 days default

  try {
    return await client.presignedGetObject(bucket, objectName, expires);
  } catch (error) {
    console.error("Error generating file URL:", error);
    throw new BusinessError(`Failed to generate file URL: ${(error as Error).message}`);
  }
};

/**
 * Download file từ MinIO (hoạt động cho cả public và private bucket)
 */
export const downloadFile = async (
  objectName: string,
  options: DownloadOptions = {},
): Promise<Readable> => {
  const client = getMinioClient();
  const bucket = options.bucket || ENV.MINIO.DEFAULT_BUCKET;

  try {
    return await client.getObject(bucket, objectName);
  } catch (error) {
    console.error("Error downloading file:", error);
    throw new BusinessError(`Failed to download file: ${(error as Error).message}`);
  }
};

/**
 * Xóa file từ MinIO (hoạt động cho cả public và private bucket)
 */
export const deleteFile = async (
  objectName: string,
  options: DeleteOptions = {},
): Promise<void> => {
  const client = getMinioClient();
  const bucket = options.bucket || ENV.MINIO.DEFAULT_BUCKET;

  try {
    await client.removeObject(bucket, objectName);
  } catch (error) {
    console.error("Error deleting file:", error);
    throw new BusinessError(`Failed to delete file: ${(error as Error).message}`);
  }
};

/**
 * Xóa nhiều files cùng lúc (hoạt động cho cả public và private bucket)
 */
export const deleteFiles = async (
  objectNames: string[],
  options: DeleteOptions = {},
): Promise<void> => {
  const client = getMinioClient();
  const bucket = options.bucket || ENV.MINIO.DEFAULT_BUCKET;

  try {
    await client.removeObjects(bucket, objectNames);
  } catch (error) {
    console.error("Error deleting files:", error);
    throw new BusinessError(`Failed to delete files: ${(error as Error).message}`);
  }
};

/**
 * Lấy thông tin file (hỗ trợ cả public và private bucket)
 */
export const getFileInfo = async (
  objectName: string,
  options: ExtendedDownloadOptions = {},
): Promise<FileInfo> => {
  const client = getMinioClient();
  const bucket = options.bucket || ENV.MINIO.DEFAULT_BUCKET;

  try {
    const stat = await client.statObject(bucket, objectName);

    // Lấy URL phù hợp với loại bucket
    const url = options.isPublic
      ? getPublicFileUrl(objectName, bucket)
      : await getFileUrl(objectName, { ...options, isPublic: false });

    return {
      name: objectName,
      lastModified: stat.lastModified,
      etag: stat.etag,
      size: stat.size,
      bucket,
      url,
      contentType: stat.metaData?.["content-type"],
      metadata: stat.metaData,
    };
  } catch (error) {
    console.error("Error getting file info:", error);
    throw new BusinessError(`Failed to get file info: ${(error as Error).message}`);
  }
};

/**
 * List objects trong bucket (hỗ trợ cả public và private bucket)
 */
export const listFiles = async (
  options: ExtendedListOptions = {},
): Promise<FileInfo[]> => {
  const client = getMinioClient();
  const bucket = options.bucket || ENV.MINIO.DEFAULT_BUCKET;

  try {
    const files: FileInfo[] = [];
    const stream = client.listObjects(bucket, options.prefix, options.recursive);

    return new Promise((resolve, reject) => {
      stream.on("data", async (obj) => {
        try {
          // Lấy URL phù hợp với loại bucket
          const url = options.isPublic
            ? getPublicFileUrl(obj.name!, bucket)
            : await getFileUrl(obj.name!, { bucket, isPublic: false });

          files.push({
            name: obj.name!,
            lastModified: obj.lastModified!,
            etag: obj.etag!,
            size: obj.size!,
            bucket,
            url,
          });
        } catch (error) {
          console.error(`Error processing object ${obj.name}:`, error);
        }
      });

      stream.on("end", () => resolve(files));
      stream.on("error", reject);
    });
  } catch (error) {
    console.error("Error listing files:", error);
    throw new BusinessError(`Failed to list files: ${(error as Error).message}`);
  }
};

/**
 * Kiểm tra file có tồn tại không (hoạt động cho cả public và private bucket)
 */
export const fileExists = async (
  objectName: string,
  options: PublicBucketOptions = {},
): Promise<boolean> => {
  const client = getMinioClient();
  const bucket = options.bucket || ENV.MINIO.DEFAULT_BUCKET;

  try {
    await client.statObject(bucket, objectName);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Copy file trong MinIO (hỗ trợ copy giữa public và private bucket)
 */
export const copyFile = async (
  sourceObjectName: string,
  destinationObjectName: string,
  options: {
    sourceBucket?: string;
    destinationBucket?: string;
    metadata?: Record<string, string>;
    makeDestinationPublic?: boolean;
  } = {},
): Promise<void> => {
  const client = getMinioClient();
  const sourceBucket = options.sourceBucket || ENV.MINIO.DEFAULT_BUCKET;
  const destinationBucket = options.destinationBucket || ENV.MINIO.DEFAULT_BUCKET;

  try {
    // Ensure destination bucket exists
    if (options.makeDestinationPublic) {
      await ensurePublicBucketExists(destinationBucket);
    } else {
      await ensureBucketExists(destinationBucket);
    }

    await client.copyObject(
      destinationBucket,
      destinationObjectName,
      `${sourceBucket}/${sourceObjectName}`,
    );
  } catch (error) {
    console.error("Error copying file:", error);
    throw new BusinessError(`Failed to copy file: ${(error as Error).message}`);
  }
};

// Helper functions cho public bucket
export const getPublicFileInfo = (objectName: string, bucket?: string) => {
  return getFileInfo(objectName, { bucket, isPublic: true });
};

export const listPublicFiles = (options: ListObjectsOptions = {}) => {
  return listFiles({ ...options, isPublic: true });
};

export const deletePublicFile = (objectName: string, bucket?: string) => {
  return deleteFile(objectName, { bucket });
};

export const deletePublicFiles = (objectNames: string[], bucket?: string) => {
  return deleteFiles(objectNames, { bucket });
};

export const copyToPublicBucket = (
  sourceObjectName: string,
  destinationObjectName: string,
  sourceBucket?: string,
  destinationBucket?: string,
) => {
  return copyFile(sourceObjectName, destinationObjectName, {
    sourceBucket,
    destinationBucket,
    makeDestinationPublic: true,
  });
};
