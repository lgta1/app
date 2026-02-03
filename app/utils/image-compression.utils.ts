import imageCompression from "browser-image-compression";

interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export type ImageSegmentMeta = {
  groupId?: string;
  segmentIndex?: number;
  segmentCount?: number;
  noWatermark?: boolean;
};

interface CompressionProgressCallback {
  (current: number, total: number): void;
}

type PosterAspect = "3:4" | "2:3" | "other";

interface PosterNormalizationResult {
  file: File;
  width: number;
  height: number;
  steps: {
    croppedToThreeFour: boolean;
    resizedToTarget: boolean;
    convertedToWebP: boolean;
    aspect: PosterAspect;
  };
}

export interface PosterVariantFile {
  file: File;
  width: number;
  height: number;
}

export interface PosterVariantsResult {
  w625: PosterVariantFile;
  w400?: PosterVariantFile;
  w220?: PosterVariantFile;
  usedWebP: boolean;
}

const POSTER_TARGET_WIDTH = 575;
const POSTER_ASPECT_TOLERANCE = 0.01;
const ASPECT_THREE_FOUR = 3 / 4;
const ASPECT_TWO_THREE = 2 / 3;

const SEGMENT_MAX_HEIGHT = 3000;
const SEGMENT_GROUP_ID_KEY = "__segmentGroupId";
const SEGMENT_INDEX_KEY = "__segmentIndex";
const SEGMENT_COUNT_KEY = "__segmentCount";
const SEGMENT_NOWATERMARK_KEY = "__noWatermark";

export const getImageSegmentMeta = (file: File): ImageSegmentMeta => {
  const anyFile = file as any;
  return {
    groupId: typeof anyFile?.[SEGMENT_GROUP_ID_KEY] === "string" ? anyFile[SEGMENT_GROUP_ID_KEY] : undefined,
    segmentIndex: typeof anyFile?.[SEGMENT_INDEX_KEY] === "number" ? anyFile[SEGMENT_INDEX_KEY] : undefined,
    segmentCount: typeof anyFile?.[SEGMENT_COUNT_KEY] === "number" ? anyFile[SEGMENT_COUNT_KEY] : undefined,
    noWatermark: Boolean(anyFile?.[SEGMENT_NOWATERMARK_KEY]),
  };
};

export const setImageSegmentMeta = (file: File, meta: ImageSegmentMeta): File => {
  const anyFile = file as any;
  if (meta.groupId) anyFile[SEGMENT_GROUP_ID_KEY] = meta.groupId;
  if (typeof meta.segmentIndex === "number") anyFile[SEGMENT_INDEX_KEY] = meta.segmentIndex;
  if (typeof meta.segmentCount === "number") anyFile[SEGMENT_COUNT_KEY] = meta.segmentCount;
  if (meta.noWatermark) {
    anyFile[SEGMENT_NOWATERMARK_KEY] = true;
  } else if (anyFile?.[SEGMENT_NOWATERMARK_KEY]) {
    delete anyFile[SEGMENT_NOWATERMARK_KEY];
  }
  return file;
};

export const copyImageSegmentMeta = (from: File, to: File): File => {
  const meta = getImageSegmentMeta(from);
  if (!meta.groupId && typeof meta.segmentIndex !== "number" && typeof meta.segmentCount !== "number") {
    return to;
  }
  return setImageSegmentMeta(to, meta);
};

const buildSegmentFileName = (name: string, segmentIndex: number) => {
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : "";
  return `${base}__p${segmentIndex + 1}${ext}`;
};

/**
 * Cắt ảnh dài theo chiều dọc (maxHeight).
 * - Tạo meta segment để điều khiển watermark sau này.
 */
