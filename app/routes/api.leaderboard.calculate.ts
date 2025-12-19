import type { ActionFunctionArgs } from "react-router";

import { calculateAllLeaderboards } from "@/jobs/leaderboard.server";
import { requireAdminLogin } from "@/services/auth.server";
import { calculateLeaderboard, type LeaderboardPeriod } from "@/services/leaderboard.svc";

export async function loader({ request }: ActionFunctionArgs) {
  try {
    // BYPASS nội bộ bằng token bí mật (không cần login)
const url = new URL(request.url);
const token =
  request.headers.get("x-internal-job-token") ||
  url.searchParams.get("token");

if (token && token === process.env.INTERNAL_JOB_TOKEN) {
  const periodParam = (url.searchParams.get("period") ?? "daily") as "daily" | "weekly" | "monthly";
  if (url.searchParams.has("period")) {
    await calculateLeaderboard(periodParam); // weekly/monthly sẽ bị bỏ qua an toàn
    return Response.json({ success: true, from: "internal", period: periodParam, skipped: periodParam !== "daily" });
  } else {
    await calculateAllLeaderboards();
    return Response.json({ success: true, from: "internal", period: "daily" });
  }
}

    await requireAdminLogin(request);
    const period = url.searchParams.get("period") as string;

    // Nếu không có period, tính toán tất cả
    if (!period) {
      await calculateAllLeaderboards();
      return Response.json({
        success: true,
        message: "Đã tính toán xong leaderboard daily (weekly/monthly dùng counters, không cần tính)",
      });
    }

    // Validate period
    if (!["daily", "weekly", "monthly"].includes(period)) {
      return Response.json(
        { error: "Period không hợp lệ. Chỉ chấp nhận: daily, weekly, monthly" },
        { status: 400 },
      );
    }

    await calculateLeaderboard(period as LeaderboardPeriod); // weekly/monthly sẽ log skip
    return Response.json({
      success: true,
      message: period === "daily"
        ? "Đã tính toán xong leaderboard daily"
        : "Weekly/Monthly đang dùng counters realtime, không cần tính snapshot",
      skipped: period !== "daily",
    });
  } catch (error) {
    console.error("Lỗi API calculate leaderboard:", error);
    return Response.json(
      { error: "Lỗi server khi tính toán leaderboard" },
      { status: 500 },
    );
  }
}
