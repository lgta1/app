import { UserModel } from "~/database/models/user.model";

export const getTopUser = async () => {
  return await UserModel.find({})
    .sort({ exp: -1 })
    .limit(10)
    .select("-password -salt")
    .lean();
};
