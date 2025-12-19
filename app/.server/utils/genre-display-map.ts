import { GenresModel } from "~/database/models/genres.model";
import { toSlug } from "~/utils/slug.utils";

export async function buildGenreDisplayMap(genres?: string[] | null): Promise<Record<string, string>> {
  const normalized = Array.from(
    new Set(
      (Array.isArray(genres) ? genres : [])
        .map((item) => toSlug(String(item)))
        .filter(Boolean),
    ),
  );

  if (!normalized.length) {
    return {};
  }

  const docs = await GenresModel.find({ slug: { $in: normalized } })
    .select({ slug: 1, name: 1 })
    .lean();

  const map: Record<string, string> = {};
  for (const doc of docs) {
    const slug = String((doc as any)?.slug || "").toLowerCase();
    if (!slug) continue;
    const name = String((doc as any)?.name || "").trim();
    if (!name) continue;
    map[slug] = name;
  }

  return map;
}
