import type { LoaderFunctionArgs } from "react-router";
import { json } from "~/utils/json.server";
import { getAllGenres } from "@/queries/genres.query";

export async function loader({}: LoaderFunctionArgs) {
  const genres = await getAllGenres();
  return json({
    ok: true,
    count: Array.isArray(genres) ? genres.length : 0,
    first30Slugs: (genres || []).slice(0, 30).map((g: any) => g?.slug),
  });
}
