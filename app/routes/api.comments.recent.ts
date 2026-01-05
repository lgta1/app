import { getRecentMangaComments } from "@/queries/comment.query";

import type { Route } from "./+types/api.comments.recent";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    // Quy chuẩn mới: tối đa 10 bình luận gần nhất, chia 2 trang, mỗi trang 5.
    const limit = 5;

    // Chỉ cho phép 2 trang
    const clampedPage = Math.max(1, Math.min(page, 2));

    const result = await getRecentMangaComments(clampedPage, limit);
    const cappedTotalPages = Math.min(result.totalPages ?? 1, 2);

    return Response.json(
      {
        data: result.data,
        totalPages: cappedTotalPages,
        currentPage: Math.min((result.currentPage ?? clampedPage), cappedTotalPages),
        totalCount: result.totalCount ?? undefined,
        success: true,
      },
      {
        headers: {
          // Ngăn cache trên mobile/CDN làm treo dữ liệu cũ
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching recent comments:", error);
    return Response.json(
      { error: "Có lỗi xảy ra khi tải bình luận gần đây", success: false },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
