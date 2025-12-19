// app/routes/api.genres.upsert.ts
import type { LoaderFunctionArgs } from "react-router";
import { json } from "~/utils/json.server";
import { GenresModel } from "~/database/models/genres.model";
import { GENRE_CATEGORY } from "~/constants/genres";
import { getUserInfoFromSession } from "@/services/session.svc";
import { isAdmin } from "~/helpers/user.helper";

const NEW_GENRES: Array<{ slug: string; name: string; description: string; category?: string }> = [
  { slug: "trap", name: "Trap", description: "Nhân vật nam ăn mặc hoặc thể hiện như nữ; ngoại hình và/hoặc tính cách nữ tính tạo nên sự nhập nhằng giới tính gợi cảm." },
  { slug: "paizuri", name: "Paizuri", description: "Quan hệ tình dục với ngực (ép dương vật giữa bầu ngực để kích thích và đạt cực khoái)." },
  { slug: "historical", name: "Historical", description: "Bối cảnh lịch sử, xa xưa; trang phục, phong tục và không gian cổ điển tạo nên sắc thái gợi cảm đặc trưng." },
  { slug: "hairy", name: "Hairy", description: "Nhân vật nữ có lông vùng kín rậm rạp, nhấn mạnh sự tự nhiên, trưởng thành và quyến rũ nguyên bản." },
  { slug: "exhibitionism", name: "Exhibitionism", description: "Lộ bộ phận nhạy cảm trước người khác; thường gắn với tình huống bị nhìn lén, rình trộm hoặc chủ động phô bày táo bạo." },
  { slug: "humiliation", name: "Humiliation", description: "Làm nhục, làm xấu hổ; mang tính ép buộc hoặc đặt nhân vật vào tình cảnh tiến thoái lưỡng nan không thể trốn tránh." },
  { slug: "miko", name: "Miko", description: "Vu nữ giữ đền với trang phục truyền thống, vẻ đẹp thanh khiết nhưng gợi cảm trong bối cảnh tâm linh Nhật Bản." },
  { slug: "kuudere", name: "Kuudere", description: "Kiểu nhân vật bề ngoài cực kỳ lạnh lùng để che giấu cảm xúc bên trong; chỉ mở lòng khi được chinh phục." },
  { slug: "ai-generated", name: "AI Generated", description: "Tác phẩm do AI tạo ra (nét vẽ, hình ảnh, truyện); nhấn mạnh phong cách, hiệu ứng và sự độc đáo của công cụ AI." },
  { slug: "transformation", name: "Transformation", description: "Nhân vật biến thân sang hình thể khác (ma thuật, công nghệ, lời nguyền...), mang đến trải nghiệm gợi cảm mới lạ." },
  { slug: "sweating", name: "Sweating", description: "Chảy mồ hôi nhiều; trong cảnh quan hệ nhấn mạnh cơ thể ướt át, hơi thở gấp và cao trào mãnh liệt." },
  { slug: "tall-girl", name: "Tall Girl", description: "Gái cao ráo, chân dài; thường có chiều cao vượt nam chính, tạo cảm giác áp đảo và quyến rũ." },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserInfoFromSession(request);
  if (!user || !isAdmin(user.role)) {
    return json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const results: Array<{ slug: string; upserted: boolean; updated: boolean }> = [];

  for (const item of NEW_GENRES) {
    const payload = {
      name: item.name,
      slug: item.slug,
      description: item.description,
      category: item.category || GENRE_CATEGORY.GENERAL,
    };
    const existing = await GenresModel.findOne({ slug: item.slug }).lean();
    if (!existing) {
      await GenresModel.updateOne(
        { slug: item.slug },
        { $setOnInsert: payload },
        { upsert: true }
      );
      results.push({ slug: item.slug, upserted: true, updated: false });
    } else {
      await GenresModel.updateOne(
        { slug: item.slug },
        { $set: { name: item.name, description: item.description, category: GENRE_CATEGORY.GENERAL } }
      );
      results.push({ slug: item.slug, upserted: false, updated: true });
    }
  }

  const count = await GenresModel.countDocuments({});
  return json({ ok: true, results, totalCount: count });
}
