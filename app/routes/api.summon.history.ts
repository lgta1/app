import type { LoaderFunctionArgs } from "react-router";

import { getSummonHistoryWithPagination } from "@/queries/user-waifu.query";
import { requireLogin } from "@/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireLogin(request);
    const url = new URL(request.url);
    const bannerId = url.searchParams.get("bannerId") as string;
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "5");

    if (!bannerId) {
      return Response.json(
        { success: false, error: "bannerId là bắt buộc" },
        { status: 400 },
      );
    }

    const history = await getSummonHistoryWithPagination(user.id, bannerId, page, limit);

    return Response.json({
      success: true,
      ...history,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: "Không thể lấy dữ liệu user info" },
      { status: 500 },
    );
  }
}
