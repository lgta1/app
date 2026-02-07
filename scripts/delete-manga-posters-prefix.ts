#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env.production");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

import { getEnvironmentPrefix, getMinioClient, deletePublicFiles } from "~/utils/minio.utils";
import { MINIO_CONFIG } from "@/configs/minio.config";

const PROGRESS_EVERY = 5000;
const DELETE_BATCH = 500;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options: { dryRun: boolean; prefix?: string } = { dryRun: false };
  for (const arg of args) {
    if (arg === "--dry-run") options.dryRun = true;
    if (arg.startsWith("--prefix=")) {
      options.prefix = arg.split("=")[1];
    }
  }
  return options;
};

const run = async () => {
  const options = parseArgs();
  const envPrefix = getEnvironmentPrefix();
  const prefixPath = options.prefix
    ? options.prefix.replace(/^\/+/, "").replace(/\/+$/, "")
    : envPrefix
      ? `${envPrefix}/manga-posters`
      : "manga-posters";

  console.info(`[delete-manga-posters] prefix=${prefixPath} dryRun=${options.dryRun}`);

  const client = getMinioClient();
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;
  const stream = client.listObjects(bucket, prefixPath, true);

  let scanned = 0;
  let matched = 0;
  let deleted = 0;
  let failed = 0;
  const pending: string[] = [];

  await new Promise<void>((resolve, reject) => {
    stream.on("data", async (obj) => {
      scanned += 1;
      const name = obj?.name || "";
      if (!name) return;
      matched += 1;

      if (matched % PROGRESS_EVERY === 0) {
        console.info(`[delete-manga-posters] found=${matched} deleted=${deleted} failed=${failed}`);
      }

      if (options.dryRun) return;

      pending.push(name);
      if (pending.length >= DELETE_BATCH) {
        const batch = pending.splice(0, pending.length);
        try {
          await deletePublicFiles(batch);
          deleted += batch.length;
        } catch (error) {
          failed += batch.length;
          console.warn("[delete-manga-posters] delete batch failed", error);
        }
      }
    });

    stream.on("end", async () => {
      if (!options.dryRun && pending.length > 0) {
        const batch = pending.splice(0, pending.length);
        try {
          await deletePublicFiles(batch);
          deleted += batch.length;
        } catch (error) {
          failed += batch.length;
          console.warn("[delete-manga-posters] final delete batch failed", error);
        }
      }
      resolve();
    });

    stream.on("error", (error) => reject(error));
  });

  console.info("[delete-manga-posters] Done");
  console.info(JSON.stringify({ scanned, found: matched, deleted, failed, dryRun: options.dryRun }, null, 2));
};

run().catch((err) => {
  console.error("[delete-manga-posters] Fatal error", err);
  process.exit(1);
});
