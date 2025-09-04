// app/helpers/waifu.helper.ts
export type SelectedWaifu = {
  id: string;
  name?: string;
  filename?: string; // ví d?: "mitsuri vinahentai.com-1756571970280-47bb08f5.webp"
};

export const STORAGE_KEY = "selectedWaifu";

export function getSelectedWaifu(): SelectedWaifu | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Build URL ?nh tinh t? thu m?c public b?n dang dùng: /public/images/waifu */
export function buildWaifuStillUrl(filename?: string): string | null {
  return filename ? `/images/waifu/${filename}` : null;
}

/** L?y filename t? URL (b? query/hash), dùng khi luu “Ð?ng hành” */
export function extractFilename(input?: string): string | null {
  if (!input) return null;
  const clean = input.split("?")[0].split("#")[0];
  const last = clean.split("/").pop() || "";
  return last ? decodeURIComponent(last) : null;
}
