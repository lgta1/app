import { CommentModel } from "~/database/models/comment.model";

export const getCommentsByMangaId = async (
  mangaId: string,
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  const comments = await CommentModel.find({ mangaId })
    .populate("userId", "name avatar gender level faction")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit + 1)
    .lean();

  const hasMore = comments.length > limit;

  return {
    data: comments.slice(0, limit),
    hasMore,
  };
};

export const getCommentById = async (commentId: string) => {
  return await CommentModel.findById(commentId)
    .populate("userId", "name avatar gender level faction")
    .populate("mangaId", "title")
    .lean();
};
