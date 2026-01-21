import { DEFAULT_CDN_BASE } from "~/constants/cdn";

const normalizeBase = (value: string): string => value.replace(/\/+$/, "");

export const getRuntimeCdnBase = (): string => {
  // Prefer SSR-provided runtime base (varies per domain/request).
  if (typeof document !== "undefined") {
    try {
      const value = getComputedStyle(document.documentElement).getPropertyValue("--cdn-base").trim();
      if (value) return normalizeBase(value);
    } catch {
      // ignore
    }
  }

  const viteCdn = ((import.meta as any)?.env?.VITE_CDN_BASE as string | undefined)?.trim();
  if (viteCdn) return normalizeBase(viteCdn);

  const nodeCdn = ((globalThis as any)?.process?.env?.CDN_BASE as string | undefined)?.trim();
  if (nodeCdn) return normalizeBase(nodeCdn);

  return normalizeBase(DEFAULT_CDN_BASE);
};
