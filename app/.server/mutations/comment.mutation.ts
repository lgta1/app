import { isValidObjectId } from "mongoose";

import { sanitizeCommentContent, validateCommentContent } from "@/services/comment.svc";
import { getUserInfoFromSession } from "@/services/session.svc";
import { createNotification } from "@/mutations/notification.mutation";

import { CommentModel } from "~/database/models/comment.model";
import { UserReactionCommentModel } from "~/database/models/user-reaction-comment.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";
import { MangaModel } from "~/database/models/manga.model";
import { PostModel } from "~/database/models/post.model";
import { UserModel } from "~/database/models/user.model";

import type { ReactionType } from "~/constants/reactions";
import { normalizeReactionType } from "~/constants/reactions";

export const createComment = async (data: {
  content: string;
  mangaId?: string;
  postId?: string;
  userId: string;
  parentId?: string; // Thêm parentId để hỗ trợ nested comments
}) => {
  const { content, mangaId, postId, userId, parentId } = data;

  if (!validateCommentContent(content)) {
    throw new BusinessError("Nội dung bình luận không hợp lệ (1-1000 ký tự)");
  }

  if (!mangaId && !postId) {
    throw new BusinessError("Cần có mangaId hoặc postId");
  }

  if (mangaId && postId) {
    throw new BusinessError("Không thể có cả mangaId và postId");
  }

  if (
    (mangaId && !isValidObjectId(mangaId)) ||
    (postId && !isValidObjectId(postId)) ||
    (parentId && !isValidObjectId(parentId)) ||
    !isValidObjectId(userId)
  ) {
    throw new BusinessError("ID không hợp lệ");
  }

  const sanitizedContent = sanitizeCommentContent(content);

  const commentData: any = {
    content: sanitizedContent,
    userId,
  };

  // Nếu có parentId, validate parentComment và xử lý logic nested
  if (parentId) {
    const parentComment = await CommentModel.findById(parentId);
    if (!parentComment) {
      throw new BusinessError("Không tìm thấy bình luận cha");
    }

    // Chỉ cho phép tối đa 2 cấp: nếu parent đã có parentId thì không cho reply thêm
    if (parentComment.parentId) {
      throw new BusinessError("Chỉ hỗ trợ tối đa 2 cấp bình luận");
    }

    // Thêm parentId vào commentData
    commentData.parentId = parentId;

    // Inherit mangaId/postId từ parent comment nếu không được provide
    if (parentComment.mangaId && !mangaId) {
      commentData.mangaId = parentComment.mangaId;
    }
    if (parentComment.postId && !postId) {
      commentData.postId = parentComment.postId;
    }

    // Lưu lại user của comment cha để xử lý notify sau khi lưu comment mới
    (commentData as any)._parentUserId = String(parentComment.userId);
  }

  if (mangaId) {
    commentData.mangaId = mangaId;
  }

  if (postId) {
    commentData.postId = postId;
  }

  const comment = new CommentModel(commentData);

  await comment.save();

  // Populate để trả về thông tin đầy đủ
  const saved = await CommentModel.findById(comment._id)
    .populate("userId", "name avatar gender level faction")
    .lean();

  // ─────────────────────────────────────────────────────────────
  // NOTIFICATIONS (non-blocking):
  // - Nếu là bình luận cấp 1 trên manga/post → notify tác giả (owner/author)
  // - Nếu là trả lời (có parentId) → notify người đã viết bình luận cha
  // - Không notify chính người tự bình luận/trả lời mình
  // ─────────────────────────────────────────────────────────────
  try {
    const populatedUser = saved?.userId;
    const actorId =
      populatedUser && typeof populatedUser === "object" && "_id" in populatedUser
        ? String((populatedUser as { _id: string })._id)
        : String(populatedUser ?? commentData.userId);
    const actor = await UserModel.findById(actorId).select("name").lean();
    const actorName = actor?.name ?? "Một người dùng";

    // Helper gửi notify an toàn
    const sendSafe = async (
      targetUserId?: string | null,
      payload?: {
        title: string;
        subtitle: string;
        imgUrl: string;
        type?: string;
        targetType?: string;
        targetId?: string;
        targetUrl?: string;
        targetSlug?: string | null;
      },
    ) => {
      const to = targetUserId ? String(targetUserId) : null;
      if (!to || to === actorId) return; // bỏ qua nếu không có người nhận hoặc tự nhận
      await createNotification({ userId: to, ...payload });
    };

    // Nếu là trả lời comment
    if (commentData.parentId) {
      // Lấy thông tin context từ parent: ưu tiên manga
      const parent = await CommentModel.findById(commentData.parentId)
        .select("userId mangaId postId")
        .lean();
      if (parent) {
        if (parent.mangaId) {
          const manga = await MangaModel.findById(parent.mangaId).select("title poster ownerId slug").lean();
          const targetSlug = manga?.slug ?? null;
          await sendSafe(parent.userId as any, {
            title: manga?.title ?? "Bình luận mới",
            subtitle: `${actorName} đã trả lời bạn tại truyện ${manga?.title ?? ""}`.trim(),
            imgUrl: manga?.poster ?? "/images/logo.webp",
            type: "comment-reply",
            targetType: "manga",
            targetId: String(parent.mangaId),
            targetSlug,
            targetUrl: targetSlug ? `/truyen-hentai/${targetSlug}` : `/truyen-hentai/${String(parent.mangaId)}`,
          });
        } else if (parent.postId) {
          const post = await PostModel.findById(parent.postId).select("title images authorId").lean();
          await sendSafe(parent.userId as any, {
            title: post?.title ?? "Bình luận mới",
            subtitle: `${actorName} đã trả lời bạn trong bài viết ${post?.title ?? ""}`.trim(),
            imgUrl: (post?.images && post.images[0]) || "/images/logo.webp",
            type: "comment-reply",
            targetType: "post",
            targetId: String(parent.postId),
            targetUrl: `/post/${String(parent.postId)}`,
          });
        }
      }
    } else {
      // Bình luận cấp 1
      if (commentData.mangaId) {
        const manga = await MangaModel.findById(commentData.mangaId).select("title poster ownerId slug").lean();
        const targetSlug = manga?.slug ?? null;
        await sendSafe(manga?.ownerId, {
          title: manga?.title ?? "Bình luận mới",
          subtitle: `${actorName} đã bình luận về truyện của bạn`,
          imgUrl: manga?.poster ?? "/images/logo.webp",
          targetType: "manga",
          targetId: String(commentData.mangaId),
          targetSlug,
          targetUrl: targetSlug ? `/truyen-hentai/${targetSlug}` : `/truyen-hentai/${String(commentData.mangaId)}`,
        });
      } else if (commentData.postId) {
        const post = await PostModel.findById(commentData.postId).select("title images authorId").lean();
        await sendSafe(post?.authorId, {
          title: post?.title ?? "Bình luận mới",
          subtitle: `${actorName} đã bình luận về bài viết của bạn`,
          imgUrl: (post?.images && post.images[0]) || "/images/logo.webp",
          targetType: "post",
          targetId: String(commentData.postId),
          targetUrl: `/post/${String(commentData.postId)}`,
        });
      }
    }
  } catch (err) {
    // Không chặn flow khi notify lỗi
    console.error("Notify on comment failed:", err);
  }

  return saved;
};

