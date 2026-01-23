#!/usr/bin/env tsx
import mongoose from "mongoose";

import { initMongoDB } from "~/database/connection";
import { MangaModel } from "~/database/models/manga.model";
import { MINIO_CONFIG } from "@/configs/minio.config";
import { DEFAULT_CDN_BASE } from "~/constants/cdn";
import { getEnvironmentPrefix, getMinioClient, getPublicFileUrl } from "~/utils/minio.utils";

type ListedObject = {
  fullPath: string;
  size?: number;
  lastModified?: Date;
};

type Options = {
  prefixImages: string;
  prefixPosters: string;
  limit: number;
  sample: number;
  postersLimit: number;
  imagesLimit: number;
};

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const prefix = `--${name}=`;
    const hit = args.find((a) => a.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : undefined;
  };

  return {
    prefixImages: getArg("prefix-images") || process.env.PREFIX_IMAGES || "manga-images",
    prefixPosters: getArg("prefix-posters") || process.env.PREFIX_POSTERS || "manga-posters",
    limit: parseNumber(getArg("limit") || process.env.LIMIT, 2000),
    imagesLimit: parseNumber(getArg("images-limit") || process.env.IMAGES_LIMIT, 2000),
    postersLimit: parseNumber(getArg("posters-limit") || process.env.POSTERS_LIMIT, 2000),
    sample: parseNumber(getArg("sample") || process.env.SAMPLE, 8),
  };
};

const waitForMongoConnected = async (timeoutMs: number) => {
  if (mongoose.connection.readyState === 1) return;

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup();
      reject(new Error(`MongoDB connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const onConnected = () => {
      cleanup();
      resolve();
    };
    const onError = (err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const cleanup = () => {
      clearTimeout(t);
      mongoose.connection.off("connected", onConnected);
      mongoose.connection.off("error", onError);
    };

    mongoose.connection.on("connected", onConnected);
    mongoose.connection.on("error", onError);
  });
};

const listObjectsLimited = async (prefixPath: string, limit: number): Promise<ListedObject[]> => {
  const client = getMinioClient();
  const bucket = MINIO_CONFIG.DEFAULT_BUCKET;
  const files: ListedObject[] = [];

  return await new Promise((resolve, reject) => {
    const stream = client.listObjects(bucket, prefixPath, true);
    let done = false;

    const finalize = (err?: unknown) => {
      if (done) return;
      done = true;
      if (err) reject(err);
      else resolve(files);
    };

    stream.on("data", (obj) => {
      if (!obj?.name) return;
      files.push({ fullPath: obj.name, size: obj.size, lastModified: obj.lastModified });
      if (limit > 0 && files.length >= limit) {
        stream.destroy();
        finalize();
      }
    });

    stream.on("error", (error) => finalize(error));
    stream.on("end", () => finalize());
  });
};

const stripEnvPrefix = (fullPath: string, envPrefix: string) => {
  if (!envPrefix) return fullPath.replace(/^\/+/, "");
  const normalized = fullPath.replace(/^\/+/, "");
  const prefix = `${envPrefix}/`;
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
};

const normalizeInternalFullPath = (value?: string | null): string | null => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (!raw.startsWith("http")) {
    return raw.replace(/^\/+/, "");
  }

  const cdnBase = ((process.env.CDN_BASE ?? "").trim() || DEFAULT_CDN_BASE).replace(/\/+$/, "");
  const bucketMarker = `/${MINIO_CONFIG.DEFAULT_BUCKET}/`;

  if (raw.startsWith(`${cdnBase}/`)) {
    return raw.slice(cdnBase.length + 1);
  }

  try {
    const url = new URL(raw);
    if (bucketMarker && url.pathname.includes(bucketMarker)) {
      const rest = url.pathname.split(bucketMarker)[1];
      return rest ? rest.replace(/^\/+/, "") : null;
    }
    return url.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
};

const isValidObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

const main = async () => {
  const options = parseArgs();
  const envPrefix = getEnvironmentPrefix();

  console.info(`[r2:orphan] options=${JSON.stringify(options)} envPrefix=${envPrefix || "<none>"}`);

  initMongoDB();
  await waitForMongoConnected(30_000);

  const existingMangaIds = new Set<string>();
  for await (const doc of MangaModel.find({}, { _id: 1 }).lean().cursor()) {
    existingMangaIds.add(String(doc._id));
  }
  console.info(`[r2:orphan] mangaIds loaded=${existingMangaIds.size}`);

  const referencedPosters = new Set<string>();
  for await (const doc of MangaModel.find({}, { poster: 1, shareImage: 1 }).lean().cursor()) {
    const posterPath = normalizeInternalFullPath((doc as any)?.poster);
    const sharePath = normalizeInternalFullPath((doc as any)?.shareImage);
    if (posterPath) referencedPosters.add(stripEnvPrefix(posterPath, envPrefix));
    if (sharePath) referencedPosters.add(stripEnvPrefix(sharePath, envPrefix));
  }

  // ---- Scan manga-images ----
  const prefixImages = envPrefix ? `${envPrefix}/${options.prefixImages}` : options.prefixImages;
  const imageObjects = await listObjectsLimited(prefixImages, options.imagesLimit || options.limit);

  let orphanImages = 0;
  const orphanImageSamples: string[] = [];
  const orphanMangaIds = new Set<string>();

  for (const obj of imageObjects) {
    const canonical = stripEnvPrefix(obj.fullPath, envPrefix);
    if (!canonical.startsWith(`${options.prefixImages}/`)) continue;
    const parts = canonical.split("/");
    const mangaId = parts[1] || "";
    if (!mangaId || !isValidObjectId(mangaId)) continue;

    if (!existingMangaIds.has(mangaId)) {
      orphanImages += 1;
      orphanMangaIds.add(mangaId);
      if (orphanImageSamples.length < options.sample) {
        orphanImageSamples.push(getPublicFileUrl(obj.fullPath));
      }
    }
  }

  // ---- Scan manga-posters ----
  const prefixPosters = envPrefix ? `${envPrefix}/${options.prefixPosters}` : options.prefixPosters;
  const posterObjects = await listObjectsLimited(prefixPosters, options.postersLimit || options.limit);

  let orphanPosters = 0;
  const orphanPosterSamples: string[] = [];

  for (const obj of posterObjects) {
    const canonical = stripEnvPrefix(obj.fullPath, envPrefix);
    if (!canonical.startsWith(`${options.prefixPosters}/`)) continue;
    if (!referencedPosters.has(canonical)) {
      orphanPosters += 1;
      if (orphanPosterSamples.length < options.sample) {
        orphanPosterSamples.push(getPublicFileUrl(obj.fullPath));
      }
    }
  }

  console.info("\n===== R2 orphan report (sampled) =====");
  console.info(`Images scanned=${imageObjects.length} orphanImages=${orphanImages} orphanMangaIds=${orphanMangaIds.size}`);
  if (orphanImageSamples.length) {
    console.info("Sample orphan chapter images:");
    for (const u of orphanImageSamples) console.info(`- ${u}`);
  }

  console.info(`\nPosters scanned=${posterObjects.length} orphanPosters=${orphanPosters}`);
  if (orphanPosterSamples.length) {
    console.info("Sample orphan posters:");
    for (const u of orphanPosterSamples) console.info(`- ${u}`);
  }

  console.info("\nDone.");
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error("[r2:orphan] failed:", err);
  process.exit(1);
});
