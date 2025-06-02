import { ROLES } from "~/constants/user";
import { BannerModel, type BannerType } from "~/database/models/banner.model";
import { UserModel } from "~/database/models/user.model";
import { WaifuModel } from "~/database/models/waifu.model";
import { BusinessError } from "~/helpers/errors";
import { getUserId, getUserInfoFromSession } from "@/services/session.svc";

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

  if (![ROLES.ADMIN, ROLES.MOD].includes(currentUser.role)) {
    throw new BusinessError("Bạn không có quyền tạo banner");
  }

  // Validate dates
  if (data.startDate >= data.endDate) {
    throw new BusinessError("Ngày bắt đầu phải nhỏ hơn ngày kết thúc");
  }

  // Lấy thông tin waifu từ IDs
  const waifus = await WaifuModel.find({ _id: { $in: data.waifuIds } }).lean();

  // Tạo waifuList với thông tin đầy đủ
  const waifuList = waifus.map((waifu) => ({
    id: waifu._id.toString(),
    name: waifu.name,
    image: waifu.image,
    stars: waifu.stars,
    expBuff: waifu.expBuff,
    goldBuff: waifu.goldBuff,
  }));

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

export const updateBanner = async (request: Request, data: BannerType) => {
  const userId = await getUserId(request);
  if (!userId) {
    throw new BusinessError("Bạn cần đăng nhập để cập nhật banner");
  }

  const user = await UserModel.findById(userId);
  if (user?.role !== ROLES.ADMIN) {
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

  const updatedBanner = await BannerModel.findByIdAndUpdate(
    data.id,
    { $set: data },
    { new: true },
  );

  return {
    success: true,
    message: "Cập nhật banner thành công",
    data: updatedBanner,
  };
};

export const deleteBanner = async (request: Request, bannerId: string) => {
  const userId = await getUserId(request);
  if (!userId) {
    throw new BusinessError("Bạn cần đăng nhập để xóa banner");
  }

  const user = await UserModel.findById(userId);
  if (user?.role !== ROLES.ADMIN) {
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
  const banner = await BannerModel.findByIdAndUpdate(
    bannerId,
    { $inc: { totalRolls: count } },
    { new: true },
  );

  if (!banner) {
    throw new BusinessError("Banner không tồn tại");
  }

  return banner;
};
