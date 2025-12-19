import { CommentModel } from "~/database/models/comment.model";
import { ensureMangaSlug } from "~/database/helpers/manga-slug.helper";

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

export const getPageContainingComment = async (
  commentId: string,
  params: { mangaId?: string; postId?: string },
  limit: number,
) => {
  const { mangaId, postId } = params;
  const filterBase = mangaId
    ? { mangaId }
    : postId
      ? { postId }
      : null;

  if (!filterBase) return null;

  const focusComment = await CommentModel.findOne({
    _id: commentId,
    parentId: null,
    ...filterBase,
  })
    .select("createdAt")
    .lean();

  if (!focusComment) return null;

  const newerCount = await CommentModel.countDocuments({
    parentId: null,
    ...filterBase,
    createdAt: { $gt: focusComment.createdAt },
  });

  const effectiveLimit = Math.max(1, limit || 1);
  const page = Math.floor(newerCount / effectiveLimit) + 1;

  return { page };
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
    .populate("mangaId", "title poster slug")
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

// Recent comments across mangas (include both level-1 and level-2)
export const getRecentMangaComments = async (
  page: number = 1,
  limit: number = 20,
) => {
  const effectiveLimit = Math.max(1, Math.min(100, limit));
  const skip = (page - 1) * effectiveLimit;

  // Chỉ lấy bình luận cấp 1 (parent) của manga
  const filter = { mangaId: { $exists: true }, parentId: null } as any;

  // Tối ưu hiệu năng: không đếm tổng; lấy thừa 1 bản ghi để suy ra còn trang kế tiếp hay không
  const records = await CommentModel.find(filter)
    .populate("userId", "name avatar")
    .populate("mangaId", "title poster slug")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(effectiveLimit + 1)
    .lean();

  const hasNext = records.length > effectiveLimit;
  const pageItems = hasNext ? records.slice(0, effectiveLimit) : records;

  await Promise.all(
    pageItems
      .filter((c: any) => c?.mangaId)
      .map((c: any) => ensureMangaSlug(c.mangaId)),
  );

  const data = pageItems.map((c: any) => ({
    ...c,
    id: String(c._id ?? c.id ?? ""),
    user: c.userId
      ? {
          id: String(c.userId._id ?? c.userId.id ?? ""),
          name: c.userId.name,
          avatar: c.userId.avatar,
        }
      : null,
    manga: c.mangaId
      ? {
          id: String(c.mangaId._id ?? c.mangaId.id ?? ""),
          title: c.mangaId.title,
          poster: (c.mangaId as any).poster,
          slug: (c.mangaId as any).slug,
        }
      : null,
  }));

  // Suy luận totalPages nhưng tối đa 3 trang
  const inferredTotalPages = hasNext ? Math.min(3, page + 1) : Math.min(3, page);

  return {
    data,
    totalPages: Math.max(1, inferredTotalPages),
    currentPage: page,
    totalCount: undefined as any, // không cần dùng cho UI; giữ field để không vỡ kiểu
  };
};
