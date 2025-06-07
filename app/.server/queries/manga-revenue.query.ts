import type { MangaType } from "~/database/models/manga.model";
import { MangaRevenueModel } from "~/database/models/manga-revenue.model";

/**
 * Lấy danh sách revenue theo period
 * @param period Period cần lấy
 * @returns Danh sách revenue
 */
export async function getRevenuesByPeriod(
  period: "daily" | "weekly" | "monthly",
): Promise<MangaType[]> {
  const revenues = await MangaRevenueModel.find({ period })
    .populate("mangaId")
    .sort({ revenue: -1 })
    .limit(10)
    .lean();

  return revenues.map((revenue) => ({
    ...(revenue.mangaId as unknown as MangaType),
    revenue: revenue.revenue,
  }));
}
