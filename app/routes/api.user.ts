import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { UserModel } from "~/database/models/user.model";
import { WaifuModel } from "~/database/models/waifu.model";
import { getDefaultBlacklistTagSlugs } from "~/constants/blacklist-tags";
import { UserWaifuInventoryModel } from "~/database/models/user-waifu-inventory";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json({ success: true, data: null });
    }
    let userFull: any = await UserModel.findById(user?.id)
      .select("-password -salt")
      .lean();

    // Auto-apply defaults once for users who never configured the blacklist.
    try {
      const configured = Boolean(userFull?.hasConfiguredBlacklistTags);
      const list = Array.isArray(userFull?.blacklistTags) ? (userFull.blacklistTags as any[]) : [];
      if (!configured && list.length === 0) {
        const defaults = getDefaultBlacklistTagSlugs();
        await UserModel.findByIdAndUpdate(user?.id, {
          $set: { blacklistTags: defaults, hasConfiguredBlacklistTags: true },
        });
        userFull = { ...userFull, blacklistTags: defaults, hasConfiguredBlacklistTags: true };
      }
    } catch {
      // ignore
    }

    return Response.json({ success: true, data: userFull });
  } catch (error) {
    return Response.json(
      { success: false, error: "Không thể lấy dữ liệu user info" },
      { status: 500 },
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json(
        { success: false, error: "Vui lòng đăng nhập" },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;
    const waifuId = formData.get("waifuId") as string;

    const currentUser = await UserModel.findById(user.id).select("currentWaifu");

    if (actionType === "setWaifu") {
      if (currentUser?.currentWaifu) {
        return Response.json({
          success: false,
          error: "Bạn cần gỡ waifu hiện tại trước khi chọn waifu mới",
        });
      }

      // Find waifu by name to get the ID
      const waifu = await WaifuModel.findById(waifuId).lean();
      if (!waifu) {
        return Response.json({
          success: false,
          error: "Không tìm thấy waifu",
        });
      }

      const inv = await UserWaifuInventoryModel.findOne({
        userId: user.id,
        waifuId,
        count: { $gt: 0 },
      })
        .select(["count"])
        .lean();

      if (!inv) {
        return Response.json({
          success: false,
          error: "Bạn chưa sở hữu waifu này",
        });
      }

      // Derive static still filename: prefer waifu.image if already a still extension
      // (You can adjust this mapping later if animated vs still differ)
      const image = waifu.image || "";
      const isStill = /(\.webp|\.png|\.jpg|\.jpeg)$/i.test(image);
      const stillFilename = isStill ? image.split('/').pop() : null;

      await UserModel.findByIdAndUpdate(user.id, {
        currentWaifu: waifu._id,
        currentWaifuName: waifu.name ?? null,
        // Only set waifuFilename if we detected a plausible still file name
        ...(stillFilename ? { waifuFilename: stillFilename } : {}),
      });

      return Response.json({
        success: true,
        message: "Đã chọn waifu đồng hành thành công",
      });
    } else if (actionType === "unsetWaifu") {
      await UserModel.findByIdAndUpdate(user.id, {
        currentWaifu: null,
        currentWaifuName: null,
        waifuFilename: null,
      });

      return Response.json({
        success: true,
        message: "Đã gỡ waifu đồng hành thành công",
      });
    }

    return Response.json(
      { success: false, error: "Hành động không hợp lệ" },
      { status: 400 },
    );
  } catch (error) {
    return Response.json({ success: false, error: "Có lỗi xảy ra" }, { status: 500 });
  }
}
