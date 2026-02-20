import { notifyNewChapter } from "@/services/notification.svc";
import { getUserInfoFromSession } from "@/services/session.svc";

import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel, type ChapterType } from "~/database/models/chapter.model";
import { MangaModel } from "~/database/models/manga.model";
import { generateUniqueChapterSlug } from "~/database/helpers/chapter-slug.helper";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin, isDichGia } from "~/helpers/user.helper";
import { MANGA_STATUS } from "~/constants/manga";
import { getFileInfo } from "~/utils/minio.utils";
import { MINIO_CONFIG } from "@/configs/minio.config";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";

// Helpers to validate chapter image limits for UNAPPROVED manga
const MAX_IMAGES_UNAPPROVED = 100;
const MAX_PER_IMAGE_UNAPPROVED = 5 * 1024 * 1024; // 5MB
const MAX_TOTAL_UNAPPROVED = 130 * 1024 * 1024; // 130MB
const MAX_SCHEDULE_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;

const resolveNextChapterNumber = async (mangaId: string): Promise<number> => {
  const latest = await ChapterModel.findOne({ mangaId })
    .select({ chapterNumber: 1 })
    .sort({ chapterNumber: -1 })
    .lean();
  const latestNumber = Number((latest as any)?.chapterNumber || 0);
  return latestNumber + 1;
};

const resolveIncomingStatus = (rawStatus: unknown): number => {
  const status = Number(rawStatus);
  return status === CHAPTER_STATUS.APPROVED ||
      status === CHAPTER_STATUS.SCHEDULED
    ? status
    : CHAPTER_STATUS.APPROVED;
};

const resolveScheduleTimestamp = (rawPublishAt: unknown): Date => {
  const value = rawPublishAt instanceof Date ? rawPublishAt : new Date(String(rawPublishAt || ""));
  if (Number.isNaN(value.getTime())) {
    throw new BusinessError("Thời điểm hẹn giờ không hợp lệ");
  }
  const now = Date.now();
  const ts = value.getTime();
  if (ts <= now) {
    throw new BusinessError("Thời điểm hẹn giờ phải lớn hơn hiện tại");
  }
  if (ts > now + MAX_SCHEDULE_AHEAD_MS) {
    throw new BusinessError("Chỉ được hẹn giờ tối đa 30 ngày tới");
  }
  return value;
};

function fullPathFromPublicUrl(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/^\/+/, "");
    // If MinIO-style URL includes bucket as first segment, strip it
    const bucket = MINIO_CONFIG.DEFAULT_BUCKET;
    if (path.startsWith(bucket + "/")) {
      path = path.substring(bucket.length + 1);
    }
    return path;
  } catch {
    // Best-effort: treat as already a fullPath
    return url;
  }
}

async function fetchPublicImageSize(publicUrl: string): Promise<number> {
  const fullPath = fullPathFromPublicUrl(publicUrl);
  const info = await getFileInfo(fullPath, { isPublic: true });
  if (typeof info.size !== "number") {
    throw new BusinessError("Không xác định được dung lượng ảnh, vui lòng thử lại");
  }
  return info.size;
}

async function validateUnapprovedChapterConstraints(
  contentUrls: string[],
): Promise<number> {
  if (contentUrls.length > MAX_IMAGES_UNAPPROVED) {
    throw new BusinessError(
      `Truyện chưa duyệt chỉ được tối đa ${MAX_IMAGES_UNAPPROVED} ảnh mỗi chương`,
    );
  }

  let total = 0;
  for (const publicUrl of contentUrls) {
    const size = await fetchPublicImageSize(publicUrl);
    if (size > MAX_PER_IMAGE_UNAPPROVED) {
      throw new BusinessError(
        `Ảnh vượt quá 5MB: ${publicUrl.split("/").pop() || "file"}`,
      );
    }
    total += size;
    if (total > MAX_TOTAL_UNAPPROVED) {
      throw new BusinessError(
        `Tổng dung lượng chương vượt quá 130MB (hiện tại ~${(total / 1024 / 1024).toFixed(1)}MB)`,
      );
    }
  }

  return total;
}

