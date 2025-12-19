#!/usr/bin/env tsx
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { generateUniqueMangaSlug, isLikelyObjectId } from "~/database/helpers/manga-slug.helper";
import { MangaModel } from "~/database/models/manga.model";

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

interface CliOptions {
  dryRun: boolean;
  limit: number;
  all: boolean;
}

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = { dryRun: false, limit: 0, all: false };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--all") {
      options.all = true;
    } else if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (!Number.isNaN(value) && value >= 0) {
        options.limit = value;
      }
    }
  }

  return options;
};

const buildQuery = (all: boolean) => {
  if (all) return {};
  return {
    $or: [
      { slug: { $exists: false } },
      { slug: null },
      { slug: "" },
      { slug: { $regex: OBJECT_ID_REGEX } },
    ],
  };
};

const needsBackfill = (slugValue: unknown): boolean => {
  if (typeof slugValue !== "string") return true;
  const trimmed = slugValue.trim();
  if (!trimmed) return true;
  return isLikelyObjectId(trimmed);
};

const resolveTitleSource = (doc: any, fallback: string): string => {
  const title = typeof doc.title === "string" ? doc.title.trim() : "";
  if (title) return title;
  const alternateTitle = typeof doc.alternateTitle === "string" ? doc.alternateTitle.trim() : "";
  if (alternateTitle) return alternateTitle;
  if (doc.code != null) return `truyen-${doc.code}`;
  return fallback;
};

const run = async () => {
  const options = parseArgs();
  const query = buildQuery(options.all);
  const limitLabel = options.limit > 0 ? `${options.limit} docs` : "no limit";
  console.info(`[slug:backfill] Start dryRun=${options.dryRun} all=${options.all} limit=${limitLabel}`);

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 20 });

  const cursor = MangaModel.find(query)
    .sort({ createdAt: 1 })
    .select({ title: 1, alternateTitle: 1, slug: 1, code: 1 })
    .lean()
    .cursor();

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for await (const doc of cursor) {
      if (options.limit > 0 && processed >= options.limit) {
        break;
      }

      processed += 1;
      const mongoId = String(doc._id);
      const currentSlug = typeof doc.slug === "string" ? doc.slug.trim() : "";
      const requiresUpdate = options.all ? true : needsBackfill(currentSlug);

      if (!requiresUpdate) {
        skipped += 1;
        continue;
      }

      const source = resolveTitleSource(doc, `manga-${mongoId.slice(-6)}`);
      const nextSlug = await generateUniqueMangaSlug(source, mongoId);

      if (!nextSlug || nextSlug === currentSlug) {
        skipped += 1;
        continue;
      }

      if (options.dryRun) {
        updated += 1;
        console.info(`[dry-run] ${mongoId}: "${currentSlug || "<empty>"}" -> "${nextSlug}" (title="${source}")`);
        continue;
      }

      try {
        await MangaModel.updateOne(
          { _id: doc._id },
          { $set: { slug: nextSlug } },
          { timestamps: false },
        );
        updated += 1;
        console.info(`[updated] ${mongoId}: "${currentSlug || "<empty>"}" -> "${nextSlug}"`);
      } catch (error) {
        failed += 1;
        console.error(`[error] ${mongoId}: failed to update slug`, error);
      }
    }
  } finally {
    await cursor.close();
    await mongoose.disconnect();
  }

  console.info("[slug:backfill] Completed");
  console.info(` processed: ${processed}`);
  console.info(` updated  : ${updated}`);
  console.info(` skipped  : ${skipped}`);
  console.info(` failed   : ${failed}`);
};

run().catch(async (error) => {
  console.error("[slug:backfill] Fatal error", error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error("[slug:backfill] Disconnect error", disconnectError);
  }
  process.exitCode = 1;
});
