import { WaifuModel } from "~/database/models/waifu.model";

export const getAllWaifus = async () => {
  return await WaifuModel.find({}).sort({ createdAt: -1 }).lean();
};
