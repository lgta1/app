#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { listFiles, getEnvironmentPrefix } from "~/utils/minio.utils";

const envPath = path.resolve(process.cwd(), ".env.production");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const LOG_PATH = path.resolve(
  "tmp/backfill-poster-variants-2026-02-06T01-01-06-962Z.json",
);
const SAMPLE_SIZE = 200;

const loadIds = (): string[] => {
  if (!fs.existsSync(LOG_PATH)) {
    throw new Error(`Log file not found: ${LOG_PATH}`);
  }
  const raw = JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => String(item?.id || ""))
    .filter(Boolean)
    .slice(0, SAMPLE_SIZE);
};

const buildPrefix = (id: string) => {
  const envPrefix = getEnvironmentPrefix();
  const parts = [envPrefix, "story-images", `poster-${id}-`].filter(Boolean);
  return parts.join("/");
};

const checkLegacyFiles = async (id: string) => {
  const prefixPath = buildPrefix(id);
  const files = await listFiles({ prefixPath, recursive: false, isPublic: true });
  const legacy = files.filter((f) => /-w(400|625)(-|\.)/.test(f.name));
  return {
    id,
    total: files.length,
    legacyCount: legacy.length,
    legacyFiles: legacy.map((f) => f.fullPath),
  };
};

const run = async () => {
  const ids = loadIds();
  if (ids.length === 0) {
    console.log(JSON.stringify({ error: "No ids found" }, null, 2));
    return;
  }

  const uri = process.env.MONGO_URI || process.env.MONGO_URL || "";
  await mongoose.connect(uri, { dbName: process.env.DB_NAME || undefined });
  const coll = mongoose.connection.db.collection("mangas");
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const docs = await coll
    .find(
      { _id: { $in: objectIds } },
      { projection: { posterVariants: 1 } },
    )
    .toArray();
  const legacyInDb = docs.filter((doc) => {
    const variants = (doc as any)?.posterVariants || {};
    return Boolean(variants?.w400 || variants?.w625);
  }).length;

  let legacyInStorage = 0;
  let legacyFilesTotal = 0;
  const legacySamples: Array<{ id: string; legacyFiles: string[] }> = [];

  for (const id of ids) {
    const res = await checkLegacyFiles(id);
    if (res.legacyCount > 0) {
      legacyInStorage += 1;
      legacyFilesTotal += res.legacyCount;
      if (legacySamples.length < 10) {
        legacySamples.push({ id, legacyFiles: res.legacyFiles });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        sampleSize: ids.length,
        legacyInDb,
        legacyInStorage,
        legacyFilesTotal,
        legacySamples,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
