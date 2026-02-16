import { validateImageFile } from "~/utils/image-compression.utils";

const ALLOWED_CHAPTER_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_CHAPTER_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_TYPE_DETAILS = 4;

const getFileExtension = (filename: string) => {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === filename.length - 1) return "";
  return filename.slice(dotIndex + 1).toLowerCase();
};

const inferFormatLabel = (file: File) => {
  const extension = getFileExtension(file.name);
  if (extension) return extension;

  const mime = String(file.type || "").toLowerCase();
  if (!mime) return "không rõ";

  const slashIndex = mime.indexOf("/");
  if (slashIndex >= 0 && slashIndex < mime.length - 1) {
    return mime.slice(slashIndex + 1);
  }
  return mime;
};

const isAcceptedChapterImageType = (file: File) => {
  const extension = getFileExtension(file.name);
  const mime = String(file.type || "").toLowerCase();

  const byExtension = extension ? ALLOWED_CHAPTER_IMAGE_EXTENSIONS.has(extension) : false;
  const byMime = mime ? ALLOWED_CHAPTER_IMAGE_MIME_TYPES.has(mime) : false;

  return byExtension || byMime;
};

const formatTypeBreakdown = (typeCounts: Map<string, number>) => {
  const sorted = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);
  const shown = sorted.slice(0, MAX_TYPE_DETAILS).map(([ext, count]) => `${ext}: ${count}`);
  const hiddenTypeCount = Math.max(0, sorted.length - MAX_TYPE_DETAILS);
  if (hiddenTypeCount > 0) shown.push(`+${hiddenTypeCount} loại khác`);
  return shown.join(", ");
};

export type ChapterUploadValidationResult = {
  validFiles: File[];
  invalidFormatCount: number;
  invalidFormatBreakdown: string;
  oversizedCount: number;
};

export function validateChapterUploadFiles(filesLike: FileList | File[]): ChapterUploadValidationResult {
  const files = Array.from(filesLike);
  const validFiles: File[] = [];
  const invalidTypeCounts = new Map<string, number>();
  let oversizedCount = 0;

  for (const file of files) {
    if (!isAcceptedChapterImageType(file)) {
      const label = inferFormatLabel(file);
      invalidTypeCounts.set(label, (invalidTypeCounts.get(label) || 0) + 1);
      continue;
    }

    try {
      validateImageFile(file);
      validFiles.push(file);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("quá lớn") || message.includes("10mb")) {
        oversizedCount += 1;
      } else {
        const label = inferFormatLabel(file);
        invalidTypeCounts.set(label, (invalidTypeCounts.get(label) || 0) + 1);
      }
    }
  }

  const invalidFormatCount = Array.from(invalidTypeCounts.values()).reduce((sum, count) => sum + count, 0);

  return {
    validFiles,
    invalidFormatCount,
    invalidFormatBreakdown: formatTypeBreakdown(invalidTypeCounts),
    oversizedCount,
  };
}

export function buildChapterUploadValidationMessage(result: ChapterUploadValidationResult) {
  const messages: string[] = [];

  if (result.invalidFormatCount > 0) {
    const breakdown = result.invalidFormatBreakdown
      ? ` (${result.invalidFormatBreakdown})`
      : "";
    messages.push(
      `Đã bỏ qua ${result.invalidFormatCount} file định dạng không hợp lệ${breakdown}. Chỉ nhận jpg, jpeg, png, webp.`,
    );
  }

  if (result.oversizedCount > 0) {
    messages.push(`Đã bỏ qua ${result.oversizedCount} file vượt quá 10MB.`);
  }

  return messages.join(" ");
}