async function calculateChapterContentBytes(contentUrls: string[]): Promise<number> {
  if (!Array.isArray(contentUrls) || contentUrls.length === 0) {
    return 0;
  }

  let total = 0;
  for (const publicUrl of contentUrls) {
    total += await fetchPublicImageSize(publicUrl);
  }
  return total;
}

// CHAPTER TITLE NORMALIZATION POLICY (2025-11-08)
// If incoming title is blank/placeholder ("" or only whitespace or "...")
// we auto-assign "Chap N" where N is the final chapterNumber after increment.
// This ensures consistent naming and removes the previous "..." fallback logic.
export const createChapter = async (
  request: Request,
  chapter: Omit<ChapterType, "id" | "createdAt" | "updatedAt">,
) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  const requestId = typeof (chapter as any).requestId === "string" ? (chapter as any).requestId.trim() : "";
  if (requestId) {
    const existing = await ChapterModel.findOne({ mangaId: chapter.mangaId, requestId }).lean();
    if (existing) {
      return existing as any;
    }
  }

  let query: any = {
    _id: chapter.mangaId,
  };

  if (!isAdmin(userInfo.role)) {
    query = {
      ...query,
      ownerId: userInfo.id,
    };
  }

  // Fetch manga first to enforce unapproved constraints safely
  const manga = await MangaModel.findOne(query);

  if (!manga) {
    throw new BusinessError("Không tìm thấy manga");
  }

  const contentUrls = (Array.isArray(chapter.contentUrls) ? chapter.contentUrls : []).map(
    (u) => rewriteLegacyCdnUrl(u),
  );

  const incomingStatus = resolveIncomingStatus((chapter as any).status);
  const isImmediatePublish = incomingStatus === CHAPTER_STATUS.APPROVED;
  const isScheduledPublish = incomingStatus === CHAPTER_STATUS.SCHEDULED;
  const publishAt = isScheduledPublish ? resolveScheduleTimestamp((chapter as any).publishAt) : undefined;
  const publishedAt = isImmediatePublish ? new Date() : undefined;

  // Unapproved gating rules (skip for admins)
  let totalBytes = 0;
  if (!isAdmin(userInfo.role) && manga.status !== MANGA_STATUS.APPROVED) {
    // 1) Only one chapter allowed until approved
    const existingCount = await ChapterModel.countDocuments({
      mangaId: chapter.mangaId,
      status: { $ne: CHAPTER_STATUS.REJECTED },
    });
    if (existingCount >= 1) {
      throw new BusinessError(
        "Truyện chưa được duyệt chỉ được đăng tối đa 1 chương",
      );
    }

    // 2) Per-chapter constraints (images/size)
    totalBytes = await validateUnapprovedChapterConstraints(contentUrls);
  } else {
    if (typeof (chapter as any).contentBytes === "number" && (chapter as any).contentBytes > 0) {
      totalBytes = (chapter as any).contentBytes;
    } else {
      totalBytes = await calculateChapterContentBytes(contentUrls);
    }
  }

  // Determine final chapter number BEFORE creation (do not mutate manga yet)
  const finalNumber = await resolveNextChapterNumber(String(chapter.mangaId));

  const rawTitle = (chapter.title ?? "").trim();
  const isPlaceholder = rawTitle === "..."; // legacy placeholder to ignore
  const finalTitle = rawTitle ? rawTitle : `Chap ${finalNumber}`;

  // Generate stable SEO slug ONCE, based on the initial title (or "Chap N" fallback).
  // If duplicated within this manga, add suffix: -2, -3, ...
  let chapterSlug = await generateUniqueChapterSlug(
    String(chapter.mangaId),
    isPlaceholder ? `Chap ${finalNumber}` : finalTitle,
  );

  // Best-effort retry to handle rare concurrent creates.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const newChapter = await ChapterModel.create({
        ...chapter,
        contentUrls,
        contentBytes: totalBytes,
        title: isPlaceholder ? `Chap ${finalNumber}` : finalTitle,
        chapterNumber: finalNumber,
        slug: chapterSlug,
        status: incomingStatus,
        ...(publishAt ? { publishAt } : {}),
        ...(publishedAt ? { publishedAt } : {}),
        ...(requestId ? { requestId } : {}),
      });

      if (isImmediatePublish) {
        try {
          await MangaModel.updateOne(
            { _id: manga.id },
            { $max: { chapters: finalNumber }, $set: { updatedAt: publishedAt || newChapter.createdAt } },
            { timestamps: false },
          );
        } catch (updateError) {
          console.warn("[createChapter] Failed to update manga counters", updateError);
        }

        try {
          await notifyNewChapter(newChapter, manga);
        } catch (notifyError) {
          console.warn("[createChapter] Failed to notify followers", notifyError);
        }
      }

      return newChapter;
    } catch (e: any) {
      const code = Number(e?.code);
      const msg = String(e?.message || "");
      const isDup = code === 11000 || msg.includes("E11000");
      if (!isDup) throw e;

      if (requestId) {
        const existingByRequest = await ChapterModel.findOne({ mangaId: chapter.mangaId, requestId }).lean();
        if (existingByRequest) return existingByRequest as any;
      }

      const existingByNumber = await ChapterModel.findOne({
        mangaId: chapter.mangaId,
        chapterNumber: finalNumber,
      }).lean();
      if (existingByNumber) return existingByNumber as any;

      // Recompute based on the same base title; suffix selection depends on current DB state.
      chapterSlug = await generateUniqueChapterSlug(
        String(chapter.mangaId),
        isPlaceholder ? `Chap ${finalNumber}` : finalTitle,
      );
    }
  }

  throw new BusinessError("Không thể tạo slug chương duy nhất, vui lòng thử lại");
};

