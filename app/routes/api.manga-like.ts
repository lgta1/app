import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { recordLike } from "@/services/interaction.svc";
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
      // Make this operation idempotent + race-safe (unique index on {userId,mangaId}).
      // If multiple requests hit at once, only the first should increment likeNumber.
      const upsertRes = await UserLikeMangaModel.updateOne(
        { userId: user.id, mangaId },
        { $setOnInsert: { userId: user.id, mangaId } },
        { upsert: true },
      );
      const inserted = Boolean((upsertRes as any)?.upsertedId || (upsertRes as any)?.upsertedCount);

      if (inserted) {
        await MangaModel.findByIdAndUpdate(
          mangaId,
          { $inc: { likeNumber: 1 } },
          { timestamps: false },
        );

        // Record like interaction (non-blocking)
        recordLike(mangaId, user.id).catch((error) => {
          console.error("Lỗi khi ghi like interaction:", error);
        });
      }

      return Response.json({
        success: true,
        message: inserted ? "Thích truyện thành công" : "Truyện đã được thích trước đó",
        isLiked: true,
      });
    }

    if (intent === "unlike") {
      // Idempotent unlike: only decrement if we actually removed a record.
      const delRes = await UserLikeMangaModel.deleteOne({ userId: user.id, mangaId });
      const deleted = Number((delRes as any)?.deletedCount || (delRes as any)?.n || 0) > 0;

      if (deleted) {
        await MangaModel.findByIdAndUpdate(
          mangaId,
          { $inc: { likeNumber: -1 } },
          { timestamps: false },
        );
      }

      return Response.json({
        success: true,
        message: deleted ? "Bỏ thích truyện thành công" : "Truyện chưa được thích trước đó",
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
