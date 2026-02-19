import mongoose from "mongoose";

import { initMongoDB } from "~/database/connection";
import { MangaModel } from "~/database/models/manga.model";

const OWNER_ID = "690e3b7186eed8d5d7aaaf78";
const WINDOW_DAYS = 10;
const BACK_MONTHS = 32;

const waitForMongo = async () => {
  if (mongoose.connection.readyState === 1) return;
  await new Promise<void>((resolve, reject) => {
    const onConnected = () => {
      cleanup();
      resolve();
    };
    const onError = (err: unknown) => {
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
};

const main = async () => {
  initMongoDB();
  await waitForMongo();

  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const targetCreatedAt = new Date(now);
  targetCreatedAt.setMonth(targetCreatedAt.getMonth() - BACK_MONTHS);

  const filter = {
    ownerId: OWNER_ID,
    createdAt: { $gte: tenDaysAgo },
  } as const;

  const beforeDocs = await MangaModel.find(filter)
    .select("_id title slug createdAt")
    .sort({ createdAt: -1 })
    .lean();

  console.log("[backdate-onlinebanking] ownerId:", OWNER_ID);
  console.log("[backdate-onlinebanking] matched in last", WINDOW_DAYS, "days:", beforeDocs.length);
  console.log("[backdate-onlinebanking] target createdAt:", targetCreatedAt.toISOString());

  if (beforeDocs.length === 0) {
    console.log("[backdate-onlinebanking] no documents matched, nothing to update");
    await mongoose.disconnect();
    return;
  }

  console.log("[backdate-onlinebanking] sample before:");
  for (const doc of beforeDocs.slice(0, 20)) {
    console.log(`- ${String((doc as any)._id)} | ${String((doc as any).slug || "") || String((doc as any).title || "")} | ${new Date((doc as any).createdAt).toISOString()}`);
  }

  const updateResult = await MangaModel.collection.updateMany(
    filter,
    { $set: { createdAt: targetCreatedAt } },
  );

  console.log("[backdate-onlinebanking] modifiedCount:", Number(updateResult.modifiedCount || 0));

  const afterDocs = await MangaModel.find({ _id: { $in: beforeDocs.map((d: any) => d._id) } })
    .select("_id title slug createdAt")
    .sort({ createdAt: -1 })
    .lean();

  console.log("[backdate-onlinebanking] sample after:");
  for (const doc of afterDocs.slice(0, 20)) {
    console.log(`- ${String((doc as any)._id)} | ${String((doc as any).slug || "") || String((doc as any).title || "")} | ${new Date((doc as any).createdAt).toISOString()}`);
  }

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error("[backdate-onlinebanking] failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
