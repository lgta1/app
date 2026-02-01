#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import readline from "readline";
import sharp from "sharp";
import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env.production");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

import { ENV } from "@/configs/env.config";
import { uploadBufferWithValidation } from "@/services/file-upload.service";
import { MangaModel } from "~/database/models/manga.model";
import type { AllowedFileFormat } from "~/types/minio.types";
import type { PosterVariantsPayload } from "~/utils/poster-variants.utils";
import { getPublicFileUrl } from "~/utils/minio.utils";

const DEFAULT_BATCH_LIMIT = 0; // 0 = process all
const POSTER_TARGET_WIDTH = 575;
const POSTER_ASPECT_TOLERANCE = 0.01;
const ASPECT_THREE_FOUR = 3 / 4;
const ASPECT_TWO_THREE = 2 / 3;

const ALLOWED_FORMATS: AllowedFileFormat[] = ["jpeg", "jpg", "png", "webp", "gif"];

type CliOptions = {
  dryRun: boolean;
  force: boolean;
  limit: number;
  batchSize: number;
  pauseSeconds: number;
  interactive: boolean;
};

type ImagePayload = {
  buffer: Buffer;
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp" | "gif";
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    dryRun: false,
    force: false,
    limit: DEFAULT_BATCH_LIMIT,
    batchSize: 0,
    pauseSeconds: 0,
    interactive: false,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg.startsWith("--limit=")) {
      const [, rawValue] = arg.split("=");
      const parsed = Number.parseInt(rawValue ?? "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        options.limit = parsed;
      }
    } else if (arg.startsWith("--batch-size=")) {
      const [, rawValue] = arg.split("=");
      const parsed = Number.parseInt(rawValue ?? "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        options.batchSize = parsed;
      }
    } else if (arg.startsWith("--pause-seconds=")) {
      const [, rawValue] = arg.split("=");
      const parsed = Number.parseInt(rawValue ?? "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        options.pauseSeconds = parsed;
      }
    } else if (arg === "--interactive") {
      options.interactive = true;
    }
  }

  return options;
};

const waitForDecision = async (seconds: number): Promise<boolean> => {
  if (seconds <= 0) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = `Tạm dừng sau batch. Gõ 'dung' để dừng hoặc Enter để tiếp tục (tự chạy sau ${seconds}s): `;

  const response = await Promise.race<string | null>([
    new Promise((resolve) => rl.question(question, (answer) => resolve(answer))),
    new Promise((resolve) => setTimeout(() => resolve(null), seconds * 1000)),
  ]);

  rl.close();

  if (response === null) return true;
  const normalized = response.trim().toLowerCase();
  if (!normalized) return true;
  return !(normalized === "dung" || normalized === "stop" || normalized === "no" || normalized === "n");
};

const buildQuery = (force: boolean) => {
  const base = { poster: { $exists: true, $ne: "" } };
  if (force) return base;

  return {
    ...base,
    $or: [
      { posterVariants: { $exists: false } },
      { "posterVariants.w625": { $exists: false } },
      { "posterVariants.w400": { $exists: false } },
      { "posterVariants.w220": { $exists: false } },
    ],
  };
};

const logSummary = (label: string, value: number) => {
  console.info(`${label.padEnd(12, " ")}: ${value}`);
};

