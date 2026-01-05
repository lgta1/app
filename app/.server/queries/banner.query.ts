import { BannerModel } from "~/database/models/banner.model";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";
import { normalizeWaifuImageUrl } from "~/.server/utils/waifu-image";

const normalizeBanner = (b: any): any => {
  if (!b) return b;
  const banner = { ...b };
  if (!banner.id && banner._id) {
    try {
      banner.id = typeof banner._id?.toString === "function" ? banner._id.toString() : String(banner._id);
    } catch {
      // ignore
    }
  }
  if (typeof banner.imageUrl === "string") banner.imageUrl = rewriteLegacyCdnUrl(banner.imageUrl);
  if (typeof banner.mobileImageUrl === "string") banner.mobileImageUrl = rewriteLegacyCdnUrl(banner.mobileImageUrl);

  const list: any[] = Array.isArray(banner.waifuList) ? banner.waifuList : [];
  if (list.length) {
    banner.waifuList = list.map((w) => {
      const obj = typeof (w as any)?.toObject === "function" ? (w as any).toObject() : w;
      const nextImg = normalizeWaifuImageUrl(obj?.image);
      return { ...obj, image: nextImg ?? obj?.image };
    });
  }

  return banner;
};

export const getAllBanners = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;
  const banners = await BannerModel.find({})
    .sort({ startDate: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return Array.isArray(banners) ? banners.map(normalizeBanner) : banners;
};

export const countBanners = async () => {
  return await BannerModel.countDocuments({});
};

export const getBannerById = async (id: string) => {
  const banner = await BannerModel.findById(id).lean();
  return normalizeBanner(banner);
};

export const getAllOpenedBanners = async () => {
  const now = new Date();
  const banners = await BannerModel.find({
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .sort({ isRateUp: -1, startDate: -1 })
    .lean();

  return Array.isArray(banners) ? banners.map(normalizeBanner) : banners;
};
