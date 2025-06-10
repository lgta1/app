import { isValidObjectId } from "mongoose";

import { sanitizeCommentContent, validateCommentContent } from "@/services/comment.svc";
import { getUserInfoFromSession } from "@/services/session.svc";

import { CommentModel } from "~/database/models/comment.model";
import { UserLikeCommentModel } from "~/database/models/user-like-comment.model";
import { isAdmin } from "~/helpers/user.helper";

export const createComment = async (data: {
  content: string;
  mangaId: string;
  userId: string;
}) => {
  const { content, mangaId, userId } = data;

  if (!validateCommentContent(content)) {
    throw new Error("Nội dung bình luận không hợp lệ (1-1000 ký tự)");
  }

  if (!isValidObjectId(mangaId) || !isValidObjectId(userId)) {
    throw new Error("ID không hợp lệ");
  }

  const sanitizedContent = sanitizeCommentContent(content);

  const comment = new CommentModel({
    content: sanitizedContent,
    mangaId,
    userId,
  });

  await comment.save();

  // Populate để trả về thông tin đầy đủ
  return await CommentModel.findById(comment._id)
    .populate("userId", "name avatar gender level faction")
    .lean();
};

export const deleteComment = async (commentId: string, request: Request) => {
  const user = await getUserInfoFromSession(request);

  if (!isAdmin(user?.role ?? "")) {
    throw new Error("Bạn không có quyền xóa bình luận");
  }

  if (!isValidObjectId(commentId)) {
    throw new Error("ID không hợp lệ");
  }

  const comment = await CommentModel.findById(commentId);

  if (!comment) {
    throw new Error("Không tìm thấy bình luận");
  }

  // Xóa cứng khỏi database
  await CommentModel.findByIdAndDelete(commentId);

  return { success: true, message: "Xóa bình luận thành công" };
};

export const likeComment = async (commentId: string, userId: string) => {
  const userLikeComment = await UserLikeCommentModel.findOne({ commentId, userId });

  if (userLikeComment) {
    throw new Error("Bạn đã thích bình luận này");
  }

  const newUserLikeComment = new UserLikeCommentModel({ commentId, userId });
  await newUserLikeComment.save();

  await CommentModel.findByIdAndUpdate(commentId, { $inc: { likeNumber: 1 } });

  return { success: true, message: "Thích bình luận thành công" };
};
