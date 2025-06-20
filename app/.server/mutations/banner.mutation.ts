import { getUserInfoFromSession } from "@/services/session.svc";

import { BannerModel } from "~/database/models/banner.model";
import { WaifuModel } from "~/database/models/waifu.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";

export type CreateBannerData = {
  title: string;
  startDate: Date;
  endDate: Date;
  imageUrl: string;
  mobileImageUrl: string;
  waifuIds: string[];
  isRateUp: boolean;
};

export const createBanner = async (request: Request, data: CreateBannerData) => {
  const currentUser = await getUserInfoFromSession(request);
  if (!currentUser) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  if (!isAdmin(currentUser.role)) {
    throw new BusinessError("Bạn không có quyền tạo banner");
  }

  // Validate dates
  if (data.startDate >= data.endDate) {
    throw new BusinessError("Ngày bắt đầu phải nhỏ hơn ngày kết thúc");
  }

  // Lấy thông tin waifu từ IDs
  const waifuList = await WaifuModel.find({ _id: { $in: data.waifuIds } }).lean();

  const banner = await BannerModel.create({
    title: data.title,
    startDate: data.startDate,
    endDate: data.endDate,
    imageUrl: data.imageUrl,
    mobileImageUrl: data.mobileImageUrl,
    waifuList,
    isRateUp: data.isRateUp,
    totalRolls: 0,
  });

  return {
    success: true,
    message: "Tạo banner thành công",
    data: banner,
  };
};

export type UpdateBannerData = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  imageUrl: string;
  mobileImageUrl: string;
  waifuIds: string[];
  isRateUp: boolean;
};

export const updateBanner = async (request: Request, data: UpdateBannerData) => {
  const currentUser = await getUserInfoFromSession(request);
  if (!currentUser) {
    throw new BusinessError("Bạn cần đăng nhập để cập nhật banner");
  }

  if (!isAdmin(currentUser.role)) {
    throw new BusinessError("Bạn không có quyền cập nhật banner");
  }

  const banner = await BannerModel.findById(data.id);
  if (!banner) {
    throw new BusinessError("Banner không tồn tại");
  }

  // Validate dates if provided
  if (data.startDate && data.endDate && data.startDate >= data.endDate) {
    throw new BusinessError("Ngày bắt đầu phải nhỏ hơn ngày kết thúc");
  }

  // Lấy thông tin waifu từ IDs
  const waifuList = await WaifuModel.find({ _id: { $in: data.waifuIds } }).lean();

  const updatedBanner = await BannerModel.findByIdAndUpdate(
    data.id,
    {
      $set: {
        title: data.title,
        startDate: data.startDate,
        endDate: data.endDate,
        imageUrl: data.imageUrl,
        mobileImageUrl: data.mobileImageUrl,
        waifuList,
        isRateUp: data.isRateUp,
      },
    },
    { new: true },
  ).lean();

  return {
    success: true,
    message: "Cập nhật banner thành công",
    data: updatedBanner,
  };
};

export const deleteBanner = async (request: Request, bannerId: string) => {
  const currentUser = await getUserInfoFromSession(request);
  if (!currentUser) {
    throw new BusinessError("Bạn cần đăng nhập để xóa banner");
  }

  if (!isAdmin(currentUser.role)) {
    throw new BusinessError("Bạn không có quyền xóa banner");
  }

  const banner = await BannerModel.findById(bannerId);
  if (!banner) {
    throw new BusinessError("Banner không tồn tại");
  }

  // Hard delete
  await BannerModel.findByIdAndDelete(bannerId);

  return {
    success: true,
    message: "Xóa banner thành công",
  };
};

export const incrementBannerRolls = async (bannerId: string, count: number = 1) => {
  const banner = await BannerModel.findByIdAndUpdate(bannerId, {
    $inc: { totalRolls: count },
  });

  if (!banner) {
    throw new BusinessError("Banner không tồn tại");
  }

  return banner;
};
