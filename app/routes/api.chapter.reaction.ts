import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";
import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";
import { ChapterModel } from "~/database/models/chapter.model";
import { UserChapterReactionModel } from "~/database/models/user-chapter-reaction.model";
import type { ChapterReaction } from "~/constants/chapter-rating";
import { Types } from "mongoose";
import { getMangaPublishedById } from "@/queries/manga.query";
import { resolveMangaHandle } from "~/database/helpers/manga-slug.helper";

const resolveChapterId = async (input: {
  chapterId?: string;
  mangaId?: string;
  mangaSlug?: string;
  chapterSlug?: string;
  chapterNumber?: number;
}): Promise<string | null> => {
  const chapterId = (input.chapterId ?? "").trim();
  if (chapterId) {
    if (!Types.ObjectId.isValid(chapterId)) return null;
    return chapterId;
  }

  const chapterSlug = (input.chapterSlug ?? "").trim();

  let mangaId = (input.mangaId ?? "").trim();
  if (!mangaId || !Types.ObjectId.isValid(mangaId)) {
    mangaId = "";
  }
  if (!mangaId) {
    const mangaSlug = (input.mangaSlug ?? "").trim();
    if (mangaSlug) {
      if (Types.ObjectId.isValid(mangaSlug)) {
        mangaId = mangaSlug;
      } else {
        // Prefer the same published resolver used by page loaders
        const manga = await getMangaPublishedById(mangaSlug);
        let mid = String((manga as any)?.id ?? (manga as any)?._id ?? "").trim();
        if (!mid) {
          // Fallback: resolve slug/id without published gating (should still be safe; final chapter lookup constrains results)
          const anyManga = await resolveMangaHandle(mangaSlug);
          mid = String((anyManga as any)?.id ?? (anyManga as any)?._id ?? "").trim();
        }
        if (mid && Types.ObjectId.isValid(mid)) mangaId = mid;
      }
    }
  }

  // Best-effort resolution by slug
  if (chapterSlug) {
    if (mangaId) {
      const doc = await ChapterModel.findOne({ mangaId, slug: chapterSlug }).select({ _id: 1 }).lean();
      const id = String((doc as any)?._id ?? "").trim();
      return id && Types.ObjectId.isValid(id) ? id : null;
    }

    // If mangaId cannot be resolved, only accept global slug lookup when it is unambiguous.
    const docs = await ChapterModel.find({ slug: chapterSlug }).select({ _id: 1 }).limit(2).lean();
    if (docs.length === 1) {
      const id = String((docs[0] as any)?._id ?? "").trim();
      return id && Types.ObjectId.isValid(id) ? id : null;
    }
  }

  const chapterNumber = input.chapterNumber;
  if (mangaId && typeof chapterNumber === "number" && Number.isFinite(chapterNumber)) {
    const doc = await ChapterModel.findOne({ mangaId, chapterNumber }).select({ _id: 1 }).lean();
    const id = String((doc as any)?._id ?? "").trim();
    return id && Types.ObjectId.isValid(id) ? id : null;
  }

  return null;
};

// GET: fetch current counts + user reaction (if logged in)
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    const url = new URL(request.url);
    const chapterIdParam = url.searchParams.get("chapterId")?.trim() ?? "";
    const mangaId = url.searchParams.get("mangaId")?.trim() ?? "";
    const mangaSlug = url.searchParams.get("mangaSlug")?.trim() ?? "";
    const chapterSlug = url.searchParams.get("chapterSlug")?.trim() ?? "";
    const chapterNumberRaw = url.searchParams.get("chapterNumber")?.trim() ?? "";
    const chapterNumber = chapterNumberRaw ? Number(chapterNumberRaw) : undefined;

    const chapterId = await resolveChapterId({
      chapterId: chapterIdParam,
      mangaId,
      mangaSlug,
      chapterSlug,
      chapterNumber,
    });

    if (!chapterId) return Response.json({ error: "Không xác định được chương" }, { status: 400 });

    const chapter = await ChapterModel.findById(chapterId)
      .select({ likeNumber: 1, dislikeNumber: 1, chapScore: 1 })
      .lean();

    if (!chapter) {
      return Response.json({ error: "Không tìm thấy chương" }, { status: 404 });
    }

    let reaction: ChapterReaction | null = null;
    if (user) {
      const doc = await UserChapterReactionModel.findOne({ userId: user.id, chapterId })
        .select({ reaction: 1 })
        .lean();
      reaction = (doc as any)?.reaction ?? null;
    }

    return Response.json({
      like: Number((chapter as any).likeNumber) || 0,
      dislike: Number((chapter as any).dislikeNumber) || 0,
      chapScore: Number((chapter as any).chapScore) || 0,
      reaction,
    });
  } catch (e) {
    console.error("api.chapter.reaction loader error:", e);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}

// POST: vote like/dislike (creates or switches)
export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json({ error: "Vui lòng đăng nhập để đánh giá chương" }, { status: 401 });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Chỉ chấp nhận POST method" }, { status: 405 });
    }

    const formData = await request.formData();
    const chapterIdParam = String(formData.get("chapterId") || "").trim();
    const mangaId = String(formData.get("mangaId") || "").trim();
    const mangaSlug = String(formData.get("mangaSlug") || "").trim();
    const chapterSlug = String(formData.get("chapterSlug") || "").trim();
    const chapterNumberRaw = String(formData.get("chapterNumber") || "").trim();
    const chapterNumber = chapterNumberRaw ? Number(chapterNumberRaw) : undefined;
    const reaction = String(formData.get("reaction") || "").trim() as ChapterReaction;

    const chapterId = await resolveChapterId({
      chapterId: chapterIdParam,
      mangaId,
      mangaSlug,
      chapterSlug,
      chapterNumber,
    });

    if (!chapterId) {
      return Response.json({ error: "Không xác định được chương" }, { status: 400 });
    }

    const { reactToChapter } = await import("~/.server/mutations/chapter-reaction.mutation");
    const result = await reactToChapter({ userId: user.id, chapterId, reaction });

    return Response.json({ success: true, ...result });
  } catch (e) {
    if (isBusinessError(e)) return returnBusinessError(e);
    console.error("api.chapter.reaction action error:", e);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}
