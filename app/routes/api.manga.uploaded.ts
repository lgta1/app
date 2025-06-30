import type { LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { MangaModel } from "~/database/models/manga.model";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    if (!user) {
      return Response.json(
        { error: "Vui lòng đăng nhập để xem truyện đã đăng" },
        { status: 401 },
      );
    }

    // Lấy danh sách manga đã đăng
    const skip = (page - 1) * limit;

    const uploadedMangas = await MangaModel.find({ ownerId: user.id })
      .select("title poster chapters viewNumber likeNumber followNumber status createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Đếm tổng số manga đã đăng
    const totalUploaded = await MangaModel.countDocuments({ ownerId: user.id });
    const totalPages = Math.ceil(totalUploaded / limit);

    // Chuyển đổi dữ liệu
    const mangaList = uploadedMangas.map((manga) => ({
      ...manga.toObject(),
      id: manga._id.toString(),
    }));

    return Response.json({
      success: true,
      data: mangaList,
      currentPage: page,
      totalPages,
      totalUploaded,
    });
  } catch (error) {
    console.error("Error in manga uploaded loader:", error);
    return Response.json({ error: "Có lỗi xảy ra khi lấy dữ liệu" }, { status: 500 });
  }
}
