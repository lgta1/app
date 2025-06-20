import type { LoaderFunctionArgs } from "react-router";

import { getUserWaifuLeaderboard } from "@/queries/user-waifu-leaderboard.query";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "5");

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
