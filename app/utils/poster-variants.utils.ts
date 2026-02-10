export type PosterVariantKey = "w200" | "w220" | "w320" | "w360" | "w575";

export type PosterVariantEntry = {
  url: string;
  width?: number;
  height?: number;
  fullPath?: string;
  bytes?: number;
};

export type PosterVariantsPayload = {
  source?: PosterVariantEntry;
  w200?: PosterVariantEntry;
  w220?: PosterVariantEntry;
  w320?: PosterVariantEntry;
  w360?: PosterVariantEntry;
  w575?: PosterVariantEntry;
};

export type PosterContext =
  | "small"
  | "cardMobile"
  | "cardDesktop"
  | "detail"
  | "leaderboard";

const pickVariant = (
  variants: PosterVariantsPayload | undefined | null,
  desired: PosterVariantKey,
): PosterVariantEntry | undefined => {
  if (!variants) return undefined;
  if (desired === "w200") return variants.w200 || variants.w220 || variants.w320 || variants.w360 || variants.w575;
  if (desired === "w220") return variants.w220 || variants.w200 || variants.w320 || variants.w360 || variants.w575;
  if (desired === "w320") return variants.w320 || variants.w360 || variants.w575 || variants.w220 || variants.w200;
  if (desired === "w360") return variants.w360 || variants.w320 || variants.w575 || variants.w220 || variants.w200;
  return variants.w575 || variants.w360 || variants.w320 || variants.w220 || variants.w200;
};

export const getPosterVariantForContext = (
  manga: any,
  context: PosterContext,
): PosterVariantEntry | undefined => {
  const variants = (manga as any)?.posterVariants as PosterVariantsPayload | undefined;
  if (context === "cardMobile") {
    const preferred = variants?.w360 || variants?.w320;
    if (preferred?.url) return preferred;

    const fallbackUrl = (manga as any)?.poster as string | undefined;
    if (fallbackUrl) return { url: fallbackUrl };

    const fallbackVariant = variants?.w220 || variants?.w200;
    return fallbackVariant?.url ? fallbackVariant : undefined;
  }
  const desired: PosterVariantKey =
    context === "small" || context === "leaderboard"
      ? "w200"
      : context === "cardMobile"
      ? "w360"
      : "w575";

  const picked = pickVariant(variants, desired);
  if (picked?.url) return picked;

  const fallbackUrl = (manga as any)?.poster as string | undefined;
  return fallbackUrl ? { url: fallbackUrl } : undefined;
};

export const getPosterUrlForContext = (manga: any, context: PosterContext): string => {
  return getPosterVariantForContext(manga, context)?.url || "";
};

const FALLBACK_WIDTHS: Record<PosterVariantKey, number> = {
  w200: 200,
  w220: 220,
  w320: 320,
  w360: 360,
  w575: 575,
};

export const buildPosterSrcSet = (
  variants: PosterVariantsPayload | undefined | null,
): string | undefined => {
  if (!variants) return undefined;
  const entries: Array<{ url: string; width: number }> = [];
  (Object.keys(FALLBACK_WIDTHS) as PosterVariantKey[]).forEach((key) => {
    const entry = (variants as any)[key] as PosterVariantEntry | undefined;
    if (!entry?.url) return;
    const width = entry.width || FALLBACK_WIDTHS[key];
    entries.push({ url: entry.url, width });
  });
  if (entries.length === 0) return undefined;
  entries.sort((a, b) => a.width - b.width);
  return entries.map((item) => `${item.url} ${item.width}w`).join(", ");
};
