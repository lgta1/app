import {
  getTotalMangaCount,
  searchMangaApprovedWithPagination,
} from "@/queries/manga.query";

import type { Route } from "./+types/api.manga.search";

import { MANGA_CONTENT_TYPE, MANGA_STATUS } from "~/constants/manga";
import { sharedTtlCache } from "~/.server/utils/ttl-cache";
import { json } from "~/utils/json.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const keyword = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");

  if (!keyword.trim()) {
    // Don’t cache empty queries (can vary by client behavior)
    return json(
      {
        manga: [],
        hasMore: false,
        nextPage: page + 1,
        total: 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const cacheKey = `api:manga-search:${keyword.trim().toLowerCase()}:${page}:${limit}`;
  const { manga, total } = await sharedTtlCache.getOrSet(
    cacheKey,
    30_000,
    async () => {
      const [manga, total] = await Promise.all([
        searchMangaApprovedWithPagination({ keyword, page, limit }),
        getTotalMangaCount({
          searchTerm: keyword,
          query: {
            status: MANGA_STATUS.APPROVED,
            contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
          },
        }),
      ]);
      return { manga, total };
    },
  );

  return json(
    {
      manga,
      hasMore: manga.length === limit,
      nextPage: page + 1,
      total,
    },
    {
      headers: {
        // Search is expensive and heavily repeated; cache briefly at edge
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        "CDN-Cache-Control": "public, max-age=120, stale-while-revalidate=600",
      },
    },
  );
}
