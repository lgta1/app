const RESTRICTED_GENRE_SLUGS = new Set(["lolicon", "loli", "shota"]);

const normalizeSlug = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "object" && value && "slug" in (value as any)) {
    const slug = (value as any).slug;
    if (typeof slug === "string") return slug.trim().toLowerCase();
  }
  return "";
};

export const isRestrictedGenreSlug = (slug?: string | null): boolean => {
  const normalized = normalizeSlug(slug);
  return normalized ? RESTRICTED_GENRE_SLUGS.has(normalized) : false;
};

export const hasRestrictedGenres = (genres?: unknown): boolean => {
  if (!Array.isArray(genres)) return false;
  for (const item of genres) {
    const normalized = normalizeSlug(item);
    if (normalized && RESTRICTED_GENRE_SLUGS.has(normalized)) return true;
  }
  return false;
};

export const RESTRICTED_GENRE_SLUG_LIST = Array.from(RESTRICTED_GENRE_SLUGS);
