import { CommentModel } from "~/database/models/comment.model";

export const getCommentsByMangaId = async (
  mangaId: string,
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  const comments = await CommentModel.find({ mangaId })
    .populate("userId", "name avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await CommentModel.countDocuments({ mangaId });

  return {
    comments,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

export const getCommentById = async (commentId: string) => {
  return await CommentModel.findById(commentId)
    .populate("userId", "name avatar role")
    .populate("mangaId", "title")
    .lean();
};
