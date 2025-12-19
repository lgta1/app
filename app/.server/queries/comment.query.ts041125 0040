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

  const filter = mangaId ? { mangaId, parentId: null } : { postId, parentId: null }; // Chỉ lấy parent comments
  const skip = (page - 1) * limit;

  // Get total count for pagination (chỉ đếm parent comments)
  const totalCount = await CommentModel.countDocuments(filter);
  const totalPages = Math.ceil(totalCount / limit);

  // Get parent comments with pagination
  const comments = await CommentModel.find(filter)
    .populate("userId", "name avatar gender level faction waifuFilename")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Thêm thông tin về số lượng replies cho mỗi comment
  const commentsWithReplyCounts = await Promise.all(
    comments.map(async (comment) => {
      const replyCount = await CommentModel.countDocuments({ parentId: comment._id });
      return {
        ...comment,
        replyCount, // Thêm field replyCount
      };
    }),
  );

  return {
    data: commentsWithReplyCounts,
    totalPages,
    currentPage: page,
    totalCount,
  };
};

// Function để lấy replies cho một parent comment cụ thể
export const getReplies = async (parentId: string) => {
  const replies = await CommentModel.find({ parentId })
    .populate("userId", "name avatar gender level faction waifuFilename")
    .sort({ createdAt: 1 }) // Sort theo thời gian tạo tăng dần cho replies
    .lean();

  return replies;
};

// Function để lấy comment với replies (dùng khi cần load cả parent và replies)
export const getCommentWithReplies = async (commentId: string) => {
  const comment = await CommentModel.findById(commentId)
    .populate("userId", "name avatar gender level faction waifuFilename")
    .lean();

  if (!comment) {
    return null;
  }

  // Nếu là parent comment, lấy replies
  if (!comment.parentId) {
    const replies = await getReplies(commentId);
    return { ...comment, replies };
  }

  return comment;
};

export const getCommentById = async (commentId: string) => {
  return await CommentModel.findById(commentId)
    .populate("userId", "name avatar gender level faction waifuFilename")
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
  const totalCount = await CommentModel.countDocuments({
    userId,
    mangaId: { $exists: true },
  });
  const totalPages = Math.ceil(totalCount / limit);

  // Get comments with pagination
  const comments = await CommentModel.find({ userId, mangaId: { $exists: true } })
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
