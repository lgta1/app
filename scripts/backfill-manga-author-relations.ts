#!/usr/bin/env tsx
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { AuthorModel } from "~/database/models/author.model";
import { MangaModel } from "~/database/models/manga.model";
import { slugify } from "~/utils/slug.utils";

type CliOptions = {
  dryRun: boolean;
  force: boolean;
  limit: number;
  mongoUri?: string;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = { dryRun: false, force: false, limit: 0 };

  for (const arg of args) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
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
  return input
    .split(",")
    .map((s) => normalizeName(s))
    .filter(Boolean);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ensureUniqueSlug = async (baseRaw: string) => {
  const base = (baseRaw || "author").trim() || "author";
  let slug = base;
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // exists() is fast
    const exists = await AuthorModel.exists({ slug });
    if (!exists) return slug;
    slug = `${base}-${i++}`;
    if (i > 200) {
      return `${base}-${Date.now()}`;
    }
  }
};

const run = async () => {
  const options = parseArgs();
  console.info(
    `[manga:authors:backfill] Starting dryRun=${options.dryRun} force=${options.force} limit=${options.limit || "all"}`,
  );

  await mongoose.connect(options.mongoUri || ENV.MONGO.URI, { maxPoolSize: 20 });

  const baseQuery: Record<string, any> = { author: { $exists: true, $ne: "" } };
  const query = options.force
    ? baseQuery
    : {
        ...baseQuery,
        $or: [
          { authorNames: { $exists: false } },
          { authorNames: { $size: 0 } },
          { authorSlugs: { $exists: false } },
          { authorSlugs: { $size: 0 } },
        ],
      };

  const cursor = MangaModel.find(query, { _id: 1, slug: 1, title: 1, author: 1, authorNames: 1, authorSlugs: 1 })
    .sort({ _id: 1 })
    .cursor();

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let createdAuthors = 0;
  let linkedExistingAuthors = 0;
  let failed = 0;

  try {
    for await (const doc of cursor) {
      if (options.limit > 0 && processed >= options.limit) break;
      processed += 1;

      const legacy = String((doc as any)?.author ?? "");
      const namesRaw = splitAuthorNames(legacy);
      if (namesRaw.length === 0) {
        skipped += 1;
        continue;
      }

      // de-dupe by lowercase name, preserve order
      const seen = new Set<string>();
      const names: string[] = [];
      for (const n of namesRaw) {
        const key = n.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(n);
      }

      const slugs: string[] = [];
      for (const name of names) {
        const existing = await AuthorModel.findOne(
          { name: { $regex: new RegExp(`^${escapeRegExp(name)}$`, "i") } },
          { slug: 1, name: 1 },
        ).lean();

        if (existing?.slug) {
          linkedExistingAuthors += 1;
          slugs.push(String(existing.slug));
          continue;
        }

        const base = slugify(name) || "author";
        const slug = await ensureUniqueSlug(base);

        if (!options.dryRun) {
          await AuthorModel.create({ name, slug });
        }

        createdAuthors += 1;
        slugs.push(slug);
      }

      // If already matches, skip
      const currentNames = Array.isArray((doc as any)?.authorNames) ? (doc as any).authorNames : [];
      const currentSlugs = Array.isArray((doc as any)?.authorSlugs) ? (doc as any).authorSlugs : [];

      const sameNames =
        Array.isArray(currentNames) &&
        currentNames.length === names.length &&
        currentNames.every((v: any, i: number) => String(v) === names[i]);
      const sameSlugs =
        Array.isArray(currentSlugs) &&
        currentSlugs.length === slugs.length &&
        currentSlugs.every((v: any, i: number) => String(v) === slugs[i]);

      if (sameNames && sameSlugs) {
        skipped += 1;
        continue;
      }

      if (!options.dryRun) {
        await MangaModel.updateOne(
          { _id: (doc as any)._id },
          { $set: { authorNames: names, authorSlugs: slugs } },
          { timestamps: false },
        );
      }

      updated += 1;
    }
  } catch (err) {
    failed += 1;
    console.error("[manga:authors:backfill] Unexpected error", err);
  } finally {
    await cursor.close();
    await mongoose.disconnect();
  }

  console.info("[manga:authors:backfill] Completed");
  console.info(`processed : ${processed}`);
  console.info(`updated   : ${updated}`);
  console.info(`skipped   : ${skipped}`);
  console.info(`authors+  : ${createdAuthors}`);
  console.info(`linked    : ${linkedExistingAuthors}`);
  console.info(`failed    : ${failed}`);
};

run().catch((err) => {
  console.error("[manga:authors:backfill] Fatal error", err);
  process.exit(1);
});
