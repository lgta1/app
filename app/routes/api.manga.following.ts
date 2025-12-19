import type { LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const userIdParam = url.searchParams.get("userId");

    let targetUserId: string;

    if (userIdParam) {
      // Nếu có userId trong query params, sử dụng userId đó
      targetUserId = userIdParam;
    } else {
      // Nếu không có userId, lấy từ session (flow hiện tại)
      const user = await getUserInfoFromSession(request);
      if (!user) {
        return Response.json(
          { error: "Vui lòng đăng nhập để xem danh sách theo dõi" },
          { status: 401 },
        );
      }
      targetUserId = user.id;
    }

    // Lấy danh sách manga đã follow
    const skip = (page - 1) * limit;

    const followedMangas = await UserFollowMangaModel.find({ userId: targetUserId })
      .populate({
        path: "mangaId",
        model: "Manga",
        select: "title poster slug chapters viewNumber likeNumber followNumber",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Đếm tổng số manga đã follow
    const totalFollowed = await UserFollowMangaModel.countDocuments({
      userId: targetUserId,
    });
    const totalPages = Math.ceil(totalFollowed / limit);

    // Chuyển đổi dữ liệu
    const mangaList = followedMangas
      .filter((follow) => follow.mangaId && typeof follow.mangaId === "object") // Lọc những manga còn tồn tại
      .map((follow) => {
        const manga = follow.mangaId as any;
        return {
          ...manga.toObject(),
          id: manga._id.toString(),
          slug: manga.slug,
        };
      });

    return Response.json({
      success: true,
      data: mangaList,
      currentPage: page,
      totalPages,
      totalFollowed,
    });
  } catch (error) {
    console.error("Error in manga following loader:", error);
    return Response.json({ error: "Có lỗi xảy ra khi lấy dữ liệu" }, { status: 500 });
  }
}
