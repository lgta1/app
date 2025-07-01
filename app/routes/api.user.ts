import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { UserModel } from "~/database/models/user.model";
import { WaifuModel } from "~/database/models/waifu.model";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json({ success: true, data: null });
    }
    const userFull = await UserModel.findById(user?.id).lean();
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

      await UserModel.findByIdAndUpdate(user.id, {
        currentWaifu: waifu._id,
      });

      return Response.json({
        success: true,
        message: "Đã chọn waifu đồng hành thành công",
      });
    } else if (actionType === "unsetWaifu") {
      await UserModel.findByIdAndUpdate(user.id, {
        currentWaifu: null,
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
