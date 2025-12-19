#!/usr/bin/env tsx
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { MANGA_CONTENT_TYPE, MANGA_USER_STATUS, type MangaContentType } from "~/constants/manga";
import { importViHentaiManga } from "@/services/importers/vi-hentai-importer";

type CliOptions = {
  url?: string;
  ownerId?: string;
  translationTeam?: string;
  dryRun: boolean;
  approve: boolean;
  skipIfExists: boolean;
  contentType?: MangaContentType;
  userStatusOverride?: number;
  slugOverride?: string;
};

const parseArgs = (): CliOptions => {
  const options: CliOptions = {
    dryRun: false,
    approve: false,
    skipIfExists: false,
  };
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const readValue = () => {
      const eqIndex = arg.indexOf("=");
      if (eqIndex >= 0) {
        return arg.slice(eqIndex + 1);
      }
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        i += 1;
        return next;
      }
      return undefined;
    };

    const requireValue = (label: string) => {
      const value = readValue();
      if (!value) {
        throw new Error(`Missing value for ${label}`);
      }
      return value;
    };

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--approve") {
      options.approve = true;
      continue;
    }
    if (arg === "--skip-if-exists") {
      options.skipIfExists = true;
      continue;
    }
    if (arg === "--url" || arg.startsWith("--url=")) {
      options.url = requireValue("--url");
      continue;
    }
    if (arg === "--owner" || arg === "--owner-id" || arg.startsWith("--owner=")) {
      options.ownerId = requireValue("--owner");
      continue;
    }
    if (arg === "--translation-team" || arg === "--team" || arg.startsWith("--translation-team=")) {
      options.translationTeam = requireValue("--translation-team");
      continue;
    }
    if (arg === "--content-type" || arg.startsWith("--content-type=")) {
      const value = requireValue("--content-type").toUpperCase();
      options.contentType = value === "COSPLAY" ? MANGA_CONTENT_TYPE.COSPLAY : MANGA_CONTENT_TYPE.MANGA;
      continue;
    }
    if (arg === "--user-status" || arg.startsWith("--user-status=")) {
      const value = requireValue("--user-status").toLowerCase();
      if (["completed", "complete", "done", "full", "hoan", "hoàn"].some((token) => value.includes(token))) {
        options.userStatusOverride = MANGA_USER_STATUS.COMPLETED;
      } else {
        options.userStatusOverride = MANGA_USER_STATUS.ON_GOING;
      }
      continue;
    }
    if (arg === "--slug" || arg.startsWith("--slug=")) {
      options.slugOverride = requireValue("--slug");
      continue;
    }

    console.warn(`[importer] Unknown argument: ${arg}`);
  }

  return options;
};

const assertOptions = (options: CliOptions) => {
  if (!options.url) {
    throw new Error("--url is required");
  }
  if (!options.ownerId) {
    throw new Error("--owner is required");
  }
};
const run = async () => {
  const options = parseArgs();
  assertOptions(options);

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 10 });

  try {
    const result = await importViHentaiManga({
      url: options.url!,
      ownerId: options.ownerId!,
      translationTeam: options.translationTeam,
      dryRun: options.dryRun,
      approve: options.approve,
      skipIfExists: options.skipIfExists,
      contentType: options.contentType,
      userStatusOverride: options.userStatusOverride,
      slugOverride: options.slugOverride,
    });

    console.info(`[importer] ${result.message} (${result.mode})`);
    if (result.createdId) {
      console.info(`[importer] createdId=${result.createdId} slug=${result.createdSlug}`);
    }
    if (result.unknownGenres.length) {
      console.warn(`[importer] Bỏ qua thể loại không hỗ trợ: ${result.unknownGenres.join(", ")}`);
    }

    console.info("[importer] Payload preview:");
    console.info(JSON.stringify(result.payload, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

run().catch(async (error) => {
  console.error("[importer] Failed", error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error("[importer] Disconnect error", disconnectError);
  }
  process.exitCode = 1;
});
