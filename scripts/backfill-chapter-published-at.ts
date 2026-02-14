#!/usr/bin/env tsx
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { CHAPTER_STATUS } from "~/constants/chapter";
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
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (!Number.isNaN(value) && value >= 0) {
        options.limit = value;
      }
    }
  }

  return options;
};

const baseFilter = {
  status: CHAPTER_STATUS.APPROVED,
  $or: [{ publishedAt: { $exists: false } }, { publishedAt: null }],
};

const run = async () => {
  const options = parseArgs();
  console.info(
    `[chapter:publishedAt:backfill] Start dryRun=${options.dryRun} limit=${options.limit || "all"}`,
  );

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 10 });

  try {
    const missingBefore = await ChapterModel.countDocuments(baseFilter);
    const approvedTotalBefore = await ChapterModel.countDocuments({ status: CHAPTER_STATUS.APPROVED });
    const approvedWithPublishedAtBefore = await ChapterModel.countDocuments({
      status: CHAPTER_STATUS.APPROVED,
      publishedAt: { $type: "date" },
    });
    console.info(`[chapter:publishedAt:backfill] missingBefore=${missingBefore}`);
    console.info(`[chapter:publishedAt:backfill] approvedTotalBefore=${approvedTotalBefore}`);
    console.info(
      `[chapter:publishedAt:backfill] approvedWithPublishedAtBefore=${approvedWithPublishedAtBefore}`,
    );

    if (missingBefore === 0) {
      console.info("[chapter:publishedAt:backfill] No documents need backfill");
      return;
    }

    if (options.dryRun) {
      const sample = await ChapterModel.find(baseFilter)
        .select({ _id: 1, mangaId: 1, chapterNumber: 1, createdAt: 1, publishAt: 1, publishedAt: 1 })
        .sort({ createdAt: -1 })
        .limit(options.limit > 0 ? options.limit : 20)
        .lean();

      console.info(`[chapter:publishedAt:backfill] sampleCount=${sample.length}`);
      for (const row of sample) {
        console.info(
          JSON.stringify({
            id: String((row as any)?._id ?? ""),
            mangaId: String((row as any)?.mangaId ?? ""),
            chapterNumber: Number((row as any)?.chapterNumber ?? 0),
            createdAt: (row as any)?.createdAt ?? null,
            publishAt: (row as any)?.publishAt ?? null,
            publishedAt: (row as any)?.publishedAt ?? null,
          }),
        );
      }
      return;
    }

    let modified = 0;

    if (options.limit > 0) {
      const ids = await ChapterModel.find(baseFilter)
        .select({ _id: 1 })
        .sort({ createdAt: 1 })
        .limit(options.limit)
        .lean();

      if (ids.length) {
        const result = await ChapterModel.updateMany(
          { _id: { $in: ids.map((d: any) => d._id) } },
          [
            {
              $set: {
                publishedAt: {
                  $ifNull: ["$publishAt", "$createdAt"],
                },
              },
            },
          ],
        );
        modified = Number((result as any)?.modifiedCount || 0);
      }
    } else {
      const result = await ChapterModel.updateMany(
        baseFilter,
        [
          {
            $set: {
              publishedAt: {
                $ifNull: ["$publishAt", "$createdAt"],
              },
            },
          },
        ],
      );
      modified = Number((result as any)?.modifiedCount || 0);
    }

    const missingAfter = await ChapterModel.countDocuments(baseFilter);
    const withPublishedAt = await ChapterModel.countDocuments({
      status: CHAPTER_STATUS.APPROVED,
      publishedAt: { $type: "date" },
    });

    console.info("[chapter:publishedAt:backfill] Completed");
    console.info(` modified     : ${modified}`);
    console.info(` missingAfter : ${missingAfter}`);
    console.info(` approved+publishedAt(date): ${withPublishedAt}`);
  } finally {
    await mongoose.disconnect();
  }
};

run().catch(async (error) => {
  console.error("[chapter:publishedAt:backfill] Fatal error", error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error("[chapter:publishedAt:backfill] Disconnect error", disconnectError);
  }
  process.exitCode = 1;
});
