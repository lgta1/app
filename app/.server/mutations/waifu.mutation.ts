import { WaifuModel } from "~/database/models/waifu.model";
import type { WaifuType } from "~/database/models/waifu.model";
import { BusinessError } from "~/helpers/errors";
import { getUserId } from "@/services/session.svc";
import { UserModel } from "~/database/models/user.model";
import { ROLES } from "~/constants/user";

export const createWaifu = async (request: Request, waifuData: Omit<WaifuType, "id">) => {
  const currentUserId = await getUserId(request);
  if (!currentUserId) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  const currentUser = await UserModel.findById(currentUserId);
  if (!currentUser || ![ROLES.ADMIN, ROLES.MOD].includes(currentUser.role)) {
    throw new BusinessError("Bạn không có quyền thực hiện hành động này");
  }

  // Validate dữ liệu
  if (!waifuData.name || waifuData.name.trim().length === 0) {
    throw new BusinessError("Tên waifu không được để trống");
  }

  if (!waifuData.image || waifuData.image.trim().length === 0) {
    throw new BusinessError("Ảnh waifu không được để trống");
  }

  if (!waifuData.stars || waifuData.stars < 1 || waifuData.stars > 5) {
    throw new BusinessError("Số sao phải từ 1 đến 5");
  }

  if (waifuData.expBuff < 0) {
    throw new BusinessError("Buff kinh nghiệm không được âm");
  }

  if (waifuData.goldBuff < 0) {
    throw new BusinessError("Buff vàng không được âm");
  }

  const newWaifu = new WaifuModel({
    name: waifuData.name.trim(),
    image: waifuData.image.trim(),
    stars: waifuData.stars,
    expBuff: waifuData.expBuff,
    goldBuff: waifuData.goldBuff,
    description: waifuData.description,
  });

  await newWaifu.save();

  return {
    success: true,
    message: "Tạo waifu thành công",
    data: newWaifu,
  };
};
