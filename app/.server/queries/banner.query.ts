import { BannerModel } from "~/database/models/banner.model";

export const getAllBanners = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;
  return await BannerModel.find({})
    .sort({ startDate: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

export const countBanners = async () => {
  return await BannerModel.countDocuments({});
};

export const getBannerById = async (id: string) => {
  return await BannerModel.findById(id).lean();
};

export const getAllOpenedBanners = async () => {
  const now = new Date();
  return await BannerModel.find({
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .sort({ isRateUp: -1, startDate: -1 })
    .lean();
};
