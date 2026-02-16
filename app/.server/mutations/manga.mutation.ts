import mongoose, { Types } from "mongoose";

import { getUserInfoFromSession } from "@/services/session.svc";
import { generateMangaShareImage } from "@/services/share-image.svc";

import { MANGA_CONTENT_TYPE, MANGA_STATUS, MANGA_USER_STATUS, type MangaContentType } from "~/constants/manga";
import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel } from "~/database/models/chapter.model";
import { CommentModel } from "~/database/models/comment.model";
import { UserLikeCommentModel } from "~/database/models/user-like-comment.model";
import { UserReactionCommentModel } from "~/database/models/user-reaction-comment.model";
import { generateUniqueMangaSlug, resolveMangaHandle } from "~/database/helpers/manga-slug.helper";
import { MangaModel, type MangaType } from "~/database/models/manga.model";
import { MangaRatingModel } from "~/database/models/manga-rating.model";
import { MangaRevenueModel } from "~/database/models/manga-revenue.model";
import { UserModel } from "~/database/models/user.model";
import { AdminActionLogModel } from "~/database/models/admin-action-log.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserLikeMangaModel } from "~/database/models/user-like-manga.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { UserChapterReactionModel } from "~/database/models/user-chapter-reaction.model";
import { ReadingRewardClaimModel } from "~/database/models/reading-reward-claim.model";
import { ReportModel } from "~/database/models/report.model";
import { NotificationModel } from "~/database/models/notification.model";
import { InteractionModel } from "~/database/models/interaction.model";
import {
  DailyLeaderboardModel,
  WeeklyLeaderboardModel,
  MonthlyLeaderboardModel,
} from "~/database/models/leaderboard.model";
import { HotCarouselSnapshotModel } from "~/database/models/hot-carousel-snapshot.model";
import { ViHentaiAutoUpdateQueueModel } from "~/database/models/vi-hentai-auto-update-queue.model";
import { ViHentaiAutoUpdateRunModel } from "~/database/models/vi-hentai-auto-update-run.model";
import { ViHentaiAutoDownloadJobModel } from "~/database/models/vi-hentai-auto-download-job.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin, isDichGia } from "~/helpers/user.helper";
import { createNotification } from "@/mutations/notification.mutation";
import { UserFollowAuthorModel } from "~/database/models/user-follow-author.model";
import { UserFollowTranslatorModel } from "~/database/models/user-follow-translator.model";
import { AuthorModel } from "~/database/models/author.model";
import { TranslatorModel } from "~/database/models/translator.model";
import { MINIO_CONFIG } from "@/configs/minio.config";
import { getCdnBase } from "~/.server/utils/cdn-url";
import { deleteFiles, getEnvironmentPrefix, listFiles } from "~/utils/minio.utils";

const resolveMangaMutationTarget = async (handle: string) => {
  if (!handle) return null;
  const doc = await resolveMangaHandle(handle);
  if (!doc) return null;
  const targetId = String((doc as any)._id ?? (doc as any).id ?? "");
  if (!targetId) return null;
  return { doc, targetId };
};

type StorageCleanupReport = {
  deleted: boolean;
  errors: string[];
};

const toObjectId = (value: string | null | undefined) =>
  value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;

const dedupeStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter(Boolean) as string[]));

