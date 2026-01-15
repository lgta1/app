import mongoose from "mongoose";

import { initMongoDB } from "~/database/connection";
import { UserWaifuModel } from "~/database/models/user-waifu";
import { UserWaifuInventoryModel } from "~/database/models/user-waifu-inventory";

const main = async () => {
  initMongoDB();

  // Wait until connected
  if (mongoose.connection.readyState !== 1) {
    await new Promise<void>((resolve, reject) => {
      const onConnected = () => {
        cleanup();
        resolve();
      };
      const onError = (err: any) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        mongoose.connection.off("connected", onConnected);
        mongoose.connection.off("error", onError);
      };

      mongoose.connection.on("connected", onConnected);
      mongoose.connection.on("error", onError);
    });
  }

  const agg = await UserWaifuModel.aggregate([
    { $match: { waifuStars: { $gte: 3 } } },
    {
      $group: {
        _id: { userId: "$userId", waifuId: "$waifuId" },
        count: { $sum: 1 },
      },
    },
  ]);

  let processed = 0;
  const ops: any[] = [];

  for (const row of agg || []) {
    const userId = String((row as any)?._id?.userId || "");
    const waifuId = String((row as any)?._id?.waifuId || "");
    const count = Number((row as any)?.count || 0);
    if (!userId || !waifuId || count <= 0) continue;

    processed++;
    ops.push({
      updateOne: {
        filter: { userId, waifuId },
        update: { $set: { userId, waifuId, count } },
        upsert: true,
      },
    });
  }

  let upserts = 0;
  if (ops.length) {
    const res = await UserWaifuInventoryModel.bulkWrite(ops, { ordered: false });
    upserts = Number((res as any)?.upsertedCount || 0);
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, processed, upserts }));

  await mongoose.disconnect();
};

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error("[backfill-user-waifu-inventory] failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
