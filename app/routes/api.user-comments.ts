import { getCommentsByUserId } from "@/queries/comment.query";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/api.user-comments";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const user = await getUserInfoFromSession(request);

    if (!user) {
      return Response.json({ error: "Vui lòng đăng nhập" }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    const commentsData = await getCommentsByUserId(user.id, page, limit);

    return Response.json({
      data: commentsData.data,
      totalPages: commentsData.totalPages,
      currentPage: commentsData.currentPage,
      totalCount: commentsData.totalCount,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching user comments:", error);
    return Response.json(
      {
        error: "Có lỗi xảy ra khi tải bình luận",
        success: false,
      },
      { status: 500 },
    );
  }
}
