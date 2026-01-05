import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";

const looksLikeAbsoluteUrl = (value: string): boolean => /^(https?:)?\/\//i.test(value);

const looksLikeFilename = (value: string): boolean => {
  if (!value) return false;
  if (value.includes("/")) return false;
  return /\.[a-z0-9]{2,5}$/i.test(value);
};

/**
 * Normalizes waifu image references used by UI.
 * - Accepts absolute URLs, /images/waifu/... paths, or bare filenames.
 * - Ensures a usable public URL under /images/waifu/ for filename-only values.
 */
export const normalizeWaifuImageUrl = (input: unknown): string | null => {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  const fixKnownWaifuKeyMismatch = (value: string): string => {
    // Compatibility shim: a lot of existing objects in R2 were uploaded with filenames containing
    // "vinahentai.com" (part of the object key). Some DB rows ended up stored without the ".com",
    // causing CDN 404s like:
    //   .../waifu-images/Rem_vinahentai-vinahentai-...webp
    // while the real object key is:
    //   .../waifu-images/Rem_vinahentai-vinahentai.com-...webp
    // Only touch URLs/paths under the waifu-images bucket.
    if (!/(?:^|\/)waifu-images\//i.test(value)) return value;
    if (/vinahentai\.com/i.test(value)) return value;

    return value.replace(/vinahentai-vinahentai-(?=\d)/i, "vinahentai-vinahentai.com-");
  };

  // For absolute URLs, rewrite legacy CDN hostnames if needed.
  if (looksLikeAbsoluteUrl(raw)) {
    const rewritten = rewriteLegacyCdnUrl(raw);
    return fixKnownWaifuKeyMismatch(rewritten);
  }

  // Do NOT mutate filename/path contents (some objects legitimately include "vinahentai.com" in the key).
  const value = fixKnownWaifuKeyMismatch(raw);

  if (value.startsWith("/images/waifu/")) return value;
  if (value.startsWith("images/waifu/")) return `/${value}`;

  if (looksLikeFilename(value)) return `/images/waifu/${value}`;

  // As a last resort, if it *looks* like a waifu file path without leading slash.
  if (value.startsWith("waifu/") || value.startsWith("images/")) {
    return value.startsWith("/") ? value : `/${value}`;
  }

  return value;
};
