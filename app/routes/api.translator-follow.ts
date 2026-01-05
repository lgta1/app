import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { TranslatorModel } from "~/database/models/translator.model";
import { UserFollowTranslatorModel } from "~/database/models/user-follow-translator.model";
import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";

// Loader: check follow status (and return follower count)
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    const url = new URL(request.url);
    const translatorSlug = url.searchParams.get("translatorSlug") || url.searchParams.get("slug");

    if (!translatorSlug) {
      return Response.json({ error: "translatorSlug là bắt buộc" }, { status: 400 });
    }

    const translator = await TranslatorModel.findOne({ slug: translatorSlug })
      .select("slug followNumber")
      .lean();
    if (!translator) {
      return Response.json({ error: "Dịch giả không tồn tại" }, { status: 404 });
    }

    if (!user) {
      return Response.json({ isFollowing: false, followersCount: (translator as any).followNumber ?? 0 });
    }

    const followRecord = await UserFollowTranslatorModel.findOne({
      userId: user.id,
      translatorSlug: String(translatorSlug).toLowerCase(),
    });

    return Response.json({
      isFollowing: !!followRecord,
      followersCount: (translator as any).followNumber ?? 0,
    });
  } catch (error) {
    console.error("Error checking translator follow status:", error);
    return Response.json({ error: "Có lỗi xảy ra khi kiểm tra trạng thái theo dõi" }, { status: 500 });
  }
}

// Action: follow/unfollow
export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);

    if (!user) {
      return Response.json({ error: "Vui lòng đăng nhập để theo dõi dịch giả" }, { status: 401 });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Chỉ chấp nhận POST method" }, { status: 405 });
    }

    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const translatorSlugRaw = formData.get("translatorSlug") as string;

    if (!translatorSlugRaw) {
      return Response.json({ error: "translatorSlug là bắt buộc" }, { status: 400 });
    }

    const translatorSlug = String(translatorSlugRaw).toLowerCase();

    const translator = await TranslatorModel.findOne({ slug: translatorSlug })
      .select("_id slug followNumber")
      .lean();
    if (!translator) {
      return Response.json({ error: "Dịch giả không tồn tại" }, { status: 404 });
    }

    if (intent === "follow") {
      const existingFollow = await UserFollowTranslatorModel.findOne({ userId: user.id, translatorSlug });
      if (existingFollow) {
        return Response.json({ error: "Bạn đã theo dõi dịch giả này rồi" }, { status: 400 });
      }

      await UserFollowTranslatorModel.create({ userId: user.id, translatorSlug });
      const updated = await TranslatorModel.findOneAndUpdate(
        { slug: translatorSlug },
        { $inc: { followNumber: 1 } },
        { new: true, timestamps: false, projection: { followNumber: 1 } },
      ).lean();

      return Response.json({
        success: true,
        message: "Theo dõi dịch giả thành công",
        isFollowing: true,
        followersCount: (updated as any)?.followNumber ?? (translator as any)?.followNumber ?? 0,
      });
    }

    if (intent === "unfollow") {
      const existingFollow = await UserFollowTranslatorModel.findOne({ userId: user.id, translatorSlug });
      if (!existingFollow) {
        return Response.json({ error: "Bạn chưa theo dõi dịch giả này" }, { status: 400 });
      }

      await UserFollowTranslatorModel.deleteOne({ userId: user.id, translatorSlug });
      const updated = await TranslatorModel.findOneAndUpdate(
        { slug: translatorSlug },
        { $inc: { followNumber: -1 } },
        { new: true, timestamps: false, projection: { followNumber: 1 } },
      ).lean();
      await TranslatorModel.updateOne({ slug: translatorSlug, followNumber: { $lt: 0 } }, { $set: { followNumber: 0 } });

      return Response.json({
        success: true,
        message: "Bỏ theo dõi dịch giả thành công",
        isFollowing: false,
        followersCount: Math.max(0, (updated as any)?.followNumber ?? (translator as any)?.followNumber ?? 0),
      });
    }

    return Response.json({ error: "Intent không hợp lệ" }, { status: 400 });
  } catch (error) {
    if (isBusinessError(error)) {
      return returnBusinessError(error);
    }

    console.error("Error in translator follow action:", error);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}
