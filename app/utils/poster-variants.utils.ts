export type PosterVariantKey = "w220" | "w400" | "w625";

export type PosterVariantEntry = {
  url: string;
  width?: number;
  height?: number;
  fullPath?: string;
  bytes?: number;
};

export type PosterVariantsPayload = {
  source?: PosterVariantEntry;
  w220?: PosterVariantEntry;
  w400?: PosterVariantEntry;
  w625?: PosterVariantEntry;
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
  if (desired === "w220") return variants.w220 || variants.w400 || variants.w625;
  if (desired === "w400") return variants.w400 || variants.w625;
  return variants.w625;
};

export const getPosterVariantForContext = (
  manga: any,
  context: PosterContext,
): PosterVariantEntry | undefined => {
  const variants = (manga as any)?.posterVariants as PosterVariantsPayload | undefined;
  const desired: PosterVariantKey =
    context === "small" || context === "leaderboard"
      ? "w220"
      : context === "cardMobile"
      ? "w400"
      : "w625";

  const picked = pickVariant(variants, desired);
  if (picked?.url) return picked;

  const fallbackUrl = (manga as any)?.poster as string | undefined;
  return fallbackUrl ? { url: fallbackUrl } : undefined;
};

export const getPosterUrlForContext = (manga: any, context: PosterContext): string => {
  return getPosterVariantForContext(manga, context)?.url || "";
};
