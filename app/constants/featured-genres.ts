// Danh sách thể loại nổi bật dùng cho gợi ý "Có thể bạn thích"
// Lưu dưới dạng SLUG để khớp với cách lưu trong MangaModel.genres (dựa trên việc form tạo manga thao tác bằng slug, và pages truy cập `/genres/:slug`).
// Nếu trong tương lai genres lưu bằng tên hiển thị, cần map qua slug chuẩn trước khi so sánh.
import { stripDiacritics } from "~/utils/text-normalize";

export const FEATURED_GENRE_SLUGS: ReadonlySet<string> = new Set(
  [
    // 🥇 ĐỊNH DẠNG TRUYỆN (FORMAT · BẮT BUỘC)
    "3d-hentai",
    "manhwa",
    "anh-cosplay",

    // ⚠️ So khớp format trước tiên, khác format = loại (mặc định)
    "incest",
    "soft-incest",
    "ntr",
    "netori",
    "rape",
    "femdom",
    "harem",
    "gangbang",
    "slave",
    "mind-control",
    "sister",
    "brother",
    "mother",
    "daughter",
    "milf",
    "loli",
    "shota",
    "teacher",
    "housewife",
    "virgin",
    "anal",
    "blowjobs",
    "paizuri",
    "masturbation",
    "double-penetration",
    "humiliation",
    "exhibitionism",
    "mind-break",
    "time-stop",
    "drug",
    "fantasy",
    "isekai",
    "supernatural",
    "monster",
    "demon",
    "succubus",
    "elf",
    "historical",
    "futanari",
    "trap",
    "gender-bender",
    "transformation",
    "tentacles",
    "vanilla",
    "romance",
    "drama",
    "horror",
    "comedy",
    "doujinshi",
    "webtoon",
  ].map((s) => s.trim().toLowerCase()),
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