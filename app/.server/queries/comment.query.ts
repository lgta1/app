import { CommentModel } from "~/database/models/comment.model";

// Generic function để get comments cho cả manga và post
export const getComments = async (
  params: { mangaId?: string; postId?: string },
  page: number = 1,
  limit: number = 10,
) => {
  const { mangaId, postId } = params;

  if (!mangaId && !postId) {
    throw new Error("Either mangaId or postId must be provided");
  }

  if (mangaId && postId) {
    throw new Error("Cannot provide both mangaId and postId");
  }

  const filter = mangaId ? { mangaId } : { postId };
  const skip = (page - 1) * limit;

  // Get total count for pagination
  const totalCount = await CommentModel.countDocuments(filter);
  const totalPages = Math.ceil(totalCount / limit);

  // Get comments with pagination
  const comments = await CommentModel.find(filter)
    .populate("userId", "name avatar gender level faction")
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

export const getCommentById = async (commentId: string) => {
  return await CommentModel.findById(commentId)
    .populate("userId", "name avatar gender level faction")
    .populate("mangaId", "title")
    .populate("postId", "title")
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
    .populate("postId", "title")
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