export const hardDeleteManga = async (request: Request, mangaId: string) => {
  const manga = await MangaModel.findById(mangaId).lean();

  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  const envPrefix = getEnvironmentPrefix();
  const bucketMarker = `/${String(MINIO_CONFIG.DEFAULT_BUCKET || "")}/`;
  const cdnBase = getCdnBase(request as any).replace(/\/+$/, "");

  const toFullPathIfInternal = (urlRaw?: string | null) => {
    const u = (urlRaw || "").toString().trim();
    if (!u) return null;
    if (!(u.startsWith(cdnBase + "/") || u.includes(bucketMarker))) return null;
    try {
      const url = new URL(u);
      if (bucketMarker && url.pathname.includes(bucketMarker)) {
        const rest = url.pathname.split(bucketMarker)[1];
        return rest ? rest.replace(/^\/+/, "") : null;
      }
      return url.pathname.replace(/^\/+/, "");
    } catch {
      return null;
    }
  };

  const deletePrefix = async (prefixPath: string) => {
    const normalized = prefixPath.replace(/^\/+|\/+$/g, "");
    const actualPrefix = envPrefix ? `${envPrefix}/${normalized}` : normalized;
    const files = await listFiles({ prefixPath: actualPrefix, recursive: true, isPublic: true } as any);
    const fullPaths = files.map((f: any) => String(f.fullPath || "")).filter(Boolean);
    const CHUNK = 500;
    for (let i = 0; i < fullPaths.length; i += CHUNK) {
      await deleteFiles(fullPaths.slice(i, i + CHUNK));
    }
  };

  const chapters = await ChapterModel.find({ mangaId }).select("_id contentUrls").lean();
  const chapterObjectIds = chapters.map((chapter) => chapter._id).filter(Boolean);
  const chapterIdStrings = chapters.map((chapter) => String((chapter as any)._id || "")).filter(Boolean);
  const contentUrls = chapters.flatMap((chapter) =>
    Array.isArray((chapter as any).contentUrls) ? (chapter as any).contentUrls : [],
  );
  const contentPaths = contentUrls.map((url) => toFullPathIfInternal(String(url))).filter(Boolean) as string[];

  const posterFullPath = toFullPathIfInternal((manga as any)?.poster);
  const shareFullPath = toFullPathIfInternal((manga as any)?.shareImage);
  const extraStoragePaths = dedupeStrings([posterFullPath, shareFullPath, ...contentPaths]);

  const runCascadeDeletes = async (session?: mongoose.ClientSession) => {
    const sessionOpt = session ? { session } : undefined;
    const mangaObjectId = toObjectId(mangaId);

    const commentQuery = CommentModel.find({ mangaId }).select("_id");
    if (session) commentQuery.session(session);
    const commentDocs = await commentQuery;
    const commentIds = commentDocs.map((doc) => String((doc as any)._id || "")).filter(Boolean);

    if (commentIds.length) {
      await UserLikeCommentModel.deleteMany({ commentId: { $in: commentIds } }, sessionOpt);
      await UserReactionCommentModel.deleteMany({ commentId: { $in: commentIds } }, sessionOpt);
    }

    if (chapterObjectIds.length) {
      await UserReadChapterModel.deleteMany({ chapterId: { $in: chapterObjectIds } }, sessionOpt);
    }

    if (chapterIdStrings.length) {
      await UserChapterReactionModel.deleteMany({ chapterId: { $in: chapterIdStrings } }, sessionOpt);
      await ReadingRewardClaimModel.deleteMany({ chapterId: { $in: chapterIdStrings } }, sessionOpt);
    }

    await CommentModel.deleteMany({ mangaId }, sessionOpt);
    await UserFollowMangaModel.deleteMany({ mangaId }, sessionOpt);
    await UserLikeMangaModel.deleteMany({ mangaId }, sessionOpt);
    await MangaRatingModel.deleteMany({ mangaId }, sessionOpt);
    await MangaRevenueModel.deleteMany({ mangaId }, sessionOpt);
    await ChapterModel.deleteMany({ mangaId }, sessionOpt);

    if (mangaObjectId) {
      await InteractionModel.deleteMany({ story_id: mangaObjectId }, sessionOpt);
      await DailyLeaderboardModel.deleteMany({ story_id: mangaObjectId }, sessionOpt);
      await WeeklyLeaderboardModel.deleteMany({ story_id: mangaObjectId }, sessionOpt);
      await MonthlyLeaderboardModel.deleteMany({ story_id: mangaObjectId }, sessionOpt);

      const reportFilters: any[] = [{ mangaId: mangaObjectId }, { targetId: mangaObjectId }];
      if (chapterObjectIds.length) {
        reportFilters.push({ targetId: { $in: chapterObjectIds } });
      }
      await ReportModel.deleteMany({ $or: reportFilters }, sessionOpt);
    }

    const notificationFilters: any[] = [{ targetId: mangaId }];
    if ((manga as any)?.slug) {
      const slug = String((manga as any).slug || "").trim();
      if (slug) {
        notificationFilters.push({ targetUrl: new RegExp(`/truyen-hentai/${slug}(?:$|\\?)`) });
      }
    }

    await NotificationModel.deleteMany({ $or: notificationFilters }, sessionOpt);
    await AdminActionLogModel.deleteMany({ mangaId }, sessionOpt);

    await ViHentaiAutoDownloadJobModel.deleteMany(
      { $or: [{ createdMangaId: mangaId }, { "progress.mangaId": mangaId }] },
      sessionOpt,
    );

    await ViHentaiAutoUpdateQueueModel.updateMany(
      { "items.mangaId": mangaId },
      { $pull: { items: { mangaId } } },
      sessionOpt,
    );

    await ViHentaiAutoUpdateRunModel.updateMany(
      { "items.mangaId": mangaId },
      { $pull: { items: { mangaId } } },
      sessionOpt,
    );

    await HotCarouselSnapshotModel.updateMany({ items: mangaId }, { $pull: { items: mangaId } }, sessionOpt);

    const presenceKey = `presence.${mangaId}`;
    await HotCarouselSnapshotModel.updateMany(
      { [presenceKey]: { $exists: true } },
      { $unset: { [presenceKey]: "" } },
      sessionOpt,
    );

    await MangaModel.findByIdAndDelete(mangaId, sessionOpt as any);
    await UserModel.findByIdAndUpdate((manga as any).ownerId, { $inc: { mangasCount: -1 } }, sessionOpt as any);
  };

  const isTransactionUnsupported = (err: any) => {
    const msg = String(err?.message || "").toLowerCase();
    return (
      msg.includes("transaction") &&
      (msg.includes("replica set") ||
        msg.includes("mongos") ||
        msg.includes("not supported") ||
        msg.includes("transaction numbers are only allowed"))
    );
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await runCascadeDeletes(session);
    });
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      console.warn("[hardDeleteManga] transaction unsupported; falling back to non-transaction delete", error);
      await runCascadeDeletes();
    } else {
      throw error;
    }
  } finally {
    session.endSession();
  }

  const storageReport: StorageCleanupReport = { deleted: true, errors: [] };

  try {
    await deletePrefix(`manga-images/${mangaId}`);
  } catch (cleanupError) {
    const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    storageReport.deleted = false;
    storageReport.errors.push(`deletePrefix:manga-images/${mangaId}:${message}`);
    console.warn("[hardDeleteManga] storage prefix cleanup failed", cleanupError);
  }

  if (extraStoragePaths.length) {
    const CHUNK = 500;
    for (let i = 0; i < extraStoragePaths.length; i += CHUNK) {
      try {
        await deleteFiles(extraStoragePaths.slice(i, i + CHUNK));
      } catch (cleanupError) {
        const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        storageReport.deleted = false;
        storageReport.errors.push(`deleteFiles:${message}`);
        console.warn("[hardDeleteManga] storage file cleanup failed", cleanupError);
      }
    }
  }

  return {
    success: true,
    message: "Xóa truyện thành công",
    storage: storageReport,
  };
};

