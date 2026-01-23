import { createComment, deleteComment, likeComment, reactComment } from "@/mutations/comment.mutation";
import { getComments, getReplies, getPageContainingComment } from "@/queries/comment.query";
import { getUserReactionsForComments } from "@/queries/comment-reaction.query";
import { recordComment } from "@/services/interaction.svc";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/api.comments";

import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";
import { sharedTtlCache } from "~/.server/utils/ttl-cache";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");
    const postId = url.searchParams.get("postId");
    const parentId = url.searchParams.get("parentId");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "5");
    const focusCommentId = url.searchParams.get("focusCommentId");

    if (parentId) {
      const replies = await sharedTtlCache.getOrSet(
        `api:comment-replies:${parentId}`,
        10_000,
        () => getReplies(parentId),
      );

      if (user?.id) {
        const ids = (replies || []).map((c: any) => String(c?.id ?? c?._id ?? "")).filter(Boolean);
        const map = await getUserReactionsForComments(user.id, ids);
        const withMine = (replies || []).map((c: any) => ({
          ...c,
          userReaction: map[String(c?.id ?? c?._id ?? "")] ?? null,
        }));
        return Response.json({ data: withMine, success: true });
      }

      return Response.json({ data: replies, success: true });
    }

    if (!mangaId && !postId) {
      return Response.json(
        { error: "mangaId hoặc postId là bắt buộc", success: false },
        { status: 400 },
      );
    }

    if (mangaId && postId) {
      return Response.json(
        { error: "Không thể có cả mangaId và postId", success: false },
        { status: 400 },
      );
    }

    let effectivePage = page;
    if (focusCommentId && (mangaId || postId)) {
      const pageInfo = await getPageContainingComment(
        focusCommentId,
        { mangaId: mangaId || undefined, postId: postId || undefined },
        limit,
      );
      if (pageInfo?.page) {
        effectivePage = pageInfo.page;
      }
    }

    const baseKey = mangaId ? `manga:${mangaId}` : `post:${postId}`;
    const cacheKey = focusCommentId
      ? null
      : `api:comments:${baseKey}:page:${effectivePage}:limit:${limit}`;

    const commentsData = cacheKey
      ? await sharedTtlCache.getOrSet(
          cacheKey,
          10_000,
          () =>
            getComments(
              { mangaId: mangaId || undefined, postId: postId || undefined },
              effectivePage,
              limit,
            ),
        )
      : await getComments(
          { mangaId: mangaId || undefined, postId: postId || undefined },
          effectivePage,
          limit,
        );

    const comments = commentsData.data || [];
    if (user?.id) {
      const ids = comments.map((c: any) => String(c?.id ?? c?._id ?? "")).filter(Boolean);
      const map = await getUserReactionsForComments(user.id, ids);
      const withMine = comments.map((c: any) => ({
        ...c,
        userReaction: map[String(c?.id ?? c?._id ?? "")] ?? null,
      }));

      return Response.json({
        data: withMine,
        totalPages: commentsData.totalPages,
        currentPage: commentsData.currentPage,
        totalCount: commentsData.totalCount,
        success: true,
      });
    }

    return Response.json({
      data: comments,
      totalPages: commentsData.totalPages,
      currentPage: commentsData.currentPage,
      totalCount: commentsData.totalCount,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return Response.json(
      { error: "Có lỗi xảy ra khi tải bình luận", success: false },
      { status: 500 },
    );
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
      const postId = formData.get("postId") as string;
      const parentId = formData.get("parentId") as string;

      if (!content) {
        return Response.json(
          { error: "Nội dung bình luận là bắt buộc" },
          { status: 400 },
        );
      }

      // Nếu không có parentId, cần có mangaId hoặc postId
      if (!parentId && !mangaId && !postId) {
        return Response.json(
          { error: "mangaId, postId hoặc parentId là bắt buộc" },
          { status: 400 },
        );
      }

      if (mangaId && postId) {
        return Response.json(
          { error: "Không thể có cả mangaId và postId" },
          { status: 400 },
        );
      }

      // Create comment
      const comment = await createComment({
        content,
        mangaId: mangaId || undefined,
        postId: postId || undefined,
        parentId: parentId || undefined,
        userId: user.id,
      });

      // Record comment interaction for manga (non-blocking)
      if (mangaId) {
        recordComment(mangaId, user.id).catch((error) => {
          console.error("Lỗi khi ghi comment interaction:", error);
        });
      }

      const response = {
        success: true,
        comment,
      };

      return Response.json(response);
    }

    if (intent === "like-comment") {
      const commentId = formData.get("commentId") as string;

      if (!commentId) {
        return Response.json({ error: "commentId là bắt buộc" }, { status: 400 });
      }

      const result = await likeComment(commentId, user.id);

      return Response.json(result);
    }

    if (intent === "react-comment") {
      const commentId = formData.get("commentId") as string;
      const reaction = formData.get("reaction");

      if (!commentId) {
        return Response.json({ error: "commentId là bắt buộc" }, { status: 400 });
      }

      const result = await reactComment(commentId, user.id, reaction);
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
