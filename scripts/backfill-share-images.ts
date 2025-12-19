#!/usr/bin/env tsx
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { generateMangaShareImage } from "@/services/share-image.svc";
import { MangaModel } from "~/database/models/manga.model";

const DEFAULT_BATCH_LIMIT = 0; // 0 = process all

type CliOptions = {
  dryRun: boolean;
  force: boolean;
  limit: number;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = { dryRun: false, force: false, limit: DEFAULT_BATCH_LIMIT };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg.startsWith("--limit=")) {
      const [, rawValue] = arg.split("=");
      const parsed = Number.parseInt(rawValue ?? "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        options.limit = parsed;
      }
    }
  }

  return options;
};

const buildQuery = (force: boolean) => {
  const base = { poster: { $exists: true, $ne: "" } };
  if (force) {
    return base;
  }

  return {
    ...base,
    $or: [{ shareImage: { $exists: false } }, { shareImage: null }, { shareImage: "" }],
  };
};

const logSummary = (label: string, value: number) => {
  console.info(`${label.padEnd(12, " ")}: ${value}`);
};

const run = async () => {
  const options = parseArgs();
  const query = buildQuery(options.force);
  const limitInfo = options.limit > 0 ? `${options.limit} items` : "all items";
  console.info(`[share-image:backfill] Starting with query=${JSON.stringify(query)} limit=${limitInfo}`);

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 20 });

  const cursor = MangaModel.find(query).sort({ updatedAt: 1 }).cursor();

  let processed = 0;
  let regenerated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for await (const doc of cursor) {
      if (options.limit > 0 && processed >= options.limit) {
        break;
      }

      processed += 1;
      const mangaId = String(doc._id);
      const title = doc.title ?? "Untitled";
      const posterUrl = doc.poster;

      if (!posterUrl) {
        skipped += 1;
        console.warn(`[skip] Missing poster for manga ${mangaId} (${title})`);
        continue;
      }

      if (options.dryRun) {
        regenerated += 1;
        console.info(`[dry-run] Would generate share image for ${mangaId} (${title})`);
        continue;
      }

      try {
        const shareImage = await generateMangaShareImage({
          mangaId,
          title,
          posterUrl,
        });

        if (!shareImage) {
          failed += 1;
          console.error(`[failed] Unable to render share image for ${mangaId}`);
          continue;
        }

        await MangaModel.updateOne({ _id: doc._id }, { $set: { shareImage } }, { timestamps: false });
        regenerated += 1;
        console.info(`[done] Share image updated for ${mangaId}`);
      } catch (error) {
        failed += 1;
        console.error(`[error] Unexpected failure for ${mangaId}`, error);
      }
    }
  } finally {
    await cursor.close();
    await mongoose.disconnect();
  }

  console.info("[share-image:backfill] Completed");
  logSummary("processed", processed);
  logSummary("updated", regenerated);
  logSummary("skipped", skipped);
  logSummary("failed", failed);
};

run().catch((error) => {
  console.error("[share-image:backfill] Fatal error", error);
  mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
