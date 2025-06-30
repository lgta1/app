import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { MangaModel } from "~/database/models/manga.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";

// Loader để check trạng thái follow
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");

    if (!mangaId) {
      return Response.json({ error: "mangaId là bắt buộc" }, { status: 400 });
    }

    if (!user) {
      return Response.json({ isFollowing: false });
    }

    const followRecord = await UserFollowMangaModel.findOne({
      userId: user.id,
      mangaId: mangaId,
    });

    return Response.json({ isFollowing: !!followRecord });
  } catch (error) {
    console.error("Error checking follow status:", error);
    return Response.json(
      { error: "Có lỗi xảy ra khi kiểm tra trạng thái theo dõi" },
      { status: 500 },
    );
  }
}

// Action để follow/unfollow
export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);

    if (!user) {
      return Response.json(
        { error: "Vui lòng đăng nhập để theo dõi truyện" },
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

    if (intent === "follow") {
      // Kiểm tra đã follow chưa
      const existingFollow = await UserFollowMangaModel.findOne({
        userId: user.id,
        mangaId: mangaId,
      });

      if (existingFollow) {
        return Response.json(
          { error: "Bạn đã theo dõi truyện này rồi" },
          { status: 400 },
        );
      }

      // Tạo follow record
      await UserFollowMangaModel.create({
        userId: user.id,
        mangaId: mangaId,
      });

      // Tăng followNumber trong manga
      await MangaModel.findByIdAndUpdate(mangaId, {
        $inc: { followNumber: 1 },
      });

      return Response.json({
        success: true,
        message: "Theo dõi truyện thành công",
        isFollowing: true,
      });
    }

    if (intent === "unfollow") {
      // Kiểm tra đã follow chưa
      const existingFollow = await UserFollowMangaModel.findOne({
        userId: user.id,
        mangaId: mangaId,
      });

      if (!existingFollow) {
        return Response.json({ error: "Bạn chưa theo dõi truyện này" }, { status: 400 });
      }

      // Xóa follow record
      await UserFollowMangaModel.deleteOne({
        userId: user.id,
        mangaId: mangaId,
      });

      // Giảm followNumber trong manga
      await MangaModel.findByIdAndUpdate(mangaId, {
        $inc: { followNumber: -1 },
      });

      return Response.json({
        success: true,
        message: "Bỏ theo dõi truyện thành công",
        isFollowing: false,
      });
    }

    return Response.json({ error: "Intent không hợp lệ" }, { status: 400 });
  } catch (error) {
    if (isBusinessError(error)) {
      return returnBusinessError(error);
    }

    console.error("Error in manga follow action:", error);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}