export const deleteManga = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để xóa truyện");
  }

  if (!isAdmin(userInfo.role)) {
    throw new BusinessError("Bạn không có quyền xóa truyện");
  }

  return hardDeleteManga(request, mangaId);
};

export const createManga = async (
  request: Request,
  manga: Omit<MangaType, "id" | "slug" | "createdAt" | "updatedAt" | "chapters" | "status"> & {
    contentType?: MangaContentType;
  },
) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để tạo truyện");
  }
  if (!Object.values(MANGA_USER_STATUS).includes(manga.userStatus)) {
    throw new BusinessError("Truyện không được tạo với trạng thái này");
  }
  const isAdminUser = isAdmin(userInfo.role);
  // Auto approve nếu là dịch giả và là owner (ownerId đã gắn = userInfo.id ở layer gọi)
  const shouldAutoApprove = isDichGia(userInfo.role) && String(manga.ownerId) === String(userInfo.id);
  const requestedContentType = manga.contentType;
  const resolvedContentType =
    isAdminUser && requestedContentType === MANGA_CONTENT_TYPE.COSPLAY
      ? MANGA_CONTENT_TYPE.COSPLAY
      : MANGA_CONTENT_TYPE.MANGA;

  const slug = await generateUniqueMangaSlug(manga.title);

  const doc = await MangaModel.create({
    ...manga,
    contentType: resolvedContentType,
    slug,
    ...(shouldAutoApprove ? { status: MANGA_STATUS.APPROVED } : {}),
  });

  try {
    const shareImage = await generateMangaShareImage({
      mangaId: String(doc._id),
      title: manga.title,
      posterUrl: manga.poster,
    });

    if (shareImage) {
      await MangaModel.findByIdAndUpdate(doc._id, { shareImage }, { timestamps: false });
      (doc as any).shareImage = shareImage;
    }
  } catch (error) {
    console.error("[createManga] Không thể tạo ảnh chia sẻ", error);
  }

  if (shouldAutoApprove) {
    try {
      await AdminActionLogModel.create({
        action: 'AUTO_APPROVE_DICHGIA',
        adminId: userInfo.id, // ghi lại user thực hiện (dịch giả)
        mangaId: String(doc._id),
      } as any);
    } catch (e) {
      console.warn('[createManga] log auto approve failed', e);
    }
  }

  return doc;
};

