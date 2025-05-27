import type { ActionFunctionArgs } from "react-router";

import { requireAdminLogin } from "~/helpers/auth.server";
import {
  calculateLeaderboard,
  type LeaderboardPeriod,
} from "~/helpers/leaderboard.server";
import { calculateAllLeaderboards } from "~/jobs/leaderboard.server";

export async function loader({ request }: ActionFunctionArgs) {
  try {
    await requireAdminLogin(request);

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
