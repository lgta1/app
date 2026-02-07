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
import { deletePublicFiles, getEnvironmentPrefix, getMinioClient } from "~/utils/minio.utils";
import { MINIO_CONFIG } from "@/configs/minio.config";

const LEGACY_REGEX = /-w(400|625)(-|\.)/;
const DELETE_BATCH_SIZE = 500;

type CliOptions = {
  dryRun: boolean;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = { dryRun: false };
  if (args.includes("--dry-run")) options.dryRun = true;
  return options;
};

const extractFullPathFromUrl = (value: string, envPrefix: string): string | null => {
  const text = String(value || "").trim();
  if (!text) return null;

  const prefix = envPrefix ? `${envPrefix}/story-images/` : "story-images/";
  if (text.includes(prefix)) {
    const idx = text.indexOf(prefix);
    return text.slice(idx);
  }

  try {
    const url = new URL(text);
    const rawPath = url.pathname.replace(/^\/+/, "");
    if (rawPath.includes(prefix)) {
      const idx = rawPath.indexOf(prefix);
      return rawPath.slice(idx);
    }
    if (rawPath.includes("story-images/")) {
      const idx = rawPath.indexOf("story-images/");
      const tail = rawPath.slice(idx);
      return envPrefix ? `${envPrefix}/${tail}` : tail;
    }
    return rawPath || null;
  } catch {
    return null;
  }
};

const buildReferencedSet = async (): Promise<Set<string>> => {
  const envPrefix = getEnvironmentPrefix();
  const set = new Set<string>();

  const cursor = MangaModel.find(
    { poster: { $exists: true, $ne: "" } },
    { poster: 1, posterVariants: 1 },
  ).lean().cursor();

  for await (const doc of cursor) {
    const poster = (doc as any)?.poster;
    const variants = (doc as any)?.posterVariants || {};

    if (typeof poster === "string") {
      const derived = extractFullPathFromUrl(poster, envPrefix);
      if (derived) set.add(derived);
    }

    const entries = [variants.w220, variants.w320, variants.w575, variants.w400, variants.w625, variants.source];
    for (const entry of entries) {
      if (!entry) continue;
      if (entry.fullPath) {
        set.add(entry.fullPath);
        continue;
      }
      if (entry.url) {
        const derived = extractFullPathFromUrl(entry.url, envPrefix);
        if (derived) set.add(derived);
      }
    }
  }

  return set;
};

const listLegacyObjects = async () => {
  const client = getMinioClient();
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;
  const envPrefix = getEnvironmentPrefix();
  const prefixPath = envPrefix ? `${envPrefix}/story-images/` : "story-images/";

  return new Promise<string[]>((resolve, reject) => {
    const results: string[] = [];
    const stream = client.listObjects(bucket, prefixPath, true);

    stream.on("data", (obj) => {
      const name = obj?.name || "";
      if (name && LEGACY_REGEX.test(name)) {
        results.push(name);
      }
      if (results.length % 5000 === 0 && results.length > 0) {
        console.info(`[scan] legacy files found=${results.length}`);
      }
    });

    stream.on("end", () => resolve(results));
    stream.on("error", (error) => reject(error));
  });
};

const run = async () => {
  const options = parseArgs();
  console.info(`[cleanup-legacy] Starting dryRun=${options.dryRun}`);

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 10 });

  const referenced = await buildReferencedSet();
  console.info(`[cleanup-legacy] referenced paths=${referenced.size}`);

  const legacyObjects = await listLegacyObjects();
  console.info(`[cleanup-legacy] legacy objects found=${legacyObjects.length}`);

  const toDelete = legacyObjects.filter((p) => !referenced.has(p));
  console.info(`[cleanup-legacy] orphan legacy objects=${toDelete.length}`);

  if (options.dryRun) {
    await mongoose.disconnect();
    return;
  }

  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += DELETE_BATCH_SIZE) {
    const batch = toDelete.slice(i, i + DELETE_BATCH_SIZE);
    if (batch.length === 0) continue;
    await deletePublicFiles(batch);
    deleted += batch.length;
    console.info(`[cleanup-legacy] deleted=${deleted}/${toDelete.length}`);
  }

  await mongoose.disconnect();
  console.info("[cleanup-legacy] Done");
};

run().catch((err) => {
  console.error("[cleanup-legacy] Fatal error", err);
  process.exit(1);
});