export const updateManga = async (
  request: Request,
  id: string,
  data: Partial<Omit<MangaType, "_id" | "id" | "slug" | "createdAt" | "updatedAt" | "chapters">>,
) => {
  let userInfo: Awaited<ReturnType<typeof getUserInfoFromSession>> | null = null;
  try {
    userInfo = await getUserInfoFromSession(request);
  } catch {
    userInfo = null;
  }
  const canEditContentType = !!userInfo && isAdmin(userInfo.role);
  const manga = await MangaModel.findById(id);

  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  const payload: Record<string, any> = { ...data };
  const willReject =
    typeof payload.status === "number" &&
    payload.status === MANGA_STATUS.REJECTED &&
    manga.status !== MANGA_STATUS.REJECTED;
  const rejectReasonText = typeof payload.rejectReason === "string" ? payload.rejectReason.trim() : "";
  if ("contentType" in payload) {
    if (canEditContentType) {
      payload.contentType =
        payload.contentType === MANGA_CONTENT_TYPE.COSPLAY
          ? MANGA_CONTENT_TYPE.COSPLAY
          : MANGA_CONTENT_TYPE.MANGA;
    } else {
      delete payload.contentType;
    }
  }
  const posterSource = data.poster || manga.poster;
  const titleSource = data.title || manga.title;
  const needsShareImage = Boolean(
    (posterSource && !manga.shareImage) ||
      (data.poster && data.poster !== manga.poster) ||
      (data.title && !!manga.shareImage),
  );

  if (needsShareImage && posterSource) {
    try {
      const shareImage = await generateMangaShareImage({
        mangaId: id,
        title: titleSource,
        posterUrl: posterSource,
      });

      if (shareImage) {
        payload.shareImage = shareImage;
      }
    } catch (error) {
      console.error("[updateManga] Không thể tạo ảnh chia sẻ", error);
    }
  }

  // Không cập nhật updatedAt khi chỉ sửa metadata
  await MangaModel.findByIdAndUpdate(id, { $set: payload }, { timestamps: false });

  if (willReject && userInfo && isAdmin(userInfo.role)) {
    const title = "Có Truyện Bị Từ Chối";
    const reasonText = rejectReasonText || "Không có lý do.";
    const subtitle = `Truyện "${manga.title}" bị từ chối với lý do: ${reasonText}`;
    try {
      await createNotification({
        userId: String(manga.ownerId || ""),
        title,
        subtitle,
        imgUrl: "/images/noti/system.png",
        type: "manga-rejected",
        targetType: "manga",
        targetId: String(manga._id || id),
        targetSlug: String(manga.slug || ""),
      });
    } catch (e) {
      console.warn("[updateManga] reject notification failed", e);
    }
  }
};

