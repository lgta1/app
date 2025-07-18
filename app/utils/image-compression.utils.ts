import imageCompression from "browser-image-compression";

interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

interface CompressionProgressCallback {
  (current: number, total: number): void;
}

/**
 * Nén ảnh theo quy tắc:
 * ≤ 250KB: Giữ nguyên
 * 250KB – 1MB: Nén xuống 250KB
 * 1MB – 2MB: Nén xuống 600KB
 * > 2MB: Nén xuống ~1MB
 */
export async function compressImageToWebP(file: File): Promise<CompressionResult> {
  const originalSize = file.size;
  const sizeInMB = originalSize / (1024 * 1024);
  const sizeInKB = originalSize / 1024;

  let targetSizeInMB: number;
  const maxWidthOrHeight: number = 2000; // Max dimension to prevent too large images

  // Determine target size based on original size
  if (sizeInKB <= 250) {
    // ≤ 250KB: Giữ nguyên, chỉ chuyển sang WebP
    targetSizeInMB = sizeInMB;
  } else if (sizeInKB > 250 && sizeInMB <= 1) {
    // 250KB – 1MB: Nén xuống 250KB
    targetSizeInMB = 0.25;
  } else if (sizeInMB > 1 && sizeInMB <= 2) {
    // 1MB – 2MB: Nén xuống 600KB
    targetSizeInMB = 0.6;
  } else {
    // > 2MB: Nén xuống ~1MB
    targetSizeInMB = 1;
  }

  const options = {
    maxSizeMB: targetSizeInMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: "image/webp" as const,
    initialQuality: 1,
    alwaysKeepResolution: false,
    exifOrientation: 1,
  };

  try {
    const compressedFile = await imageCompression(file, options);

    // Ensure the file has WebP extension
    const webpFileName = createWebPFileName(file.name);
    const webpFile = new File([compressedFile], webpFileName, {
      type: "image/webp",
      lastModified: Date.now(),
    });

    return {
      compressedFile: webpFile,
      originalSize,
      compressedSize: webpFile.size,
      compressionRatio: ((originalSize - webpFile.size) / originalSize) * 100,
    };
  } catch (error) {
    console.error("Error compressing image:", error);
    throw new Error("Không thể nén ảnh. Vui lòng thử lại.");
  }
}

/**
 * Nén nhiều ảnh với callback progress
 */
export async function compressMultipleImages(
  files: File[],
  onProgress?: CompressionProgressCallback,
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Update progress
    if (onProgress) {
      onProgress(i, files.length);
    }

    try {
      const result = await compressImageToWebP(file);
      results.push(result);
    } catch (error) {
      console.error(`Error compressing file ${file.name}:`, error);
      // Continue with other files, but throw error with specific file info
      throw new Error(
        `Không thể nén ảnh "${file.name}". Vui lòng kiểm tra định dạng file.`,
      );
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress(files.length, files.length);
  }

  return results;
}

/**
 * Format file size để hiển thị
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

/**
 * Tạo tên file mới với extension .webp
 */
export function createWebPFileName(originalName: string): string {
  const nameWithoutExt =
    originalName.substring(0, originalName.lastIndexOf(".")) || originalName;
  return `${nameWithoutExt}.webp`;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): boolean {
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    throw new Error(`File "${file.name}" không phải là định dạng ảnh hợp lệ.`);
  }

  if (file.size > maxSize) {
    throw new Error(`File "${file.name}" quá lớn. Kích thước tối đa là 10MB.`);
  }

  return true;
}
