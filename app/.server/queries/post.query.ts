import { PostModel } from "~/database/models/post.model";
import { UserLikePostModel } from "~/database/models/user-like-post.model";

export const getAllPosts = async (
  page: number = 1,
  limit: number = 10,
  filters: {
    tags?: string[];
    authorId?: string;
    search?: string;
  } = {},
) => {
  const skip = (page - 1) * limit;

  // Build query
  const query: any = {
    isDeleted: false,
    isPublished: true,
  };

  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $in: filters.tags };
  }

  if (filters.authorId) {
    query.authorId = filters.authorId;
  }

  if (filters.search) {
    query.$or = [
      { title: { $regex: filters.search, $options: "i" } },
      { tags: { $regex: filters.search, $options: "i" } },
    ];
  }

  // Get total count for pagination
  const totalCount = await PostModel.countDocuments(query);
  const totalPages = Math.ceil(totalCount / limit);

  const posts = await PostModel.find(query)
    .populate("authorId", "name avatar gender level faction")
    .sort({ isPinned: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    data: posts,
    totalPages,
    currentPage: page,
    totalCount,
  };
};

export const getPostById = async (postId: string) => {
  return await PostModel.findOne({
    _id: postId,
    isDeleted: false,
    isPublished: true,
  })
    .populate("authorId", "name avatar gender level faction")
    .lean();
};

export const getPostByIdWithLikeStatus = async (postId: string, userId?: string) => {
  const post = await PostModel.findOneAndUpdate(
    {
      _id: postId,
      isDeleted: false,
      isPublished: true,
    },
    {
      $inc: {
        viewNumber: 1,
      },
    },
  )
    .populate("authorId", "name avatar gender level faction")
    .lean();

  if (!post) {
    return null;
  }

  let isLiked = false;
  if (userId) {
    const existingLike = await UserLikePostModel.findOne({
      postId,
      userId,
    });
    isLiked = !!existingLike;
  }

  return {
    ...post,
    isLiked,
  };
};
