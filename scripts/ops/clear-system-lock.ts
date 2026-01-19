import { initMongoDB } from "~/database/connection";
import { SystemLockModel } from "~/database/models/system-lock.model";
import mongoose from "mongoose";
import os from "os";

const key = process.argv[2] || "vi-hentai-auto-update";
const dryRun = process.argv.includes("--dry-run");

const waitForMongoConnected = async (timeoutMs: number) => {
  if (mongoose.connection.readyState === 1) return;

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup();
      reject(new Error(`MongoDB connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const onConnected = () => {
      cleanup();
      resolve();
    };
    const onError = (err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const cleanup = () => {
      clearTimeout(t);
      mongoose.connection.off("connected", onConnected);
      mongoose.connection.off("error", onError);
    };

    mongoose.connection.on("connected", onConnected);
    mongoose.connection.on("error", onError);
  });
};

async function main() {
  initMongoDB();
  await waitForMongoConnected(15_000);

  const now = new Date();
  const username = (() => {
    try {
      return os.userInfo().username;
    } catch {
      return "unknown";
    }
  })();
  const lockedBy = `ops|user:${username}|host:${os.hostname()}`;

  const before = await SystemLockModel.findOne({ key })
    .select({ key: 1, lockedUntil: 1, lockedBy: 1 })
    .lean();

  let updated = null as any;
  if (!dryRun) {
    updated = await SystemLockModel.findOneAndUpdate(
      { key },
      { $set: { lockedUntil: now, lockedBy } },
      { upsert: true, new: true },
    )
      .select({ key: 1, lockedUntil: 1, lockedBy: 1 })
      .lean();
  }

  const after = await SystemLockModel.findOne({ key })
    .select({ key: 1, lockedUntil: 1, lockedBy: 1 })
    .lean();

  console.log(
    JSON.stringify(
      {
        key,
        dryRun,
        now,
        before,
        updated,
        after,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
