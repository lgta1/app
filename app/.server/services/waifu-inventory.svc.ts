import mongoose from "mongoose";

import { UserWaifuInventoryModel } from "~/database/models/user-waifu-inventory";
import { UserWaifuModel } from "~/database/models/user-waifu";
import { WaifuModel } from "~/database/models/waifu.model";
import { BusinessError } from "~/helpers/errors.helper";

export type GrantWaifuOptions = {
  userId: string;
  waifuId: string;
  bannerId: string;
  // Optional: override name/stars for the history log (defaults to WaifuModel values)
  waifuName?: string | null;
  waifuStars?: number | null;
  session?: mongoose.ClientSession;
};

export const grantWaifu = async (options: GrantWaifuOptions) => {
  const { userId, waifuId, bannerId, session } = options;

  if (!userId) throw new BusinessError("Thiếu userId");
  if (!waifuId) throw new BusinessError("Thiếu waifuId");
  if (!bannerId) throw new BusinessError("Thiếu bannerId");

  const waifuQuery = WaifuModel.findById(waifuId)
    .select(["_id", "name", "image", "stars", "expBuff", "goldBuff"])
    .lean();
  if (session) waifuQuery.session(session);
  const waifu = await waifuQuery;
  if (!waifu) throw new BusinessError("Không tìm thấy waifu");

  const waifuIdStr = (waifu as any)?._id?.toString?.() ?? (waifu as any)?.id ?? String(waifuId);
  const waifuStars = Number(options.waifuStars ?? (waifu as any)?.stars ?? 0);
  if (waifuStars < 3) {
    throw new BusinessError("Chỉ có thể grant waifu từ 3 sao trở lên");
  }

  const waifuName = String(options.waifuName ?? (waifu as any)?.name ?? "");

  if (session) {
    const inventoryRow = await UserWaifuInventoryModel.findOneAndUpdate(
      { userId, waifuId: waifuIdStr },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true, session },
    );

    await UserWaifuModel.create(
      [
        {
          bannerId,
          userId,
          waifuId: waifuIdStr,
          waifuName,
          waifuStars,
        },
      ],
      { session },
    );

    return {
      waifu,
      inventory: inventoryRow,
    };
  }

  // Transaction when possible. If MongoDB is not configured for transactions,
  // we fall back to best-effort sequential writes.
  const localSession = await mongoose.startSession();
  try {
    let inventoryRow: any = null;

    try {
      await localSession.withTransaction(async () => {
        inventoryRow = await UserWaifuInventoryModel.findOneAndUpdate(
          { userId, waifuId: waifuIdStr },
          { $inc: { count: 1 } },
          { upsert: true, new: true, setDefaultsOnInsert: true, session: localSession },
        );

        await UserWaifuModel.create(
          [
            {
              bannerId,
              userId,
              waifuId: waifuIdStr,
              waifuName,
              waifuStars,
            },
          ],
          { session: localSession },
        );
      });

      return {
        waifu,
        inventory: inventoryRow,
      };
    } catch (txErr) {
      // eslint-disable-next-line no-console
      console.warn("[grantWaifu] transaction failed; falling back:", txErr);
    }

    const inventoryRowFallback = await UserWaifuInventoryModel.findOneAndUpdate(
      { userId, waifuId: waifuIdStr },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await UserWaifuModel.create({
      bannerId,
      userId,
      waifuId: waifuIdStr,
      waifuName,
      waifuStars,
    });

    return {
      waifu,
      inventory: inventoryRowFallback,
    };
  } finally {
    localSession.endSession();
  }
};

export type ConsumeWaifuOptions = {
  userId: string;
  waifuId: string;
  amount: number;
};

export const consumeWaifu = async (options: ConsumeWaifuOptions) => {
  const { userId, waifuId, amount } = options;
  if (!userId) throw new BusinessError("Thiếu userId");
  if (!waifuId) throw new BusinessError("Thiếu waifuId");
  if (!amount || amount <= 0) throw new BusinessError("Số lượng không hợp lệ");

  const updated = await UserWaifuInventoryModel.findOneAndUpdate(
    { userId, waifuId, count: { $gte: amount } },
    { $inc: { count: -amount } },
    { new: true },
  ).lean();

  if (!updated) {
    throw new BusinessError("Không đủ waifu để thực hiện");
  }

  return updated;
};
