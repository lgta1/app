import { getNewManga } from "@/queries/manga.query";

import { json } from "~/utils/json.server";
import { sharedTtlCache } from "~/.server/utils/ttl-cache";

import type { Route } from "./+types/api.manga.latest";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");

  try {
    const result = await sharedTtlCache.getOrSet(
      `api:manga-latest:${page}:${limit}:chapters>=1`,
      30_000,
      () => getNewManga(page, limit, { minChapters: 1 }),
    );

    return json(
      {
        data: result.manga,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        success: true,
      },
      {
        headers: {
          // Public data; safe to cache briefly to cut DB load
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          "CDN-Cache-Control": "public, max-age=120, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    return json(
      {
        data: [],
        totalPages: 0,
        currentPage: page,
        success: false,
        error: "Có lỗi xảy ra khi tải dữ liệu",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
