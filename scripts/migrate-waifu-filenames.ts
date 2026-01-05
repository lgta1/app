#!/usr/bin/env tsx
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { BannerModel } from "~/database/models/banner.model";
import { UserModel } from "~/database/models/user.model";
import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard.model";
import { WaifuModel } from "~/database/models/waifu.model";

const DEFAULT_LIMIT = 0; // 0 = all
const WAIFU_DIR = path.resolve(process.cwd(), "public/images/waifu");

type CliOptions = {
  dryRun: boolean;
  limit: number;
  skipFiles: boolean;
};

const LEGACY_RE = /(www\.)?vinahentai\.com/g;

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = { dryRun: false, limit: DEFAULT_LIMIT, skipFiles: false };

  for (const arg of args) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--skip-files") options.skipFiles = true;
    else if (arg.startsWith("--limit=")) {
      const [, rawValue] = arg.split("=");
      const parsed = Number.parseInt(rawValue ?? "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) options.limit = parsed;
    }
  }

  return options;
};

const normalizeName = (value: string): string => {
  // Replace legacy domain with a stable brand token (not a TLD) so future domain
  // migrations don't require renaming waifu files again.
  return value.replace(LEGACY_RE, "vinahentai");
};

const normalizeWaifuImageRef = (value: unknown): string | null => {
  if (typeof value !== "string" || !value) return null;
  if (!LEGACY_RE.test(value)) return null;

  // Reset regex state after test() with /g
  LEGACY_RE.lastIndex = 0;

  // If it's a local path, only normalize the basename.
  if (value.startsWith("/images/waifu/")) {
    const prefix = "/images/waifu/";
    const rest = value.slice(prefix.length);
    return prefix + normalizeName(rest);
  }

  // If it's a filename-only reference, normalize whole string.
  return normalizeName(value);
};

const logSummary = (label: string, value: number) => {
  console.info(`${label.padEnd(14, " ")}: ${value}`);
};

const migrateFiles = async (options: CliOptions) => {
  if (options.skipFiles) {
    console.info("[migrate:waifu-filenames] Skipping file renames (--skip-files)");
    return { scanned: 0, matched: 0, renamed: 0 };
  }

  const entries = await fs.readdir(WAIFU_DIR, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);

  let scanned = 0;
  let matched = 0;
  let renamed = 0;

  const existing = new Set(files);

  for (const filename of files) {
    if (options.limit > 0 && scanned >= options.limit) break;
    scanned += 1;

    if (!filename.includes("vinahentai.com") && !filename.includes("www.vinahentai.com")) continue;

    const next = normalizeName(filename);
    if (next === filename) continue;

    matched += 1;

    if (existing.has(next)) {
      throw new Error(
        `[migrate:waifu-filenames] File rename collision: ${filename} -> ${next} already exists`,
      );
    }

    if (options.dryRun) {
      if (matched <= 10) console.info(`[migrate:waifu-filenames] (dry-run) mv '${filename}' -> '${next}'`);
      continue;
    }

    await fs.rename(path.join(WAIFU_DIR, filename), path.join(WAIFU_DIR, next));
    existing.delete(filename);
    existing.add(next);
    renamed += 1;
  }

  console.info(
    `[migrate:waifu-filenames] Files scanned=${scanned} matched=${matched} renamed=${options.dryRun ? 0 : renamed}`,
  );
  return { scanned, matched, renamed: options.dryRun ? 0 : renamed };
};

