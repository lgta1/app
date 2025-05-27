import type { ActionFunctionArgs } from "react-router";

import { ROLES } from "~/constants";
import { UserModel } from "~/database/models/user.model";
import {
  calculateLeaderboard,
  type LeaderboardPeriod,
} from "~/helpers/leaderboard.server";
import { getUserId } from "~/helpers/session.server";
import { calculateAllLeaderboards } from "~/jobs/leaderboard.server";

export async function loader({ request }: ActionFunctionArgs) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await UserModel.findOne({ _id: userId });
    if (user?.role !== ROLES.ADMIN) {
      return Response.json(
        { error: "You are not authorized to access this resource" },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const period = url.searchParams.get("period") as string;

    // Nếu không có period, tính toán tất cả
    if (!period) {
      await calculateAllLeaderboards();
      return Response.json({
        success: true,
        message: "Đã tính toán xong tất cả leaderboards",
      });
    }

    // Validate period
    if (!["daily", "weekly", "monthly"].includes(period)) {
      return Response.json(
        { error: "Period không hợp lệ. Chỉ chấp nhận: daily, weekly, monthly" },
        { status: 400 },
      );
    }

    await calculateLeaderboard(period as LeaderboardPeriod);

    return Response.json({
      success: true,
      message: `Đã tính toán xong leaderboard ${period}`,
    });
  } catch (error) {
    console.error("Lỗi API calculate leaderboard:", error);
    return Response.json(
      { error: "Lỗi server khi tính toán leaderboard" },
      { status: 500 },
    );
  }
}
