import { isValidObjectId } from "mongoose";

import { sanitizeCommentContent, validateCommentContent } from "@/services/comment.svc";

import { CommentModel } from "~/database/models/comment.model";

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
    .populate("userId", "name avatar")
    .lean();
};

export const deleteComment = async (commentId: string) => {
  const comment = await CommentModel.findById(commentId);

  if (!comment) {
    throw new Error("Không tìm thấy bình luận");
  }

  // Xóa cứng khỏi database
  await CommentModel.findByIdAndDelete(commentId);

  return { success: true, message: "Xóa bình luận thành công" };
};
