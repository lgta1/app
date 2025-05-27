export interface UploadResult {
  bucket: string;
  objectName: string;
  etag: string;
  url: string;
  versionId?: string;
}

export interface UploadOptions {
  bucket?: string;
  metadata?: Record<string, string>;
  contentType?: string;
  generateUniqueFileName?: boolean;
  tags?: Record<string, string>;
}

export interface DownloadOptions {
  bucket?: string;
  expires?: number; // URL expiration time in seconds (default: 7 days)
}

export interface FileInfo {
  name: string;
  lastModified: Date;
  etag: string;
  size: number;
  bucket: string;
  url?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface ListObjectsOptions {
  bucket?: string;
  prefix?: string;
  recursive?: boolean;
  maxKeys?: number;
}

export interface DeleteOptions {
  bucket?: string;
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