export const submitMangaToReview = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để nộp truyện");
  }

  const resolved = await resolveMangaMutationTarget(mangaId);
  if (!resolved) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  if (String((resolved.doc as any).ownerId) !== String(userInfo.id)) {
    throw new BusinessError("Bạn không có quyền nộp truyện này");
  }

  if ((resolved.doc as any).status === MANGA_STATUS.APPROVED) {
    throw new BusinessError("Truyện đã được duyệt");
  }

  await MangaModel.findByIdAndUpdate(
    resolved.targetId,
    { $set: { status: MANGA_STATUS.PENDING, rejectReason: "" } },
    { timestamps: false },
  );

  return {
    success: true,
    message: "Nộp truyện thành công",
  };
};

export const approveManga = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để duyệt truyện");
  }

  if (!isAdmin(userInfo.role)) {
    throw new BusinessError("Bạn không có quyền duyệt truyện");
  }

  const resolved = await resolveMangaMutationTarget(mangaId);
  if (!resolved) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  const wasApproved = (resolved.doc as any)?.status === MANGA_STATUS.APPROVED;

  await MangaModel.findByIdAndUpdate(
    resolved.targetId,
    { $set: { status: MANGA_STATUS.APPROVED } },
    { timestamps: false },
  );

  // Khi duyệt manga, tự động duyệt các chapter đang pending để public có thể hiển thị ngay.
  // Không đụng chapter rejected/scheduled để tránh phá workflow riêng.
  try {
    const now = new Date();
    await ChapterModel.updateMany(
      {
        mangaId: String(resolved.targetId),
        status: CHAPTER_STATUS.PENDING,
      },
      {
        $set: {
          status: CHAPTER_STATUS.APPROVED,
          publishedAt: now,
        },
      },
      { timestamps: false },
    );
  } catch (error) {
    console.warn("[approveManga] approve pending chapters failed", error);
  }

  // Notify followers (non-blocking, best-effort) when manga is released (approved).
  if (!wasApproved) {
    const mangaDoc = resolved.doc as any;
    const title: string = String(mangaDoc?.title ?? "Truyện mới");
    const poster: string = String(mangaDoc?.poster ?? "/images/logo.webp");
    const slug: string | null = mangaDoc?.slug ? String(mangaDoc.slug) : null;
    const authorSlugs: string[] = Array.isArray(mangaDoc?.authorSlugs)
      ? mangaDoc.authorSlugs.map((s: any) => String(s).toLowerCase()).filter(Boolean)
      : [];
    const translatorSlugs: string[] = Array.isArray(mangaDoc?.translatorSlugs)
      ? mangaDoc.translatorSlugs.map((s: any) => String(s).toLowerCase()).filter(Boolean)
      : [];

    const targetUrl = slug ? `/truyen-hentai/${slug}` : `/truyen-hentai/${String(resolved.targetId)}`;

    void (async () => {
      try {
        const [authors, translators] = await Promise.all([
          authorSlugs.length
            ? AuthorModel.find({ slug: { $in: authorSlugs } }).select({ slug: 1, name: 1 }).lean()
            : Promise.resolve([] as Array<{ slug: string; name: string }>),
          translatorSlugs.length
            ? TranslatorModel.find({ slug: { $in: translatorSlugs } }).select({ slug: 1, name: 1 }).lean()
            : Promise.resolve([] as Array<{ slug: string; name: string }>),
        ]);

        const BATCH_SIZE = 50;

        // Send per followed entity to include exact name in notification.
        for (const author of authors as any[]) {
          const authorSlug = String((author as any)?.slug ?? "").toLowerCase().trim();
          const authorName = String((author as any)?.name ?? authorSlug).trim();
          if (!authorSlug || !authorName) continue;
          const followerIds = await UserFollowAuthorModel.find({ authorSlug }).distinct("userId");
          const recipients = (followerIds as any[])
            .map((uid) => String(uid ?? "").trim())
            .filter(Boolean);
          if (!recipients.length) continue;

          const payloadBase = {
            title: `Tác giả "${authorName}" bạn theo dõi vừa ra truyện mới`,
            subtitle: `Tác giả/dịch giả "${authorName}" vừa ra truyện "${title}"`,
            imgUrl: poster,
            type: "follow-release-author",
            targetType: "manga",
            targetId: String(resolved.targetId),
            targetSlug: slug,
            targetUrl,
          };

          for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
            const batch = recipients.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(batch.map((userId) => createNotification({ userId, ...payloadBase })));
          }
        }

        for (const translator of translators as any[]) {
          const translatorSlug = String((translator as any)?.slug ?? "").toLowerCase().trim();
          const translatorName = String((translator as any)?.name ?? translatorSlug).trim();
          if (!translatorSlug || !translatorName) continue;
          const followerIds = await UserFollowTranslatorModel.find({ translatorSlug }).distinct("userId");
          const recipients = (followerIds as any[])
            .map((uid) => String(uid ?? "").trim())
            .filter(Boolean);
          if (!recipients.length) continue;

          const payloadBase = {
            title: `Dịch giả "${translatorName}" bạn theo dõi vừa ra truyện mới`,
            subtitle: `Tác giả/dịch giả "${translatorName}" vừa ra truyện "${title}"`,
            imgUrl: poster,
            type: "follow-release-translator",
            targetType: "manga",
            targetId: String(resolved.targetId),
            targetSlug: slug,
            targetUrl,
          };

          for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
            const batch = recipients.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(batch.map((userId) => createNotification({ userId, ...payloadBase })));
          }
        }
      } catch (err) {
        console.warn("[approveManga] notify followers failed", err);
      }
    })();
  }

  return {
    success: true,
    message: "Duyệt truyện thành công",
  };
};

