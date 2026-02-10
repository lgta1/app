import { isValidObjectId } from "mongoose";

import { createNotification } from "@/mutations/notification.mutation";
import { grantGoldReward } from "@/services/gold-reward.svc";
import { getUserInfoFromSession } from "@/services/session.svc";

import { ROLES } from "~/constants/user";
import { UserModel, type UserType } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";
import {
  validateUsernameComplete,
  validateUsernameChangeCost,
  sanitizeUsername,
  USERNAME_CHANGE_COST,
} from "~/utils/username-validator.server";
import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard.model";

export const promoteToAdmin = async (request: Request, userId: string) => {
  const currentUserInfo = await getUserInfoFromSession(request);
  if (!currentUserInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  if (currentUserInfo.role !== ROLES.ADMIN) {
    throw new BusinessError("Bạn không có quyền thực hiện hành động này");
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new BusinessError("Người dùng không tồn tại");
  }

  await UserModel.findByIdAndUpdate(userId, { $set: { role: ROLES.ADMIN } });

  return {
    success: true,
    message: "Nâng cấp thành công",
  };
};

export const promoteToMod = async (request: Request, userId: string) => {
  const currentUserInfo = await getUserInfoFromSession(request);
  if (!currentUserInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  if (currentUserInfo.role !== ROLES.ADMIN) {
    throw new BusinessError("Bạn không có quyền thực hiện hành động này");
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new BusinessError("Người dùng không tồn tại");
  }

  await UserModel.findByIdAndUpdate(userId, { $set: { role: ROLES.MOD } });

  return {
    success: true,
    message: "Nâng cấp thành công",
  };
};

export const demoteToUser = async (request: Request, userId: string) => {
  const currentUserInfo = await getUserInfoFromSession(request);
  if (!currentUserInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  if (currentUserInfo.role !== ROLES.ADMIN) {
    throw new BusinessError("Bạn không có quyền thực hiện hành động này");
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new BusinessError("Người dùng không tồn tại");
  }

  await UserModel.findByIdAndUpdate(userId, { $set: { role: ROLES.USER } });

  return {
    success: true,
    message: "Hạ cấp thành công",
  };
};

export const deleteUser = async (request: Request, userId: string) => {
  const currentUserInfo = await getUserInfoFromSession(request);
  if (!currentUserInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  if (!isAdmin(currentUserInfo.role)) {
    throw new BusinessError("Bạn không có quyền thực hiện hành động này");
  }

  if (!isValidObjectId(userId)) {
    throw new BusinessError("ID người dùng không hợp lệ");
  }

  await UserModel.findOneAndUpdate(
    { _id: userId, role: { $ne: ROLES.ADMIN } },
    { $set: { isDeleted: true } },
  );

  await UserWaifuLeaderboardModel.deleteOne({ userId });

  return {
    success: true,
    message: "Xóa người dùng thành công",
  };
};

export const banUser = async (
  request: Request,
  userId: string,
  days: number,
  message: string,
) => {
  const currentUserInfo = await getUserInfoFromSession(request);
  if (!currentUserInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  if (!isAdmin(currentUserInfo.role)) {
    throw new BusinessError("Bạn không có quyền thực hiện hành động này");
  }

  if (!isValidObjectId(userId)) {
    throw new BusinessError("ID người dùng không hợp lệ");
  }

  // Tính toán ngày hết hạn ban
  const banExpiresAt = new Date();
  banExpiresAt.setDate(banExpiresAt.getDate() + days);

  await UserModel.findOneAndUpdate(
    { _id: userId, role: { $ne: ROLES.ADMIN } },
    {
      $set: {
        isBanned: true,
        banExpiresAt,
        banMessage: message,
      },
    },
  );

  await Promise.all([
    UserModel.findByIdAndUpdate(userId, { $inc: { warningsCount: 1 } }),
    createNotification({
      userId,
      title: `Bạn đã vi phạm quy định. Tài khoản sẽ bị cấm trong ${days} ngày`,
      imgUrl: "/images/noti/ban.png",
    }),
  ]);

  return {
    success: true,
    message: "Khóa người dùng thành công",
  };
};

export const rewardGoldUser = async (
  request: Request,
  userId: string,
  amount: number,
  message: string,
) => {
  const currentUserInfo = await getUserInfoFromSession(request);
  if (!currentUserInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  if (!isAdmin(currentUserInfo.role)) {
    throw new BusinessError("Bạn không có quyền thực hiện hành động này");
  }

  if (!isValidObjectId(userId)) {
    throw new BusinessError("ID người dùng không hợp lệ");
  }

  await grantGoldReward({
    userId,
    amount,
    title: `Bạn đã nhận được ${amount} dâm ngọc. Vì ${message}`,
  });

  return {
    success: true,
    message: "Thưởng thành công",
  };
};

export const updateUserProfile = async (
  request: Request,
  userId: string,
  data: Partial<UserType>,
) => {
  const currentUserInfo = await getUserInfoFromSession(request);
  if (!currentUserInfo) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  if (!isValidObjectId(userId)) {
    throw new BusinessError("ID người dùng không hợp lệ");
  }

  // Lấy thông tin user hiện tại
  const currentUser = await UserModel.findById(userId).lean();
  if (!currentUser) {
    throw new BusinessError("Không tìm thấy thông tin người dùng");
  }

  const updatedData: Partial<UserType> = { ...data };
  let goldDeduction = 0;
  let usernameChanged = false;

  // Kiểm tra nếu có thay đổi username (name field)
  if (data.name && data.name !== currentUser.name) {
    usernameChanged = true;
    
    // Sanitize username để đảm bảo an toàn
    const sanitizedUsername = sanitizeUsername(data.name);
    updatedData.name = sanitizedUsername;

    // Validate username constraints và uniqueness
    const usernameValidation = await validateUsernameComplete(
      sanitizedUsername,
      userId,
    );
    
    if (!usernameValidation.isValid) {
      throw new BusinessError(usernameValidation.error || "Username không hợp lệ");
    }

    // Kiểm tra user có đủ gold để đổi username không
    const goldValidation = validateUsernameChangeCost(currentUser.gold);
    if (!goldValidation.isValid) {
      throw new BusinessError(goldValidation.error || "Không đủ Ngọc để đổi username");
    }

    goldDeduction = USERNAME_CHANGE_COST;
  }

  // Thực hiện cập nhật
  const updateQuery: any = { $set: updatedData };
  
  if (goldDeduction > 0) {
    updateQuery.$inc = { gold: -goldDeduction };
  }

  await UserModel.findByIdAndUpdate(userId, updateQuery);

  return {
    success: true,
    message: "Cập nhật thành công",
    goldDeducted: goldDeduction,
  };
};
