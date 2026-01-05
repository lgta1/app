// Danh sách thể loại nổi bật dùng cho gợi ý "Có thể bạn thích"
// Lưu dưới dạng SLUG để khớp với cách lưu trong MangaModel.genres (dựa trên việc form tạo manga thao tác bằng slug, và pages truy cập `/genres/:slug`).
// Nếu trong tương lai genres lưu bằng tên hiển thị, cần map qua slug chuẩn trước khi so sánh.
import { stripDiacritics } from "~/utils/text-normalize";

// Thứ tự ưu tiên hiển thị featured genres (cao -> thấp).
// Lưu dưới dạng slug để so khớp trực tiếp với MangaModel.genres và route `/genres/:slug`.
export const FEATURED_GENRE_PRIORITY: readonly string[] = Object.freeze(
  [
    // Latest user-defined priority (high -> low)
    "guro",
    "scat",
    "anh-cosplay",
    "ai-generated",
    "manhwa",
    "3d-hentai",
    "full-color",
    "animal",
    "bestiality",
    "bdsm",
    // DB uses `old-man`, but source labels may slugify to `dirty-old-man`
    "old-man",
    "dirty-old-man",
    "tu-tien",
    "ngot",
    "vanilla",
    "gender-bender",
    "transformation",
    "tsundere",
    "incest",
    "ntr",
    "schoolgirl",
    "mother",
    "loli",
    "shota",
    "futanari",
    "rape",
    "milf",
    "succubus",
    "elf",
    "humiliation",
    "exhibitionism",
    "mind-break",
    "doujinshi",
    "gangbang",
    "slave",
    "mind-control",
    "virgin",
    "teacher",
    "masturbation",
    "double-penetration",
    "time-stop",
    "drug",
    "isekai",
    "supernatural",
    "monster",
    "demon",
    "historical",
    "trap",
    "tentacles",
    "horror",
    // keep "co-che" but make it lowest priority
    "co-che",
  ].map((s) => s.trim().toLowerCase()).filter(Boolean),
);

export const FEATURED_GENRE_PRIORITY_RANK: Readonly<Record<string, number>> = Object.freeze(
  FEATURED_GENRE_PRIORITY.reduce((acc, slug, idx) => {
    acc[slug] = idx;
    acc[slug.replace(/-/g, "")] = idx;
    return acc;
  }, {} as Record<string, number>),
);

export const FEATURED_GENRE_SLUGS: ReadonlySet<string> = new Set(
  FEATURED_GENRE_PRIORITY,
);

// Ghi chú các mục chỉnh sửa so với yêu cầu ban đầu + bổ sung:
// - "artist cd" -> "artist-cg" (đối chiếu genres-full.json)
// - "blackskin" -> "black-skin"
// - "animal girl" -> "animal-girl"
// - "3d hentai" -> "3d-hentai"
// - "based game" -> "based-game"
// - "gender bender" -> "gender-bender"
// - "schoolgirl" giữ nguyên nhưng trong JSON là slug "schoolgirl" với name "SchoolGirl"
// - "côn trùng" -> "con-trung"
// - "crotch tattoo" -> "crotch-tattoo"
// Những slug còn lại trùng khớp.

// Helper chuẩn hoá mảng genres đầu vào để so sánh với FEATURED_GENRE_SLUGS
export function normalizeGenreSlugs(genres: string[] | undefined): string[] {
  const toSlug = (value: string): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";

    // If it already looks like a slug, keep as-is.
    const lowered = raw.toLowerCase();
    if (/^[a-z0-9-]+$/.test(lowered)) {
      // Normalize known legacy aliases to canonical slugs.
      if (lowered === "cosplay") return "anh-cosplay";
      if (lowered === "blowjob") return "blowjobs";
      return lowered;
    }

    // Otherwise, fold Vietnamese + punctuation/spacing into a slug-like form.
    const folded = stripDiacritics(lowered);
    const slug = folded
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Map common legacy display names to canonical slugs.
    if (slug === "anh-cosplay") return "anh-cosplay";
    if (slug === "cosplay") return "anh-cosplay";
    if (slug === "blowjob") return "blowjobs";
    return slug;
  };

  return (genres || []).map(toSlug).filter(Boolean);
}