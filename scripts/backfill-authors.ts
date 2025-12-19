#!/usr/bin/env tsx
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { AuthorModel } from "~/database/models/author.model";
import { MangaModel } from "~/database/models/manga.model";
import { slugify } from "~/utils/slug.utils";

type CliOptions = {
  dryRun: boolean;
  limit: number;
  mongoUri?: string;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = { dryRun: false, limit: 0 };

  for (const arg of args) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg.startsWith("--limit=")) {
      const [, raw] = arg.split("=");
      const parsed = Number.parseInt(raw ?? "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) options.limit = parsed;
    } else if (arg.startsWith("--mongo=")) {
      const [, raw] = arg.split("=");
      const uri = (raw ?? "").trim();
      if (uri) options.mongoUri = uri;
    }
  }

  return options;
};

const normalizeName = (raw: string) => raw.trim().replace(/\s+/g, " ");

const splitAuthorNames = (raw: string): string[] => {
  const input = (raw || "").toString().trim();
  if (!input) return [];

  // Data hiện tại đang lưu dạng "Tên1, Tên2".
  // Giữ split đơn giản theo dấu phẩy để tránh làm hỏng các format khác.
  return input
    .split(",")
    .map((s) => normalizeName(s))
    .filter(Boolean);
};

const ensureUniqueSlug = (baseRaw: string, existingSlugs: Set<string>) => {
  const base = (baseRaw || "author").trim() || "author";
  let candidate = base;
  let i = 2;

  while (existingSlugs.has(candidate)) {
    candidate = `${base}-${i++}`;
    if (i > 200) {
      candidate = `${base}-${Date.now()}`;
      break;
    }
  }

  existingSlugs.add(candidate);
  return candidate;
};

const run = async () => {
  const options = parseArgs();
  console.info(
    `[authors:backfill] Starting dryRun=${options.dryRun} limit=${options.limit || "all"}`,
  );

  await mongoose.connect(options.mongoUri || ENV.MONGO.URI, { maxPoolSize: 20 });

  // 1) Load existing authors (build quick lookup by normalized lower-case name + slug set)
  const existingAuthors = await AuthorModel.find({}, { name: 1, slug: 1 }).lean();
  const existingNameKey = new Set<string>();
  const existingSlugs = new Set<string>();

  for (const a of existingAuthors) {
    existingNameKey.add(normalizeName(String(a.name)).toLowerCase());
    existingSlugs.add(String(a.slug));
  }

  // 2) Scan mangas -> collect unique author names
  const cursor = MangaModel.find({ author: { $exists: true, $ne: "" } }, { author: 1 })
    .sort({ _id: 1 })
    .cursor();

  const nameCounts = new Map<string, number>();
  let mangaProcessed = 0;

  try {
    for await (const doc of cursor) {
      if (options.limit > 0 && mangaProcessed >= options.limit) break;
      mangaProcessed += 1;

      const raw = String((doc as any)?.author ?? "");
      const names = splitAuthorNames(raw);
      for (const name of names) {
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
      }
    }
  } finally {
    await cursor.close();
  }

  const uniqueNames = Array.from(nameCounts.keys());

  // 3) Determine missing names -> create author docs
  const toCreate: Array<{ name: string; slug: string }> = [];
  let skippedExisting = 0;
  let collisionSlug = 0;

  for (const name of uniqueNames) {
    const key = normalizeName(name).toLowerCase();
    if (existingNameKey.has(key)) {
      skippedExisting += 1;
      continue;
    }

    const base = slugify(name) || "author";
    const slugBefore = base;
    const slug = ensureUniqueSlug(base, existingSlugs);
    if (slug !== slugBefore) collisionSlug += 1;

    toCreate.push({ name: normalizeName(name), slug });
    existingNameKey.add(key);
  }

  console.info(
    `[authors:backfill] mangas=${mangaProcessed} uniqueNames=${uniqueNames.length} missing=${toCreate.length} slugCollisions=${collisionSlug}`,
  );

  if (options.dryRun) {
    console.info("[authors:backfill] Dry-run complete (no writes).");
    await mongoose.disconnect();
    return;
  }

  if (toCreate.length > 0) {
    // insertMany for speed; ordered=false to keep going if something unexpected hits unique index.
    const created = await AuthorModel.insertMany(toCreate, { ordered: false });
    console.info(`[authors:backfill] Created ${created.length} authors`);
  } else {
    console.info("[authors:backfill] No missing authors to create");
  }

  console.info(`[authors:backfill] Skipped existing by name=${skippedExisting}`);

  await mongoose.disconnect();
  console.info("[authors:backfill] Done");
};

run().catch((err) => {
  console.error("[authors:backfill] Fatal error", err);
  process.exit(1);
});
