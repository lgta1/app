export interface UploadResult {
  objectName: string;
  etag: string;
  url: string;
  versionId?: string;
  fullPath: string; // Complete path including prefix
}

export interface UploadOptions {
  prefixPath?: string; // Prefix path for file organization (e.g., "images/avatars", "documents/pdfs")
  metadata?: Record<string, string>;
  contentType?: string;
  generateUniqueFileName?: boolean;
  tags?: Record<string, string>;
  cacheControl?: string;
}

export interface DownloadOptions {
  prefixPath?: string;
  expires?: number; // URL expiration time in seconds (default: 7 days)
}

export interface FileInfo {
  name: string; // Original file name
  fullPath: string; // Complete path in bucket (prefix + name)
  lastModified: Date;
  etag: string;
  size: number;
  url?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  prefixPath?: string; // Extracted prefix path
}

export interface ListObjectsOptions {
  prefixPath?: string; // Filter by prefix path
  recursive?: boolean;
  maxKeys?: number;
}

export interface DeleteOptions {
  prefixPath?: string; // Prefix path for file location
}

export interface MinioError extends Error {
  code?: string;
  statusCode?: number;
  resource?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type SupportedImageFormat = "jpeg" | "jpg" | "png" | "gif" | "webp" | "svg";
export type SupportedDocumentFormat =
  | "pdf"
  | "doc"
  | "docx"
  | "xls"
  | "xlsx"
  | "ppt"
  | "pptx"
  | "txt";
export type SupportedVideoFormat = "mp4" | "avi" | "mov" | "wmv" | "flv" | "webm";
export type SupportedAudioFormat = "mp3" | "wav" | "ogg" | "aac" | "flac";

export type AllowedFileFormat =
  | SupportedImageFormat
  | SupportedDocumentFormat
  | SupportedVideoFormat
  | SupportedAudioFormat;
