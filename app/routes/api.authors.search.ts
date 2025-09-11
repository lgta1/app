import type { LoaderFunctionArgs } from "react-router";

import { AuthorModel } from "~/database/models/author.model";
import { slugify } from "~/utils/slug.utils";

/**
 * /api/authors/search?q=...
 * - Hỗ trợ contains thay vì startsWith
 * - Bỏ dấu bằng cách search thêm trên field slug
 * - Không yêu cầu đăng nhập
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  // Trả về rỗng nếu không có q (tránh scan DB)
  if (!q) {
    return Response.json({ items: [] });
  }

  // Chuẩn hóa: tạo thêm qSlug để tìm kiếm bỏ dấu
  const qSlug = slugify(q); // ví dụ "Á quốc" -> "a-quoc"

  // Tìm theo chứa (contains) trên cả name (có dấu) và slug (bỏ dấu)
  // - name: case-insensitive (không bỏ dấu hoàn toàn được bằng regex)
  // - slug: regex chứa (bỏ dấu hoàn toàn nhờ slugify)
  const items = await AuthorModel.find(
    {
      $or: [
        { slug: { $regex: qSlug, $options: "i" } }, // bỏ dấu, contains
        { name: { $regex: q, $options: "i" } }, // có dấu, contains (best-effort)
      ],
    },
    { _id: 1, name: 1, slug: 1 },
  )
    .sort({ name: 1 })
    .limit(10)
    .lean();

  return Response.json({
    items: items.map((a) => ({
      id: a._id.toString(),
      name: a.name,
      slug: a.slug,
    })),
  });
}
