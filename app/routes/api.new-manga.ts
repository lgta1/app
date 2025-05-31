import { getNewManga } from "@/queries/manga.query";

import type { Route } from "./+types/api.new-manga";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");

  const manga = await getNewManga(page, limit);

  return {
    manga,
    hasMore: manga.length === limit,
    nextPage: page + 1,
  };
}
