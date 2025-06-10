import {
  getTotalMangaCount,
  searchMangaApprovedWithPagination,
} from "@/queries/manga.query";

import type { Route } from "./+types/api.manga.search";

import { MANGA_STATUS } from "~/constants/manga";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const keyword = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");

  if (!keyword.trim()) {
    return {
      manga: [],
      hasMore: false,
      nextPage: page + 1,
      total: 0,
    };
  }

  const [manga, total] = await Promise.all([
    searchMangaApprovedWithPagination({ keyword, page, limit }),
    getTotalMangaCount({ searchTerm: keyword, query: { status: MANGA_STATUS.APPROVED } }),
  ]);

  return {
    manga,
    hasMore: manga.length === limit,
    nextPage: page + 1,
    total,
  };
}
