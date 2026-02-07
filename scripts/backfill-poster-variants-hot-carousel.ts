#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
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
import { deletePublicFiles, getPublicFileUrl } from "~/utils/minio.utils";
import { collectPosterVariantPaths } from "~/.server/utils/poster-variants.server";
import { getHotCarouselLeaderboard } from "~/.server/queries/leaderboad.query";

const POSTER_TARGET_WIDTH = 575;
const POSTER_ASPECT_TOLERANCE = 0.01;
const ASPECT_THREE_FOUR = 3 / 4;
const ASPECT_TWO_THREE = 2 / 3;
const ALLOWED_FORMATS: AllowedFileFormat[] = ["jpeg", "jpg", "png", "webp", "gif"];

type CliOptions = {
  dryRun: boolean;
  limit: number;
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
    limit: 0,
  };

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

const resizeToWidth = async (payload: ImagePayload, targetWidth: number): Promise<ImagePayload> => {
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
  key: "w220" | "w320" | "w575",
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
  return Boolean(variants?.w575?.url && variants?.w320?.url && variants?.w220?.url);
};

const hasLegacyVariants = (doc: any) => {
  const variants = (doc as any)?.posterVariants as any | undefined;
  return Boolean(variants?.w400?.url || variants?.w625?.url);
};

const extractFullPathFromUrl = (value: string): string | null => {
  const text = String(value || "").trim();
  if (!text) return null;

  const prefix = "story-images/";
  const idx = text.indexOf(prefix);
  if (idx >= 0) return text.slice(idx);

  try {
    const url = new URL(text);
    const pathValue = url.pathname.replace(/^\/+/, "");
    const prefixIdx = pathValue.indexOf(prefix);
    if (prefixIdx >= 0) return pathValue.slice(prefixIdx);
    return pathValue || null;
  } catch {
    return null;
  }
};

const collectLegacyPaths = (doc: any): string[] => {
  const variants = (doc as any)?.posterVariants as any | undefined;
  const legacyEntries = [variants?.w400, variants?.w625];
  const paths: string[] = [];
  for (const entry of legacyEntries) {
    if (!entry) continue;
    if (entry.fullPath) {
      paths.push(entry.fullPath);
      continue;
    }
    if (entry.url) {
      const derived = extractFullPathFromUrl(entry.url);
      if (derived) paths.push(derived);
    }
  }
  return Array.from(new Set(paths)).filter(Boolean);
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
  const w575Payload = await resizeToWidth(base, POSTER_TARGET_WIDTH);
  variants.w575 = await buildVariantEntry(mangaId, "w575", w575Payload, dryRun);

  if (base.width > 450) {
    const w320Payload = await resizeToWidth(base, 320);
    variants.w320 = await buildVariantEntry(mangaId, "w320", w320Payload, dryRun);
  }

  if (base.width > 301) {
    const w220Payload = await resizeToWidth(base, 220);
    variants.w220 = await buildVariantEntry(mangaId, "w220", w220Payload, dryRun);
  }

  return variants;
};

const run = async () => {
  const options = parseArgs();
  console.info(
    `[poster-variants:hot-carousel] Starting dryRun=${options.dryRun} limit=${options.limit || "all"}`,
  );

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 10 });

  const hotItems = await getHotCarouselLeaderboard();
  const ids = hotItems
    .map((item: any) => String(item?.id ?? item?._id ?? ""))
    .filter(Boolean);

  const limited = options.limit > 0 ? ids.slice(0, options.limit) : ids;

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  const processedItems: Array<{ id: string; slug?: string; title?: string }> = [];

  try {
    for (const id of limited) {
      processed += 1;
      const doc = await MangaModel.findById(id).lean();
      if (!doc) {
        skipped += 1;
        continue;
      }

      const poster = (doc as any).poster ?? "";
      if (!poster) {
        skipped += 1;
        console.warn(`[skip] Missing poster for manga ${id}`);
        continue;
      }

      const needsUpdate = !hasCompleteVariants(doc) || hasLegacyVariants(doc);
      if (!needsUpdate) {
        skipped += 1;
        continue;
      }

      const posterUrl = resolvePosterUrl(poster);
      if (!posterUrl) {
        skipped += 1;
        console.warn(`[skip] Invalid poster URL for manga ${id}`);
        continue;
      }

      if (options.dryRun) {
        console.info(`[dry-run] Would build variants for ${id}`);
        updated += 1;
        continue;
      }

      try {
        const variants = await buildVariants(id, posterUrl, options.dryRun);
        if (!variants?.w575?.url) {
          failed += 1;
          console.error(`[failed] Unable to build variants for ${id}`);
          continue;
        }

        await MangaModel.updateOne(
          { _id: doc._id },
          {
            $set: {
              poster: variants.w575.url,
              posterVariants: variants,
            },
          },
          { timestamps: false },
        );

        processedItems.push({
          id,
          slug: (doc as any).slug ? String((doc as any).slug) : undefined,
          title: (doc as any).title ? String((doc as any).title) : undefined,
        });

        const oldPaths = collectPosterVariantPaths((doc as any).posterVariants, (doc as any).poster);
        const legacyPaths = collectLegacyPaths(doc);
        const newPaths = collectPosterVariantPaths(variants, variants.w575.url);
        const toDelete = Array.from(new Set([...oldPaths, ...legacyPaths])).filter(
          (p) => !newPaths.includes(p),
        );
        if (toDelete.length) {
          try {
            await deletePublicFiles(toDelete);
          } catch (error) {
            console.warn(`[cleanup] delete old poster variants failed for ${id}`, error);
          }
        }

        updated += 1;
        console.info(`[done] Updated poster variants for ${id}`);
      } catch (error) {
        failed += 1;
        console.error(`[error] Unexpected failure for ${id}`, error);
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  const logDir = path.resolve(process.cwd(), "tmp");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(
    logDir,
    `backfill-poster-variants-hot-carousel-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(logFile, JSON.stringify({ processedItems }, null, 2));

  console.info("\n[poster-variants:hot-carousel] Done");
  console.info(`Processed : ${processed}`);
  console.info(`Updated   : ${updated}`);
  console.info(`Skipped   : ${skipped}`);
  console.info(`Failed    : ${failed}`);
  console.info(`Log file  : ${logFile}`);
};

run().catch((err) => {
  console.error("[poster-variants:hot-carousel] Fatal error", err);
  process.exit(1);
});
