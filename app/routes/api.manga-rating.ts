import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { calculateAndUpdateMangaRating, getUserMangaRating } from "@/services/rating.svc";
import { getUserInfoFromSession } from "@/services/session.svc";

import { MangaModel } from "~/database/models/manga.model";
import { MangaRatingModel } from "~/database/models/manga-rating.model";
import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";

// Loader để check trạng thái rating và lấy thông tin rating hiện tại
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");

    if (!mangaId) {
      return Response.json({ error: "mangaId là bắt buộc" }, { status: 400 });
    }

    // Lấy thông tin manga để có ratingAverage và ratingCount
    const manga = await MangaModel.findById(mangaId);
    if (!manga) {
      return Response.json({ error: "Manga không tồn tại" }, { status: 404 });
    }

    if (!user) {
      return Response.json({
        hasRated: false,
        userRating: null,
        ratingAverage: manga.ratingAverage || 0,
        ratingCount: manga.ratingCount || 0,
      });
    }

    const userRating = await getUserMangaRating(user.id, mangaId);

    return Response.json({
      hasRated: userRating !== null,
      userRating,
      ratingAverage: manga.ratingAverage || 0,
      ratingCount: manga.ratingCount || 0,
    });
  } catch (error) {
    console.error("Error checking rating status:", error);
    return Response.json(
      { error: "Có lỗi xảy ra khi kiểm tra trạng thái đánh giá" },
      { status: 500 },
    );
  }
}

// Action để rate manga
export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);

    if (!user) {
      return Response.json(
        { error: "Vui lòng đăng nhập để đánh giá truyện" },
        { status: 401 },
      );
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Chỉ chấp nhận POST method" }, { status: 405 });
    }

    const formData = await request.formData();
    const mangaId = formData.get("mangaId") as string;
    const ratingValue = Number(formData.get("rating"));

    if (!mangaId) {
      return Response.json({ error: "mangaId là bắt buộc" }, { status: 400 });
    }

    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      return Response.json({ error: "Rating phải từ 1 đến 5 sao" }, { status: 400 });
    }

    // Kiểm tra manga có tồn tại không
    const manga = await MangaModel.findById(mangaId);
    if (!manga) {
      return Response.json({ error: "Manga không tồn tại" }, { status: 404 });
    }

    // Kiểm tra user đã rating chưa
    const existingRating = await MangaRatingModel.findOne({
      userId: user.id,
      mangaId: mangaId,
    });

    if (existingRating) {
      return Response.json({ error: "Bạn đã đánh giá manga này rồi" }, { status: 400 });
    }

    // Tạo rating mới
    await MangaRatingModel.create({
      userId: user.id,
      mangaId: mangaId,
      rating: ratingValue,
    });

    // Tính toán và cập nhật rating trung bình
    const { ratingAverage, ratingCount } = await calculateAndUpdateMangaRating(mangaId);

    return Response.json({
      success: true,
      message: "Đánh giá thành công",
      userRating: ratingValue,
      ratingAverage,
      ratingCount,
      hasRated: true,
    });
  } catch (error) {
    if (isBusinessError(error)) {
      return returnBusinessError(error);
    }

    console.error("Error in manga rating action:", error);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}
