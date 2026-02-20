#!/usr/bin/env tsx
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel } from "~/database/models/chapter.model";

type CliOptions = {
  dryRun: boolean;
  limit: number;
  mangaId?: string;
  mongoUri?: string;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    dryRun: true,
    limit: 0,
  };

  for (const arg of args) {
    if (arg === "--apply") {
      options.dryRun = false;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const [, raw] = arg.split("=");
      const parsed = Number.parseInt(raw || "", 10);
      if (Number.isFinite(parsed) && parsed > 0) options.limit = parsed;
      continue;
    }
    if (arg.startsWith("--manga=")) {
      const [, raw] = arg.split("=");
      const value = (raw || "").trim();
      if (value) options.mangaId = value;
      continue;
    }
    if (arg.startsWith("--mongo=")) {
      const [, raw] = arg.split("=");
      const value = (raw || "").trim();
      if (value) options.mongoUri = value;
      continue;
    }
  }

  return options;
};

const run = async () => {
  const options = parseArgs();

  await mongoose.connect(options.mongoUri || ENV.MONGO.URI, {
    maxPoolSize: 10,
    minPoolSize: 1,
  });

  try {
    const query: Record<string, any> = {
      status: { $in: [CHAPTER_STATUS.PENDING, CHAPTER_STATUS.REJECTED] },
    };
    if (options.mangaId) {
      query.mangaId = options.mangaId;
    }

    let docsQuery = ChapterModel.find(query)
      .select({ _id: 1, mangaId: 1, chapterNumber: 1, status: 1, publishAt: 1, publishedAt: 1, createdAt: 1 })
      .sort({ mangaId: 1, chapterNumber: 1 });

    if (options.limit > 0) {
      docsQuery = docsQuery.limit(options.limit);
    }

    const docs = await docsQuery.lean();

    console.info(
      `[chapter-status:migrate] mode=${options.dryRun ? "DRY_RUN" : "APPLY"} candidates=${docs.length}`,
    );

    if (docs.length === 0) return;

    for (const doc of docs) {
      const nextPublishedAt =
        doc.publishedAt instanceof Date
          ? doc.publishedAt
          : doc.createdAt instanceof Date
            ? doc.createdAt
            : new Date();

      const before = {
        id: String((doc as any)._id),
        mangaId: String((doc as any).mangaId || ""),
        chapterNumber: Number((doc as any).chapterNumber || 0),
        status: Number((doc as any).status),
        publishAt: (doc as any).publishAt,
        publishedAt: (doc as any).publishedAt,
      };

      const after = {
        status: CHAPTER_STATUS.APPROVED,
        publishAt: undefined,
        publishedAt: nextPublishedAt,
      };

      console.info("[chapter-status:migrate]", { before, after });

      if (!options.dryRun) {
        await ChapterModel.updateOne(
          { _id: (doc as any)._id },
          {
            $set: {
              status: CHAPTER_STATUS.APPROVED,
              publishedAt: nextPublishedAt,
            },
            $unset: {
              publishAt: 1,
            },
          },
          { timestamps: false },
        );
      }
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("[chapter-status:migrate] fatal", error);
  process.exit(1);
});
