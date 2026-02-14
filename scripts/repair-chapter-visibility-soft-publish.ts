#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { CHAPTER_STATUS } from "~/constants/chapter";
import { ChapterModel } from "~/database/models/chapter.model";

type RepairDoc = {
  _id: any;
  status?: number;
  createdAt?: Date;
  publishAt?: Date | null;
  publishedAt?: Date | null;
  mangaId?: string;
  chapterNumber?: number;
};

type BackupRow = {
  id: string;
  oldStatus: number | null;
  oldPublishedAt: string | null;
  oldPublishAt: string | null;
  createdAt: string | null;
  mangaId: string;
  chapterNumber: number;
};

interface CliOptions {
  dryRun: boolean;
  limit: number;
}

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = { dryRun: false, limit: 0 };

  for (const arg of args) {
    if (arg === "--dry-run") options.dryRun = true;
    if (arg.startsWith("--limit=")) {
      const n = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (!Number.isNaN(n) && n >= 0) options.limit = n;
    }
  }

  return options;
};

const toIso = (value?: Date | null) => (value instanceof Date ? value.toISOString() : value ? new Date(value).toISOString() : null);

const ensureLogDir = () => {
  const dir = path.resolve(process.cwd(), "logs/db-fixes");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const timestampTag = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const writeJson = (filePath: string, data: unknown) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

const run = async () => {
  const options = parseArgs();
  const now = new Date();

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 10 });

  const allCount = await ChapterModel.countDocuments({});
  const byStatusBefore = await ChapterModel.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const repairFilter: any = {
    status: CHAPTER_STATUS.PENDING,
    $or: [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: now } }],
  };

  const docs = await ChapterModel.find(repairFilter)
    .select({ _id: 1, status: 1, publishAt: 1, publishedAt: 1, createdAt: 1, mangaId: 1, chapterNumber: 1 })
    .sort({ createdAt: 1 })
    .limit(options.limit > 0 ? options.limit : 0)
    .lean<RepairDoc[]>();

  const candidates = docs.map((d) => ({
    id: String(d._id),
    oldStatus: typeof d.status === "number" ? d.status : null,
    oldPublishedAt: toIso(d.publishedAt ?? null),
    oldPublishAt: toIso(d.publishAt ?? null),
    createdAt: toIso(d.createdAt ?? null),
    mangaId: String(d.mangaId ?? ""),
    chapterNumber: Number(d.chapterNumber ?? 0),
  })) satisfies BackupRow[];

  const summaryBase = {
    timestamp: new Date().toISOString(),
    dryRun: options.dryRun,
    totalChapters: allCount,
    byStatusBefore,
    repairCandidateCount: candidates.length,
  };

  if (candidates.length === 0) {
    console.log(JSON.stringify({ ...summaryBase, message: "No repair candidates" }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const logDir = ensureLogDir();
  const tag = timestampTag();
  const backupPath = path.join(logDir, `chapter-visibility-repair-backup-${tag}.json`);
  writeJson(backupPath, candidates);

  let modified = 0;
  if (!options.dryRun) {
    const ids = candidates.map((row) => new mongoose.Types.ObjectId(row.id));
    const result = await ChapterModel.updateMany(
      { _id: { $in: ids } },
      [
        {
          $set: {
            status: CHAPTER_STATUS.APPROVED,
            publishedAt: { $ifNull: ["$publishedAt", { $ifNull: ["$publishAt", "$createdAt"] }] },
          },
        },
      ],
    );
    modified = Number((result as any)?.modifiedCount || 0);

    const rollbackPath = path.join(logDir, `chapter-visibility-repair-rollback-${tag}.js`);
    const rollbackScript = `// Auto-generated rollback script\n// Run: mongosh \"${ENV.MONGO.URI}\" --file ${rollbackPath}\n\nconst rows = ${JSON.stringify(candidates, null, 2)};\nconst bulk = rows.map((row) => ({\n  updateOne: {\n    filter: { _id: ObjectId(row.id) },\n    update: {\n      $set: {\n        status: row.oldStatus,\n        publishedAt: row.oldPublishedAt ? new Date(row.oldPublishedAt) : null,\n      },\n    },\n  },\n}));\n\nif (bulk.length) {\n  const result = db.chapters.bulkWrite(bulk);\n  printjson(result);\n} else {\n  print('No rows to rollback');\n}\n`;
    fs.writeFileSync(rollbackPath, rollbackScript, "utf8");
  }

  const byStatusAfter = await ChapterModel.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const approvedAfter = await ChapterModel.countDocuments({ status: CHAPTER_STATUS.APPROVED });

  console.log(
    JSON.stringify(
      {
        ...summaryBase,
        modified,
        approvedAfter,
        byStatusAfter,
        backupPath,
        rollbackPath: options.dryRun ? null : path.join(logDir, `chapter-visibility-repair-rollback-${tag}.js`),
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("[repair-chapter-visibility] Fatal error", error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exitCode = 1;
});
