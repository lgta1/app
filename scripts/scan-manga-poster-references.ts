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

const SEARCH_TOKEN = "manga-poster";
const SAMPLE_LIMIT = 3;
const PROGRESS_EVERY = 1000000;

const normalizePath = (base: string, key: string) => (base ? `${base}.${key}` : key);

const collectMatches = (
  value: unknown,
  basePath: string,
  out: Array<{ path: string; value: string }>,
  maxMatches: number,
) => {
  if (out.length >= maxMatches) return;
  if (typeof value === "string") {
    if (value.includes(SEARCH_TOKEN)) {
      out.push({ path: basePath || "(root)", value });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectMatches(value[i], `${basePath}[${i}]`, out, maxMatches);
      if (out.length >= maxMatches) return;
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, next] of Object.entries(value)) {
      collectMatches(next, normalizePath(basePath, key), out, maxMatches);
      if (out.length >= maxMatches) return;
    }
  }
};

const scanCollection = async (db: mongoose.mongo.Db, name: string) => {
  const coll = db.collection(name);
  const cursor = coll.find({}, { batchSize: 500 });
  let processed = 0;
  let matched = 0;
  const samples: Array<{ id: string; matches: Array<{ path: string; value: string }> }> = [];

  for await (const doc of cursor) {
    processed += 1;
    if (processed % PROGRESS_EVERY === 0) {
      console.info(`[scan] ${name} processed=${processed} matched=${matched}`);
    }

    const matches: Array<{ path: string; value: string }> = [];
    collectMatches(doc, "", matches, 5);
    if (matches.length > 0) {
      matched += 1;
      if (samples.length < SAMPLE_LIMIT) {
        samples.push({ id: String((doc as any)._id ?? ""), matches });
      }
    }
  }

  return { name, processed, matched, samples };
};

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGO_URL || "";
  await mongoose.connect(uri, { dbName: process.env.DB_NAME || undefined });
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  const results: Array<{
    name: string;
    processed: number;
    matched: number;
    samples: Array<{ id: string; matches: Array<{ path: string; value: string }> }>;
  }> = [];

  let totalProcessed = 0;
  let totalMatched = 0;

  for (const c of collections) {
    const res = await scanCollection(db, c.name);
    results.push(res);
    totalProcessed += res.processed;
    totalMatched += res.matched;
  }

  console.log(
    JSON.stringify(
      {
        token: SEARCH_TOKEN,
        totalProcessed,
        totalMatched,
        results,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("[scan-manga-poster] Fatal error", err);
  process.exit(1);
});
