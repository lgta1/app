// Shared genre rules around Vanilla vs. “anti-vanilla” tags.
// Slugs are canonical internal keys.

export const VANILLA_GENRE_SLUG = "vanilla" as const;

export const ANTI_VANILLA_TAGS: ReadonlySet<string> = new Set(
  [
    "ntr",
    "group",
    "bdsm",
    "bestiality",
    "bisexual",
    "blackmail",
    "bondage",
    "con-trung", // insect / côn_trùng
    "cross-dressing",
    "dirty",
    "dirtyoldman",
    "futanari",
    "gender-bender",
    "guro",
    "incest",
    "monster",
    "scat",
    "threesome",
    "tentacles",
    "rape",
    "mind-break",
  ].map((s) => s.trim().toLowerCase()),
);

export function normalizeGenreSlug(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function hasAntiVanillaTag(genres: readonly string[] | undefined): boolean {
  const list = Array.isArray(genres) ? genres : [];
  return list.some((g) => ANTI_VANILLA_TAGS.has(normalizeGenreSlug(g)));
}

/**
 * Import-time normalization rule:
 * If at least 1 anti-vanilla tag exists and vanilla also exists, drop vanilla.
 */
export function dropVanillaWhenAntiVanillaPresent(genres: readonly string[] | undefined): string[] {
  const list = Array.isArray(genres) ? genres.map(normalizeGenreSlug).filter(Boolean) : [];
  const hasVanilla = list.includes(VANILLA_GENRE_SLUG);
  if (!hasVanilla) return list;

  const hasAnti = list.some((g) => ANTI_VANILLA_TAGS.has(g));
  if (!hasAnti) return list;

  return list.filter((g) => g !== VANILLA_GENRE_SLUG);
}
