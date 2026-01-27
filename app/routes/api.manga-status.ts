import type { LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserLikeMangaModel } from "~/database/models/user-like-manga.model";

const privateShortCacheHeaders = {
  "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
  Vary: "Cookie",
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");

    if (!mangaId) {
      return Response.json(
        { error: "mangaId là bắt buộc" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json(
        { isLiked: false, isFollowing: false },
        { headers: { "Cache-Control": "public, max-age=30, s-maxage=120" } },
      );
    }

    const [likeRecord, followRecord] = await Promise.all([
      UserLikeMangaModel.findOne({ userId: user.id, mangaId }).select("_id").lean(),
      UserFollowMangaModel.findOne({ userId: user.id, mangaId }).select("_id").lean(),
    ]);

    return Response.json(
      {
        isLiked: Boolean(likeRecord),
        isFollowing: Boolean(followRecord),
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
