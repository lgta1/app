import { isValidObjectId } from "mongoose";

import {
  sanitizePostContent,
  sanitizePostTags,
  sanitizePostTitle,
  validatePostContent,
  validatePostTags,
  validatePostTitle,
} from "@/services/post.svc";
import { getUserInfoFromSession } from "@/services/session.svc";

import { PostModel } from "~/database/models/post.model";
import { UserLikePostModel } from "~/database/models/user-like-post.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";

export const createPost = async (data: {
  title: string;
  content: string;
  tags: string[];
  images?: string[];
  authorId: string;
}) => {
  const { title, content, tags, images = [], authorId } = data;

  // Validate input
  if (!validatePostTitle(title)) {
    throw new BusinessError("Tiêu đề không hợp lệ (1-100 ký tự)");
  }

  if (!validatePostContent(content)) {
    throw new BusinessError("Nội dung không hợp lệ (1-10000 ký tự)");
  }

  if (!validatePostTags(tags)) {
    throw new BusinessError("Tags không hợp lệ (tối đa 10 tags, mỗi tag 1-50 ký tự)");
  }

  if (!isValidObjectId(authorId)) {
    throw new BusinessError("User ID không hợp lệ");
  }

  // Sanitize input
  const sanitizedTitle = sanitizePostTitle(title);
  const sanitizedContent = sanitizePostContent(content);
  const sanitizedTags = sanitizePostTags(tags);

  const post = new PostModel({
    title: sanitizedTitle,
    content: sanitizedContent,
    tags: sanitizedTags,
    images,
    authorId,
  });

  await post.save();

  // Populate để trả về thông tin đầy đủ
  return await PostModel.findById(post._id)
    .populate("authorId", "name avatar gender level faction")
    .lean();
};

export const updatePost = async (
  postId: string,
  data: {
    title?: string;
    content?: string;
    tags?: string[];
    images?: string[];
  },
  request: Request,
) => {
  const user = await getUserInfoFromSession(request);

  if (!user) {
    throw new BusinessError("Bạn cần đăng nhập để chỉnh sửa bài viết");
  }

  if (!isValidObjectId(postId)) {
    throw new BusinessError("ID không hợp lệ");
  }

  const post = await PostModel.findById(postId);

  if (!post) {
    throw new BusinessError("Không tìm thấy bài viết");
  }

  // Check permission
  if (post.authorId !== user.id && !isAdmin(user.role)) {
    throw new BusinessError("Bạn không có quyền chỉnh sửa bài viết này");
  }

  const updateData: any = {};

  if (data.title !== undefined) {
    if (!validatePostTitle(data.title)) {
      throw new BusinessError("Tiêu đề không hợp lệ (1-100 ký tự)");
    }
    updateData.title = sanitizePostTitle(data.title);
  }

  if (data.content !== undefined) {
    if (!validatePostContent(data.content)) {
      throw new BusinessError("Nội dung không hợp lệ (1-10000 ký tự)");
    }
    updateData.content = sanitizePostContent(data.content);
  }

  if (data.tags !== undefined) {
    if (!validatePostTags(data.tags)) {
      throw new BusinessError("Tags không hợp lệ (tối đa 10 tags, mỗi tag 1-50 ký tự)");
    }
    updateData.tags = sanitizePostTags(data.tags);
  }

  if (data.images !== undefined) {
    updateData.images = data.images;
  }

  const updatedPost = await PostModel.findByIdAndUpdate(postId, updateData, { new: true })
    .populate("authorId", "name avatar gender level faction")
    .lean();

  return updatedPost;
};

export const deletePost = async (postId: string, request: Request) => {
  const user = await getUserInfoFromSession(request);

  if (!user) {
    throw new BusinessError("Bạn cần đăng nhập để xóa bài viết");
  }

  if (!isValidObjectId(postId)) {
    throw new BusinessError("ID không hợp lệ");
  }

  const post = await PostModel.findById(postId);

  if (!post) {
    throw new BusinessError("Không tìm thấy bài viết");
  }

  // Check permission
  if (post.authorId !== user.id && !isAdmin(user.role)) {
    throw new BusinessError("Bạn không có quyền xóa bài viết này");
  }

  // Soft delete
  await PostModel.findByIdAndUpdate(postId, { isDeleted: true });

  return { success: true, message: "Xóa bài viết thành công" };
};

export const likePost = async (postId: string, userId: string) => {
  if (!isValidObjectId(postId) || !isValidObjectId(userId)) {
    throw new BusinessError("ID không hợp lệ");
  }

  const post = await PostModel.findById(postId).select("likeNumber");
  if (!post) {
    throw new BusinessError("Không tìm thấy bài viết");
  }

  // Race-safe toggle:
  // - Like: upsert the relation and only increment counter if inserted
  // - Unlike: delete the relation and only decrement counter if deleted
  const existing = await UserLikePostModel.findOne({ postId, userId }).select("_id").lean();

  if (existing) {
    const delRes = await UserLikePostModel.deleteOne({ postId, userId });
    const deleted = (delRes as any)?.deletedCount === 1;

    const updatedPost = await PostModel.findOneAndUpdate(
      { _id: postId },
      deleted ? { $inc: { likeNumber: -1 } } : {},
      { new: true, projection: { likeNumber: 1 } },
    ).lean();

    return {
      success: true,
      message: deleted ? "Đã bỏ thích bài viết" : "Bài viết chưa được thích trước đó",
      isLiked: false,
      likeNumber: Math.max(0, Number((updatedPost as any)?.likeNumber ?? post.likeNumber ?? 0)),
    };
  }

  const upsertRes = await UserLikePostModel.updateOne(
    { postId, userId },
    { $setOnInsert: { postId, userId } },
    { upsert: true },
  );
  const inserted = Boolean((upsertRes as any)?.upsertedCount) || Boolean((upsertRes as any)?.upsertedId);

  const updatedPost = await PostModel.findOneAndUpdate(
    { _id: postId },
    inserted ? { $inc: { likeNumber: 1 } } : {},
    { new: true, projection: { likeNumber: 1 } },
  ).lean();

  return {
    success: true,
    message: inserted ? "Đã thích bài viết" : "Bài viết đã được thích trước đó",
    isLiked: true,
    likeNumber: Math.max(0, Number((updatedPost as any)?.likeNumber ?? post.likeNumber ?? 0)),
  };
};

export const checkUserLikedPost = async (postId: string, userId: string) => {
  if (!isValidObjectId(postId) || !isValidObjectId(userId)) {
    return false;
  }

  const existingLike = await UserLikePostModel.findOne({
    postId,
    userId,
  });

  return !!existingLike;
};

export const incrementPostView = async (postId: string) => {
  if (!isValidObjectId(postId)) {
    throw new BusinessError("ID không hợp lệ");
  }

  await PostModel.findByIdAndUpdate(postId, { $inc: { viewNumber: 1 } });

  return { success: true };
};
