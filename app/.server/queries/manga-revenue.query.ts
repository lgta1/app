import type { MangaType } from "~/database/models/manga.model";
import { MangaRevenueModel } from "~/database/models/manga-revenue.model";

type MangaRevenueType = MangaType & { revenue: number };

/**
 * Lấy danh sách revenue theo period
 * @param period Period cần lấy
 * @returns Danh sách revenue
 */
export async function getRevenuesByPeriod(
  period: "daily" | "weekly" | "monthly",
): Promise<MangaRevenueType[]> {
  const revenues = await MangaRevenueModel.find({ period })
    .populate("mangaId")
    .sort({ revenue: -1 })
    .limit(10)
    .lean();

  return revenues.map((revenue) => ({
    ...(revenue.mangaId as unknown as MangaRevenueType),
    revenue: revenue.revenue,
  }));
}
