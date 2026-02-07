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
import { deletePublicFiles } from "~/utils/minio.utils";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {
    dryRun: false,
    limit: 0,
    batchSize: 200,
  };
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

const extractFullPath = (value: string): string | null => {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!/https?:\/\//i.test(text)) return text.replace(/^\/+/, "");
  try {
    const url = new URL(text);
    const pathName = url.pathname.replace(/^\/+/, "");
    return pathName || null;
  } catch {
    return null;
  }
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

  const filter: Record<string, any> = { "posterVariants.w400": { $exists: true } };
  const total = await MangaModel.countDocuments(filter);
  const limit = opts.limit > 0 ? Math.min(opts.limit, total) : total;

  console.info(`Found ${total} manga with w400. Target: ${limit}. Dry-run: ${opts.dryRun}`);

  if (limit === 0) {
    await mongoose.disconnect();
    return;
  }

  const cursor = MangaModel.find(filter)
    .select({ posterVariants: 1 })
    .lean()
    .cursor();

  const toDelete = new Set<string>();
  let processed = 0;
  for await (const doc of cursor) {
    if (opts.limit > 0 && processed >= opts.limit) break;
    const variant = (doc as any)?.posterVariants?.w400;
    const fullPath = variant?.fullPath || extractFullPath(variant?.url || "");
    if (fullPath) toDelete.add(fullPath);
    processed += 1;
  }

  const paths = Array.from(toDelete);
  console.info(`Collected ${paths.length} files to delete from R2.`);

  if (!opts.dryRun && paths.length > 0) {
    const batches = chunk(paths, opts.batchSize);
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      await deletePublicFiles(batch);
      console.info(`Deleted batch ${i + 1}/${batches.length} (${batch.length} files).`);
    }
  } else if (opts.dryRun) {
    console.info("Dry-run enabled; no files deleted.");
  }

  if (!opts.dryRun) {
    const res = await MangaModel.updateMany(
      filter,
      { $unset: { "posterVariants.w400": "" } },
      { timestamps: false },
    );
    console.info(`DB updated: ${res.modifiedCount} documents unset w400.`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("delete-poster-w400 failed", error);
  process.exitCode = 1;
});
