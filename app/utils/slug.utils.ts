// app/utils/slug.utils.ts

/**
 * Bỏ dấu, lowercase, chỉ giữ [a-z0-9-], khoảng trắng -> "-"
 */
export function slugify(str: string) {
  return (
    (str || "")
      .toString()
      .trim()
      .toLowerCase()
      // chuẩn hoá + bỏ dấu (đảm bảo chạy trên mọi runtime)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // fallback bỏ dấu
      .replace(/\p{Diacritic}/gu, "") // và thêm bỏ dấu theo Unicode props (nếu hỗ trợ)
      .replace(/[^a-z0-9\s-]/g, "") // bỏ ký tự lạ
      .replace(/\s+/g, "-") // space -> "-"
      .replace(/-+/g, "-")
  ); // gộp "-"
}

/** Alias để tương thích import cũ: import { toSlug } from "~/utils/slug.utils" */
export function toSlug(str: string) {
  return slugify(str);
}
