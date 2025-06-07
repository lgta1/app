import {
  MangaRevenueModel,
  type MangaRevenueType,
} from "~/database/models/manga-revenue.model";

/**
 * Xóa tất cả dữ liệu revenue theo period
 * @param period Period cần xóa
 * @returns Số lượng documents đã xóa
 */
export async function deleteAllRevenuesByPeriod(period: "daily" | "weekly" | "monthly") {
  const result = await MangaRevenueModel.deleteMany({ period });
  return result.deletedCount;
}

/**
 * Thêm mới nhiều dữ liệu revenue cùng lúc
 * @param revenueData Mảng dữ liệu revenue cần thêm
 * @returns Dữ liệu đã được thêm
 */
export async function bulkInsertRevenues(
  revenueData: Omit<MangaRevenueType, "createdAt" | "updatedAt">[],
) {
  return await MangaRevenueModel.insertMany(revenueData);
}

/**
 * Upload dữ liệu revenue từ mảng dữ liệu
 * @param period Period của dữ liệu
 * @param revenueData Mảng dữ liệu revenue
 * @returns Kết quả upload
 */
export async function uploadMangaRevenues(
  period: "daily" | "weekly" | "monthly",
  revenueData: { mangaId: string; revenue: number }[],
) {
  try {
    // Xóa tất cả dữ liệu cũ theo period
    const deletedCount = await deleteAllRevenuesByPeriod(period);

    // Chuyển đổi dữ liệu để thêm period
    const formattedData = revenueData.map((item) => ({
      ...item,
      period,
    }));

    // Thêm dữ liệu mới
    const insertedData = await bulkInsertRevenues(formattedData);

    return {
      success: true,
      deletedCount,
      insertedCount: insertedData.length,
      data: insertedData,
    };
  } catch (error) {
    console.error("Error uploading manga revenues:", error);
    throw new Error(`Failed to upload manga revenues: ${(error as Error).message}`);
  }
}
