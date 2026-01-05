import type { LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { MangaModel } from "~/database/models/manga.model";
import { isAdmin } from "~/helpers/user.helper";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const userIdParam = url.searchParams.get("userId");

    const sessionUser = await getUserInfoFromSession(request);
    let targetUserId: string;

    if (userIdParam) {
      targetUserId = userIdParam;
    } else {
      if (!sessionUser) {
        return Response.json(
          { error: "Vui lòng đăng nhập để xem truyện đã đăng" },
          { status: 401 },
        );
      }
      targetUserId = sessionUser.id;
    }

    const skip = (page - 1) * limit;
    const matchCondition = { ownerId: targetUserId };

    const [uploadedMangas, totalUploaded, totalViewsAgg] = await Promise.all([
      MangaModel.find(matchCondition)
        .select(
          "title poster slug chapters viewNumber likeNumber followNumber ratingScore ratingTotalVotes ratingChaptersWithVotes status createdAt userStatus",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MangaModel.countDocuments(matchCondition),
      MangaModel.aggregate([
        { $match: matchCondition },
        { $group: { _id: null, totalViews: { $sum: { $ifNull: ["$viewNumber", 0] } } } },
      ]),
    ]);

    const totalPages = Math.ceil(totalUploaded / limit);
    const totalViews = totalViewsAgg?.[0]?.totalViews ?? 0;
    const isAdminUser = Boolean(sessionUser && isAdmin(sessionUser.role));

    // Chuyển đổi dữ liệu
    const mangaList = uploadedMangas.map((manga) => ({
      ...manga.toObject(),
      id: manga._id.toString(),
      slug: manga.slug,
    }));

    return Response.json({
      success: true,
      data: mangaList,
      currentPage: page,
      totalPages,
      totalUploaded,
      totalViews,
      isAdminUser,
    });
  } catch (error) {
    console.error("Error in manga uploaded loader:", error);
    return Response.json({ error: "Có lỗi xảy ra khi lấy dữ liệu" }, { status: 500 });
  }
}
