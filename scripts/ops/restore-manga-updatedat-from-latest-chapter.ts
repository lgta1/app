import fs from "node:fs";
import path from "node:path";

import mongoose from "mongoose";

import { ENV } from "~/.server/configs/env.config";

type RestoreCandidate = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  slug?: string;
  updatedAt: Date;
  latestChapterAt: Date;
  lagMs: number;
};

const readArg = (name: string): string | undefined => {
  const prefix = `${name}=`;
  const item = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return item ? item.slice(prefix.length).trim() : undefined;
};

const hasFlag = (name: string) => process.argv.slice(2).includes(name);

const parseDateOrThrow = (value: string, name: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
};

const now = new Date();
const defaultFrom = new Date(now.getTime() - 6 * 60 * 60 * 1000);
const from = parseDateOrThrow(readArg("--from") || defaultFrom.toISOString(), "--from");
const to = parseDateOrThrow(readArg("--to") || now.toISOString(), "--to");
const lagMinutes = Number.parseInt(readArg("--lag-minutes") || "15", 10);
const status = Number.parseInt(readArg("--status") || "1", 10);
const sampleSize = Number.parseInt(readArg("--sample") || "20", 10);
const applyMode = hasFlag("--apply");
const rootDir = process.cwd();
const defaultBackupPath = path.join(rootDir, "tmp", `manga-updatedat-restore-backup-${Date.now()}.jsonl`);
const backupPath = readArg("--backup") || defaultBackupPath;

if (!Number.isFinite(lagMinutes) || lagMinutes < 1) {
  throw new Error("--lag-minutes must be a positive integer");
}

if (!Number.isFinite(status)) {
  throw new Error("--status must be a number");
}

if (!Number.isFinite(sampleSize) || sampleSize < 1) {
  throw new Error("--sample must be a positive integer");
}

if (from > to) {
  throw new Error("--from must be <= --to");
}

const lagMsThreshold = lagMinutes * 60_000;

const buildPipeline = (withSampleLimit?: number) => {
  const pipeline: any[] = [
    { $match: { status, updatedAt: { $gte: from, $lte: to } } },
    {
      $lookup: {
        from: "chapters",
        let: { mangaIdStr: { $toString: "$_id" } },
        pipeline: [
          { $match: { $expr: { $eq: ["$mangaId", "$$mangaIdStr"] } } },
          { $project: { t: { $ifNull: ["$updatedAt", "$createdAt"] }, chapterNumber: 1 } },
          { $sort: { t: -1, chapterNumber: -1 } },
          { $limit: 1 },
        ],
        as: "latest",
      },
    },
    { $set: { latest: { $first: "$latest" } } },
    { $match: { "latest.t": { $ne: null } } },
    {
      $set: {
        latestChapterAt: "$latest.t",
        lagMs: { $subtract: ["$updatedAt", "$latest.t"] },
      },
    },
    { $match: { lagMs: { $gt: lagMsThreshold } } },
    {
      $project: {
        _id: 1,
        title: 1,
        slug: 1,
        updatedAt: 1,
        latestChapterAt: 1,
        lagMs: 1,
      },
    },
    { $sort: { lagMs: -1, _id: 1 } },
  ];

  if (withSampleLimit && withSampleLimit > 0) {
    pipeline.push({ $limit: withSampleLimit });
  }

  return pipeline;
};

const run = async () => {
  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 10 });
  const db = mongoose.connection.db;

  const totalWindow = await db.collection("mangas").countDocuments({
    status,
    updatedAt: { $gte: from, $lte: to },
  });

  const candidates = (await db
    .collection("mangas")
    .aggregate(buildPipeline())
    .toArray()) as RestoreCandidate[];

  const sample = (await db
    .collection("mangas")
    .aggregate(buildPipeline(sampleSize))
    .toArray()) as RestoreCandidate[];

  console.log(
    JSON.stringify(
      {
        mode: applyMode ? "apply" : "dry-run",
        from: from.toISOString(),
        to: to.toISOString(),
        status,
        lagMinutes,
        totalWindow,
        candidateCount: candidates.length,
        sample: sample.map((item) => ({
          _id: String(item._id),
          title: item.title,
          slug: item.slug,
          updatedAt: item.updatedAt,
          latestChapterAt: item.latestChapterAt,
          lagMs: item.lagMs,
        })),
      },
      null,
      2,
    ),
  );

  if (!applyMode || candidates.length === 0) {
    return;
  }

  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  const backupLines = candidates
    .map((item) =>
      JSON.stringify({
        _id: String(item._id),
        title: item.title,
        slug: item.slug,
        oldUpdatedAt: item.updatedAt,
        newUpdatedAt: item.latestChapterAt,
        lagMs: item.lagMs,
      }),
    )
    .join("\n");
  fs.writeFileSync(backupPath, `${backupLines}\n`, "utf8");

  const chunkSize = 500;
  let matchedCount = 0;
  let modifiedCount = 0;

  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    const res = await db
      .collection("mangas")
      .bulkWrite(
        chunk.map((item) => ({
          updateOne: {
            filter: { _id: item._id },
            update: { $set: { updatedAt: item.latestChapterAt } },
            upsert: false,
            timestamps: false,
          },
        })),
        { ordered: false, bypassDocumentValidation: true },
      );

    matchedCount += res.matchedCount || 0;
    modifiedCount += res.modifiedCount || 0;
  }

  console.log(
    JSON.stringify(
      {
        backupPath,
        matchedCount,
        modifiedCount,
      },
      null,
      2,
    ),
  );
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
