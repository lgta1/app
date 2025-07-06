import { isValidObjectId } from "mongoose";

import { sanitizeCommentContent, validateCommentContent } from "@/services/comment.svc";
import { getUserInfoFromSession } from "@/services/session.svc";

import { CommentModel } from "~/database/models/comment.model";
import { UserLikeCommentModel } from "~/database/models/user-like-comment.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";

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
  return await CommentModel.findById(comment._id)
    .populate("userId", "name avatar gender level faction")
    .lean();
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
  if (!isValidObjectId(commentId) || !isValidObjectId(userId)) {
    throw new BusinessError("ID không hợp lệ");
  }

  const comment = await CommentModel.findById(commentId);
  if (!comment) {
    throw new BusinessError("Không tìm thấy bình luận");
  }

  const userLikeComment = await UserLikeCommentModel.findOne({ commentId, userId });

  if (userLikeComment) {
    // Unlike comment
    await UserLikeCommentModel.findByIdAndDelete(userLikeComment._id);
    await CommentModel.findByIdAndUpdate(commentId, { $inc: { likeNumber: -1 } });

    const newLikeCount = Math.max(0, (comment.likeNumber || 0) - 1);

    return {
      success: true,
      message: "Bỏ thích bình luận thành công",
      commentId,
      newLikeCount,
      isLiked: false,
    };
  }

  // Like comment
  const newUserLikeComment = new UserLikeCommentModel({ commentId, userId });
  await newUserLikeComment.save();

  await CommentModel.findByIdAndUpdate(commentId, { $inc: { likeNumber: 1 } });

  const newLikeCount = (comment.likeNumber || 0) + 1;

  return {
    success: true,
    message: "Thích bình luận thành công",
    commentId,
    newLikeCount,
    isLiked: true,
  };
};
