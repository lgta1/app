import { createPost, deletePost, likePost, updatePost } from "@/mutations/post.mutation";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/api.post";

import { getAllPosts } from "~/.server/queries/post.query";
import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";

import { POSTS_ENABLED } from "~/constants/feature-flags";

const notFoundHeaders = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

export async function loader({ request }: Route.LoaderArgs) {
  if (!POSTS_ENABLED) {
    throw new Response("Not Found", { status: 404, headers: notFoundHeaders });
  }
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search") || "";
    const tags = url.searchParams.get("tags")?.split(",").filter(Boolean) || [];
    const authorId = url.searchParams.get("authorId") || "";

    const filters = {
      ...(search && { search }),
      ...(tags.length > 0 && { tags }),
      ...(authorId && { authorId }),
    };

    const posts = await getAllPosts(page, limit, filters);

    return Response.json({
      success: true,
      ...posts,
    });
  } catch (error) {
    console.error("Error loading posts:", error);
    return Response.json(
      { error: "Có lỗi xảy ra khi tải bài viết", success: false },
      { status: 500 },
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  if (!POSTS_ENABLED) {
    throw new Response("Not Found", { status: 404, headers: notFoundHeaders });
  }
  try {
    const user = await getUserInfoFromSession(request);

    if (!user) {
      return Response.json({ error: "Vui lòng đăng nhập" }, { status: 401 });
    }

    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    switch (intent) {
      case "create-post": {
        const title = formData.get("title") as string;
        const content = formData.get("content") as string;
        const tagsStr = formData.get("tags") as string;
        const imagesStr = formData.get("images") as string;

        if (!title || !content) {
          return Response.json(
            { error: "Tiêu đề và nội dung là bắt buộc" },
            { status: 400 },
          );
        }

        const tags = tagsStr ? JSON.parse(tagsStr) : [];
        const images = imagesStr ? JSON.parse(imagesStr) : [];

        const post = await createPost({
          title,
          content,
          tags,
          images,
          authorId: user.id,
        });

        return Response.json({
          success: true,
          post,
          message: "Tạo bài viết thành công",
        });
      }

      case "update-post": {
        const postId = formData.get("postId") as string;
        const title = formData.get("title") as string;
        const content = formData.get("content") as string;
        const tagsStr = formData.get("tags") as string;
        const imagesStr = formData.get("images") as string;

        if (!postId) {
          return Response.json({ error: "postId là bắt buộc" }, { status: 400 });
        }

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (tagsStr !== undefined) updateData.tags = JSON.parse(tagsStr);
        if (imagesStr !== undefined) updateData.images = JSON.parse(imagesStr);

        const post = await updatePost(postId, updateData, request);

        return Response.json({
          success: true,
          post,
          message: "Cập nhật bài viết thành công",
        });
      }

      case "delete-post": {
        const postId = formData.get("postId") as string;

        if (!postId) {
          return Response.json({ error: "postId là bắt buộc" }, { status: 400 });
        }

        const result = await deletePost(postId, request);

        return Response.json({
          success: true,
          postId,
          message: result.message,
        });
      }

      case "like-post": {
        const postId = formData.get("postId") as string;

        if (!postId) {
          return Response.json({ error: "postId là bắt buộc" }, { status: 400 });
        }

        const result = await likePost(postId, user.id);

        return Response.json(result);
      }

      default:
        return Response.json({ error: "Intent không hợp lệ" }, { status: 400 });
    }
  } catch (error) {
    if (isBusinessError(error)) {
      return returnBusinessError(error);
    }

    console.error("Error in posts action:", error);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}