const resolvePosterUrl = (poster: string): string => {
  const trimmed = String(poster || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return getPublicFileUrl(trimmed.replace(/^\/+/, ""));
};

const classifyPosterAspect = (ratio: number): "3:4" | "2:3" | "other" => {
  if (Math.abs(ratio - ASPECT_THREE_FOUR) <= POSTER_ASPECT_TOLERANCE) return "3:4";
  if (Math.abs(ratio - ASPECT_TWO_THREE) <= POSTER_ASPECT_TOLERANCE) return "2:3";
  return "other";
};

const normalizeFormat = (format?: string | null): "jpeg" | "png" | "webp" | "gif" => {
  if (format === "png" || format === "webp" || format === "gif") return format;
  return "jpeg";
};

const getFormatExtension = (format: ImagePayload["format"]) => {
  if (format === "jpeg") return "jpg";
  return format;
};

const getFormatContentType = (format: ImagePayload["format"]) => {
  if (format === "jpeg") return "image/jpeg";
  return `image/${format}`;
};

const fetchPosterBuffer = async (posterUrl: string): Promise<Buffer | null> => {
  try {
    const response = await fetch(posterUrl);
    if (!response.ok) {
      console.error(`[fetch] Poster not OK ${response.status} ${posterUrl}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("[fetch] Poster download failed", posterUrl, error);
    return null;
  }
};

const cropToThreeFour = async (payload: ImagePayload): Promise<ImagePayload> => {
  const ratio = payload.width / payload.height;
  if (classifyPosterAspect(ratio) !== "other") return payload;

  let cropWidth = payload.width;
  let cropHeight = payload.height;
  let left = 0;
  let top = 0;

  const targetRatio = ASPECT_THREE_FOUR;
  if (ratio > targetRatio) {
    cropWidth = Math.floor(payload.height * targetRatio);
    left = Math.floor((payload.width - cropWidth) / 2);
  } else {
    cropHeight = Math.floor(payload.width / targetRatio);
    top = Math.floor((payload.height - cropHeight) / 2);
  }

  const cropped = await sharp(payload.buffer)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .toBuffer();

  return {
    ...payload,
    buffer: cropped,
    width: cropWidth,
    height: cropHeight,
  };
};

const maybeConvertToWebP = async (payload: ImagePayload): Promise<ImagePayload> => {
  if (payload.format === "gif" || payload.format === "webp") return payload;

  try {
    const webpBuffer = await sharp(payload.buffer).webp({ quality: 92 }).toBuffer();
    if (webpBuffer.length < payload.buffer.length) {
      return {
        buffer: webpBuffer,
        width: payload.width,
        height: payload.height,
        format: "webp",
      };
    }
  } catch (error) {
    console.warn("[webp] Conversion failed, keeping original", error);
  }

  return payload;
};

const resizeToWidth = async (
  payload: ImagePayload,
  targetWidth: number,
): Promise<ImagePayload> => {
  const pipeline = sharp(payload.buffer).resize({
    width: targetWidth,
    withoutEnlargement: true,
  });

  const format = payload.format;
  if (format === "jpeg") {
    pipeline.jpeg({ quality: 90, mozjpeg: true });
  } else if (format === "png") {
    pipeline.png({ compressionLevel: 9 });
  } else if (format === "webp") {
    pipeline.webp({ quality: 92 });
  } else if (format === "gif") {
    pipeline.gif();
  }

  const result = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    buffer: result.data,
    width: result.info.width ?? payload.width,
    height: result.info.height ?? payload.height,
    format,
  };
};

const buildVariantEntry = async (
  mangaId: string,
  key: "w220" | "w400" | "w625",
  payload: ImagePayload,
  dryRun: boolean,
) => {
  const ext = getFormatExtension(payload.format);
  const originalFilename = `poster-${mangaId}-${key}.${ext}`;
  const contentType = getFormatContentType(payload.format);

  if (dryRun) {
    return {
      url: "",
      width: payload.width,
      height: payload.height,
      fullPath: "",
      bytes: payload.buffer.length,
    };
  }

  const result = await uploadBufferWithValidation({
    buffer: payload.buffer,
    originalFilename,
    prefixPath: "story-images",
    contentType,
    allowedFormats: ALLOWED_FORMATS,
    generateUniqueFileName: true,
  });

  return {
    url: result.url,
    width: payload.width,
    height: payload.height,
    fullPath: result.fullPath,
    bytes: payload.buffer.length,
  };
};

const hasCompleteVariants = (doc: any) => {
  const variants = (doc as any)?.posterVariants;
  return Boolean(variants?.w625?.url && variants?.w400?.url && variants?.w220?.url);
};

const buildVariants = async (
  mangaId: string,
  posterUrl: string,
  dryRun: boolean,
): Promise<PosterVariantsPayload | null> => {
  const buffer = await fetchPosterBuffer(posterUrl);
  if (!buffer) return null;

  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) {
    console.warn(`[meta] Missing dimensions for ${mangaId}`);
    return null;
  }

  const format = normalizeFormat(meta.format ?? "jpeg");
  if (format === "gif") {
    console.warn(`[skip] GIF poster not supported for ${mangaId}`);
    return null;
  }

  let base: ImagePayload = {
    buffer,
    width: meta.width,
    height: meta.height,
    format,
  };

  base = await cropToThreeFour(base);
  base = await maybeConvertToWebP(base);

  const variants: PosterVariantsPayload = {};
  const w625Payload = await resizeToWidth(base, POSTER_TARGET_WIDTH);
  variants.w625 = await buildVariantEntry(mangaId, "w625", w625Payload, dryRun);

  if (base.width > 450) {
    const w400Payload = await resizeToWidth(base, 400);
    variants.w400 = await buildVariantEntry(mangaId, "w400", w400Payload, dryRun);
  }

  if (base.width > 301) {
    const w220Payload = await resizeToWidth(base, 220);
    variants.w220 = await buildVariantEntry(mangaId, "w220", w220Payload, dryRun);
  }

  return variants;
};

const run = async () => {
  const options = parseArgs();
  const query = buildQuery(options.force);
  const limitInfo = options.limit > 0 ? `${options.limit} items` : "all items";
  const batchInfo = options.batchSize > 0 ? `${options.batchSize}` : "off";
  const pauseInfo = options.pauseSeconds > 0 ? `${options.pauseSeconds}s` : "off";
  console.info(
    `[poster-variants:backfill] Starting with query=${JSON.stringify(query)} limit=${limitInfo} batchSize=${batchInfo} pause=${pauseInfo}`,
  );

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 20 });

  const cursor = MangaModel.find(query).sort({ updatedAt: 1 }).cursor();

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for await (const doc of cursor) {
      if (options.limit > 0 && processed >= options.limit) {
        break;
      }

      processed += 1;
      const mangaId = String(doc._id);
      const title = doc.title ?? "Untitled";
      const poster = doc.poster ?? "";

      if (!poster) {
        skipped += 1;
        console.warn(`[skip] Missing poster for manga ${mangaId} (${title})`);
        continue;
      }

      if (!options.force && hasCompleteVariants(doc)) {
        skipped += 1;
        continue;
      }

      const posterUrl = resolvePosterUrl(poster);
      if (!posterUrl) {
        skipped += 1;
        console.warn(`[skip] Invalid poster URL for manga ${mangaId}`);
        continue;
      }

      if (options.dryRun) {
        const baseName = path.basename(new URL(posterUrl).pathname || "poster");
        console.info(`[dry-run] Would build variants for ${mangaId} (${baseName})`);
        updated += 1;
      } else {
        try {
          const variants = await buildVariants(mangaId, posterUrl, options.dryRun);
          if (!variants?.w625?.url) {
            failed += 1;
            console.error(`[failed] Unable to build variants for ${mangaId}`);
          } else {
            await MangaModel.updateOne(
              { _id: doc._id },
              {
                $set: {
                  poster: variants.w625.url,
                  posterVariants: variants,
                },
              },
              { timestamps: false },
            );

            updated += 1;
            console.info(`[done] Updated poster variants for ${mangaId}`);
          }
        } catch (error) {
          failed += 1;
          console.error(`[error] Unexpected failure for ${mangaId}`, error);
        }
      }

      if (options.batchSize > 0 && processed % options.batchSize === 0) {
        const shouldContinue = options.interactive
          ? await waitForDecision(options.pauseSeconds)
          : options.pauseSeconds > 0
          ? await new Promise<boolean>((resolve) =>
              setTimeout(() => resolve(true), options.pauseSeconds * 1000),
            )
          : true;

        if (!shouldContinue) {
          console.info("[poster-variants:backfill] Stopped by user");
          break;
        }
      }
    }
  } finally {
    await cursor.close();
    await mongoose.disconnect();
  }

  console.info("[poster-variants:backfill] Completed");
  logSummary("processed", processed);
  logSummary("updated", updated);
  logSummary("skipped", skipped);
  logSummary("failed", failed);
};

run().catch((error) => {
  console.error("[poster-variants:backfill] Fatal error", error);
  mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
