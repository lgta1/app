type MaybeWithMangaId = {
  slug?: string | null;
  id?: string | null;
  _id?: string | null;
};

function normalize(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function getMangaHandle(input?: string | MaybeWithMangaId | null): string | null {
  if (!input) return null;
  if (typeof input === "string") {
    return normalize(input);
  }
  return normalize(input.slug) ?? normalize(input.id) ?? normalize(input._id);
}

export function buildMangaUrl(input?: string | MaybeWithMangaId | null) {
  const handle = getMangaHandle(input);
  return handle ? `/truyen-hentai/${handle}` : "/truyen-hentai";
}
