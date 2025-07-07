import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { MangaModel } from "~/database/models/manga.model";
import { UserLikeMangaModel } from "~/database/models/user-like-manga.model";
import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";

// Loader để check trạng thái like
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");

    if (!mangaId) {
      return Response.json({ error: "mangaId là bắt buộc" }, { status: 400 });
    }

    if (!user) {
      return Response.json({ isLiked: false });
    }

    const likeRecord = await UserLikeMangaModel.findOne({
      userId: user.id,
      mangaId: mangaId,
    });

    return Response.json({ isLiked: !!likeRecord });
  } catch (error) {
    console.error("Error checking like status:", error);
    return Response.json(
      { error: "Có lỗi xảy ra khi kiểm tra trạng thái yêu thích" },
      { status: 500 },
    );
  }
}

// Action để like/unlike
export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);

    if (!user) {
      return Response.json(
        { error: "Vui lòng đăng nhập để yêu thích truyện" },
        { status: 401 },
      );
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Chỉ chấp nhận POST method" }, { status: 405 });
    }

    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const mangaId = formData.get("mangaId") as string;

    if (!mangaId) {
      return Response.json({ error: "mangaId là bắt buộc" }, { status: 400 });
    }

    // Kiểm tra manga có tồn tại không
    const manga = await MangaModel.findById(mangaId);
    if (!manga) {
      return Response.json({ error: "Truyện không tồn tại" }, { status: 404 });
    }

    if (intent === "like") {
      // Kiểm tra đã like chưa
      const existingLike = await UserLikeMangaModel.findOne({
        userId: user.id,
        mangaId: mangaId,
      });

      if (existingLike) {
        return Response.json({ error: "Bạn đã thích truyện này rồi" }, { status: 400 });
      }

      // Tạo like record
      await UserLikeMangaModel.create({
        userId: user.id,
        mangaId: mangaId,
      });

      // Tăng likeNumber trong manga
      await MangaModel.findByIdAndUpdate(mangaId, {
        $inc: { likeNumber: 1 },
      });

      return Response.json({
        success: true,
        message: "Thích truyện thành công",
        isLiked: true,
      });
    }

    if (intent === "unlike") {
      // Kiểm tra đã like chưa
      const existingLike = await UserLikeMangaModel.findOne({
        userId: user.id,
        mangaId: mangaId,
      });

      if (!existingLike) {
        return Response.json({ error: "Bạn chưa thích truyện này" }, { status: 400 });
      }

      // Xóa like record
      await UserLikeMangaModel.deleteOne({
        userId: user.id,
        mangaId: mangaId,
      });

      // Giảm likeNumber trong manga
      await MangaModel.findByIdAndUpdate(mangaId, {
        $inc: { likeNumber: -1 },
      });

      return Response.json({
        success: true,
        message: "Bỏ thích truyện thành công",
        isLiked: false,
      });
    }

    return Response.json({ error: "Intent không hợp lệ" }, { status: 400 });
  } catch (error) {
    if (isBusinessError(error)) {
      return returnBusinessError(error);
    }

    console.error("Error in manga like action:", error);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}
