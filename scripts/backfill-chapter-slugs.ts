#!/usr/bin/env tsx
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { ensureChapterSlugsForManga } from "~/database/helpers/chapter-slug.helper";
import { ChapterModel } from "~/database/models/chapter.model";

interface CliOptions {
  dryRun: boolean;
  limit: number;
}

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = { dryRun: false, limit: 0 };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (!Number.isNaN(value) && value >= 0) {
        options.limit = value;
      }
    }
  }

  return options;
};

const run = async () => {
  const options = parseArgs();
  const limitLabel = options.limit > 0 ? `${options.limit} mangaIds` : "no limit";
  console.info(`[chapter-slug:backfill] Start dryRun=${options.dryRun} limit=${limitLabel}`);

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 10 });

  const mangaIds = await ChapterModel.distinct("mangaId", {
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }],
  });

  let processed = 0;
  let updated = 0;

  try {
    for (const mangaId of mangaIds) {
      if (options.limit > 0 && processed >= options.limit) break;
      processed += 1;

      if (options.dryRun) {
        const missingCount = await ChapterModel.countDocuments({
          mangaId,
          $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }],
        });
        console.info(`[dry-run] mangaId=${mangaId} missing=${missingCount}`);
        continue;
      }

      await ensureChapterSlugsForManga(String(mangaId));
      updated += 1;
      if (processed % 50 === 0) {
        console.info(`[chapter-slug:backfill] progress ${processed}/${mangaIds.length}`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  console.info("[chapter-slug:backfill] Completed");
  console.info(` processed: ${processed}`);
  console.info(` updated  : ${updated}`);
};

run().catch(async (error) => {
  console.error("[chapter-slug:backfill] Fatal error", error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error("[chapter-slug:backfill] Disconnect error", disconnectError);
  }
  process.exitCode = 1;
});
