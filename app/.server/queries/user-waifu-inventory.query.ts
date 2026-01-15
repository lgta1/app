import { UserWaifuInventoryModel } from "~/database/models/user-waifu-inventory";
import { WaifuModel } from "~/database/models/waifu.model";
import { normalizeWaifuImageUrl } from "~/.server/utils/waifu-image";

export const getUserWaifuInventoryCollection = async (userId: string) => {
  const inventoryRows = await UserWaifuInventoryModel.find({
    userId,
    count: { $gt: 0 },
  })
    .select(["waifuId", "count"])
    .lean();

  const countByWaifuId = new Map<string, number>();
  const waifuIds: string[] = [];

  for (const row of inventoryRows || []) {
    const waifuId = String((row as any)?.waifuId || "");
    const count = Number((row as any)?.count || 0);
    if (!waifuId || count <= 0) continue;
    waifuIds.push(waifuId);
    countByWaifuId.set(waifuId, count);
  }

  const waifus = waifuIds.length
    ? await WaifuModel.find({ _id: { $in: waifuIds } })
        .select(["_id", "name", "image", "stars", "expBuff", "goldBuff"])
        .lean()
    : [];

  const waifuCollection = (waifus || [])
    .filter((w: any) => Number(w?.stars || 0) >= 3)
    .map((w: any) => {
      const waifuId = String(w?._id?.toString?.() ?? w?.id ?? "");
      const nextImg = normalizeWaifuImageUrl(w?.image);
      return {
        waifuId,
        name: w?.name,
        image: nextImg ?? w?.image,
        stars: w?.stars,
        expBuff: w?.expBuff,
        goldBuff: w?.goldBuff,
        count: countByWaifuId.get(waifuId) ?? 0,
      };
    })
    .sort((a: any, b: any) => (b?.stars || 0) - (a?.stars || 0));

  return {
    waifuCollection,
    waifuCount: waifuCollection.length,
  };
};
