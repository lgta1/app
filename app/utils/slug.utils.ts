// app/utils/slug.utils.ts

/**
 * Normalize a string into a URL-safe slug.
 * - Remove diacritics
 * - Lowercase
 * - Keep unicode letters/numbers (so CJK names still work)
 * - Space -> "-"
 */
export function slugify(str: string) {
  const input = (str || "").toString().trim();
  if (!input) return "";

  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const sanitized = normalized
    .replace(/[^\p{Letter}\p{Number}\s-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (sanitized) return sanitized;

  // Fallback: keep original characters but replace spaces with dashes
  const fallback = input.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return fallback;
}

/** Alias để tương thích import cũ: import { toSlug } from "~/utils/slug.utils" */
export function toSlug(str: string) {
  return slugify(str);
}
