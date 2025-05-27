import { UserModel } from "~/database/models/user.model";

export const getTopUser = async () => {
  return await UserModel.find({})
    .sort({ exp: -1 })
    .limit(10)
    .select("-password -salt")
    .lean();
};

export const getListUser = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;
  return await UserModel.find({})
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select("-password -salt")
    .lean();
};
