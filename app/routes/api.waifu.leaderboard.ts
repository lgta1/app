import type { LoaderFunctionArgs } from "react-router";

import { getUserWaifuLeaderboard } from "@/queries/user-waifu-leaderboard.query";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "5")));

    const history = await getUserWaifuLeaderboard(page, limit);

    return Response.json({
      success: true,
      ...history,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: "Không thể lấy dữ liệu leaderboard" },
      { status: 500 },
    );
  }
}