// Internal/system chapter creation (no session cookie required).
// Intended for background workers where we already trust the job source.
export const createChapterAsAdmin = async (
  chapter: Omit<ChapterType, "id" | "createdAt" | "updatedAt">,
) => {
  const requestId = typeof (chapter as any).requestId === "string" ? (chapter as any).requestId.trim() : "";
  if (requestId) {
    const existing = await ChapterModel.findOne({ mangaId: chapter.mangaId, requestId }).lean();
    if (existing) {
      return existing as any;
    }
  }

  const manga = await MangaModel.findById(chapter.mangaId);
  if (!manga) {
    throw new BusinessError("Không tìm thấy manga");
  }

  const contentUrls = (Array.isArray(chapter.contentUrls) ? chapter.contentUrls : []).map((u) =>
    rewriteLegacyCdnUrl(u),
  );

  let totalBytes = 0;
  if (typeof (chapter as any).contentBytes === "number" && (chapter as any).contentBytes > 0) {
    totalBytes = (chapter as any).contentBytes;
  } else {
    totalBytes = await calculateChapterContentBytes(contentUrls);
  }

  const incomingStatus = resolveIncomingStatus((chapter as any).status);
  const isImmediatePublish = incomingStatus === CHAPTER_STATUS.APPROVED;
  const isScheduledPublish = incomingStatus === CHAPTER_STATUS.SCHEDULED;
  const publishAt = isScheduledPublish ? resolveScheduleTimestamp((chapter as any).publishAt) : undefined;
  const publishedAt = isImmediatePublish ? new Date() : undefined;

  const providedNumber = Number.isFinite((chapter as any).chapterNumber)
    ? Number((chapter as any).chapterNumber)
    : undefined;
  const finalNumber = providedNumber && providedNumber > 0
    ? providedNumber
    : await resolveNextChapterNumber(String(chapter.mangaId));

  const rawTitle = (chapter.title ?? "").trim();
  const isPlaceholder = rawTitle === "...";
  const finalTitle = rawTitle ? rawTitle : `Chap ${finalNumber}`;

  let chapterSlug = await generateUniqueChapterSlug(
    String(chapter.mangaId),
    isPlaceholder ? `Chap ${finalNumber}` : finalTitle,
  );

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const newChapter = await ChapterModel.create({
        ...chapter,
        contentUrls,
        contentBytes: totalBytes,
        title: isPlaceholder ? `Chap ${finalNumber}` : finalTitle,
        chapterNumber: finalNumber,
        slug: chapterSlug,
        status: incomingStatus,
        ...(publishAt ? { publishAt } : {}),
        ...(publishedAt ? { publishedAt } : {}),
        ...(requestId ? { requestId } : {}),
      });

      if (isImmediatePublish) {
        try {
          await MangaModel.updateOne(
            { _id: manga.id },
            { $max: { chapters: finalNumber }, $set: { updatedAt: publishedAt || newChapter.createdAt } },
            { timestamps: false },
          );
        } catch (updateError) {
          console.warn("[createChapterAsAdmin] Failed to update manga counters", updateError);
        }

        try {
          await notifyNewChapter(newChapter, manga);
        } catch (notifyError) {
          console.warn("[createChapterAsAdmin] Failed to notify followers", notifyError);
        }
      }
      return newChapter;
    } catch (e: any) {
      const code = Number(e?.code);
      const msg = String(e?.message || "");
      const isDup = code === 11000 || msg.includes("E11000");
      if (!isDup) throw e;

      if (requestId) {
        const existingByRequest = await ChapterModel.findOne({ mangaId: chapter.mangaId, requestId }).lean();
        if (existingByRequest) return existingByRequest as any;
      }

      const existingByNumber = await ChapterModel.findOne({
        mangaId: chapter.mangaId,
        chapterNumber: finalNumber,
      }).lean();
      if (existingByNumber) return existingByNumber as any;

      chapterSlug = await generateUniqueChapterSlug(
        String(chapter.mangaId),
        isPlaceholder ? `Chap ${finalNumber}` : finalTitle,
      );
    }
  }

  throw new BusinessError("Không thể tạo slug chương duy nhất, vui lòng thử lại");
};

