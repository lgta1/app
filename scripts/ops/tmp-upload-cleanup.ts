import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initMongoDB } from "~/database/connection";
import { SystemLockModel } from "~/database/models/system-lock.model";
import { deletePublicFiles, getEnvironmentPrefix, listPublicFiles } from "~/utils/minio.utils";

const LOCK_KEY = "tmp-upload-cleanup";
const TMP_PREFIX = "tmp/manga-images";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

const dryRun = process.argv.includes("--dry-run");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NODE_ENV = process.env.NODE_ENV ?? "production";
dotenv.config({
  path: path.resolve(__dirname, "..", "..", NODE_ENV === "production" ? ".env.production" : ".env"),
  override: false,
});

const getOwnerId = () => {
  const parts = [
    process.env.PM2_HOME ? "pm2" : undefined,
    process.env.NODE_APP_INSTANCE != null ? `inst:${process.env.NODE_APP_INSTANCE}` : undefined,
    `pid:${process.pid}`,
  ].filter(Boolean);
  return parts.join("|");
};

const tryAcquireLock = async (ttlMs: number): Promise<boolean> => {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ttlMs);
  const lockedBy = getOwnerId();

  const updated = await SystemLockModel.findOneAndUpdate(
    {
      key: LOCK_KEY,
      $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: { $exists: false } }],
    },
    { $set: { lockedUntil, lockedBy } },
    { new: true },
  ).lean();

  if (updated) return true;

  try {
    await SystemLockModel.create({ key: LOCK_KEY, lockedUntil, lockedBy });
    return true;
  } catch {
    return false;
  }
};

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

  const acquired = await tryAcquireLock(25 * 60 * 1000);
  if (!acquired) {
    console.warn("[tmp-upload-cleanup] lock busy, aborting");
    return;
  }

  const envPrefix = getEnvironmentPrefix();
  const listPrefix = envPrefix ? `${envPrefix}/${TMP_PREFIX}` : TMP_PREFIX;

  const files = await listPublicFiles({ prefixPath: listPrefix, recursive: true });
  const now = Date.now();
  const stale = files.filter((file) => {
    const last = file.lastModified instanceof Date ? file.lastModified.getTime() : 0;
    return last > 0 && now - last >= MAX_AGE_MS;
  });

  console.log(
    JSON.stringify(
      {
        dryRun,
        prefix: listPrefix,
        total: files.length,
        stale: stale.length,
      },
      null,
      2,
    ),
  );

  if (!stale.length) return;

  if (dryRun) {
    const preview = stale.slice(0, 20).map((f) => f.fullPath);
    console.log(JSON.stringify({ preview }, null, 2));
    return;
  }

  let deleted = 0;
  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    const batch = stale.slice(i, i + BATCH_SIZE).map((f) => f.fullPath);
    await deletePublicFiles(batch);
    deleted += batch.length;
  }

  console.log(`[tmp-upload-cleanup] deleted ${deleted} files`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
