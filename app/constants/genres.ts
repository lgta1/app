// app/constants/genres.ts
/**
 * Chuẩn hoá: toàn bộ thể loại thuộc 1 nhóm duy nhất "general".
 * Không còn các nhóm "most_viewed" / "other" / "hardcore".
 *
 * Lưu ý:
 * - Nếu ở nơi khác trong code còn import GENRE_CATEGORY.MOST_VIEWED/... → sẽ lỗi build.
 *   Đây là chủ đích để lộ các “điểm sót” cần xoá. Sửa các chỗ đó thành GENRE_CATEGORY.GENERAL.
 */

export enum GENRE_CATEGORY {
  GENERAL = "general",
}

// (nếu đoạn code nào cần mảng giá trị hợp lệ)
export const GENRE_CATEGORY_VALUES = [GENRE_CATEGORY.GENERAL] as const;
export type GenreCategory = typeof GENRE_CATEGORY_VALUES[number];

/**
 * Tuỳ chọn (không bắt buộc): map “legacy” → "general"
 * Nếu bạn muốn tạm thời migrate êm hơn ở vài nơi còn tham chiếu cũ, có thể dùng hằng dưới đây.
 * Nhưng KHÔNG dùng cho schema.
 */
export const LEGACY_GENRE_CATEGORY_MAP = {
  most_viewed: GENRE_CATEGORY.GENERAL,
  other: GENRE_CATEGORY.GENERAL,
  hardcore: GENRE_CATEGORY.GENERAL,
} as const;
