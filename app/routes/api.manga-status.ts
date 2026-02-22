import type { LoaderFunctionArgs } from "react-router";
import { Types } from "mongoose";

import { getUserInfoFromSession } from "@/services/session.svc";

import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserLikeMangaModel } from "~/database/models/user-like-manga.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";

const privateShortCacheHeaders = {
  "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Surrogate-Control": "no-store",
  Vary: "Cookie",
};

const anonymousCacheHeaders = {
  "Cache-Control": "public, max-age=900, s-maxage=900, stale-while-revalidate=120",
  "CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=120",
  "Cloudflare-CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=120",
  "Surrogate-Control": "public, s-maxage=900, stale-while-revalidate=120",
};

function buildMangaIdCandidates(id: string) {
  const candidates: any[] = [id];
  if (Types.ObjectId.isValid(id)) {
    candidates.push(new Types.ObjectId(id));
  }
  return candidates;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");
    const includeProgress = url.searchParams.get("includeProgress") === "1";

    if (!mangaId) {
      return Response.json(
        { error: "mangaId là bắt buộc" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const cookieHeader = request.headers.get("Cookie") || "";
    const hasSessionCookie = /(?:^|;\s*)__session=/.test(cookieHeader);
    if (!hasSessionCookie) {
      return Response.json(
        { isLiked: false, isFollowing: false, chapterNumber: null },
        { headers: anonymousCacheHeaders },
      );
    }

    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json(
        { isLiked: false, isFollowing: false, chapterNumber: null },
        { headers: anonymousCacheHeaders },
      );
    }

    const [likeRecord, followRecord] = await Promise.all([
      UserLikeMangaModel.findOne({ userId: user.id, mangaId }).select("_id").lean(),
      UserFollowMangaModel.findOne({ userId: user.id, mangaId }).select("_id").lean(),
    ]);

    let chapterNumber: number | null = null;
    if (includeProgress) {
      const mangaCandidates = buildMangaIdCandidates(mangaId);
      const result = await UserReadChapterModel.aggregate([
        { $match: { userId: String(user.id) } },
        {
          $addFields: {
            chapterIdObj: {
              $convert: { input: "$chapterId", to: "objectId", onError: null, onNull: null },
            },
          },
        },
        {
          $lookup: {
            from: "chapters",
            localField: "chapterIdObj",
            foreignField: "_id",
            as: "chapter",
          },
        },
        { $unwind: "$chapter" },
        { $match: { "chapter.mangaId": { $in: mangaCandidates } } },
        { $sort: { "chapter.chapterNumber": -1, updatedAt: -1 } },
        { $limit: 1 },
        { $project: { _id: 0, chapterNumber: "$chapter.chapterNumber" } },
      ]);

      chapterNumber =
        result?.[0]?.chapterNumber != null ? Number(result[0].chapterNumber) : null;
      if (!Number.isFinite(chapterNumber as number) || (chapterNumber as number) < 1) {
        chapterNumber = null;
      }
    }

    return Response.json(
      {
        isLiked: Boolean(likeRecord),
        isFollowing: Boolean(followRecord),
        chapterNumber,
      },
      { headers: privateShortCacheHeaders },
    );
  } catch (error) {
    console.error("Error checking manga status:", error);
    return Response.json(
      { error: "Có lỗi xảy ra khi kiểm tra trạng thái truyện" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