export const rejectManga = async (request: Request, mangaId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để từ chối truyện");
  }

  if (!isAdmin(userInfo.role)) {
    throw new BusinessError("Bạn không có quyền từ chối truyện");
  }

  const resolved = await resolveMangaMutationTarget(mangaId);
  if (!resolved) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  await MangaModel.findByIdAndUpdate(
    resolved.targetId,
    { $set: { status: MANGA_STATUS.REJECTED } },
    { timestamps: false },
  );

  return {
    success: true,
    message: "Từ chối truyện thành công",
  };
};

export const transferMangaOwner = async (request: Request, mangaId: string, newOwnerId: string) => {
  const userInfo = await getUserInfoFromSession(request);
  if (!userInfo) {
    throw new BusinessError("Bạn cần đăng nhập để chuyển quyền truyện");
  }

  // Chỉ ADMIN (không cho MOD) theo yêu cầu "admin cấp cao".
  if (userInfo.role !== 'ADMIN') {
    throw new BusinessError("Bạn không có quyền chuyển quyền truyện");
  }

  if (!newOwnerId || typeof newOwnerId !== 'string') {
    throw new BusinessError("ID người nhận mới không hợp lệ");
  }

  const manga = await MangaModel.findById(mangaId);
  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  if (String(manga.ownerId) === String(newOwnerId)) {
    throw new BusinessError("Người nhận đã là chủ sở hữu hiện tại");
  }

  const newOwner = await UserModel.findById(newOwnerId).select('_id role isDeleted isBanned');
  if (!newOwner || newOwner.isDeleted || newOwner.isBanned) {
    throw new BusinessError("Người nhận mới không tồn tại hoặc không hợp lệ");
  }

  const oldOwnerId = manga.ownerId;

  // Cập nhật chủ sở hữu
  await MangaModel.findByIdAndUpdate(mangaId, { $set: { ownerId: newOwnerId } }, { timestamps: false });

  // Cập nhật thống kê số lượng truyện của user
  await Promise.all([
    UserModel.findByIdAndUpdate(oldOwnerId, { $inc: { mangasCount: -1 } }),
    UserModel.findByIdAndUpdate(newOwnerId, { $inc: { mangasCount: 1 } }),
  ]);

  // Ghi log hành động admin
  try {
    await AdminActionLogModel.create({
      action: 'TRANSFER_MANGA_OWNER',
      adminId: userInfo.id,
      mangaId: String(mangaId),
      oldOwnerId: String(oldOwnerId),
      newOwnerId: String(newOwnerId),
    });
  } catch (e) {
    console.error('[transferMangaOwner] Cannot write admin action log', e);
  }

  return {
    success: true,
    message: 'Chuyển quyền truyện thành công',
    oldOwnerId: String(oldOwnerId),
    newOwnerId: String(newOwnerId),
  };
};