// Update chapter: if title provided but blank/placeholder => normalize to auto-number.
export const updateChapter = async (
  request: Request,
  mangaId: string,
  chapterNumber: number,
  updateData: Partial<Pick<ChapterType, "title" | "contentUrls" | "contentBytes">>,
) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  // Verify manga permission: admin OR owner OR translator (translationTeam matches username)
  const manga = await MangaModel.findById(mangaId);
  if (!manga) {
    throw new BusinessError("Không tìm thấy manga hoặc bạn không có quyền chỉnh sửa");
  }

  if (!isAdmin(userInfo.role)) {
    const normalize = (v: any) => String(v ?? "").trim().toLowerCase();
    const isOwner = String((manga as any).ownerId) === String((userInfo as any).id);
    const isTranslatorForManga =
      isDichGia(userInfo.role) && normalize((userInfo as any)?.name) && normalize((manga as any)?.translationTeam) &&
      normalize((userInfo as any)?.name) === normalize((manga as any)?.translationTeam);
    if (!isOwner && !isTranslatorForManga) {
      throw new BusinessError("Không tìm thấy manga hoặc bạn không có quyền chỉnh sửa");
    }
  }

  // Enforce per-chapter constraints for unapproved manga (skip for admins)
  let updatedContentBytes: number | undefined;
  const normalizedContentUrls = Array.isArray(updateData.contentUrls)
    ? updateData.contentUrls.map((u) => rewriteLegacyCdnUrl(u))
    : undefined;

  if (Array.isArray(updateData.contentUrls)) {
    if (!isAdmin(userInfo.role) && manga.status !== MANGA_STATUS.APPROVED) {
      updatedContentBytes = await validateUnapprovedChapterConstraints(normalizedContentUrls!);
    } else if (typeof updateData.contentBytes === "number" && updateData.contentBytes > 0) {
      updatedContentBytes = updateData.contentBytes;
    } else {
      updatedContentBytes = await calculateChapterContentBytes(normalizedContentUrls!);
    }
  }

  // Update chapter
  const rawTitle = (updateData.title ?? "").trim();
  const isPlaceholder = rawTitle === "..."; // legacy value
  const finalTitle = rawTitle ? rawTitle : `Chap ${chapterNumber}`;

  const updatePayload: any = {
    ...updateData,
    ...(normalizedContentUrls ? { contentUrls: normalizedContentUrls } : null),
    title: isPlaceholder ? `Chap ${chapterNumber}` : finalTitle,
  };

  if (typeof updatedContentBytes === "number") {
    updatePayload.contentBytes = updatedContentBytes;
  }

  const updatedChapter = await ChapterModel.findOneAndUpdate(
    { mangaId, chapterNumber },
    updatePayload,
    { new: true },
  );

  if (!updatedChapter) {
    throw new BusinessError("Không tìm thấy chương");
  }

  return updatedChapter;
};

