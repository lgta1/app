// app/constants/blacklist-tags.ts

/**
 * Default hidden genres for both logged-in users (first-time) and guests.
 * Keep the raw strings as requested; matching uses normalization.
 */
export const DEFAULT_BLACKLIST_TAGS = [
  "guro",
  "scat",
  "côn-trùng",
  "insect",
] as const;

export type BlacklistTag = (typeof DEFAULT_BLACKLIST_TAGS)[number];

/**
 * Normalize a genre/tag key into a comparable slug-like form.
 * - Lowercase
 * - Strip Vietnamese diacritics (côn-trùng -> con-trung)
 * - Convert non-alphanumerics to '-'
 */
export function normalizeBlacklistTag(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]+/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function getDefaultBlacklistTagSlugs(): string[] {
  return Array.from(new Set(DEFAULT_BLACKLIST_TAGS.map(normalizeBlacklistTag).filter(Boolean)));
}
