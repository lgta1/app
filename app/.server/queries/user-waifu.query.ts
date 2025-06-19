import { UserWaifuModel } from "~/database/models/user-waifu";

export const getUserWaifuByUserId = async (userId: string) => {
  return await UserWaifuModel.find({ userId }).sort({ createdAt: -1 }).lean();
};

export const getUserWaifuByUserIdAndBannerId = async (
  userId: string,
  bannerId: string,
) => {
  return await UserWaifuModel.find({ userId, bannerId }).sort({ createdAt: -1 }).lean();
};

export const getSummonHistoryWithPagination = async (
  userId: string,
  bannerId: string,
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  // Lấy tổng số record để tính totalPages
  const totalCount = await UserWaifuModel.countDocuments({ userId, bannerId });
  const totalPages = Math.ceil(totalCount / limit);

  const userWaifus = await UserWaifuModel.find({ userId, bannerId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    data: userWaifus,
    currentPage: page,
    totalPages,
    totalCount,
  };
};