// Close-gap renumber when a chapter is deleted: all chapters with number > deletedNumber move up by 1
export const renumberAfterDelete = async (
  mangaId: string,
  deletedNumber: number,
) => {
  if (!mangaId || !Number.isFinite(deletedNumber)) return;
  await ChapterModel.updateMany(
    { mangaId, chapterNumber: { $gt: deletedNumber } },
    { $inc: { chapterNumber: -1 } },
  );
};

// Reorder chapters to match the provided ordered list of chapter IDs (ascending STT)
// Uses two-phase bulk updates to avoid unique index collisions on (mangaId, chapterNumber)
export const reorderChaptersByIds = async (
  mangaId: string,
  orderedChapterIds: string[],
) => {
  if (!mangaId) {
    throw new BusinessError("mangaId là bắt buộc");
  }
  if (!Array.isArray(orderedChapterIds) || orderedChapterIds.length === 0) {
    throw new BusinessError("Danh sách chương mới không hợp lệ");
  }

  const chapters = await ChapterModel.find({ mangaId }).select("_id").lean();
  const allIds = chapters.map((c: any) => String(c._id));

  if (allIds.length !== orderedChapterIds.length) {
    throw new BusinessError("Danh sách chương không khớp số lượng hiện có");
  }

  const setAll = new Set(allIds);
  for (const id of orderedChapterIds) {
    if (!setAll.has(String(id))) {
      throw new BusinessError("Danh sách chương chứa phần tử không thuộc manga này");
    }
  }

  // Build final mapping id -> chapterNumber (1..N) based on orderedChapterIds
  const finalMap = new Map<string, number>();
  orderedChapterIds.forEach((id, idx) => finalMap.set(String(id), idx + 1));

  const OFFSET = 1_000_000;

  // Phase 1: move to temporary range to avoid unique collisions
  const phase1 = orderedChapterIds.map((id) => ({
    updateOne: {
      filter: { _id: id, mangaId },
      update: { $inc: { chapterNumber: OFFSET } },
    },
  }));

  if (phase1.length) {
    await ChapterModel.bulkWrite(phase1);
  }

  // Phase 2: set final numbers 1..N
  const phase2 = orderedChapterIds.map((id) => ({
    updateOne: {
      filter: { _id: id, mangaId },
      update: { $set: { chapterNumber: finalMap.get(String(id))! } },
    },
  }));

  if (phase2.length) {
    await ChapterModel.bulkWrite(phase2);
  }

  return { count: orderedChapterIds.length };
};
