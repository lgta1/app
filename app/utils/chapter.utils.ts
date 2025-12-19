// app/utils/chapter.utils.ts
export function getChapterDisplayName(title?: string | null, chapterNumber?: number | null): string {
  const t = (title ?? "").trim();
  if (t) return t;
  const n = Number(chapterNumber);
  if (Number.isFinite(n) && n >= 1) return `Chap ${n}`;
  return "Chap ?";
}
