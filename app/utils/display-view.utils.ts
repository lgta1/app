const envEnabled = String(import.meta.env.VITE_DISPLAY_VIEW_ENABLED ?? "true").toLowerCase();
const envFactor = Number(import.meta.env.VITE_DISPLAY_VIEW_FACTOR ?? "1.3");

export const DISPLAY_VIEWS_ENABLED = envEnabled !== "false";
export const DISPLAY_VIEW_FACTOR = Number.isFinite(envFactor) && envFactor > 0 ? envFactor : 1.3;

export const toDisplayView = (raw: unknown): number => {
  const value = Number(raw || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!DISPLAY_VIEWS_ENABLED) return Math.round(value);
  return Math.max(0, Math.round(value * DISPLAY_VIEW_FACTOR));
};

export const sumDisplayViews = (values: Array<unknown>): number => {
  return values.reduce((sum, item) => sum + toDisplayView(item), 0);
};
