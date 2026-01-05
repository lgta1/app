#!/usr/bin/env tsx
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import {
  getCdnBase,
  getLegacyCdnHostRegex,
  isLegacyCdnUrl,
  rewriteLegacyCdnUrl,
  rewriteLegacyCdnUrlsInText,
} from "~/.server/utils/cdn-url";
import { ChapterModel } from "~/database/models/chapter.model";
import { CommentModel } from "~/database/models/comment.model";
import { MangaModel } from "~/database/models/manga.model";
import { PostModel } from "~/database/models/post.model";
import { UserModel } from "~/database/models/user.model";
import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard.model";
import { WaifuModel } from "~/database/models/waifu.model";

const DEFAULT_LIMIT = 0; // 0 = all

type CliOptions = {
  dryRun: boolean;
  limit: number;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = { dryRun: false, limit: DEFAULT_LIMIT };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--limit=")) {
      const [, rawValue] = arg.split("=");
      const parsed = Number.parseInt(rawValue ?? "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        options.limit = parsed;
      }
    }
  }

  return options;
};

const logSummary = (label: string, value: number) => {
  console.info(`${label.padEnd(14, " ")}: ${value}`);
};

const needsRewrite = (value: unknown): boolean => {
  return isLegacyCdnUrl(value);
};

const rewriteArray = (values: unknown[]): string[] => {
  return values.map((value) => rewriteLegacyCdnUrl(String(value ?? "")));
};

const run = async () => {
  const options = parseArgs();
  const cdnBase = getCdnBase();
  const legacyRe = getLegacyCdnHostRegex();

  console.info(
    `[migrate:cdn-host] Starting dryRun=${options.dryRun} limit=${options.limit || "all"} CDN_BASE=${cdnBase}`,
  );

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 20 });

  console.info(
    `[migrate:cdn-host] Mongo connected host=${mongoose.connection.host} db=${mongoose.connection.name}`,
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
          `[migrate:cdn-host] ${label} match _id=${String((doc as any)._id)} keys=${Object.keys(update).join(",")}`,
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
      if (modified > 0) {
        updated += 1;
      }
    }

    console.info(`[migrate:cdn-host] ${label} processed=${processed} changed=${changed}`);
  };

  try {
    await processModel(
      "Manga",
      MangaModel,
      {
        $or: [
          { poster: legacyRe },
          { shareImage: legacyRe },
        ],
      },
      (doc: any) => {
        const update: Record<string, any> = {};
        if (needsRewrite(doc.poster)) update.poster = rewriteLegacyCdnUrl(doc.poster);
        if (needsRewrite(doc.shareImage)) update.shareImage = rewriteLegacyCdnUrl(doc.shareImage);
        return Object.keys(update).length ? update : null;
      },
    );

    await processModel(
      "User",
      UserModel,
      { avatar: legacyRe },
      (doc: any) => {
        if (!needsRewrite(doc.avatar)) return null;
        return { avatar: rewriteLegacyCdnUrl(doc.avatar) };
      },
    );

    await processModel(
      "Chapter",
      ChapterModel,
      { contentUrls: legacyRe },
      (doc: any) => {
        const urls: unknown[] = Array.isArray(doc.contentUrls) ? doc.contentUrls : [];
        if (!urls.some((u) => needsRewrite(u))) return null;
        return { contentUrls: rewriteArray(urls) };
      },
    );

    await processModel(
      "Post",
      PostModel,
      {
        $or: [
          { images: legacyRe },
          { content: legacyRe },
        ],
      },
      (doc: any) => {
        const update: Record<string, any> = {};

        const images: unknown[] = Array.isArray(doc.images) ? doc.images : [];
        if (images.some((u) => needsRewrite(u))) update.images = rewriteArray(images);

        if (needsRewrite(doc.content)) update.content = rewriteLegacyCdnUrlsInText(doc.content);

        return Object.keys(update).length ? update : null;
      },
    );

    await processModel(
      "Comment",
      CommentModel,
      { content: legacyRe },
      (doc: any) => {
        if (!needsRewrite(doc.content)) return null;
        return { content: rewriteLegacyCdnUrlsInText(doc.content) };
      },
    );

    await processModel(
      "Waifu",
      WaifuModel,
      { image: legacyRe },
      (doc: any) => {
        if (!needsRewrite(doc.image)) return null;
        return { image: rewriteLegacyCdnUrl(doc.image) };
      },
    );

    await processModel(
      "UserWaifuLeaderboard",
      UserWaifuLeaderboardModel,
      {
        $or: [
          { userAvatar: legacyRe },
          { "waifuCollection.image": legacyRe },
        ],
      },
      (doc: any) => {
        const update: Record<string, any> = {};
        if (needsRewrite(doc.userAvatar)) update.userAvatar = rewriteLegacyCdnUrl(doc.userAvatar);

        const collection: any[] = Array.isArray(doc.waifuCollection) ? doc.waifuCollection : [];
        const anyNeeds = collection.some((w) => needsRewrite(w?.image));
        if (anyNeeds) {
          update.waifuCollection = collection.map((w) => {
            const obj = typeof w?.toObject === "function" ? w.toObject() : w;
            return {
              ...obj,
              image: needsRewrite(obj?.image) ? rewriteLegacyCdnUrl(String(obj.image)) : obj?.image,
            };
          });
        }

        return Object.keys(update).length ? update : null;
      },
    );
  } finally {
    await mongoose.disconnect();
  }

  console.info("[migrate:cdn-host] Completed");
  logSummary("scanned", scanned);
  logSummary("matched", matched);
  logSummary("updated", updated);
};

run().catch((error) => {
  console.error("[migrate:cdn-host] Fatal error", error);
  mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