export const deleteComment = async (commentId: string, request: Request) => {
  const user = await getUserInfoFromSession(request);

  if (!user) {
    throw new BusinessError("Vui lòng đăng nhập");
  }

  if (!isAdmin(user.role)) {
    throw new BusinessError("Bạn không có quyền xóa bình luận");
  }

  if (!isValidObjectId(commentId)) {
    throw new BusinessError("ID bình luận không hợp lệ");
  }

  const comment = await CommentModel.findById(commentId);
  if (!comment) {
    throw new BusinessError("Không tìm thấy bình luận");
  }

  await CommentModel.findByIdAndDelete(commentId);

  return { success: true, message: "Xóa bình luận thành công" };
};

export const likeComment = async (commentId: string, userId: string) => {
  // Backward-compat wrapper: old "like" behavior becomes a reaction.
  const result = await reactComment(commentId, userId, "like");

  return {
    success: true,
    message: result.userReaction === "like" ? "Thích bình luận thành công" : "Bỏ thích bình luận thành công",
    commentId,
    newLikeCount: (result.reactionCounts as any)?.like ?? 0,
    isLiked: result.userReaction === "like",
  };
};

export const reactComment = async (commentId: string, userId: string, reactionRaw: unknown) => {
  const reaction = normalizeReactionType(reactionRaw);
  if (!reaction) {
    throw new BusinessError("Reaction không hợp lệ");
  }

  if (!isValidObjectId(commentId) || !isValidObjectId(userId)) {
    throw new BusinessError("ID không hợp lệ");
  }

  const comment = await CommentModel.findById(commentId).select("_id").lean();
  if (!comment) {
    throw new BusinessError("Không tìm thấy bình luận");
  }

  const existing = await UserReactionCommentModel.findOne({ commentId, userId }).lean();

  // Business rule: click same reaction -> toggle off
  if (existing && (existing as any).reaction === reaction) {
    await UserReactionCommentModel.deleteOne({ _id: (existing as any)._id });

    const inc: Record<string, number> = {
      [`reactionCounts.${reaction}`]: -1,
      totalReactions: -1,
    };
    if (reaction === "like") inc.likeNumber = -1;

    const updated = await CommentModel.findByIdAndUpdate(commentId, { $inc: inc }, { new: true }).lean();

    return {
      success: true,
      message: "Đã hủy cảm xúc",
      commentId,
      userReaction: null as ReactionType | null,
      reactionCounts: (updated as any)?.reactionCounts,
      totalReactions: (updated as any)?.totalReactions,
    };
  }

  if (existing) {
    const oldReaction = (existing as any).reaction as ReactionType;
    await UserReactionCommentModel.updateOne({ _id: (existing as any)._id }, { $set: { reaction } });

    const inc: Record<string, number> = {
      [`reactionCounts.${oldReaction}`]: -1,
      [`reactionCounts.${reaction}`]: 1,
    };

    if (oldReaction === "like") inc.likeNumber = (inc.likeNumber || 0) - 1;
    if (reaction === "like") inc.likeNumber = (inc.likeNumber || 0) + 1;

    const updated = await CommentModel.findByIdAndUpdate(commentId, { $inc: inc }, { new: true }).lean();

    return {
      success: true,
      message: "Đã cập nhật cảm xúc",
      commentId,
      userReaction: reaction,
      reactionCounts: (updated as any)?.reactionCounts,
      totalReactions: (updated as any)?.totalReactions,
    };
  }

  await UserReactionCommentModel.create({ commentId, userId, reaction });

  const inc: Record<string, number> = {
    [`reactionCounts.${reaction}`]: 1,
    totalReactions: 1,
  };
  if (reaction === "like") inc.likeNumber = 1;

  const updated = await CommentModel.findByIdAndUpdate(commentId, { $inc: inc }, { new: true }).lean();

  return {
    success: true,
    message: "Đã thả cảm xúc",
    commentId,
    userReaction: reaction,
    reactionCounts: (updated as any)?.reactionCounts,
    totalReactions: (updated as any)?.totalReactions,
  };
};
