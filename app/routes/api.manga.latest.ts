import { getNewManga } from "@/queries/manga.query";

import type { Route } from "./+types/api.manga.latest";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");

  try {
    const result = await getNewManga(page, limit);

    return {
      data: result.manga,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      success: true,
    };
  } catch (error) {
    return {
      data: [],
      totalPages: 0,
      currentPage: page,
      success: false,
      error: "Có lỗi xảy ra khi tải dữ liệu",
    };
  }
}
