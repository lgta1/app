import type { LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { Types } from "mongoose";
import { MangaModel } from "~/database/models/manga.model";
import { ensureSlugForDocs } from "~/database/helpers/manga-slug.helper";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";
import { MANGA_STATUS } from "~/constants/manga";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const limitRaw = parseInt(url.searchParams.get("limit") || "300");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(300, limitRaw)) : 300;
    const userIdParam = url.searchParams.get("userId");

    const sessionUser = await getUserInfoFromSession(request);

    let targetUserId: string;

    if (userIdParam) {
      // Nếu có userId trong query params, sử dụng userId đó
      targetUserId = userIdParam;
    } else {
      // Nếu không có userId, lấy từ session (flow hiện tại)
      if (!sessionUser) {
        return Response.json(
          { error: "Vui lòng đăng nhập để xem lịch sử đọc" },
          { status: 401 },
        );
      }
      targetUserId = sessionUser.id;
    }

    const shouldTrim = !!sessionUser && String(sessionUser.id) === String(targetUserId);

    // Owner-only: keep at most 300 unique mangas in reading history by removing older mangas.
    // We do this in bounded batches to avoid long request times.
    if (shouldTrim) {
      const MAX_UNIQUE = 300;
      const DROP_BATCH = 200;
      const MAX_PASSES = 10;

      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const mangasToDrop = await UserReadChapterModel.aggregate<{ mangaId: Types.ObjectId }>([
          { $match: { userId: targetUserId } },
          {
            $lookup: {
              from: "chapters",
              localField: "chapterId",
              foreignField: "_id",
              as: "chapter",
            },
          },
          { $unwind: "$chapter" },
          { $group: { _id: "$chapter.mangaId", lastReadAt: { $max: "$createdAt" } } },
          { $sort: { lastReadAt: -1 } },
          { $skip: MAX_UNIQUE },
          { $limit: DROP_BATCH },
          { $project: { mangaId: "$_id", _id: 0 } },
        ]);

        const dropIds = (mangasToDrop || [])
          .map((x: any) => x?.mangaId)
          .filter((x: any) => x && Types.ObjectId.isValid(String(x))) as Types.ObjectId[];

        if (dropIds.length === 0) break;

        const readDocIds = await UserReadChapterModel.aggregate<{ _id: Types.ObjectId }>([
          { $match: { userId: targetUserId } },
          {
            $lookup: {
              from: "chapters",
              localField: "chapterId",
              foreignField: "_id",
              as: "chapter",
            },
          },
          { $unwind: "$chapter" },
          { $match: { "chapter.mangaId": { $in: dropIds } } },
          { $project: { _id: 1 } },
        ]);

        const idsToDelete = (readDocIds || [])
          .map((x: any) => x?._id)
          .filter((x: any) => x && Types.ObjectId.isValid(String(x))) as Types.ObjectId[];
        if (idsToDelete.length === 0) break;

        await UserReadChapterModel.deleteMany({ _id: { $in: idsToDelete } });
      }
    }

    // Fetch up to 300 unique mangas (most recently read first)
    const agg = await UserReadChapterModel.aggregate<{ _id: Types.ObjectId; lastReadAt: Date }>([
      { $match: { userId: targetUserId } },
      {
        $lookup: {
          from: "chapters",
          localField: "chapterId",
          foreignField: "_id",
          as: "chapter",
        },
      },
      { $unwind: "$chapter" },
      { $group: { _id: "$chapter.mangaId", lastReadAt: { $max: "$createdAt" } } },
      { $sort: { lastReadAt: -1 } },
      { $limit: limit },
    ]);

    const mangaIds = (agg || []).map((x) => x._id).filter(Boolean);
    if (mangaIds.length === 0) {
      return Response.json({
        success: true,
        data: [],
        currentPage: 1,
        totalPages: 1,
        totalRecentRead: 0,
      });
    }

    const docs = await MangaModel.find({ _id: { $in: mangaIds }, status: MANGA_STATUS.APPROVED })
      .select("title poster slug chapters viewNumber likeNumber followNumber ratingScore ratingTotalVotes ratingChaptersWithVotes status")
      .lean();

    await ensureSlugForDocs(docs as any[]);

    const storyMap = new Map<string, any>(
      (docs || []).map((m: any) => {
        const id = String(m?._id ?? m?.id ?? "");
        if (typeof m?.poster === "string") m.poster = rewriteLegacyCdnUrl(m.poster);
        return [id, { ...m, id }];
      }),
    );

    const lastReadMap = new Map<string, Date>((agg || []).map((x: any) => [String(x._id), x.lastReadAt]));

    const data = mangaIds
      .map((id) => storyMap.get(String(id)))
      .filter(Boolean)
      .map((m: any) => ({
        ...m,
        lastReadAt: lastReadMap.get(String(m.id)) ?? null,
      }));

    return Response.json({
      success: true,
      data,
      currentPage: 1,
      totalPages: 1,
      totalRecentRead: data.length,
    });
  } catch (error) {
    console.error("Error in manga recent read loader:", error);
    return Response.json({ error: "Có lỗi xảy ra khi lấy dữ liệu" }, { status: 500 });
  }
}
