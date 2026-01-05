import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { AuthorModel } from "~/database/models/author.model";
import { UserFollowAuthorModel } from "~/database/models/user-follow-author.model";
import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";

// Loader: check follow status (and return follower count)
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    const url = new URL(request.url);
    const authorSlug = url.searchParams.get("authorSlug") || url.searchParams.get("slug");

    if (!authorSlug) {
      return Response.json({ error: "authorSlug là bắt buộc" }, { status: 400 });
    }

    const author = await AuthorModel.findOne({ slug: authorSlug }).select("slug followNumber").lean();
    if (!author) {
      return Response.json({ error: "Tác giả không tồn tại" }, { status: 404 });
    }

    if (!user) {
      return Response.json({ isFollowing: false, followersCount: (author as any).followNumber ?? 0 });
    }

    const followRecord = await UserFollowAuthorModel.findOne({
      userId: user.id,
      authorSlug: String(authorSlug).toLowerCase(),
    });

    return Response.json({
      isFollowing: !!followRecord,
      followersCount: (author as any).followNumber ?? 0,
    });
  } catch (error) {
    console.error("Error checking author follow status:", error);
    return Response.json({ error: "Có lỗi xảy ra khi kiểm tra trạng thái theo dõi" }, { status: 500 });
  }
}

// Action: follow/unfollow
export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);

    if (!user) {
      return Response.json({ error: "Vui lòng đăng nhập để theo dõi tác giả" }, { status: 401 });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Chỉ chấp nhận POST method" }, { status: 405 });
    }

    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const authorSlugRaw = formData.get("authorSlug") as string;

    if (!authorSlugRaw) {
      return Response.json({ error: "authorSlug là bắt buộc" }, { status: 400 });
    }

    const authorSlug = String(authorSlugRaw).toLowerCase();

    const author = await AuthorModel.findOne({ slug: authorSlug }).select("_id slug followNumber").lean();
    if (!author) {
      return Response.json({ error: "Tác giả không tồn tại" }, { status: 404 });
    }

    if (intent === "follow") {
      const existingFollow = await UserFollowAuthorModel.findOne({ userId: user.id, authorSlug });
      if (existingFollow) {
        return Response.json({ error: "Bạn đã theo dõi tác giả này rồi" }, { status: 400 });
      }

      await UserFollowAuthorModel.create({ userId: user.id, authorSlug });
      const updated = await AuthorModel.findOneAndUpdate(
        { slug: authorSlug },
        { $inc: { followNumber: 1 } },
        { new: true, timestamps: false, projection: { followNumber: 1 } },
      ).lean();

      return Response.json({
        success: true,
        message: "Theo dõi tác giả thành công",
        isFollowing: true,
        followersCount: (updated as any)?.followNumber ?? (author as any)?.followNumber ?? 0,
      });
    }

    if (intent === "unfollow") {
      const existingFollow = await UserFollowAuthorModel.findOne({ userId: user.id, authorSlug });
      if (!existingFollow) {
        return Response.json({ error: "Bạn chưa theo dõi tác giả này" }, { status: 400 });
      }

      await UserFollowAuthorModel.deleteOne({ userId: user.id, authorSlug });
      const updated = await AuthorModel.findOneAndUpdate(
        { slug: authorSlug },
        { $inc: { followNumber: -1 } },
        { new: true, timestamps: false, projection: { followNumber: 1 } },
      ).lean();
      await AuthorModel.updateOne({ slug: authorSlug, followNumber: { $lt: 0 } }, { $set: { followNumber: 0 } });

      return Response.json({
        success: true,
        message: "Bỏ theo dõi tác giả thành công",
        isFollowing: false,
        followersCount: Math.max(0, (updated as any)?.followNumber ?? (author as any)?.followNumber ?? 0),
      });
    }

    return Response.json({ error: "Intent không hợp lệ" }, { status: 400 });
  } catch (error) {
    if (isBusinessError(error)) {
      return returnBusinessError(error);
    }

    console.error("Error in author follow action:", error);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}
