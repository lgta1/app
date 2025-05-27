import { isValidObjectId } from "mongoose";

import { ROLES } from "~/constants";
import { UserModel } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors";
import { getUserId } from "~/helpers/session.server";

export const promoteToAdmin = async (request: Request, userId: string) => {
  const currentUserId = await getUserId(request);
  if (!currentUserId) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  const currentUser = await UserModel.findById(currentUserId);
  if (!currentUser || currentUser.role !== ROLES.ADMIN) {
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
  const currentUserId = await getUserId(request);
  if (!currentUserId) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  const currentUser = await UserModel.findById(currentUserId);
  if (!currentUser || currentUser.role !== ROLES.ADMIN) {
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
  const currentUserId = await getUserId(request);
  if (!currentUserId) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  const currentUser = await UserModel.findById(currentUserId);
  if (!currentUser || ![ROLES.ADMIN, ROLES.MOD].includes(currentUser.role)) {
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
  const currentUserId = await getUserId(request);
  if (!currentUserId) {
    throw new BusinessError("Bạn cần đăng nhập để thực hiện hành động này");
  }

  const currentUser = await UserModel.findById(currentUserId);
  if (!currentUser || ![ROLES.ADMIN, ROLES.MOD].includes(currentUser.role)) {
    throw new BusinessError("Bạn không có quyền thực hiện hành động này");
  }

  if (!isValidObjectId(userId)) {
    throw new BusinessError("ID người dùng không hợp lệ");
  }

  await UserModel.findByIdAndUpdate(userId, { $set: { isDeleted: true } });

  return {
    success: true,
    message: "Xóa người dùng thành công",
  };
};
