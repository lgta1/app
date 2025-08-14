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

interface CompressionTarget {
  minSizeKB: number;
  maxSizeKB: number;
  initialQuality: number;
}

/**
 * Nén ảnh theo quy tắc quality-based:
 * A: ≤ 300KB: Giữ nguyên
 * B: 300KB-1MB: Nén về 250-350KB (quality khởi điểm 80)
 * C: 1MB-2MB: Nén về 350-500KB (quality khởi điểm 80)
 * D: >2MB: Nén về 500-700KB (quality khởi điểm 80)
 */
export async function compressImageToWebP(file: File): Promise<CompressionResult> {
  const originalSize = file.size;
  const isAlreadyWebP = file.type === "image/webp";

  // Bước 1: Xử lý file để có được file WebP để đo dung lượng
  let initialWebPFile: File;
  if (isAlreadyWebP) {
    // Nếu đã là WebP, sử dụng trực tiếp
    initialWebPFile = file;
  } else {
    // Chuyển sang WebP với quality 100 để đo dung lượng
    initialWebPFile = await convertToWebP(file);
  }

  const webpSizeKB = initialWebPFile.size / 1024;

  // Phân nhóm dựa trên kích thước WebP
  if (webpSizeKB <= 300) {
    // Nhóm A: Giữ nguyên
    return {
      compressedFile: initialWebPFile,
      originalSize,
      compressedSize: initialWebPFile.size,
      compressionRatio: ((originalSize - initialWebPFile.size) / originalSize) * 100,
    };
  }

  // Xác định target compression cho các nhóm B, C, D
  let target: CompressionTarget;
  if (webpSizeKB > 300 && webpSizeKB <= 1024) {
    // Nhóm B: 300KB-1MB
    target = { minSizeKB: 250, maxSizeKB: 350, initialQuality: 80 };
  } else if (webpSizeKB > 1024 && webpSizeKB <= 2048) {
    // Nhóm C: 1MB-2MB
    target = { minSizeKB: 350, maxSizeKB: 500, initialQuality: 75 };
  } else {
    // Nhóm D: >2MB
    target = { minSizeKB: 500, maxSizeKB: 700, initialQuality: 70 };
  }

  // Bước 2: Nén với quality adjustment
  const finalFile = await compressWithQualityAdjustment(
    initialWebPFile,
    target,
    isAlreadyWebP,
  );

  return {
    compressedFile: finalFile,
    originalSize,
    compressedSize: finalFile.size,
    compressionRatio: ((originalSize - finalFile.size) / originalSize) * 100,
  };
}

/**
 * Chuyển ảnh sang WebP với quality 100 (chỉ đổi format)
 */
async function convertToWebP(file: File): Promise<File> {
  const options = {
    useWebWorker: true,
    fileType: "image/webp" as const,
    initialQuality: 1, // Quality 100%
    alwaysKeepResolution: true,
    exifOrientation: 1,
  };

  const convertedFile = await imageCompression(file, options);
  const webpFileName = createWebPFileName(file.name);

  return new File([convertedFile], webpFileName, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

/**
 * Nén với điều chỉnh quality để đạt target size
 */
async function compressWithQualityAdjustment(
  file: File,
  target: CompressionTarget,
  isAlreadyWebP: boolean = false,
): Promise<File> {
  let quality = target.initialQuality;
  let attempts = 0;
  const maxAttempts = 5;
  const qualityStep = 5;
  const minQuality = 50;
  const maxQuality = 95;

  while (attempts < maxAttempts) {
    const options = {
      useWebWorker: true,
      fileType: "image/webp" as const,
      initialQuality: quality / 100, // Convert to 0-1 range
      alwaysKeepResolution: true,
      exifOrientation: 1,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      const webpFileName = isAlreadyWebP ? file.name : createWebPFileName(file.name);
      const finalFile = new File([compressedFile], webpFileName, {
        type: "image/webp",
        lastModified: Date.now(),
      });

      const resultSizeKB = finalFile.size / 1024;

      // Kiểm tra giới hạn quality
      if (quality <= minQuality || quality >= maxQuality) {
        return finalFile;
      }

      // Kiểm tra nếu đạt target
      if (resultSizeKB >= target.minSizeKB && resultSizeKB <= target.maxSizeKB) {
        return finalFile;
      }

      // Điều chỉnh quality
      if (resultSizeKB > target.maxSizeKB) {
        // Quá lớn → giảm quality
        quality = Math.max(minQuality, quality - qualityStep);
      } else {
        // Quá nhỏ → tăng quality
        quality = Math.min(maxQuality, quality + qualityStep);
      }

      attempts++;
    } catch (error) {
      console.error(`Error at quality ${quality}:`, error);
      break;
    }
  }

  // Fallback: trả về với quality cuối cùng
  const fallbackOptions = {
    useWebWorker: true,
    fileType: "image/webp" as const,
    initialQuality: quality / 100,
    alwaysKeepResolution: true,
    exifOrientation: 1,
  };

  const fallbackFile = await imageCompression(file, fallbackOptions);
  const webpFileName = isAlreadyWebP ? file.name : createWebPFileName(file.name);

  return new File([fallbackFile], webpFileName, {
    type: "image/webp",
    lastModified: Date.now(),
  });
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
