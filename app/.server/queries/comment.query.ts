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

export const getCommentsByUserId = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  // Get total count for pagination
  const totalCount = await CommentModel.countDocuments({ userId });
  const totalPages = Math.ceil(totalCount / limit);

  // Get comments with pagination
  const comments = await CommentModel.find({ userId })
    .populate("mangaId", "title poster")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    data: comments,
    totalPages,
    currentPage: page,
    totalCount,
  };
};
