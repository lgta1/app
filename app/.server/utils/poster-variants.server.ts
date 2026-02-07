import type { PosterVariantsPayload } from "~/utils/poster-variants.utils";

const extractFullPathFromUrl = (value: string): string | null => {
  const text = String(value || "").trim();
  if (!text) return null;

  const prefix = "story-images/";
  const idx = text.indexOf(prefix);
  if (idx >= 0) return text.slice(idx);

  try {
    const url = new URL(text);
    const path = url.pathname.replace(/^\/+/, "");
    const prefixIdx = path.indexOf(prefix);
    if (prefixIdx >= 0) return path.slice(prefixIdx);
    return path || null;
  } catch {
    return null;
  }
};

export const collectPosterVariantPaths = (
  variants?: PosterVariantsPayload | null,
  fallbackUrl?: string | null,
): string[] => {
  const paths: string[] = [];
  const push = (entry?: { fullPath?: string; url?: string } | null) => {
    if (!entry) return;
    if (entry.fullPath) {
      paths.push(entry.fullPath);
      return;
    }
    if (entry.url) {
      const derived = extractFullPathFromUrl(entry.url);
      if (derived) paths.push(derived);
    }
  };

  if (variants) {
    push(variants.w200);
    push(variants.w220);
    push(variants.w320);
    push(variants.w360);
    push(variants.w575);
    push(variants.source);
  }

  if (paths.length === 0 && fallbackUrl) {
    const derived = extractFullPathFromUrl(fallbackUrl);
    if (derived) paths.push(derived);
  }

  return Array.from(new Set(paths)).filter(Boolean);
};

export const parsePosterVariantsPayload = (value: FormDataEntryValue | null): PosterVariantsPayload | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as PosterVariantsPayload;
  } catch {
    return null;
  }
};
