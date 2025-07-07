import { MangaModel } from "~/database/models/manga.model";
import { MangaRatingModel } from "~/database/models/manga-rating.model";

/**
 * Tính toán và cập nhật rating trung bình cho manga
 */
export async function calculateAndUpdateMangaRating(mangaId: string): Promise<{
  ratingAverage: number;
  ratingCount: number;
}> {
  // Aggregate để tính rating trung bình và số lượng rating
  const ratingStats = await MangaRatingModel.aggregate([
    { $match: { mangaId } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalRatings: { $sum: 1 },
      },
    },
  ]);

  const ratingAverage =
    ratingStats.length > 0 ? Number(ratingStats[0].averageRating.toFixed(1)) : 0;
  const ratingCount = ratingStats.length > 0 ? ratingStats[0].totalRatings : 0;

  // Cập nhật manga với rating mới
  await MangaModel.findByIdAndUpdate(mangaId, {
    ratingAverage,
    ratingCount,
  });

  return { ratingAverage, ratingCount };
}

/**
 * Lấy rating hiện tại của user cho manga
 */
export async function getUserMangaRating(
  userId: string,
  mangaId: string,
): Promise<number | null> {
  const rating = await MangaRatingModel.findOne({ userId, mangaId });
  return rating ? rating.rating : null;
}