const migrateMongo = async (options: CliOptions) => {
  console.info(
    `[migrate:waifu-filenames] Mongo dryRun=${options.dryRun} limit=${options.limit || "all"}
`,
  );

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 20 });
  console.info(
    `[migrate:waifu-filenames] Mongo connected host=${mongoose.connection.host} db=${mongoose.connection.name}`,
  );

  let scanned = 0;
  let matched = 0;
  let updated = 0;

  const processModel = async (
    label: string,
    model: any,
    query: Record<string, any>,
    buildUpdate: (doc: any) => Record<string, any> | null,
  ) => {
    let processed = 0;
    let changed = 0;
    let debugLogged = 0;

    for await (const doc of model.find(query).cursor()) {
      if (options.limit > 0 && processed >= options.limit) break;

      processed += 1;
      scanned += 1;

      const update = buildUpdate(doc);
      if (!update) continue;

      matched += 1;

      if (options.dryRun && debugLogged < 3) {
        debugLogged += 1;
        console.info(
          `[migrate:waifu-filenames] ${label} match _id=${String((doc as any)._id)} keys=${Object.keys(update).join(",")}`,
        );
      }

      if (options.dryRun) {
        changed += 1;
        continue;
      }

      const res = await model.updateOne(
        { _id: (doc as any)._id },
        { $set: update },
        { timestamps: false },
      );
      changed += 1;

      const modified = Number((res as any)?.modifiedCount ?? (res as any)?.nModified ?? 0);
      if (modified > 0) updated += 1;
    }

    console.info(`[migrate:waifu-filenames] ${label} processed=${processed} changed=${changed}`);
  };

  try {
    await processModel(
      "User",
      UserModel,
      { waifuFilename: /vinahentai\.com|www\.vinahentai\.com/ },
      (doc: any) => {
        const next = normalizeWaifuImageRef(doc.waifuFilename);
        return next ? { waifuFilename: next } : null;
      },
    );

    await processModel(
      "Banner",
      BannerModel,
      { "waifuList.image": /vinahentai\.com|www\.vinahentai\.com/ },
      (doc: any) => {
        const list: any[] = Array.isArray(doc.waifuList) ? doc.waifuList : [];
        let anyChanged = false;

        const nextList = list.map((w) => {
          const obj = typeof w?.toObject === "function" ? w.toObject() : w;
          const nextImage = normalizeWaifuImageRef(obj?.image);
          if (nextImage && nextImage !== obj?.image) anyChanged = true;
          return { ...obj, image: nextImage ?? obj?.image };
        });

        return anyChanged ? { waifuList: nextList } : null;
      },
    );

    await processModel(
      "UserWaifuLeaderboard",
      UserWaifuLeaderboardModel,
      { "waifuCollection.image": /vinahentai\.com|www\.vinahentai\.com/ },
      (doc: any) => {
        const collection: any[] = Array.isArray(doc.waifuCollection) ? doc.waifuCollection : [];
        let anyChanged = false;

        const nextCollection = collection.map((w) => {
          const obj = typeof w?.toObject === "function" ? w.toObject() : w;
          const nextImage = normalizeWaifuImageRef(obj?.image);
          if (nextImage && nextImage !== obj?.image) anyChanged = true;
          return { ...obj, image: nextImage ?? obj?.image };
        });

        return anyChanged ? { waifuCollection: nextCollection } : null;
      },
    );

    await processModel(
      "Waifu",
      WaifuModel,
      { image: /vinahentai\.com|www\.vinahentai\.com/ },
      (doc: any) => {
        const next = normalizeWaifuImageRef(doc.image);
        return next ? { image: next } : null;
      },
    );
  } finally {
    await mongoose.disconnect();
  }

  console.info("[migrate:waifu-filenames] Mongo completed");
  logSummary("scanned", scanned);
  logSummary("matched", matched);
  logSummary("updated", updated);

  return { scanned, matched, updated };
};

const run = async () => {
  const options = parseArgs();

  console.info(
    `[migrate:waifu-filenames] Starting dryRun=${options.dryRun} limit=${options.limit || "all"} skipFiles=${options.skipFiles}`,
  );

  const fileStats = await migrateFiles(options);
  const mongoStats = await migrateMongo(options);

  console.info("[migrate:waifu-filenames] Completed");
  logSummary("filesMatched", fileStats.matched);
  logSummary("filesRenamed", fileStats.renamed);
  logSummary("mongoMatched", mongoStats.matched);
  logSummary("mongoUpdated", mongoStats.updated);
};

run().catch((error) => {
  console.error("[migrate:waifu-filenames] Fatal error", error);
  mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
