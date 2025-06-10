import { createComment, deleteComment, likeComment } from "@/mutations/comment.mutation";
import { getCommentsByMangaId } from "@/queries/comment.query";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/api.comments";

import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "5");

    if (!mangaId) {
      return Response.json({ error: "mangaId là bắt buộc" }, { status: 400 });
    }

    const commentsData = await getCommentsByMangaId(mangaId, page, limit);

    return Response.json(commentsData);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return Response.json({ error: "Có lỗi xảy ra khi tải bình luận" }, { status: 500 });
  }
}

export async function action({ request }: Route.ActionArgs) {
  try {
    const user = await getUserInfoFromSession(request);

    if (!user) {
      return Response.json({ error: "Vui lòng đăng nhập để bình luận" }, { status: 401 });
    }

    if (request.method === "DELETE") {
      const formData = await request.formData();
      const commentId = formData.get("commentId") as string;
      const intent = formData.get("intent") as string;

      if (intent !== "delete-comment") {
        return Response.json({ error: "Intent không hợp lệ" }, { status: 400 });
      }

      if (!commentId) {
        return Response.json({ error: "commentId là bắt buộc" }, { status: 400 });
      }

      await deleteComment(commentId, request);

      return Response.json({
        success: true,
        commentId,
        message: "Xóa bình luận thành công",
      });
    }

    // Xử lý POST request
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "create-comment") {
      const content = formData.get("content") as string;
      const mangaId = formData.get("mangaId") as string;

      if (!content || !mangaId) {
        return Response.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
      }

      const comment = await createComment({
        content,
        mangaId,
        userId: user.id,
      });

      return Response.json({ success: true, comment });
    }

    if (intent === "like-comment") {
      const commentId = formData.get("commentId") as string;

      if (!commentId) {
        return Response.json({ error: "commentId là bắt buộc" }, { status: 400 });
      }

      const result = await likeComment(commentId, user.id);

      return Response.json(result);
    }

    return Response.json({ error: "Intent không hợp lệ" }, { status: 400 });
  } catch (error) {
    if (isBusinessError(error)) {
      return returnBusinessError(error);
    }

    console.error("Error in comment action:", error);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}