export async function splitLongImages(
  files: File[],
  opts?: { maxHeight?: number },
): Promise<File[]> {
  const maxHeight = opts?.maxHeight ?? SEGMENT_MAX_HEIGHT;
  const results: File[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const groupId = `seg-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;

    if (file.type === "image/gif") {
      results.push(
        setImageSegmentMeta(file, {
          groupId,
          segmentIndex: 0,
          segmentCount: 1,
          noWatermark: false,
        }),
      );
      continue;
    }

    let dims: { width: number; height: number } | null = null;
    try {
      dims = await getImageDimensions(file);
    } catch {
      dims = null;
    }

    if (!dims || dims.height <= maxHeight) {
      results.push(
        setImageSegmentMeta(file, {
          groupId,
          segmentIndex: 0,
          segmentCount: 1,
          noWatermark: false,
        }),
      );
      continue;
    }

    const dataUrl = await imageCompression.getDataUrlFromFile(file);
    const img = await loadImage(dataUrl);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const segmentCount = Math.ceil(height / maxHeight);

    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
      const sy = segmentIndex * maxHeight;
      const sHeight = Math.min(maxHeight, height - sy);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = sHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Không thể khởi tạo canvas context");
      ctx.drawImage(img, 0, sy, width, sHeight, 0, 0, width, sHeight);

      const mime = file.type || "image/jpeg";
      const quality =
        mime === "image/webp" || mime === "image/jpeg" || mime === "image/jpg" ? 0.98 : undefined;
      const segmentFile = await canvasToFile(
        canvas,
        mime,
        buildSegmentFileName(file.name, segmentIndex),
        quality,
      );

      results.push(
        setImageSegmentMeta(segmentFile, {
          groupId,
          segmentIndex,
          segmentCount,
          noWatermark: segmentIndex > 0,
        }),
      );
    }
  }

  return results;
}

/**
 * QUY TẮC NÉN (cập nhật theo yêu cầu 15/01/2026):
 * 1) GIF
 *    - Giữ nguyên, không nén, không đổi định dạng.
 * 2) PNG
 *    - LUÔN chuyển sang WEBP (quality 0.95), sau đó áp dụng quy tắc (3).
 * 3) JPG / JPEG / WEBP / AVIF (và PNG sau khi convert)
 *    - ≤ 2MB: giữ nguyên.
 *    - > 2MB & ≤ 2.85MB:
 *        (a) Thử nén giảm chất lượng -10% trước.
 *            Nếu file mới < file hiện tại và < 2MB → dùng file mới.
 *        (b) Nếu (a) không đạt → scale còn 75% dựa trên file gốc (chưa bị giảm chất lượng).
 *    - > 2.85MB & ≤ 3.5MB: scale còn 65%.
 *    - > 3.5MB & ≤ 5MB: scale còn 55%.
 *    - > 5MB & ≤ 7MB: scale còn 45%.
 *    - > 7MB: scale còn 35%.
 * 4) Khác
 *    - Không chấp nhận → ném lỗi.
 *
 * Ghi chú:
 * - "scale" nghĩa là giảm cả width & height theo tỷ lệ phần trăm.
 * - Thước đo dung lượng dùng file.size (sau khi convert PNG→WEBP thì dùng size của file đã convert để quyết định scale tiếp).
 * - Tỷ lệ nén (compressionRatio) vẫn tính dựa trên kích thước gốc ban đầu trước mọi xử lý.
 */
export async function compressImageToWebP(file: File): Promise<CompressionResult> {
  const originalSize = file.size;
  const type = file.type;

  const MB = 1024 * 1024;

  // 3) GIF: giữ nguyên
  if (type === "image/gif") {
    return {
      compressedFile: copyImageSegmentMeta(file, file),
      originalSize,
      compressedSize: file.size,
      compressionRatio: ((originalSize - file.size) / originalSize) * 100,
    };
  }

  // Allowed base types in rule set
  const isJpgLike = ["image/jpeg", "image/jpg"].includes(type);
  const isWebp = type === "image/webp";
  const isAvif = type === "image/avif";
  const isPng = type === "image/png";

  if (!isJpgLike && !isWebp && !isAvif && !isPng) {
    throw new Error(`Định dạng không được chấp nhận: ${type || file.name}`);
  }

  // 2) PNG: luôn convert sang WEBP (quality 0.95)
  if (isPng) {
    let converted: File;
    try {
      converted = await convertToWebP(file, 0.95);
    } catch (e) {
      console.error("PNG->WEBP convert error", e);
      // fallback: giữ nguyên nếu thất bại convert
      return {
        compressedFile: copyImageSegmentMeta(file, file),
        originalSize,
        compressedSize: file.size,
        compressionRatio: 0,
      };
    }
    // Sau convert: áp quy tắc giống JPG/WebP/AVIF trên converted
    const scaled = await scaleByRule(converted, originalSize);
    return {
      ...scaled,
      compressedFile: copyImageSegmentMeta(file, scaled.compressedFile),
    };
  }

  // 1) JPG / WEBP / AVIF: áp trực tiếp quy tắc
  const scaled = await scaleByRule(file, originalSize);
  return {
    ...scaled,
    compressedFile: copyImageSegmentMeta(file, scaled.compressedFile),
  };
}

/** Áp quy tắc cho JPG / WEBP / AVIF (và PNG đã convert sang WEBP). */
async function scaleByRule(currentFile: File, originalSize: number): Promise<CompressionResult> {
  const MB = 1024 * 1024;
  const size = currentFile.size;

  const KEEP_UNDER_BYTES = 2 * MB;
  const TRY_QUALITY_UNDER_BYTES = 2.85 * MB;

  // ≤ 2MB: keep
  if (size <= KEEP_UNDER_BYTES) {
    return {
      compressedFile: currentFile,
      originalSize,
      compressedSize: currentFile.size,
      compressionRatio: ((originalSize - currentFile.size) / originalSize) * 100,
    };
  }

  // 2MB–2.85MB: try quality -10% first; if not good enough, scale 75% based on original (no quality reduction chained).
  if (size <= TRY_QUALITY_UNDER_BYTES) {
    const maybe = await tryReduceQualityMinus10(currentFile, originalSize, KEEP_UNDER_BYTES);
    if (maybe) return maybe;
    return await scaleByRatio(currentFile, originalSize, 0.75);
  }

  // Remaining tiers keep existing ratios
  if (size <= 3.5 * MB) return await scaleByRatio(currentFile, originalSize, 0.65);
  if (size <= 5 * MB) return await scaleByRatio(currentFile, originalSize, 0.55);
  if (size <= 7 * MB) return await scaleByRatio(currentFile, originalSize, 0.45);
  return await scaleByRatio(currentFile, originalSize, 0.35);

}

async function tryReduceQualityMinus10(
  currentFile: File,
  originalSize: number,
  mustBeUnderBytes: number,
): Promise<CompressionResult | null> {
  const mime = currentFile.type;

  // browser-image-compression only supports quality for JPEG/WebP reliably.
  const supportsQuality =
    mime === "image/jpeg" ||
    mime === "image/jpg" ||
    mime === "image/webp";
  if (!supportsQuality) return null;

  // Rule: -10% quality
  // - JPEG/JPG: 0.90
  // - WebP (including PNG->WebP converted earlier): 0.85 (matches 0.95 - 0.10)
  const trialQuality01 = mime === "image/webp" ? 0.85 : 0.9;

  try {
    const recompressed = await reencodeKeepResolution(currentFile, trialQuality01);
    if (recompressed.size < currentFile.size && recompressed.size < mustBeUnderBytes) {
      return {
        compressedFile: recompressed,
        originalSize,
        compressedSize: recompressed.size,
        compressionRatio: ((originalSize - recompressed.size) / originalSize) * 100,
      };
    }
  } catch (e) {
    console.warn(`Quality trial failed for "${currentFile.name}":`, e);
  }

  return null;
}

async function reencodeKeepResolution(file: File, quality01: number): Promise<File> {
  const mime = file.type;
  const options = {
    useWebWorker: true,
    fileType: mime as any,
    initialQuality: quality01,
    maxWidthOrHeight: await inferMaxDim(file),
    alwaysKeepResolution: true,
    exifOrientation: 1,
  };
  const blob = await imageCompression(file, options);
  return new File([blob], file.name, { type: mime, lastModified: Date.now() });
}

async function scaleByRatio(currentFile: File, originalSize: number, scaleRatio: number): Promise<CompressionResult> {
  try {
    const { width, height } = await getImageDimensions(currentFile);
    const maxDim = Math.max(width, height);
    const targetMaxDim = Math.max(1, Math.floor(maxDim * scaleRatio));

    const resized = await resizeKeepFormat(currentFile, { maxWidthOrHeight: targetMaxDim });
    const chosen = resized.size < currentFile.size ? resized : currentFile;

    return {
      compressedFile: chosen,
      originalSize,
      compressedSize: chosen.size,
      compressionRatio: ((originalSize - chosen.size) / originalSize) * 100,
    };
  } catch (e) {
    console.error(`Resize failed for "${currentFile.name}":`, e);
    return {
      compressedFile: currentFile,
      originalSize,
      compressedSize: currentFile.size,
      compressionRatio: ((originalSize - currentFile.size) / originalSize) * 100,
    };
  }

}

/** Chuyển bất kỳ File ảnh sang WEBP với quality (0..1). */
async function convertToWebP(file: File, quality: number): Promise<File> {
  const options = {
    useWebWorker: true,
    fileType: "image/webp" as const,
    initialQuality: quality,
    maxWidthOrHeight: await inferMaxDim(file),
    exifOrientation: 1,
  };
  const blob = await imageCompression(file, options);
  return new File([blob], createWebPFileName(file.name), { type: "image/webp", lastModified: Date.now() });
}

async function inferMaxDim(file: File): Promise<number> {
  try {
    const { width, height } = await getImageDimensions(file);
    return Math.max(width, height);
  } catch {
    return 99999; // fallback dữ liệu nếu lỗi đọc kích thước
  }
}

/** Lấy kích thước ảnh gốc (width/height) */
async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const dataUrl = await imageCompression.getDataUrlFromFile(file);
  const img = await loadImage(dataUrl);
  return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
}

/** Tạo đối tượng Image từ dataURL và chờ onload */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Resize bằng canvas nhưng GIỮ NGUYÊN MIME TYPE.
 * - Nếu file là JPEG → xuất JPEG; PNG → xuất PNG; WebP → xuất WebP (tránh dùng cho GIF).
 * - quality01 chỉ áp dụng nếu định dạng hỗ trợ (JPEG/WebP). PNG sẽ bỏ qua.
 */
function resizeKeepFormat(
  file: File,
  opts: { maxWidthOrHeight: number; quality01?: number },
): Promise<File> {
  const mime = file.type;
  const shouldAttachQuality =
    typeof opts.quality01 === "number" &&
    Number.isFinite(opts.quality01) &&
    opts.quality01 > 0 &&
    opts.quality01 <= 1 &&
    (mime === "image/jpeg" || mime === "image/jpg" || mime === "image/webp");

  const options = {
    useWebWorker: true,
    maxWidthOrHeight: opts.maxWidthOrHeight,
    alwaysKeepResolution: false,
    exifOrientation: 1,
    ...(shouldAttachQuality ? { initialQuality: opts.quality01 } : {}),
  };
  return imageCompression(file, options).then((blob) =>
    new File([blob], file.name, { type: mime, lastModified: Date.now() }),
  );
}

/**
 * Nén nhiều ảnh với callback progress (API giữ nguyên).
 * - Gọi onProgress(i, total) trước khi xử lý file thứ i.
 * - Cuối cùng gọi onProgress(total, total).
 * - Nếu 1 file lỗi, ném lỗi (hành vi cũ).
 */
export async function compressMultipleImages(
  files: File[],
  onProgress?: CompressionProgressCallback,
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = [];

  for (let i = 0; i < files.length; i++) {
    if (onProgress) onProgress(i, files.length);
    const file = files[i];

    try {
      const result = await compressImageToWebP(file);
      results.push(result);
    } catch (error) {
      console.error(`Error compressing file ${file.name}:`, error);
      throw new Error(
        `Không thể nén ảnh "${file.name}". Vui lòng kiểm tra định dạng file.`,
      );
    }
  }

  if (onProgress) onProgress(files.length, files.length);
  return results;
}

type AvatarNormalizationResult = {
  file: File;
  width: number;
  height: number;
  steps: {
    convertedToWebP: boolean;
    croppedToSquare: boolean;
    resizedTo300: boolean;
    keptOriginalSize: boolean;
  };
};

const cropCenterSquare = async (file: File): Promise<{ file: File; size: number }> => {
  const dataUrl = await imageCompression.getDataUrlFromFile(file);
  const img = await loadImage(dataUrl);
  const size = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);

  if ((img.naturalWidth || img.width) === (img.naturalHeight || img.height)) {
    return { file, size }; // đã là hình vuông
  }

  const sx = Math.floor(((img.naturalWidth || img.width) - size) / 2);
  const sy = Math.floor(((img.naturalHeight || img.height) - size) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể khởi tạo canvas context");
  ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);

  const mime = file.type || "image/jpeg";
  const squareFile = await canvasToFile(canvas, mime, file.name, mime === "image/webp" ? 0.99 : undefined);
  return { file: squareFile, size };
};

const resizeSquareToTarget = async (file: File, targetSize: number): Promise<File> => {
  const dataUrl = await imageCompression.getDataUrlFromFile(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể khởi tạo canvas context");
  ctx.drawImage(img, 0, 0, targetSize, targetSize);

  const mime = file.type || "image/jpeg";
  const quality = mime === "image/webp" ? 0.99 : undefined;
  const name = mime === "image/webp" ? createWebPFileName(file.name) : file.name;
  return canvasToFile(canvas, mime, name, quality);
};

/**
 * Chuẩn hóa ảnh đại diện (avatar) theo chuẩn:
 * - PNG -> chuyển WEBP (quality 0.99) trước, các định dạng JPG/WEBP giữ nguyên.
 * - Center crop về hình vuông nếu chưa vuông.
 * - Sau khi vuông: nếu cạnh > 300px -> resize về 300x300; nếu <= 300px giữ nguyên.
 */
export async function normalizeAvatarImage(file: File): Promise<AvatarNormalizationResult> {
  validateImageFile(file);

  const targetSize = 300;
  let working = file;
  let convertedToWebP = false;

  // PNG -> WEBP quality 0.99
  if (working.type === "image/png") {
    try {
      working = await convertToWebP(working, 0.99);
      convertedToWebP = true;
    } catch (error) {
      console.warn("PNG->WEBP avatar convert failed, giữ nguyên file gốc", error);
    }
  }

  const baseDims = await getImageDimensions(working);
  let croppedToSquare = false;
  let resizedTo300 = false;
  let keptOriginalSize = false;

  let squareResult: { file: File; size: number } = { file: working, size: Math.min(baseDims.width, baseDims.height) };
  if (baseDims.width !== baseDims.height) {
    squareResult = await cropCenterSquare(working);
    croppedToSquare = true;
  }

  let finalFile = squareResult.file;
  let finalSize = squareResult.size;

  if (finalSize > targetSize) {
    finalFile = await resizeSquareToTarget(finalFile, targetSize);
    finalSize = targetSize;
    resizedTo300 = true;
  } else {
    keptOriginalSize = true;
  }

  return {
    file: finalFile,
    width: finalSize,
    height: finalSize,
    steps: {
      convertedToWebP,
      croppedToSquare,
      resizedTo300,
      keptOriginalSize,
    },
  };
}

/** Format file size để hiển thị */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

/** Tạo tên file mới với extension .webp (giữ lại vì nơi khác có thể đang dùng) */
export function createWebPFileName(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  const nameWithoutExt = dot > 0 ? originalName.substring(0, dot) : originalName;
  return `${nameWithoutExt}.webp`;
}

/** Validate image file (API giữ nguyên) */
export function validateImageFile(file: File): boolean {
  const validTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
  ];
  const maxSize = 10 * 1024 * 1024; // 10MB tổng giới hạn kiểm tra sơ bộ
  if (!validTypes.includes(file.type)) {
    throw new Error(`File "${file.name}" có định dạng không được chấp nhận.`);
  }
  if (file.size > maxSize) {
    throw new Error(`File "${file.name}" quá lớn. Tối đa 10MB.`);
  }
  return true;
}

const classifyPosterAspect = (ratio: number): PosterAspect => {
  if (Math.abs(ratio - ASPECT_THREE_FOUR) <= POSTER_ASPECT_TOLERANCE) return "3:4";
  if (Math.abs(ratio - ASPECT_TWO_THREE) <= POSTER_ASPECT_TOLERANCE) return "2:3";
  return "other";
};

const canvasToFile = (canvas: HTMLCanvasElement, mime: string, name: string, quality?: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Không thể tạo blob từ canvas"));
          return;
        }
        resolve(new File([blob], name, { type: mime, lastModified: Date.now() }));
      },
      mime,
      quality,
    );
  });
};

const cropToThreeFour = async (file: File): Promise<{ file: File; width: number; height: number }> => {
  const dataUrl = await imageCompression.getDataUrlFromFile(file);
  const img = await loadImage(dataUrl);

  const ratio = img.naturalWidth / img.naturalHeight;
  if (classifyPosterAspect(ratio) !== "other") {
    return { file, width: img.naturalWidth, height: img.naturalHeight };
  }

  let cropWidth = img.naturalWidth;
  let cropHeight = img.naturalHeight;
  let sx = 0;
  let sy = 0;

  const targetRatio = ASPECT_THREE_FOUR;
  if (ratio > targetRatio) {
    cropWidth = Math.floor(img.naturalHeight * targetRatio);
    sx = Math.floor((img.naturalWidth - cropWidth) / 2);
  } else {
    cropHeight = Math.floor(img.naturalWidth / targetRatio);
    sy = Math.floor((img.naturalHeight - cropHeight) / 2);
  }

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể khởi tạo canvas context");
  ctx.drawImage(img, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  const croppedFile = await canvasToFile(canvas, file.type || "image/jpeg", file.name);
  return { file: croppedFile, width: cropWidth, height: cropHeight };
};

const resizePosterToWidth = async (
  file: File,
  targetWidth: number,
): Promise<{ file: File; width: number; height: number }> => {
  const dataUrl = await imageCompression.getDataUrlFromFile(file);
  const img = await loadImage(dataUrl);

  const width = Math.min(targetWidth, img.naturalWidth || img.width || targetWidth);
  const ratio = (img.naturalWidth || img.width || width) / (img.naturalHeight || img.height || width);
  const height = Math.max(1, Math.round(width / ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể khởi tạo canvas context");
  ctx.drawImage(img, 0, 0, width, height);

  const mime = file.type || "image/jpeg";
  const isWebP = mime === "image/webp";
  const isJpeg = mime === "image/jpeg" || mime === "image/jpg";
  const quality = isWebP ? 0.92 : isJpeg ? 0.9 : undefined;
  const nextFile = await canvasToFile(
    canvas,
    mime,
    isWebP ? createWebPFileName(file.name) : file.name,
    quality,
  );
  return { file: nextFile, width, height };
};

/**
 * Tạo variants ảnh bìa theo quy tắc mới:
 * - Crop về 3:4 nếu cần.
 * - Thử convert WEBP 0.95; chỉ dùng nếu nhỏ hơn gốc.
 * - Resize tối đa 575px (không upscale).
 * - Tạo 400px nếu width > 450.
 * - Tạo 220px nếu width > 301.
 */
export async function generatePosterVariants(file: File): Promise<PosterVariantsResult> {
  const baseDims = await getImageDimensions(file);
  const aspect = classifyPosterAspect(baseDims.width / baseDims.height);

  let working = file;
  let width = baseDims.width;
  let height = baseDims.height;

  if (aspect === "other") {
    const croppedResult = await cropToThreeFour(file);
    working = croppedResult.file;
    width = croppedResult.width;
    height = croppedResult.height;
  }

  let usedWebP = false;
  if (working.type !== "image/webp" && working.type !== "image/gif") {
    try {
      const converted = await convertToWebP(working, 0.95);
      if (converted.size < working.size) {
        working = converted;
        const dims = await getImageDimensions(working);
        width = dims.width;
        height = dims.height;
        usedWebP = true;
      }
    } catch (e) {
      console.warn("Poster WEBP convert failed", e);
    }
  }

  if (width > POSTER_TARGET_WIDTH) {
    const resizedResult = await resizePosterToWidth(working, POSTER_TARGET_WIDTH);
    working = resizedResult.file;
    width = resizedResult.width;
    height = resizedResult.height;
  }

  const w625: PosterVariantFile = { file: working, width, height };
  const variants: PosterVariantsResult = { w625, usedWebP };

  if (width > 450) {
    const w400Result = await resizePosterToWidth(working, 400);
    variants.w400 = {
      file: w400Result.file,
      width: w400Result.width,
      height: w400Result.height,
    };
  }

  if (width > 301) {
    const w220Result = await resizePosterToWidth(working, 220);
    variants.w220 = {
      file: w220Result.file,
      width: w220Result.width,
      height: w220Result.height,
    };
  }

  return variants;
}

/**
 * Chuẩn hóa ảnh bìa (áp dụng cho upload mới):
 * - Nhận 3:4 hoặc 2:3; nếu khác → crop center về 3:4.
 * - JPG/JPEG: giữ nguyên định dạng.
 * - WEBP: giữ nguyên định dạng.
 * - PNG: chuyển sang WEBP (không giữ PNG sau upload).
 * - Nếu width > 575px sau bước crop/convert → resize width=575, height theo tỉ lệ.
 * - Nếu width <= 575px → giữ nguyên kích thước (không resize).
 */
export async function normalizePosterImage(file: File): Promise<PosterNormalizationResult> {
  const baseDims = await getImageDimensions(file);
  const aspect = classifyPosterAspect(baseDims.width / baseDims.height);

  let working = file;
  let width = baseDims.width;
  let height = baseDims.height;
  let cropped = false;
  let convertedToWebP = false;
  let resized = false;

  if (aspect === "other") {
    const croppedResult = await cropToThreeFour(file);
    working = croppedResult.file;
    width = croppedResult.width;
    height = croppedResult.height;
    cropped = true;
  }

  if (working.type === "image/png") {
    const converted = await convertToWebP(working, 0.95);
    working = converted;
    const dims = await getImageDimensions(working);
    width = dims.width;
    height = dims.height;
    convertedToWebP = true;
  }

  if (width > POSTER_TARGET_WIDTH) {
    const resizedResult = await resizePosterToWidth(working, POSTER_TARGET_WIDTH);
    working = resizedResult.file;
    width = resizedResult.width;
    height = resizedResult.height;
    resized = true;
  }

  return {
    file: working,
    width,
    height,
    steps: {
      croppedToThreeFour: cropped,
      resizedToTarget: resized,
      convertedToWebP,
      aspect: aspect === "other" ? "3:4" : aspect,
    },
  };
}
