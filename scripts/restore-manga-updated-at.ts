#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

const envPath = path.resolve(process.cwd(), ".env.production");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

import { ENV } from "@/configs/env.config";
import { MangaModel } from "~/database/models/manga.model";
import { ChapterModel } from "~/database/models/chapter.model";

type Options = {
  dryRun: boolean;
  limit: number;
  batchSize: number;
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const opts: Options = { dryRun: false, limit: 0, batchSize: 500 };
  for (const arg of args) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.split("=")[1] || "", 10);
      if (!Number.isNaN(value) && value >= 0) opts.limit = value;
    } else if (arg.startsWith("--batch-size=")) {
      const value = Number.parseInt(arg.split("=")[1] || "", 10);
      if (!Number.isNaN(value) && value > 0) opts.batchSize = value;
    }
  }
  return opts;
};

const chunk = <T>(arr: T[], size: number): T[][] => {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const run = async () => {
  const opts = parseArgs();
  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 10 });

  const chapterAgg = await ChapterModel.aggregate([
    { $group: { _id: "$mangaId", latestChapterAt: { $max: "$createdAt" } } },
  ]).allowDiskUse(true);

  const latestByManga = new Map<string, Date>();
  for (const row of chapterAgg) {
    if (!row?._id || !row.latestChapterAt) continue;
    latestByManga.set(String(row._id), new Date(row.latestChapterAt));
  }

  const cursor = MangaModel.find({})
    .select({ _id: 1, createdAt: 1 })
    .lean()
    .cursor();

  const ops: Array<{ updateOne: { filter: any; update: any } }> = [];
  let processed = 0;
  let updated = 0;

  const flush = async () => {
    if (ops.length === 0 || opts.dryRun) {
      ops.length = 0;
      return;
    }
    await MangaModel.collection.bulkWrite(ops, { ordered: false });
    ops.length = 0;
  };

  try {
    for await (const doc of cursor) {
      if (opts.limit > 0 && processed >= opts.limit) break;
      processed += 1;

      const mangaId = String((doc as any)._id ?? "");
      if (!mangaId) continue;
      const createdAt = (doc as any).createdAt ? new Date((doc as any).createdAt) : new Date(0);
      const latest = latestByManga.get(mangaId) || createdAt;

      if (opts.dryRun) {
        updated += 1;
        continue;
      }

      ops.push({
        updateOne: {
          filter: { _id: (doc as any)._id },
          update: { $set: { updatedAt: latest } },
        },
      });
      updated += 1;

      if (ops.length >= opts.batchSize) {
        await flush();
      }
    }
  } finally {
    await cursor.close();
    await flush();
    await mongoose.disconnect();
  }

  console.info(`restore-manga-updated-at done. processed=${processed} updated=${updated} dryRun=${opts.dryRun}`);
};

run().catch((error) => {
  console.error("restore-manga-updated-at failed", error);
  process.exitCode = 1;
});
