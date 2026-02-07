#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import sharp from "sharp";

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

const POSTER_TARGET_WIDTH = 575;
const POSTER_ASPECT_TOLERANCE = 0.01;
const ASPECT_THREE_FOUR = 3 / 4;
const ASPECT_TWO_THREE = 2 / 3;
const ALLOWED_FORMATS: AllowedFileFormat[] = ["jpeg", "jpg", "png", "webp", "gif"];

const MANGA_POSTER_REGEX = /\/manga-posters\b|manga-posters\//i;

type ImagePayload = {
  buffer: Buffer;
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp" | "gif";
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
) => {
  const ext = getFormatExtension(payload.format);
  const originalFilename = `poster-${mangaId}-${key}.${ext}`;
  const contentType = getFormatContentType(payload.format);

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

const buildVariants = async (mangaId: string, posterUrl: string): Promise<PosterVariantsPayload | null> => {
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
  variants.w575 = await buildVariantEntry(mangaId, "w575", w575Payload);

  if (base.width > 450) {
    const w320Payload = await resizeToWidth(base, 320);
    variants.w320 = await buildVariantEntry(mangaId, "w320", w320Payload);
  }

  if (base.width > 301) {
    const w220Payload = await resizeToWidth(base, 220);
    variants.w220 = await buildVariantEntry(mangaId, "w220", w220Payload);
  }

  return variants;
};

const run = async () => {
  await mongoose.connect(ENV.MONGO.URI);

  const docs = await MangaModel.find(
    {
      $or: [
        { poster: { $regex: MANGA_POSTER_REGEX } },
        { "posterVariants.w220.url": { $regex: MANGA_POSTER_REGEX } },
        { "posterVariants.w320.url": { $regex: MANGA_POSTER_REGEX } },
        { "posterVariants.w575.url": { $regex: MANGA_POSTER_REGEX } },
        { "posterVariants.w400.url": { $regex: MANGA_POSTER_REGEX } },
        { "posterVariants.w625.url": { $regex: MANGA_POSTER_REGEX } },
        { "posterVariants.source.url": { $regex: MANGA_POSTER_REGEX } },
      ],
    },
  ).lean();

  console.info(`[migrate] Found ${docs.length} manga with manga-posters references`);

  let updated = 0;
  let failed = 0;

  for (const doc of docs) {
    const mangaId = String((doc as any)._id);
    const poster = (doc as any)?.poster || "";
    const posterUrl = resolvePosterUrl(poster);
    if (!posterUrl) {
      failed += 1;
      console.warn(`[skip] Missing poster for ${mangaId}`);
      continue;
    }

    try {
      const variants = await buildVariants(mangaId, posterUrl);
      if (!variants?.w575?.url) {
        failed += 1;
        console.error(`[failed] Unable to build variants for ${mangaId}`);
        continue;
      }

      await MangaModel.updateOne(
        { _id: doc._id },
        { $set: { poster: variants.w575.url, posterVariants: variants } },
        { timestamps: false },
      );

      const oldPaths = collectPosterVariantPaths((doc as any).posterVariants, (doc as any).poster);
      if (oldPaths.length) {
        try {
          await deletePublicFiles(oldPaths);
        } catch (error) {
          console.warn(`[cleanup] delete old poster variants failed for ${mangaId}`, error);
        }
      }

      updated += 1;
      console.info(`[done] Migrated ${mangaId}`);
    } catch (error) {
      failed += 1;
      console.error(`[error] Unexpected failure for ${mangaId}`, error);
    }
  }

  await mongoose.disconnect();
  console.info(`[migrate] Completed updated=${updated} failed=${failed}`);
};

run().catch((err) => {
  console.error("[migrate] Fatal error", err);
  process.exit(1);
});
