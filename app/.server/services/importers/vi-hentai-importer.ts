import { load, type CheerioAPI, type Cheerio } from "cheerio";
import type { Element } from "domhandler";
import type { Model } from "mongoose";
import { createRequire } from "node:module";
import sharp from "sharp";

import { uploadBufferWithValidation, encodeForMetadata } from "@/services/file-upload.service";

import { MANGA_CONTENT_TYPE, MANGA_STATUS, MANGA_USER_STATUS, type MangaContentType } from "~/constants/manga";
import { generateUniqueMangaSlug } from "~/database/helpers/manga-slug.helper";
import { MangaModel } from "~/database/models/manga.model";
import { ChapterModel } from "~/database/models/chapter.model";
import { AuthorModel } from "~/database/models/author.model";
import { DoujinshiModel } from "~/database/models/doujinshi.model";
import { CharacterModel } from "~/database/models/character.model";
import { TranslatorModel } from "~/database/models/translator.model";
import { GenresModel } from "~/database/models/genres.model";
import { slugify } from "~/utils/slug.utils";
import { stripDiacritics } from "~/utils/text-normalize";
import { deleteFiles as deletePublicFiles } from "~/utils/minio.utils";
import genresData from "~/../data/genres-full.json";
import supplementalGenresData from "~/../data/genres-missing-upsert.json";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept-Language": "vi,en;q=0.9",
};

const COVER_CANDIDATE_SELECTORS = [
  ".cover-frame",
  ".book-cover",
  ".manga-cover",
  ".thumb",
  ".thumb img",
  ".book-info .cover",
  ".book-info .poster",
  ".book-detail .cover",
  ".book-detail .poster",
  ".manga-info .cover",
  ".manga-info .poster",
  ".detail-info .cover",
  ".detail-info .poster",
  ".comic-info .cover",
  ".comic-info .poster",
  ".info .cover",
  ".info .poster",
  ".content .cover",
  ".content .cover img",
  "figure.cover",
  "figure.cover img",
  ".cover img",
];

const COVER_CONTAINER_SELECTORS = [
  ".book-info",
  ".book-detail",
  ".manga-info",
  ".detail-info",
  ".comic-info",
  ".info",
  ".content",
];

const BRAND_PATTERNS = [
  /vi[\s-]?hentai(?:\.pro)?/gi,
  /việt[\s-]?hentai/gi,
  /hentai\s+vietsub\s+hd/gi,
  /kuro\s*neko/gi,
  /mèo\s*đen/gi,
];

const sanitizeWhitespace = (value?: string | null) => {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class ViHentaiForcedPauseError extends Error {
  code = "VI_HENTAI_FORCED_PAUSE" as const;

  constructor(message = "Đã tạm dừng (force)") {
    super(message);
    this.name = "ViHentaiForcedPauseError";
  }
}

async function sleepAbortable(ms: number, options: { signal?: AbortSignal; checkAbort?: () => Promise<void> | void }) {
  if (!ms || ms <= 0) return;

  const { signal, checkAbort } = options;
  const endAt = Date.now() + ms;
  const stepMs = 250;

  while (Date.now() < endAt) {
    if (signal?.aborted) throw new ViHentaiForcedPauseError();
    if (checkAbort) await checkAbort();

    const remaining = endAt - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(stepMs, remaining));
  }
}

// Reduce upstream rate-limits (429) from vi-hentai when auto-updating/downloading.
// This only applies to HTML page fetches (manga/chapter pages), NOT image downloads.
const VIHENTAI_HTML_MIN_INTERVAL_MS = (() => {
  const raw = process.env.VIHENTAI_HTML_MIN_INTERVAL_MS;
  if (raw == null || String(raw).trim() === "") return 1_500;
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1_500;
})();

const getViHentaiThrottleKey = (url: string): string | null => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === "vi-hentai.pro" || hostname.endsWith(".vi-hentai.pro")) return "vi-hentai";
    if (hostname === "vi-hentai.moe" || hostname.endsWith(".vi-hentai.moe")) return "vi-hentai";
  } catch {
    // ignore
  }
  return null;
};

const viHentaiHtmlTailByKey = new Map<string, Promise<void>>();
const viHentaiHtmlLastAtByKey = new Map<string, number>();

async function runViHentaiHtmlPaced<T>(key: string, task: () => Promise<T>): Promise<T> {
  const minIntervalMs = VIHENTAI_HTML_MIN_INTERVAL_MS;
  if (minIntervalMs <= 0) return task();

  const prev = viHentaiHtmlTailByKey.get(key) ?? Promise.resolve();
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  viHentaiHtmlTailByKey.set(key, prev.then(() => gate));

  await prev;
  try {
    const lastAt = viHentaiHtmlLastAtByKey.get(key) ?? 0;
    const waitMs = Math.max(0, lastAt + minIntervalMs - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    viHentaiHtmlLastAtByKey.set(key, Date.now());
    return await task();
  } finally {
    try {
      release?.();
    } catch {
      // ignore
    }
  }
}

const stripBranding = (value?: string | null) => {
  let result = sanitizeWhitespace(value);
  if (!result) return "";
  for (const pattern of BRAND_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return sanitizeWhitespace(result);
};

const sanitizeTitle = (value?: string | null) => {
  let cleaned = stripBranding(value);
  if (!cleaned) return "";
  cleaned = cleaned.replace(/\s*[|\-–—]+\s*$/g, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned || stripBranding(value) || "";
};

const sanitizeDescription = (value?: string | null) => {
  let cleaned = stripBranding(value);
  if (!cleaned) return "";
  cleaned = cleaned.replace(/(\s*[-–—]\s*){2,}/g, " - ");
  cleaned = cleaned.replace(/\s*[-–—]\s*$/g, "");
  return sanitizeWhitespace(cleaned);
};

const normalizeForCompare = (value?: string) =>
  stripDiacritics(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stripTrailingTitleSuffix = (description: string, title: string) => {
  if (!description || !title) return description;
  const normTitle = normalizeForCompare(title);
  if (!normTitle) return description;

  const parts = description.split(/[-–—|:]+/);
  if (parts.length < 2) return description;

  const last = parts[parts.length - 1].trim();
  const normLast = normalizeForCompare(last);
  if (normLast && normLast === normTitle) {
    const rebuilt = parts.slice(0, -1).join(" - ").trim().replace(/[-–—|:]+$/, "").trim();
    return rebuilt || description;
  }

  return description;
};

const extractTitleFromDom = ($: CheerioAPI) => {
  const selectors = [
    "h1",
    ".manga-info h1",
    ".book-info h1",
    ".detail-info h1",
    ".comic-info h1",
    ".book-title",
    ".grow.text-lg",
    ".detail-info .title",
  ];
  for (const selector of selectors) {
    const text = sanitizeWhitespace($(selector).first().text());
    if (text) {
      return text;
    }
  }
  return undefined;
};

const require = createRequire(import.meta.url);

type GenreEntry = { slug: string; name: string; aliases?: string[] };

const loadScriptGenres = (): GenreEntry[] => {
  try {
    // NOTE: This module is executed in an ESM build in many environments (Remix/Vite).
    // Using `createRequire` keeps compatibility with CommonJS exports.
    const requireFromHere = createRequire(import.meta.url);
    const raw = requireFromHere("../../../../scripts/genres.array.cjs");
    if (Array.isArray(raw)) {
      return raw
        .map((item) => {
          const aliasSource = item?.aliases ?? item?.alias;
          const aliases = Array.isArray(aliasSource)
            ? aliasSource
            : aliasSource
              ? [String(aliasSource)]
              : [];
          return { slug: item?.slug, name: item?.name, aliases };
        })
        .filter((item) => Boolean(item.slug) && Boolean(item.name));
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Không thể tải scripts/genres.array.cjs cho importer:", error);
  }
  return [];
};

const MANUAL_GENRE_ALIASES: Record<string, string> = {
  catgirl: "animal-girl",
  catgirls: "animal-girl",
  animalgirls: "animal-girl",
  "short-hentai": "short",
  shorthentai: "short",
  bodyswap: "body-swap",
  "body-swap": "body-swap",
  crossdressing: "cross-dressing",
  "cross-dressing": "cross-dressing",
  "cross dressing": "cross-dressing",
  pantyhose: "pantyhose",
  "dirty-old-man": "dirtyoldman",
  "dirty old man": "dirtyoldman",
  dirtyoldman: "dirtyoldman",
};

const GENRE_LOOKUP = (() => {
  const map = new Map<string, string>();
  const sources: GenreEntry[] = [
    ...(genresData as GenreEntry[]),
    ...(supplementalGenresData as GenreEntry[]),
    ...loadScriptGenres(),
  ];

  const addKey = (key: string, slug: string) => {
    if (!key || !slug) return;
    map.set(key, slug);
  };

  const collectKeyVariants = (value?: string) => {
    const variants = new Set<string>();
    const normalized = slugify(value || "");
    if (normalized) {
      variants.add(normalized);
      variants.add(normalized.replace(/-/g, ""));
    }
    return Array.from(variants).filter(Boolean);
  };

  for (const entry of sources) {
    const slug = entry?.slug?.trim().toLowerCase();
    if (!slug) continue;
    addKey(slug, slug);
    addKey(slug.replace(/-/g, ""), slug);
    collectKeyVariants(entry.name).forEach((key) => addKey(key, slug));
    (entry.aliases || []).forEach((alias) => {
      collectKeyVariants(alias).forEach((key) => addKey(key, slug));
    });
  }

  for (const [alias, target] of Object.entries(MANUAL_GENRE_ALIASES)) {
    const aliasKey = slugify(alias);
    const slug = target?.trim().toLowerCase();
    if (!aliasKey || !slug) continue;
    addKey(aliasKey, slug);
    addKey(aliasKey.replace(/-/g, ""), slug);
  }

  return map;
})();

export type ParsedViHentaiPage = {
  title: string;
  alternateTitle?: string;
  description: string;
  poster: string;
  rawGenres: string[];
  authorNames: string[];
  doujinshiNames: string[];
  characterNames: string[];
  executorNames: string[];
  translationTeam?: string;
  statusText?: string;
  viewNumber?: number;
  followNumber?: number;
  chapterCount: number;
  codeLabel?: string;
  lastUpdatedText?: string;
  lastUpdatedAt?: Date;
  url: string;
};

export type ViHentaiImportOptions = {
  url: string;
  ownerId: string;
  translationTeam?: string;
  slugOverride?: string;
  dryRun?: boolean;
  approve?: boolean;
  skipIfExists?: boolean;
  contentType?: MangaContentType;
  userStatusOverride?: number;
};

export type ViHentaiAutoDownloadOptions = ViHentaiImportOptions & {
  request: Request;
  downloadPoster?: boolean;
  downloadChapters?: boolean;
  asSystem?: boolean;
  maxChapters?: number;
  maxImagesPerChapter?: number;
  continueOnChapterError?: boolean;
  imageDelayMs?: number;
  imageTimeoutMs?: number;
  imageRetries?: number;
  chapterDelayMs?: number;
  /** Force-stop support (used by the background queue worker). */
  abortSignal?: AbortSignal;
  /** Return a string reason to abort ASAP (e.g. when admin force-pauses the running job). */
  shouldAbort?: () => Promise<string | undefined> | string | undefined;
  onProgress?: (progress: {
    stage: "manga" | "poster" | "chapters" | "chapter" | "image" | "done";
    message?: string;
    chapterIndex?: number;
    chapterCount?: number;
    chapterTitle?: string;
    chapterUrl?: string;
    imageIndex?: number;
    imageCount?: number;
    imageUrl?: string;
  }) => void | Promise<void>;
};

export type ViHentaiImportResult = {
  url: string;
  parsed: ParsedViHentaiPage;
  matchedGenres: string[];
  unknownGenres: string[];
  payload: {
    title: string;
    alternateTitle?: string;
    slug: string;
    description: string;
    poster: string;
    genres: string[];
    author?: string;
    translationTeam: string;
    ownerId: string;
    status: number;
    userStatus: number;
    translatorNames: string[];
    translatorSlugs: string[];
    doujinshiNames: string[];
    doujinshiSlugs: string[];
    characterNames: string[];
    characterSlugs: string[];
    keywords?: string;
    contentType: MangaContentType;
  };
  mode: "dry-run" | "created" | "skipped";
  message: string;
  createdId?: string;
  createdSlug?: string;
};

export type ViHentaiAutoDownloadResult = ViHentaiImportResult & {
  chaptersImported: number;
  imagesUploaded: number;
  chapterErrors: Array<{ chapterUrl: string; message: string }>;
};

const fetchHtml = async (url: string) => {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`Không thể tải trang (${response.status} ${response.statusText})`);
  }
  return response.text();
};

// Auto-update only: pace vi-hentai HTML requests to avoid 429.
const fetchViHentaiHtmlForAutoUpdate = async (url: string) => {
  const key = getViHentaiThrottleKey(url);
  if (!key) return fetchHtml(url);
  return runViHentaiHtmlPaced(key, () => fetchHtml(url));
};

const contentTypeToExtension = (contentType?: string | null) => {
  const ct = String(contentType || "").toLowerCase().split(";")[0].trim();
  if (ct === "image/jpeg" || ct === "image/jpg") return ".jpg";
  if (ct === "image/png") return ".png";
  if (ct === "image/webp") return ".webp";
  if (ct === "image/avif") return ".avif";
  if (ct === "image/gif") return ".gif";
  if (ct === "image/svg+xml") return ".svg";
  return ".jpg";
};

const formatToContentType = (format?: string | null): string | null => {
  const f = String(format || "").toLowerCase();
  if (f === "jpeg" || f === "jpg") return "image/jpeg";
  if (f === "png") return "image/png";
  if (f === "webp") return "image/webp";
  if (f === "gif") return "image/gif";
  if (f === "avif") return "image/avif";
  return null;
};

const normalizeFilenameForContentType = (filename: string, contentType?: string | null) => {
  const ext = contentTypeToExtension(contentType);
  if (!filename) return filename;
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) return `${filename}${ext}`;
  return `${filename.slice(0, lastDot)}${ext}`;
};

// Server-side re-implementation of the client rules in `app/utils/image-compression.utils.ts`.
// - Chapter images: size-based scaling + PNG->WebP + small quality trial.
// - Posters: crop to 3:4 when needed + width<=625 + PNG->WebP.
const IMAGE_LIMIT_PIXELS = 64_000_000;
const MB = 1024 * 1024;

type PosterAspect = "3:4" | "2:3" | "other";
const POSTER_TARGET_WIDTH = 625;
const POSTER_ASPECT_TOLERANCE = 0.01;
const ASPECT_THREE_FOUR = 3 / 4;
const ASPECT_TWO_THREE = 2 / 3;

const classifyPosterAspect = (ratio: number): PosterAspect => {
  if (Math.abs(ratio - ASPECT_THREE_FOUR) <= POSTER_ASPECT_TOLERANCE) return "3:4";
  if (Math.abs(ratio - ASPECT_TWO_THREE) <= POSTER_ASPECT_TOLERANCE) return "2:3";
  return "other";
};

async function normalizePosterBuffer(
  buffer: Buffer,
  input: { contentType: string | null },
): Promise<{ buffer: Buffer; contentType: string | null }> {
  try {
    const base = sharp(buffer, { limitInputPixels: IMAGE_LIMIT_PIXELS }).rotate();
    const meta = await base.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const format = (meta.format || "").toLowerCase();

    if (!width || !height) {
      return { buffer, contentType: input.contentType };
    }

    const aspect = classifyPosterAspect(width / height);
    const needsCrop = aspect === "other";
    const needsResize = width > POSTER_TARGET_WIDTH;
    const needsPngConvert = format === "png";

    // Match client behavior: if no changes needed (and not PNG conversion), keep as-is.
    if (!needsCrop && !needsResize && !needsPngConvert) {
      return { buffer, contentType: input.contentType || formatToContentType(format) };
    }

    let pipeline = sharp(buffer, { limitInputPixels: IMAGE_LIMIT_PIXELS }).rotate();

    // Crop center to 3:4 if not 3:4 or 2:3
    if (needsCrop) {
      const targetRatio = ASPECT_THREE_FOUR;
      if (width / height > targetRatio) {
        const cropWidth = Math.max(1, Math.floor(height * targetRatio));
        const left = Math.max(0, Math.floor((width - cropWidth) / 2));
        pipeline = pipeline.extract({ left, top: 0, width: cropWidth, height });
      } else {
        const cropHeight = Math.max(1, Math.floor(width / targetRatio));
        const top = Math.max(0, Math.floor((height - cropHeight) / 2));
        pipeline = pipeline.extract({ left: 0, top, width, height: cropHeight });
      }
    }

    // Resize to width=625 if larger.
    if (needsResize) {
      pipeline = pipeline.resize({ width: POSTER_TARGET_WIDTH, withoutEnlargement: true });
    }

    // Convert PNG -> WebP (quality 95). JPG/WEBP keep.
    if (format === "png") {
      const out = await pipeline.webp({ quality: 95, effort: 4 }).toBuffer();
      return { buffer: out, contentType: "image/webp" };
    }

    // Keep input format but do a deterministic encode.
    if (format === "jpeg" || format === "jpg") {
      const out = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      return { buffer: out, contentType: "image/jpeg" };
    }
    if (format === "webp") {
      const out = await pipeline.webp({ quality: 92, effort: 4 }).toBuffer();
      return { buffer: out, contentType: "image/webp" };
    }
    if (format === "avif") {
      const out = await pipeline.avif({ quality: 60, effort: 4 }).toBuffer();
      return { buffer: out, contentType: "image/avif" };
    }

    // Fallback: passthrough (unknown format)
    return { buffer, contentType: input.contentType || formatToContentType(format) };
  } catch {
    return { buffer, contentType: input.contentType };
  }
}

async function reencodeKeepResolutionMinus10(
  buffer: Buffer,
  format: string,
): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  const f = String(format || "").toLowerCase();
  try {
    const pipeline = sharp(buffer, { limitInputPixels: IMAGE_LIMIT_PIXELS }).rotate();
    if (f === "jpeg" || f === "jpg") {
      const out = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      return { buffer: out, contentType: "image/jpeg" };
    }
    if (f === "webp") {
      const out = await pipeline.webp({ quality: 85, effort: 4 }).toBuffer();
      return { buffer: out, contentType: "image/webp" };
    }
  } catch {
    // ignore
  }
  return null;
}

async function scaleByRatioKeepFormat(
  buffer: Buffer,
  format: string,
  ratio: number,
): Promise<{ buffer: Buffer; contentType: string | null }> {
  if (!Number.isFinite(ratio) || ratio >= 1) {
    return { buffer, contentType: formatToContentType(format) };
  }

  try {
    const base = sharp(buffer, { limitInputPixels: IMAGE_LIMIT_PIXELS }).rotate();
    const meta = await base.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height) return { buffer, contentType: formatToContentType(format) };

    const targetW = Math.max(1, Math.floor(width * ratio));
    const targetH = Math.max(1, Math.floor(height * ratio));
    let pipeline = sharp(buffer, { limitInputPixels: IMAGE_LIMIT_PIXELS })
      .rotate()
      .resize(targetW, targetH, { fit: "fill" });

    const f = String(format || "").toLowerCase();
    if (f === "jpeg" || f === "jpg") {
      return { buffer: await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer(), contentType: "image/jpeg" };
    }
    if (f === "webp") {
      return { buffer: await pipeline.webp({ quality: 92, effort: 4 }).toBuffer(), contentType: "image/webp" };
    }
    if (f === "avif") {
      return { buffer: await pipeline.avif({ quality: 60, effort: 4 }).toBuffer(), contentType: "image/avif" };
    }
    if (f === "png") {
      return { buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(), contentType: "image/png" };
    }

    return { buffer: await pipeline.toBuffer(), contentType: formatToContentType(f) };
  } catch {
    return { buffer, contentType: formatToContentType(format) };
  }
}

async function normalizeChapterImageBuffer(input: {
  url: string;
  buffer: Buffer;
  contentType: string | null;
}): Promise<{ buffer: Buffer; contentType: string | null }> {
  const { url } = input;

  // Match client rule: GIF keep as-is.
  if (isGif(url, input.contentType, input.buffer)) {
    return { buffer: input.buffer, contentType: input.contentType || "image/gif" };
  }

  try {
    const meta = await sharp(input.buffer, { limitInputPixels: IMAGE_LIMIT_PIXELS }).metadata();
    const detectedFormat = (meta.format || "").toLowerCase();

    let workingBuffer = input.buffer;
    let workingFormat = detectedFormat;

    // Client rule: PNG always converts to WebP first (quality 0.95).
    if (workingFormat === "png") {
      workingBuffer = await sharp(workingBuffer, { limitInputPixels: IMAGE_LIMIT_PIXELS })
        .rotate()
        .webp({ quality: 95, effort: 4 })
        .toBuffer();
      workingFormat = "webp";
    }

    const size = workingBuffer.length;
    if (size <= 2 * MB) {
      return { buffer: workingBuffer, contentType: formatToContentType(workingFormat) || input.contentType };
    }

    // 2MB–2.85MB: try -10% quality first; if not good enough, scale 75%.
    if (size <= 2.85 * MB) {
      const trial = await reencodeKeepResolutionMinus10(workingBuffer, workingFormat);
      if (trial && trial.buffer.length < workingBuffer.length && trial.buffer.length < 2 * MB) {
        return trial;
      }
      return await scaleByRatioKeepFormat(workingBuffer, workingFormat, 0.75);
    }

    // Remaining tiers
    if (size <= 3.5 * MB) return await scaleByRatioKeepFormat(workingBuffer, workingFormat, 0.65);
    if (size <= 5 * MB) return await scaleByRatioKeepFormat(workingBuffer, workingFormat, 0.55);
    if (size <= 7 * MB) return await scaleByRatioKeepFormat(workingBuffer, workingFormat, 0.45);
    return await scaleByRatioKeepFormat(workingBuffer, workingFormat, 0.35);
  } catch {
    // If sharp can't read metadata, fall back to original.
    return { buffer: input.buffer, contentType: input.contentType };
  }
}

const CHAPTER_IMAGE_FILTERS = {
  watermarkDims: new Set(["1798x2544", "2544x1798"]),
  watermarkMinBytes: 311 * 1024,
  watermarkMaxBytes: 315 * 1024,
  minWidthPx: 151,
  minHeightPx: 601,
  minBytes: 20 * 1024,
  minGifBytes: 70 * 1024,
};

const looksLikeHtml = (buffer: Buffer) => {
  if (!buffer?.length) return true;
  const head = buffer.subarray(0, Math.min(buffer.length, 512)).toString("utf8").trimStart();
  if (!head.startsWith("<")) return false;
  return /<(?:!doctype\s+html|html|head|body)\b/i.test(head);
};

const isGifBySignature = (buffer: Buffer) => {
  if (!buffer || buffer.length < 6) return false;
  return buffer.subarray(0, 6).toString("ascii") === "GIF89a" || buffer.subarray(0, 6).toString("ascii") === "GIF87a";
};

const isGif = (url: string, contentType: string | null, buffer: Buffer) => {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("image/gif")) return true;
  try {
    const u = new URL(url);
    if (u.pathname.toLowerCase().endsWith(".gif")) return true;
  } catch {
    if (url.toLowerCase().includes(".gif")) return true;
  }
  return isGifBySignature(buffer);
};

const shouldSkipByUrl = (url: string) => {
  return url.toLowerCase().includes("/cover/");
};

const safeFilenameFromUrl = (rawUrl: string, fallbackBase: string, contentType?: string | null) => {
  try {
    const u = new URL(rawUrl);
    const last = u.pathname.split("/").filter(Boolean).pop() || fallbackBase;
    // If it already has an extension, keep.
    if (last.includes(".")) return last;
    return `${last}${contentTypeToExtension(contentType)}`;
  } catch {
    return `${fallbackBase}${contentTypeToExtension(contentType)}`;
  }
};

async function fetchRemoteBuffer(
  url: string,
  options: { timeoutMs?: number; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  const onAbort = () => ac.abort();
  try {
    if (options.signal) {
      if (options.signal.aborted) ac.abort();
      else options.signal.addEventListener("abort", onAbort, { once: true });
    }

    const response = await fetch(url, {
      headers: options.headers ?? HEADERS,
      redirect: "follow",
      signal: ac.signal,
    });
    if (!response.ok) {
      throw new Error(`Không thể tải ảnh (${response.status} ${response.statusText})`);
    }
    const contentType = response.headers.get("content-type");
    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), contentType };
  } catch (e) {
    // Distinguish forced pause vs our own timeout abort.
    if (options.signal?.aborted) {
      throw new ViHentaiForcedPauseError();
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (options.signal) {
      try {
        options.signal.removeEventListener("abort", onAbort);
      } catch {
        // ignore
      }
    }
  }
}

async function fetchRemoteBufferWithRetry(
  url: string,
  options: {
    timeoutMs?: number;
    headers?: Record<string, string>;
    retries?: number;
    retryDelayMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const retries = Number.isFinite(options.retries) ? Math.max(0, options.retries ?? 0) : 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      if (options.signal?.aborted) throw new ViHentaiForcedPauseError();
      if (attempt > 0 && (options.retryDelayMs ?? 0) > 0) {
        await sleepAbortable(options.retryDelayMs ?? 0, { signal: options.signal });
      }
      return await fetchRemoteBuffer(url, {
        timeoutMs: options.timeoutMs,
        headers: options.headers,
        signal: options.signal,
      });
    } catch (e) {
      lastError = e;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error(`Không thể tải ảnh sau ${retries + 1} lần thử`);
}

type UploadedRemoteFile = {
  url: string;
  fullPath: string;
  sizeBytes: number;
};

async function uploadImageBuffer(
  remoteUrl: string,
  buffer: Buffer,
  contentType: string | null,
  options: {
    prefixPath: string;
    filenameHintBase: string;
    maxSizeInBytes?: number;
  },
): Promise<UploadedRemoteFile> {
  const originalFilenameRaw = safeFilenameFromUrl(remoteUrl, options.filenameHintBase, contentType);
  const originalFilename = normalizeFilenameForContentType(originalFilenameRaw, contentType);

  const result = await uploadBufferWithValidation({
    buffer,
    originalFilename,
    prefixPath: options.prefixPath,
    contentType: contentType?.split(";")[0] || undefined,
    metadata: {
      "x-amz-meta-source-url": encodeForMetadata(remoteUrl, "url"),
    },
    maxSizeInBytes: options.maxSizeInBytes,
    generateUniqueFileName: true,
  });

  return {
    url: result.url,
    fullPath: result.fullPath,
    sizeBytes: buffer.length,
  };
}

async function getImageDimensions(buffer: Buffer): Promise<{ width?: number; height?: number }> {
  try {
    const meta = await sharp(buffer, { limitInputPixels: 64_000_000 }).metadata();
    return { width: meta.width ?? undefined, height: meta.height ?? undefined };
  } catch {
    return {};
  }
}

async function shouldKeepChapterImage(options: {
  url: string;
  buffer: Buffer;
  contentType: string | null;
}): Promise<{ keep: true; width?: number; height?: number } | { keep: false; reason: string }> {
  const { url, buffer, contentType } = options;

  if (shouldSkipByUrl(url)) {
    return { keep: false, reason: "url_contains_/cover/" };
  }

  if (!buffer?.length) {
    return { keep: false, reason: "empty_body" };
  }

  if (looksLikeHtml(buffer)) {
    return { keep: false, reason: "html_body" };
  }

  const bytes = buffer.length;
  if (bytes < CHAPTER_IMAGE_FILTERS.minBytes) {
    return { keep: false, reason: `too_small_bytes(<${CHAPTER_IMAGE_FILTERS.minBytes})` };
  }

  const gif = isGif(url, contentType, buffer);
  if (gif && bytes < CHAPTER_IMAGE_FILTERS.minGifBytes) {
    return { keep: false, reason: `gif_too_small_bytes(<${CHAPTER_IMAGE_FILTERS.minGifBytes})` };
  }

  const { width, height } = await getImageDimensions(buffer);

  if (typeof width === "number" && typeof height === "number") {
    const dimKey = `${width}x${height}`;
    if (
      CHAPTER_IMAGE_FILTERS.watermarkDims.has(dimKey) &&
      bytes >= CHAPTER_IMAGE_FILTERS.watermarkMinBytes &&
      bytes <= CHAPTER_IMAGE_FILTERS.watermarkMaxBytes
    ) {
      return { keep: false, reason: "watermark_signature(1798x2544|2544x1798,311-315KB)" };
    }
  }

  if (typeof width === "number" && width < CHAPTER_IMAGE_FILTERS.minWidthPx) {
    return { keep: false, reason: `width_too_small(<${CHAPTER_IMAGE_FILTERS.minWidthPx})` };
  }
  if (typeof height === "number" && height < CHAPTER_IMAGE_FILTERS.minHeightPx) {
    return { keep: false, reason: `height_too_small(<${CHAPTER_IMAGE_FILTERS.minHeightPx})` };
  }

  return { keep: true, width, height };
}

async function uploadRemoteImage(
  remoteUrl: string,
  options: {
    prefixPath: string;
    filenameHintBase: string;
    maxSizeInBytes?: number;
    timeoutMs?: number;
    retries?: number;
    headers?: Record<string, string>;
  },
): Promise<UploadedRemoteFile> {
  const { buffer, contentType } = await fetchRemoteBufferWithRetry(remoteUrl, {
    timeoutMs: options.timeoutMs,
    headers: options.headers,
    retries: options.retries,
    retryDelayMs: 800,
  });

  return uploadImageBuffer(remoteUrl, buffer, contentType, {
    prefixPath: options.prefixPath,
    filenameHintBase: options.filenameHintBase,
    maxSizeInBytes: options.maxSizeInBytes,
  });
}

const findLabelSection = ($: CheerioAPI, label: string) => {
  const normalized = label.trim().toLowerCase();
  const candidates = $("span")
    .filter((_, el) => $(el).text().trim().toLowerCase().startsWith(normalized))
    .toArray();
  if (!candidates.length) {
    return null;
  }

  const preferredEl =
    candidates.find((el) => /[:：]/.test($(el).text())) ?? candidates[candidates.length - 1];
  const preferred = $(preferredEl);
  const parent = preferred.parent();
  return parent.length ? parent : preferred;
};

const extractLabeledText = ($: CheerioAPI, label: string) => {
  const section = findLabelSection($, label);
  if (!section) return undefined;
  const clone = section.clone();
  clone.find("span").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.startsWith(label.trim().toLowerCase())) {
      $(el).remove();
    }
  });
  return clone.text().replace(/[:：]/, "").trim().replace(/\s+/g, " ");
};

const parseNumeric = (value?: string | null) => {
  if (!value) return 0;
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10) || 0;
};

const parseGenres = ($: CheerioAPI) => {
  const section = findLabelSection($, "Thể loại");
  if (!section) return [] as string[];
  return section
    .find("a")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
};

const parseAuthorNames = ($: CheerioAPI) => {
  const section = findLabelSection($, "Tác giả");
  if (!section) {
    const fallback = sanitizeWhitespace(extractLabeledText($, "Tác giả"));
    return fallback ? [fallback] : [];
  }

  const anchors = section
    .find("a")
    .map((_, el) => sanitizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  if (anchors.length) {
    return Array.from(new Set(anchors));
  }

  const fallback = sanitizeWhitespace(extractLabeledText($, "Tác giả"));
  return fallback ? [fallback] : [];
};

const splitLabelListValues = (value?: string | null) => {
  const cleaned = sanitizeWhitespace(value);
  if (!cleaned) return [] as string[];
  return cleaned
    .split(/[,/|;]/)
    .map((part) => sanitizeWhitespace(part))
    .filter(Boolean);
};

const parseLabeledEntityList = ($: CheerioAPI, labels: string[]) => {
  const collected = new Map<string, string>();
  const addValue = (value?: string | null) => {
    const name = sanitizeWhitespace(value);
    if (!name) return;
    const key = name.toLowerCase();
    if (collected.has(key)) return;
    collected.set(key, name);
  };

  for (const label of labels) {
    const section = findLabelSection($, label);
    if (section) {
      const anchors = section
        .find("a")
        .map((_, el) => sanitizeWhitespace($(el).text()))
        .get()
        .filter(Boolean);
      if (anchors.length) {
        anchors.forEach(addValue);
        continue;
      }
    }
    const fallbackValues = splitLabelListValues(extractLabeledText($, label));
    fallbackValues.forEach(addValue);
  }

  return Array.from(collected.values());
};

const parseDoujinshiNames = ($: CheerioAPI) => parseLabeledEntityList($, ["Doujinshi", "Bộ truyện", "Series"]);

const parseCharacterNames = ($: CheerioAPI) => parseLabeledEntityList($, ["Nhân vật", "Characters", "Character"]);

const parseChapterCount = ($: CheerioAPI) => {
  const header = $("div")
    .filter((_, el) => $(el).find("span").first().text().trim().startsWith("Danh sách chương"))
    .first();
  if (!header.length) return 0;
  const headerText = sanitizeWhitespace(header.text());
  const headerCountMatch = headerText.match(/\((\d+)\)/);
  if (headerCountMatch?.[1]) {
    const n = Number.parseInt(headerCountMatch[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const list = header.nextAll("ul").first();
  if (!list.length) return 0;
  const anchorCount = list.find("a").length;
  if (anchorCount > 0) return anchorCount;
  return list.find("li").length;
};

type ViHentaiChapterEntry = {
  title: string;
  url: string;
  updatedText?: string;
};

type ViHentaiChapterListResult = {
  entries: ViHentaiChapterEntry[];
  expectedCount?: number;
  sourceOrder: "asc" | "desc" | "unknown";
};

const extractChapterNumber = (value?: string) => {
  const text = sanitizeWhitespace(value).toLowerCase();
  if (!text) return undefined;
  const m = text.match(/(?:chuong|ch\s*ương|chapter|chap)\s*(\d+(?:\.\d+)?)/i);
  if (m?.[1]) return Number.parseFloat(m[1]);
  const m2 = text.match(/\b(\d+(?:\.\d+)?)\b/);
  if (m2?.[1]) return Number.parseFloat(m2[1]);
  return undefined;
};

const extractChapterNumberFromUrl = (url: string) => {
  const m = url.match(/(?:chapter|chuong|chap)[^0-9]*(\d+(?:\.\d+)?)/i);
  if (m?.[1]) return Number.parseFloat(m[1]);
  return undefined;
};

const detectChapterListOrder = (entries: ViHentaiChapterEntry[]) => {
  if (entries.length < 2) return "unknown" as const;
  const first = extractChapterNumber(entries[0].title) ?? extractChapterNumberFromUrl(entries[0].url);
  const last =
    extractChapterNumber(entries[entries.length - 1].title) ??
    extractChapterNumberFromUrl(entries[entries.length - 1].url);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return "unknown" as const;
  if ((first as number) < (last as number)) return "asc" as const;
  if ((first as number) > (last as number)) return "desc" as const;
  return "unknown" as const;
};

const findChapterListUl = ($: CheerioAPI) => {
  const header = $("div")
    .filter((_, el) => $(el).find("span").first().text().trim().startsWith("Danh sách chương"))
    .first();

  if (!header.length) return { header: null as Cheerio<Element> | null, list: null as Cheerio<Element> | null };

  const candidates = [
    header.nextAll("ul").first(),
    header.parent().nextAll("ul").first(),
    header.closest("section,div").find("ul").first(),
  ].filter((it) => it && it.length);

  const list = candidates[0] ?? null;
  return { header, list };
};

const isViHentaiChapterUrl = (candidateUrl: string, baseUrl: string) => {
  // Most chapters are /chapter-xx, /chap-xx, /chuong-xx, but some are /oneshot.
  if (/chuong|chapter|chap/i.test(candidateUrl)) return true;
  try {
    const base = new URL(baseUrl);
    const u = new URL(candidateUrl, baseUrl);
    const mangaPath = base.pathname.replace(/\/+$/, "");
    const candidatePath = u.pathname.replace(/\/+$/, "");
    if (!mangaPath || !candidatePath.startsWith(`${mangaPath}/`)) return false;
    const rest = candidatePath.slice(mangaPath.length + 1);
    // Expect exactly one segment under the manga path (e.g. /truyen/foo/oneshot).
    if (!rest || rest.includes("/")) return false;
    // Avoid misclassifying the manga page itself.
    if (rest === "#" || rest === "?" || rest === "") return false;
    // Be conservative: only accept same-host links.
    if (u.host && base.host && u.host !== base.host) return false;
    return true;
  } catch {
    return false;
  }
};

const getVisibleChapterTitle = ($: CheerioAPI, anchor: Cheerio<Element>) => {
  // Prefer the actual visible chapter title element in the list (avoids view counts / icons / timeago).
  const direct = sanitizeWhitespace(anchor.find(".text-ellipsis").first().text());
  if (direct) return direct;

  const cloned = anchor.clone();
  cloned.find("time").remove();
  cloned.find(".time").remove();
  cloned.find(".timeago").remove();
  cloned.find(".abbreviation-number").remove();
  cloned.find("svg").remove();
  cloned.find("small").remove();
  const text = sanitizeWhitespace(cloned.text()) || sanitizeWhitespace(anchor.attr("title"));
  return text;
};

const parseChapterList = ($: CheerioAPI, baseUrl: string): ViHentaiChapterListResult => {
  const collected: ViHentaiChapterEntry[] = [];

  const { header, list } = findChapterListUl($);
  if (!header || !list || !list.length) {
    throw new Error("Không tìm thấy danh sách chương (ul) từ mục 'Danh sách chương'");
  }

  const expectedCount = parseChapterCount($) || undefined;

  const add = (href: string | undefined, title: string, updatedText?: string) => {
    const h = sanitizeWhitespace(href);
    if (!h) return;
    let url: string;
    try {
      url = new URL(h, baseUrl).toString();
    } catch {
      url = h;
    }
    if (!url) return;
    // Always use the real href; this function only validates that the href is plausibly a chapter.
    if (!isViHentaiChapterUrl(url, baseUrl)) return;
    collected.push({ title: sanitizeWhitespace(title) || "", url, updatedText: sanitizeWhitespace(updatedText) || undefined });
  };

  // Source of truth: actual <a href> inside the chapter list.
  // This avoids ever “guessing” the URL from the title.
  const anchors = list
    .find("a[href]")
    .filter((_, el) => {
      const href = $(el).attr("href") || "";
      if (!href) return false;
      const h = href.trim().toLowerCase();
      if (!h || h.startsWith("javascript:")) return false;
      // Usually the chapter list is rendered as <ul><a><li>..</li></a></ul>.
      // Keep anchors that are part of list items.
      return $(el).find("li").length > 0 || $(el).parent("li").length > 0;
    })
    .toArray();

  for (const el of anchors) {
    const a = $(el);
    const href = a.attr("href");
    if (!href) continue;

    const li = a.find("li").first().length ? a.find("li").first() : a.closest("li");
    const title = getVisibleChapterTitle($, a) || "";
    const updatedText =
      sanitizeWhitespace(li.find("time").first().attr("datetime")) ||
      sanitizeWhitespace(li.find("time").first().text()) ||
      sanitizeWhitespace(li.find(".timeago").first().attr("datetime")) ||
      sanitizeWhitespace(li.find(".time").first().text()) ||
      sanitizeWhitespace(a.find("time").first().attr("datetime")) ||
      sanitizeWhitespace(a.find(".timeago").first().attr("datetime"));

    add(href, title, updatedText);
  }

  // Deduplicate by URL while preserving order.
  const seen = new Set<string>();
  const entries = collected.filter((it) => {
    const key = it.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!entries.length) {
    throw new Error("Danh sách chương rỗng (không lấy được link chương từ mục 'Danh sách chương')");
  }

  if (expectedCount && entries.length !== expectedCount) {
    throw new Error(`Số chương không khớp: header=${expectedCount}, parsed=${entries.length}. Không tiếp tục để tránh sai dữ liệu.`);
  }

  const sourceOrder = detectChapterListOrder(entries);

  return { entries, expectedCount, sourceOrder };
};

export async function fetchViHentaiChapterList(url: string): Promise<ViHentaiChapterListResult> {
  const html = await fetchHtml(url);
  const $ = load(html);
  return parseChapterList($, url);
}

const parseViHentaiDatetime = (raw?: string | null) => {
  const value = sanitizeWhitespace(raw);
  if (!value) return undefined;
  // Most pages use: "YYYY-MM-DD HH:mm:ss" (no timezone). Treat as Asia/Ho_Chi_Minh (+07:00).
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}+07:00`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Fallback: dd/mm/yyyy or dd-mm-yyyy (optionally time)
  const m2 = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m2) {
    const dd = m2[1].padStart(2, "0");
    const mm = m2[2].padStart(2, "0");
    const yyyy = m2[3];
    const hh = (m2[4] ?? "00").padStart(2, "0");
    const min = m2[5] ?? "00";
    const ss = (m2[6] ?? "00").padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+07:00`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return undefined;
};

const normalizeAnyUrl = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return trimmed;
};

const parseChapterImagesFromHtml = (html: string, baseUrl: string): string[] => {
  const $ = load(html);
  const urls: string[] = [];

  const selectors = [
    ".reading-content img",
    ".chapter-content img",
    ".reader img",
    ".content img",
    "article img",
    "img",
  ];

  const pushUrl = (raw?: string | null) => {
    const normalized = normalizeAnyUrl(raw);
    if (!normalized) return;
    let abs = normalized;
    try {
      abs = new URL(normalized, baseUrl).toString();
    } catch {
      // ignore
    }
    if (!/^https?:/i.test(abs)) return;
    urls.push(abs);
  };

  for (const selector of selectors) {
    $(selector)
      .toArray()
      .forEach((el) => {
        const img = $(el);
        const attrs = ["data-src", "data-original", "data-lazy", "data-lazy-src", "src"] as const;
        for (const attr of attrs) {
          const v = img.attr(attr);
          if (v) {
            pushUrl(v);
            return;
          }
        }
        const srcset = img.attr("srcset")?.split(",")[0]?.trim().split(" ")[0];
        if (srcset) pushUrl(srcset);
      });
    if (urls.length) break;
  }

  // Dedup preserve order
  const seen = new Set<string>();
  return urls.filter((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
};

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers = new Array(Math.max(1, limit)).fill(null).map(async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) break;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

const parseFollowNumber = ($: CheerioAPI) => {
  const button = $("button")
    .filter((_, el) => $(el).text().toLowerCase().includes("theo dõi"))
    .first();
  if (!button.length) return 0;
  const match = button.text().match(/\((\d+)\)/);
  return match ? Number.parseInt(match[1], 10) : 0;
};

const normalizePosterUrl = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return trimmed;
};

const parsePosterFromStyle = (style?: string | null) => {
  if (!style) return undefined;
  const match = style.match(/url\((['"]?)(?<url>.+?)\1\)/);
  return normalizePosterUrl(match?.groups?.url);
};

const extractImageFromElement = ($element: Cheerio<Element>) => {
  const candidateImages: Array<Cheerio<Element>> = [];
  if ($element.is("img")) {
    candidateImages.push($element);
  }
  const firstChildImg = $element.find("img").first();
  if (firstChildImg.length) {
    candidateImages.push(firstChildImg);
  }

  for (const img of candidateImages) {
    const attrs = ["data-src", "data-original", "data-lazy", "data-lazy-src", "src"] as const;
    for (const attr of attrs) {
      const value = normalizePosterUrl(img.attr(attr));
      if (value) {
        return value;
      }
    }
    const srcset = img.attr("srcset")?.split(",")[0]?.trim().split(" ")[0];
    const srcsetUrl = normalizePosterUrl(srcset);
    if (srcsetUrl) {
      return srcsetUrl;
    }
  }

  const styleUrl = parsePosterFromStyle($element.attr("style"));
  if (styleUrl) {
    return styleUrl;
  }

  const backgroundAttr = $element.attr("data-bg") || $element.attr("data-background");
  return normalizePosterUrl(backgroundAttr);
};

const extractPosterFromDom = ($: CheerioAPI) => {
  for (const selector of COVER_CANDIDATE_SELECTORS) {
    const node = $(selector).first();
    if (!node.length) continue;
    const url = extractImageFromElement(node as Cheerio<Element>);
    if (url) {
      return url;
    }
  }

  for (const containerSelector of COVER_CONTAINER_SELECTORS) {
    const container = $(containerSelector).first();
    if (!container.length) continue;
    const direct = extractImageFromElement(container as Cheerio<Element>);
    if (direct) {
      return direct;
    }
    const fallbackNode = container.find(".cover, .poster, img, figure").first();
    if (fallbackNode.length) {
      const url = extractImageFromElement(fallbackNode as Cheerio<Element>);
      if (url) {
        return url;
      }
    }
  }

  return undefined;
};

const inferUserStatus = (text?: string) => {
  if (!text) return MANGA_USER_STATUS.ON_GOING;
  const normalized = text.toLowerCase();
  if (normalized.includes("hoàn") || normalized.includes("complete") || normalized.includes("xong")) {
    return MANGA_USER_STATUS.COMPLETED;
  }
  return MANGA_USER_STATUS.ON_GOING;
};

const parsePage = (html: string, url: string): ParsedViHentaiPage => {
  const $ = load(html);

  const titleFromDom = extractTitleFromDom($);
  const fallbackTitle =
    $("meta[property='og:title']").attr("content")?.trim() || $("title").text().trim();
  const title = sanitizeTitle(titleFromDom || fallbackTitle);
  if (!title) {
    throw new Error("Không tìm thấy tiêu đề từ trang nguồn");
  }

  const rawDescription =
    $("meta[property='og:description']").attr("content")?.trim() ||
    $("meta[name='description']").attr("content")?.trim();
  const normalizedTitle = sanitizeWhitespace(title);
  const description = sanitizeDescription(rawDescription);
  const trimmedDescription = stripTrailingTitleSuffix(description, normalizedTitle);
  const safeDescription = trimmedDescription && trimmedDescription !== normalizedTitle ? trimmedDescription : "";

  const poster =
    extractPosterFromDom($) ||
    normalizePosterUrl($("meta[property='og:image']").attr("content")) ||
    normalizePosterUrl($("meta[name='twitter:image']").attr("content")) ||
    parsePosterFromStyle($(".cover-frame").first().attr("style"));
  if (!poster) {
    throw new Error("Không tìm thấy ảnh bìa (poster)");
  }

  const rawGenres = parseGenres($);
  const doujinshiNames = parseDoujinshiNames($);
  const characterNames = parseCharacterNames($);
  const alternateTitle = sanitizeWhitespace(extractLabeledText($, "Tên khác"));
  const authorNames = parseAuthorNames($);
  const executorNames = parseLabeledEntityList($, ["Thực hiện", "Thuc hien", "Thực Hiện"]);
  const translationTeam = sanitizeWhitespace(extractLabeledText($, "Nhóm dịch"));
  const statusText = sanitizeWhitespace(extractLabeledText($, "Tình trạng"));
  const viewSection = findLabelSection($, "Lượt xem");
  const viewNumber = viewSection
    ? parseNumeric(viewSection.find(".abbreviation-number").attr("abbreviation") || viewSection.text())
    : 0;
  const chapterCount = parseChapterCount($);
  const followNumber = parseFollowNumber($);
  const codeLabel = extractLabeledText($, "Code");

  const lastUpdateSection = findLabelSection($, "Lần cuối");
  const lastUpdatedText = sanitizeWhitespace(lastUpdateSection?.text()) || undefined;
  const lastUpdatedDatetime =
    lastUpdateSection?.find("[datetime]").first().attr("datetime") ||
    lastUpdateSection?.find(".timeago").first().attr("datetime") ||
    undefined;
  const lastUpdatedAt = parseViHentaiDatetime(lastUpdatedDatetime) || undefined;

  return {
    title,
    alternateTitle,
    description: safeDescription,
    poster,
    rawGenres,
    authorNames,
    doujinshiNames,
    characterNames,
    executorNames,
    translationTeam,
    statusText,
    viewNumber,
    followNumber,
    chapterCount,
    codeLabel,
    lastUpdatedText,
    lastUpdatedAt,
    url,
  };
};

const mapGenres = async (rawGenres: string[]) => {
  const matched: string[] = [];
  const unknown: string[] = [];
  const unresolved: Array<{ label: string; key: string }> = [];

  for (const label of rawGenres) {
    const key = slugify(label);
    if (!key) continue;
    const compactKey = key.replace(/-/g, "");
    const slug = GENRE_LOOKUP.get(key) || GENRE_LOOKUP.get(compactKey);
    if (slug) {
      if (!matched.includes(slug)) {
        matched.push(slug);
      }
    } else {
      unresolved.push({ label, key });
    }
  }

  // Fallback: nếu build runtime không load được scripts/genres.array.cjs,
  // hãy thử map theo DB genres (slug) để tránh lỗi "Không map được: Bestiality".
  if (unresolved.length) {
    const uniqueKeys = Array.from(new Set(unresolved.map((it) => it.key))).filter(Boolean);
    if (uniqueKeys.length) {
      const docs = await GenresModel.find({ slug: { $in: uniqueKeys } })
        .select({ slug: 1 })
        .lean();

      const found = new Set(
        docs
          .map((d: any) => String(d?.slug || "").trim().toLowerCase())
          .filter(Boolean),
      );

      // cache vào lookup để các lần sau không query DB nữa
      for (const slug of found) {
        GENRE_LOOKUP.set(slug, slug);
        GENRE_LOOKUP.set(slug.replace(/-/g, ""), slug);
      }

      for (const { label, key } of unresolved) {
        const normalizedKey = String(key || "").trim().toLowerCase();
        if (normalizedKey && found.has(normalizedKey)) {
          if (!matched.includes(normalizedKey)) matched.push(normalizedKey);
        } else {
          unknown.push(label);
        }
      }
    } else {
      unresolved.forEach((it) => unknown.push(it.label));
    }
  }

  return { matched, unknown };
};

type TranslatorMeta = {
  translationTeam: string;
  translatorNames: string[];
  translatorSlugs: string[];
};

const normalizeTranslatorName = (value?: string | null) => {
  const trimmed = sanitizeWhitespace(value);
  if (!trimmed) return "";
  const normalized = trimmed.replace(/^nh[oó]m\s*[:：-]?\s*/i, "").trim();
  return normalized || trimmed;
};

const buildTranslatorMeta = (primary?: string, fallback?: string): TranslatorMeta => {
  const normalizedPrimary = normalizeTranslatorName(primary);
  const normalizedFallback = normalizeTranslatorName(fallback);
  const selected = normalizedPrimary || normalizedFallback;
  const translationTeam = selected || sanitizeWhitespace(primary) || sanitizeWhitespace(fallback) || "Auto-import";
  if (!selected) {
    return {
      translationTeam,
      translatorNames: [],
      translatorSlugs: [],
    };
  }
  const slugBase = slugify(selected) || selected.replace(/\s+/g, "-").toLowerCase();
  return {
    translationTeam,
    translatorNames: [selected],
    translatorSlugs: [slugBase],
  };
};

const buildKeywords = (
  statusText?: string,
  translationTeam?: string,
  rawGenres?: string[],
  codeLabel?: string,
  authorNames?: string[],
  alternateTitle?: string,
  doujinshiNames?: string[],
  characterNames?: string[],
) => {
  const parts = [
    statusText,
    translationTeam,
    rawGenres?.join(", "),
    codeLabel,
    authorNames?.join(", "),
    alternateTitle,
    doujinshiNames?.join(", "),
    characterNames?.join(", "),
  ]
    .map((part) => sanitizeWhitespace(part))
    .filter(Boolean);
  const joined = parts.join(" | ");
  return joined || undefined;
};

const normalizeNameList = (values?: string[]) => {
  if (!Array.isArray(values) || !values.length) {
    return [] as string[];
  }
  return values.map((value) => sanitizeWhitespace(value)).filter(Boolean);
};

const mergeUniqueNames = (primary: string[], secondary: string[]) => {
  const map = new Map<string, string>();
  primary.forEach((name) => {
    const key = name.toLowerCase();
    if (!map.has(key)) map.set(key, name);
  });
  secondary.forEach((name) => {
    const key = name.toLowerCase();
    if (!map.has(key)) map.set(key, name);
  });
  return Array.from(map.values());
};

const buildSlugListForNames = (names: string[], fallbackPrefix: string) => {
  const used = new Set<string>();
  return names.map((name, index) => {
    const base = slugify(name) || `${fallbackPrefix}-${index + 1}`;
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) {
      slug = `${base}-${suffix++}`;
    }
    used.add(slug);
    return slug;
  });
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
type NameSlugDocument = { name: string; slug: string };

const ensureUniqueSlugForModel = async <T extends NameSlugDocument>(
  model: Model<T>,
  base: string,
  fallbackPrefix: string,
) => {
  const safeBase = base || fallbackPrefix;
  let slug = safeBase;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (await model.exists({ slug })) {
    slug = `${safeBase}-${suffix++}`;
    if (suffix > 200) {
      slug = `${safeBase}-${Date.now()}`;
      break;
    }
  }
  return slug;
};

const ensureNamedDocuments = async <T extends NameSlugDocument>(
  model: Model<T>,
  names?: string[],
  slugs?: string[],
  slugPrefix = "entity",
) => {
  if (!names?.length) {
    return { names: [] as string[], slugs: [] as string[] };
  }

  const ensuredNames: string[] = [];
  const ensuredSlugs: string[] = [];

  for (let i = 0; i < names.length; i += 1) {
    const name = sanitizeWhitespace(names[i]);
    if (!name) continue;
    const slugHint = sanitizeWhitespace(slugs?.[i]);
    const slugBase = slugify(slugHint || name) || `${slugPrefix}-${Date.now()}-${i}`;

    const existingBySlug = await model.findOne({ slug: slugBase }).lean();
    if (existingBySlug) {
      ensuredNames.push(existingBySlug.name);
      ensuredSlugs.push(existingBySlug.slug);
      continue;
    }

    const existingByName = await model
      .findOne({ name: { $regex: new RegExp(`^${escapeRegExp(name)}$`, "i") } })
      .lean();
    if (existingByName) {
      ensuredNames.push(existingByName.name);
      ensuredSlugs.push(existingByName.slug);
      continue;
    }

    const uniqueSlug = await ensureUniqueSlugForModel(model, slugBase, slugPrefix);
    const doc = await model.create({ name, slug: uniqueSlug } as T);
    ensuredNames.push(doc.name);
    ensuredSlugs.push(doc.slug);
  }

  if (!ensuredNames.length) {
    return { names: [] as string[], slugs: [] as string[] };
  }

  return { names: ensuredNames, slugs: ensuredSlugs };
};

const ensureTranslatorDocuments = async <T extends { translatorNames: string[]; translatorSlugs: string[] }>(
  payload: T,
) => {
  const ensured = await ensureNamedDocuments(TranslatorModel, payload.translatorNames, payload.translatorSlugs, "translator");
  return {
    ...payload,
    translatorNames: ensured.names,
    translatorSlugs: ensured.slugs,
  };
};

const ensureDoujinshiDocuments = async <T extends { doujinshiNames: string[]; doujinshiSlugs: string[] }>(
  payload: T,
) => {
  const ensured = await ensureNamedDocuments(DoujinshiModel, payload.doujinshiNames, payload.doujinshiSlugs, "doujinshi");
  return {
    ...payload,
    doujinshiNames: ensured.names,
    doujinshiSlugs: ensured.slugs,
  };
};

const ensureAuthorDocuments = async <T extends { authorNames?: string[]; authorSlugs?: string[]; author?: string }>(
  payload: T,
) => {
  const ensured = await ensureNamedDocuments(AuthorModel as any, payload.authorNames, payload.authorSlugs, "author");
  return {
    ...payload,
    authorNames: ensured.names,
    authorSlugs: ensured.slugs,
    author: ensured.names.length ? ensured.names.join(", ") : payload.author,
  };
};

const ensureCharacterDocuments = async <T extends { characterNames: string[]; characterSlugs: string[] }>(
  payload: T,
) => {
  const ensured = await ensureNamedDocuments(CharacterModel, payload.characterNames, payload.characterSlugs, "character");
  return {
    ...payload,
    characterNames: ensured.names,
    characterSlugs: ensured.slugs,
  };
};

const prepareBaseMangaPayload = (
  parsed: ParsedViHentaiPage,
  options: Omit<ViHentaiImportOptions, "url">,
  matchedGenres: string[],
) => {
  const translatorMeta = buildTranslatorMeta(options.translationTeam, parsed.translationTeam);
  const executorNames = normalizeNameList(parsed.executorNames);
  const userStatus = options.userStatusOverride ?? inferUserStatus(parsed.statusText);
  const contentType = options.contentType ?? MANGA_CONTENT_TYPE.MANGA;
  const authorList = normalizeNameList(parsed.authorNames);
  const authorSlugs = buildSlugListForNames(authorList, "author");
  const doujinshiNames = normalizeNameList(parsed.doujinshiNames);
  const characterNames = normalizeNameList(parsed.characterNames);
  const doujinshiSlugs = buildSlugListForNames(doujinshiNames, "doujinshi");
  const characterSlugs = buildSlugListForNames(characterNames, "character");
  const translatorNames = mergeUniqueNames(translatorMeta.translatorNames, executorNames);
  const translatorSlugs = buildSlugListForNames(translatorNames, "translator");
  const keywords = buildKeywords(
    parsed.statusText,
    translatorMeta.translationTeam,
    parsed.rawGenres,
    parsed.codeLabel,
    authorList,
    parsed.alternateTitle,
    doujinshiNames,
    characterNames,
  );
  const author = authorList.length ? authorList.join(", ") : undefined;

  return {
    title: parsed.title,
    alternateTitle: parsed.alternateTitle || undefined,
    description: sanitizeDescription(parsed.description) || "",
    poster: parsed.poster,
    genres: matchedGenres,
    author,
    authorNames: authorList,
    authorSlugs,
    translationTeam: translatorMeta.translationTeam,
    translatorNames,
    translatorSlugs,
    doujinshiNames,
    doujinshiSlugs,
    characterNames,
    characterSlugs,
    ownerId: options.ownerId,
    status: options.approve ? MANGA_STATUS.APPROVED : MANGA_STATUS.PENDING,
    userStatus,
    keywords,
    contentType,
  };
};

export const fetchViHentaiPage = async (url: string) => {
  const html = await fetchHtml(url);
  return parsePage(html, url);
};

type BasePayload = ReturnType<typeof prepareBaseMangaPayload>;

export const buildMangaPayloadFromViHentai = async (
  parsed: ParsedViHentaiPage,
  options: Omit<ViHentaiImportOptions, "url">,
  matchedGenres: string[],
  basePayload?: BasePayload,
) => {
  const prepared = basePayload ?? prepareBaseMangaPayload(parsed, options, matchedGenres);
  const slug = options.slugOverride || (await generateUniqueMangaSlug(prepared.title));

  return {
    ...prepared,
    slug,
  };
};
import { dropVanillaWhenAntiVanillaPresent } from "~/constants/vanilla-anti-tags";

export async function importViHentaiManga(options: ViHentaiImportOptions): Promise<ViHentaiImportResult> {
  if (!options.url) throw new Error("Thiếu URL nguồn");
  if (!options.ownerId) throw new Error("Thiếu ownerId");

  const parsed = await fetchViHentaiPage(options.url);
  const mapped = await mapGenres(parsed.rawGenres);
  const matched = dropVanillaWhenAntiVanillaPresent(mapped.matched);
  const unknown = mapped.unknown;
  if (!matched.length) {
    console.warn(
      "[importViHentaiManga] No mapped genres; continuing with empty genres.",
      { url: options.url, rawGenres: parsed.rawGenres, unknownGenres: unknown },
    );
  }

  const basePayload = prepareBaseMangaPayload(parsed, options, matched);

  if (options.skipIfExists) {
    const existing = await MangaModel.findOne({ title: parsed.title })
      .select({ _id: 1, slug: 1 })
      .lean();
    if (existing) {
      return {
        url: options.url,
        parsed,
        matchedGenres: matched,
        unknownGenres: unknown,
        payload: {
          ...basePayload,
          slug: String(existing.slug || existing._id),
        },
        mode: "skipped",
        message: "Bỏ qua vì đã tồn tại truyện cùng tên",
        createdSlug: String(existing.slug || existing._id),
      };
    }
  }

  let payload = await buildMangaPayloadFromViHentai(parsed, options, matched, basePayload);

  if (options.dryRun) {
    return {
      url: options.url,
      parsed,
      matchedGenres: matched,
      unknownGenres: unknown,
      payload,
      mode: "dry-run",
      message: "Dry-run: chỉ hiển thị payload, không ghi DB",
    };
  }

  payload = await ensureTranslatorDocuments(payload);
  payload = await ensureAuthorDocuments(payload);
  payload = await ensureDoujinshiDocuments(payload);
  payload = await ensureCharacterDocuments(payload);

  const doc = await MangaModel.create(payload);
  return {
    url: options.url,
    parsed,
    matchedGenres: matched,
    unknownGenres: unknown,
    payload,
    mode: "created",
    message: "Tạo truyện thành công",
    createdId: String(doc._id),
    createdSlug: doc.slug,
  };
}

export async function autoDownloadViHentaiManga(
  options: ViHentaiAutoDownloadOptions,
): Promise<ViHentaiAutoDownloadResult> {
  const {
    request,
    downloadPoster = true,
    downloadChapters = true,
    asSystem = false,
    maxChapters = 500,
    maxImagesPerChapter = 300,
    continueOnChapterError = true,
    imageDelayMs = 50,
    imageTimeoutMs = 30_000,
    imageRetries = 2,
    chapterDelayMs = 2_000,
    abortSignal,
    shouldAbort,
    onProgress,
    ...importOptions
  } = options;

  let lastAbortCheckAt = 0;
  let cachedAbortReason: string | undefined;
  const checkAbort = async () => {
    if (abortSignal?.aborted) throw new ViHentaiForcedPauseError();
    if (!shouldAbort) return;

    const now = Date.now();
    if (cachedAbortReason) throw new ViHentaiForcedPauseError(cachedAbortReason);
    if (now - lastAbortCheckAt < 400) return;
    lastAbortCheckAt = now;

    const reason = await shouldAbort();
    if (reason) {
      cachedAbortReason = reason;
      throw new ViHentaiForcedPauseError(reason);
    }
  };

  const emitProgress = async (payload: Parameters<NonNullable<typeof onProgress>>[0]) => {
    if (!onProgress) return;
    try {
      await onProgress(payload);
    } catch {
      // Progress must never break the download flow.
    }
  };

  // Step 1: create Manga (same as import)
  await checkAbort();
  await emitProgress({ stage: "manga", message: "Đang tải trang truyện..." });
  const parsed = await fetchViHentaiPage(importOptions.url);
  await checkAbort();
  await emitProgress({ stage: "manga", message: `Đã parse truyện: ${parsed.title || ""}`.trim() });
  const mapped = await mapGenres(parsed.rawGenres);
  const matched = dropVanillaWhenAntiVanillaPresent(mapped.matched);
  const unknown = mapped.unknown;
  if (!matched.length) {
    const warning = `Cảnh báo: không map được thể loại hợp lệ (nhận được: ${parsed.rawGenres.join(", ") || "<empty>"}). Sẽ tạo truyện với 0 thể loại.`;
    console.warn("[autoDownloadViHentaiManga]", warning);
    await emitProgress({ stage: "manga", message: warning });
  }

  const basePayload = prepareBaseMangaPayload(parsed, importOptions, matched);

  if (importOptions.skipIfExists) {
    const existing = await MangaModel.findOne({ title: parsed.title })
      .select({ _id: 1, slug: 1 })
      .lean();
    if (existing) {
      return {
        url: importOptions.url,
        parsed,
        matchedGenres: matched,
        unknownGenres: unknown,
        payload: {
          ...basePayload,
          slug: String(existing.slug || existing._id),
        },
        mode: "skipped",
        message: "Bỏ qua vì đã tồn tại truyện cùng tên",
        createdSlug: String(existing.slug || existing._id),
        chaptersImported: 0,
        imagesUploaded: 0,
        chapterErrors: [],
      };
    }
  }

  let payload = await buildMangaPayloadFromViHentai(parsed, importOptions, matched, basePayload);

  // Optional: download poster to our storage and store CDN URL
  if (downloadPoster) {
    await checkAbort();
    await emitProgress({ stage: "poster", message: "Đang tải poster..." });
    try {
      const fetchedPoster = await fetchRemoteBufferWithRetry(parsed.poster, {
        timeoutMs: imageTimeoutMs,
        retries: imageRetries,
        retryDelayMs: 800,
        signal: abortSignal,
        headers: {
          ...HEADERS,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          Referer: importOptions.url,
          Origin: new URL(importOptions.url).origin,
        },
      });

      const normalizedPoster = await normalizePosterBuffer(fetchedPoster.buffer, {
        contentType: fetchedPoster.contentType,
      });

      const uploaded = await uploadImageBuffer(parsed.poster, normalizedPoster.buffer, normalizedPoster.contentType, {
        prefixPath: "manga-posters",
        filenameHintBase: "poster",
        maxSizeInBytes: 9 * 1024 * 1024,
      });

      payload = { ...payload, poster: uploaded.url };
      await emitProgress({ stage: "poster", message: "Poster OK" });
    } catch (e) {
      // Keep original remote poster as fallback
      console.warn("[autoDownloadViHentaiManga] poster download failed", e);
      await emitProgress({ stage: "poster", message: "Poster lỗi (fallback dùng link nguồn)" });
    }
  }

  if (importOptions.dryRun) {
    return {
      url: importOptions.url,
      parsed,
      matchedGenres: matched,
      unknownGenres: unknown,
      payload,
      mode: "dry-run",
      message: "Dry-run: chỉ hiển thị payload, không ghi DB",
      chaptersImported: 0,
      imagesUploaded: 0,
      chapterErrors: [],
    };
  }

  payload = await ensureTranslatorDocuments(payload);
  payload = await ensureAuthorDocuments(payload);
  payload = await ensureDoujinshiDocuments(payload);
  payload = await ensureCharacterDocuments(payload);

  const doc = await MangaModel.create(payload);

  const resultBase: ViHentaiAutoDownloadResult = {
    url: importOptions.url,
    parsed,
    matchedGenres: matched,
    unknownGenres: unknown,
    payload,
    mode: "created",
    message: "Tạo truyện thành công",
    createdId: String(doc._id),
    createdSlug: doc.slug,
    chaptersImported: 0,
    imagesUploaded: 0,
    chapterErrors: [],
  };

  if (!downloadChapters) {
    return {
      ...resultBase,
      message: "Tạo truyện thành công (không tải chương)",
    };
  }

  // Step 2: fetch chapter list and import from oldest -> newest
  await checkAbort();
  await emitProgress({ stage: "chapters", message: "Đang lấy danh sách chương..." });
  const chapterList = await fetchViHentaiChapterList(importOptions.url);
  const chapters = chapterList.entries;
  if (!chapters.length) {
    throw new Error("Danh sách chương rỗng");
  }

  const limit = maxChapters && maxChapters > 0 ? Math.min(chapters.length, maxChapters) : chapters.length;

  // Prefer oldest N chapters.
  // - If source is desc (newest -> oldest): oldest are at the end
  // - If source is asc (oldest -> newest): oldest are at the beginning
  const limited =
    limit >= chapters.length
      ? chapters
      : chapterList.sourceOrder === "asc"
        ? chapters.slice(0, limit)
        : chapters.slice(-limit);

  // Ensure import order is oldest -> newest
  const ordered =
    chapterList.sourceOrder === "asc" ? limited.slice() : limited.slice().reverse();

  await emitProgress({
    stage: "chapters",
    message: `Sẽ tải ${ordered.length} chương (oldest → newest)`,
    chapterCount: ordered.length,
  });

  // Lazy import to avoid circular dependency at module load.
  const { createChapter, createChapterAsAdmin } = await import("~/.server/mutations/chapter.mutation");

  for (let chapterIndex = 0; chapterIndex < ordered.length; chapterIndex += 1) {
    await checkAbort();
    const chapterEntry = ordered[chapterIndex];
    const chapterUrl = chapterEntry.url;
    const chapterPrefix = `manga-images/${String(doc._id)}/${String(chapterIndex + 1).padStart(4, "0")}`;

    await emitProgress({
      stage: "chapter",
      message: `Đang tải chương ${chapterIndex + 1}/${ordered.length}`,
      chapterIndex: chapterIndex + 1,
      chapterCount: ordered.length,
      chapterTitle: sanitizeWhitespace(chapterEntry.title) || undefined,
      chapterUrl,
    });

    try {
      await checkAbort();
      const html = await fetchHtml(chapterUrl);
      const imageUrls = parseChapterImagesFromHtml(html, chapterUrl);
      if (!imageUrls.length) {
        throw new Error("Không tìm thấy ảnh trong trang chương");
      }
      if (imageUrls.length > maxImagesPerChapter) {
        throw new Error(`Số ảnh vượt giới hạn: ${imageUrls.length}/${maxImagesPerChapter}`);
      }

      const uploaded: UploadedRemoteFile[] = [];
      const skipped: Array<{ url: string; reason: string }> = [];
      let keptIndex = 0;

      for (let imageIndex = 0; imageIndex < imageUrls.length; imageIndex += 1) {
        await checkAbort();
        const imgUrl = imageUrls[imageIndex];

        await emitProgress({
          stage: "image",
          message: `Ảnh ${imageIndex + 1}/${imageUrls.length}`,
          chapterIndex: chapterIndex + 1,
          chapterCount: ordered.length,
          chapterTitle: sanitizeWhitespace(chapterEntry.title) || undefined,
          chapterUrl,
          imageIndex: imageIndex + 1,
          imageCount: imageUrls.length,
          imageUrl: imgUrl,
        });

        if (imageIndex > 0 && imageDelayMs > 0) {
          await sleepAbortable(imageDelayMs, { signal: abortSignal, checkAbort });
        }

        // 1) Skip obvious non-content images early
        if (shouldSkipByUrl(imgUrl)) {
          skipped.push({ url: imgUrl, reason: "url_contains_/cover/" });
          continue;
        }

        // 2) Download (with retries) and apply content filters
        let fetched: { buffer: Buffer; contentType: string | null } | null = null;
        try {
          fetched = await fetchRemoteBufferWithRetry(imgUrl, {
            timeoutMs: imageTimeoutMs,
            retries: imageRetries,
            retryDelayMs: 800,
            signal: abortSignal,
            headers: {
              ...HEADERS,
              Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
              Referer: chapterUrl,
              Origin: new URL(chapterUrl).origin,
            },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          skipped.push({ url: imgUrl, reason: `fetch_error:${message}` });
          continue;
        }

        const decision = await shouldKeepChapterImage({
          url: imgUrl,
          buffer: fetched.buffer,
          contentType: fetched.contentType,
        });
        if (!decision.keep) {
          skipped.push({ url: imgUrl, reason: decision.reason });
          continue;
        }

        keptIndex += 1;
        try {
          const normalized = await normalizeChapterImageBuffer({
            url: imgUrl,
            buffer: fetched.buffer,
            contentType: fetched.contentType,
          });

          const uploadedOne = await uploadImageBuffer(imgUrl, normalized.buffer, normalized.contentType, {
            prefixPath: chapterPrefix,
            filenameHintBase: `page-${String(keptIndex).padStart(3, "0")}`,
            maxSizeInBytes: 9 * 1024 * 1024,
          });
          uploaded.push(uploadedOne);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          skipped.push({ url: imgUrl, reason: `upload_error:${message}` });
          continue;
        }
      }

      if (!uploaded.length) {
        const sample = skipped.slice(0, 5).map((s) => `${s.reason}`).join(", ");
        throw new Error(
          `Không còn ảnh hợp lệ sau khi lọc (đã loại ${skipped.length}/${imageUrls.length}).` +
            (sample ? ` Ví dụ lý do: ${sample}` : ""),
        );
      }

      if (skipped.length) {
        console.warn(
          "[autoDownloadViHentaiManga] filtered chapter images",
          JSON.stringify(
            {
              chapterUrl,
              total: imageUrls.length,
              kept: uploaded.length,
              skipped: skipped.length,
              sample: skipped.slice(0, 5),
            },
            null,
            0,
          ),
        );
      }

      const contentUrls = uploaded.map((u) => u.url);
      const fullPaths = uploaded.map((u) => u.fullPath).filter(Boolean);
      const totalBytes = uploaded.reduce((sum, u) => sum + (u.sizeBytes || 0), 0);

      try {
        if (asSystem) {
          await createChapterAsAdmin({
            mangaId: String(doc._id),
            title: sanitizeWhitespace(chapterEntry.title) || "",
            sourceChapterUrl: chapterUrl,
            contentUrls,
            contentBytes: totalBytes,
          } as any);
        } else {
          await createChapter(request, {
            mangaId: String(doc._id),
            title: sanitizeWhitespace(chapterEntry.title) || "",
            sourceChapterUrl: chapterUrl,
            contentUrls,
            contentBytes: totalBytes,
          } as any);
        }

        resultBase.chaptersImported += 1;
        resultBase.imagesUploaded += uploaded.length;
      } catch (e) {
        // Rollback uploaded files for this chapter
        try {
          if (fullPaths.length) await deletePublicFiles(fullPaths);
        } catch (cleanupError) {
          console.warn("[autoDownloadViHentaiManga] cleanup uploaded chapter files failed", cleanupError);
        }
        throw e;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      resultBase.chapterErrors.push({ chapterUrl, message });
      if (!continueOnChapterError) {
        resultBase.message = `Tạo truyện thành công nhưng lỗi khi tải chương: ${message}`;
        return resultBase;
      }
      // continue
    } finally {
      if (chapterIndex < ordered.length - 1 && chapterDelayMs > 0) {
        await sleepAbortable(chapterDelayMs, { signal: abortSignal, checkAbort });
      }
    }
  }

  // Step 3: update Manga.updatedAt based on source "Lần cuối".
  // Do it at the end (after chapter imports) per requested flow.
  if (parsed.lastUpdatedAt) {
    try {
      await MangaModel.updateOne(
        { _id: doc._id },
        { $set: { updatedAt: parsed.lastUpdatedAt } },
        // Prevent mongoose timestamps plugin from overriding updatedAt.
        { timestamps: false } as any,
      );
    } catch (e) {
      console.warn("[autoDownloadViHentaiManga] set updatedAt failed", e);
    }
  }

  if (resultBase.chapterErrors.length) {
    resultBase.message = `Tạo truyện thành công, tải chương xong (${resultBase.chaptersImported}/${ordered.length}) nhưng có lỗi.`;
  } else {
    resultBase.message = `Tạo truyện + tải chương thành công (${resultBase.chaptersImported} chương, ${resultBase.imagesUploaded} ảnh)`;
  }

  await emitProgress({ stage: "done", message: resultBase.message });

  return resultBase;
}

export type ViHentaiAutoUpdateOptions = Omit<ViHentaiAutoDownloadOptions, "skipIfExists" | "downloadChapters" | "maxChapters"> & {
  /** Max number of new chapters to append for existing manga in one run. */
  maxNewChapters?: number;
  /** If manga doesn't exist, import at most this many chapters (defaults to 200). */
  maxChaptersForNewManga?: number;
};

export type ViHentaiAutoUpdateResult = {
  url: string;
  mode: "created" | "updated" | "noop" | "dry-run";
  message: string;
  parsedTitle?: string;
  mangaId?: string;
  mangaSlug?: string;
  chaptersAdded: number;
  imagesUploaded: number;
  chapterErrors: Array<{ chapterUrl: string; message: string }>;
};

/**
 * Auto update flow:
 * - If manga doesn't exist (match by title): create + optionally download chapters.
 * - If exists: fetch chapter list and append missing chapters (prefers URL diff).
 */
export async function autoUpdateViHentaiManga(options: ViHentaiAutoUpdateOptions): Promise<ViHentaiAutoUpdateResult> {
  const {
    request,
    asSystem = true,
    dryRun = false,
    downloadPoster = true,
    maxChaptersForNewManga = 200,
    maxNewChapters = 20,
    downloadChapters = true,
    continueOnChapterError = true,
    maxImagesPerChapter = 300,
    imageDelayMs = 100,
    imageTimeoutMs = 30_000,
    imageRetries = 2,
    chapterDelayMs = 5_000,
    onProgress,
    ...importOptions
  } = options as any;

  const emitProgress = async (payload: Parameters<NonNullable<typeof onProgress>>[0]) => {
    if (!onProgress) return;
    try {
      await onProgress(payload);
    } catch {
      // Progress must never break the update flow.
    }
  };

  if (!importOptions.url) throw new Error("Thiếu URL nguồn");

  await emitProgress({ stage: "manga", message: "Đang tải trang truyện..." });
  const parsed = parsePage(await fetchViHentaiHtmlForAutoUpdate(importOptions.url), importOptions.url);
  const title = parsed.title;

  const existing = await MangaModel.findOne({ title })
    .select({ _id: 1, slug: 1, chapters: 1 })
    .lean();

  // If missing -> create via existing auto-download path (ensures same metadata + poster handling)
  if (!existing) {
    if (!importOptions.ownerId) {
      throw new Error(
        "Không thể tạo truyện mới vì thiếu ownerId. Vui lòng cấu hình ownerId cho scheduler hoặc chạy qua admin UI.",
      );
    }
    if (dryRun) {
      return {
        url: importOptions.url,
        mode: "dry-run",
        message: "Dry-run: truyện chưa tồn tại, sẽ tạo mới + tải chương",
        parsedTitle: title,
        chaptersAdded: 0,
        imagesUploaded: 0,
        chapterErrors: [],
      };
    }

    const created = await autoDownloadViHentaiManga({
      ...(options as any),
      skipIfExists: false,
      downloadPoster,
      downloadChapters: Boolean(downloadChapters),
      asSystem,
      maxChapters: typeof maxChaptersForNewManga === "number" && maxChaptersForNewManga > 0 ? maxChaptersForNewManga : 200,
    });

    return {
      url: importOptions.url,
      mode: "created",
      message: created.message,
      parsedTitle: title,
      mangaId: created.createdId,
      mangaSlug: created.createdSlug,
      chaptersAdded: created.chaptersImported || 0,
      imagesUploaded: created.imagesUploaded || 0,
      chapterErrors: Array.isArray(created.chapterErrors) ? created.chapterErrors : [],
    };
  }

  // Existing: append missing chapters
  if (dryRun) {
    return {
      url: importOptions.url,
      mode: "dry-run",
      message: "Dry-run: truyện đã tồn tại, sẽ sync chương thiếu",
      parsedTitle: title,
      mangaId: String(existing._id),
      mangaSlug: String(existing.slug || existing._id),
      chaptersAdded: 0,
      imagesUploaded: 0,
      chapterErrors: [],
    };
  }

  await emitProgress({ stage: "chapters", message: "Đang lấy danh sách chương..." });
  const chapterListHtml = await fetchViHentaiHtmlForAutoUpdate(importOptions.url);
  const chapterList = parseChapterList(load(chapterListHtml), importOptions.url);
  const sourceEntries = chapterList.entries;
  if (!sourceEntries.length) {
    return {
      url: importOptions.url,
      mode: "noop",
      message: "Danh sách chương rỗng",
      parsedTitle: title,
      mangaId: String(existing._id),
      mangaSlug: String(existing.slug || existing._id),
      chaptersAdded: 0,
      imagesUploaded: 0,
      chapterErrors: [],
    };
  }

  const mangaId = String(existing._id);

  // IMPORTANT: Do NOT rely on MangaModel.chapters here.
  // In practice it can be stale or represent a different count than the actual chapter documents.
  // For auto-update we must compare real chapter totals to decide how many chapters to append.
  const localCount = await ChapterModel.countDocuments({ mangaId });

  // Rule: determine how many chapters to fetch by comparing totals (sourceCount - localCount).
  // This prevents backfilling old chapters (1,2,3,...) when only the newest chapter is missing.
  const sourceCount = sourceEntries.length;
  const diffByCount = Math.max(0, sourceCount - localCount);

  let missingOrdered: ViHentaiChapterEntry[] = [];
  if (diffByCount > 0) {
    const toImport =
      typeof maxNewChapters === "number" && maxNewChapters > 0 ? Math.min(diffByCount, maxNewChapters) : diffByCount;

    // sourceEntries can be newest-first on vi-hentai (e.g. 20,19,...,1).
    // We want the NEWEST missing chapters, but import them oldest->newest within that subset.
    let newestSlice: ViHentaiChapterEntry[];
    if (toImport >= sourceEntries.length) {
      newestSlice = sourceEntries.slice();
    } else if (chapterList.sourceOrder === "asc") {
      // oldest -> newest: newest are at the end
      newestSlice = sourceEntries.slice(-toImport);
    } else {
      // newest -> oldest: newest are at the start
      newestSlice = sourceEntries.slice(0, toImport);
    }

    missingOrdered = chapterList.sourceOrder === "asc" ? newestSlice : newestSlice.slice().reverse();
  }

  if (!missingOrdered.length) {
    return {
      url: importOptions.url,
      mode: "noop",
      message: `Không có chương mới (nguồn=${sourceEntries.length}, đích=${localCount})`,
      parsedTitle: title,
      mangaId,
      mangaSlug: String(existing.slug || existing._id),
      chaptersAdded: 0,
      imagesUploaded: 0,
      chapterErrors: [],
    };
  }

  await emitProgress({
    stage: "chapters",
    message: `Phát hiện ${missingOrdered.length} chương mới. Sẽ tải (oldest → newest).`,
    chapterCount: missingOrdered.length,
  });

  // Lazy import to avoid circular dependency at module load.
  const { createChapter, createChapterAsAdmin } = await import("~/.server/mutations/chapter.mutation");

  const result: ViHentaiAutoUpdateResult = {
    url: importOptions.url,
    mode: "updated",
    message: "Đang tải chương mới...",
    parsedTitle: title,
    mangaId,
    mangaSlug: String(existing.slug || existing._id),
    chaptersAdded: 0,
    imagesUploaded: 0,
    chapterErrors: [],
  };

  // We use the REAL chapter count to build deterministic storage paths.
  let nextChapterNumber = localCount + 1;

  for (let idx = 0; idx < missingOrdered.length; idx += 1) {
    const entry = missingOrdered[idx];
    const chapterUrl = entry.url;
    const chapterTitle = sanitizeWhitespace(entry.title) || "";
    const chapterNumberForPath = nextChapterNumber;
    const chapterPrefix = `manga-images/${mangaId}/${String(chapterNumberForPath).padStart(4, "0")}`;

    await emitProgress({
      stage: "chapter",
      message: `Đang tải chương mới ${idx + 1}/${missingOrdered.length}`,
      chapterIndex: idx + 1,
      chapterCount: missingOrdered.length,
      chapterTitle: chapterTitle || undefined,
      chapterUrl,
    });

    try {
      const html = await fetchViHentaiHtmlForAutoUpdate(chapterUrl);
      const imageUrls = parseChapterImagesFromHtml(html, chapterUrl);
      if (!imageUrls.length) throw new Error("Không tìm thấy ảnh trong trang chương");
      if (imageUrls.length > maxImagesPerChapter) {
        throw new Error(`Số ảnh vượt giới hạn: ${imageUrls.length}/${maxImagesPerChapter}`);
      }

      const uploaded: UploadedRemoteFile[] = [];
      const skipped: Array<{ url: string; reason: string }> = [];
      let keptIndex = 0;

      for (let imageIndex = 0; imageIndex < imageUrls.length; imageIndex += 1) {
        const imgUrl = imageUrls[imageIndex];

        await emitProgress({
          stage: "image",
          message: `Ảnh ${imageIndex + 1}/${imageUrls.length}`,
          chapterIndex: idx + 1,
          chapterCount: missingOrdered.length,
          chapterTitle: chapterTitle || undefined,
          chapterUrl,
          imageIndex: imageIndex + 1,
          imageCount: imageUrls.length,
          imageUrl: imgUrl,
        });

        if (imageIndex > 0 && imageDelayMs > 0) {
          await sleep(imageDelayMs);
        }

        if (shouldSkipByUrl(imgUrl)) {
          skipped.push({ url: imgUrl, reason: "url_contains_/cover/" });
          continue;
        }

        let fetched: { buffer: Buffer; contentType: string | null } | null = null;
        try {
          fetched = await fetchRemoteBufferWithRetry(imgUrl, {
            timeoutMs: imageTimeoutMs,
            retries: imageRetries,
            retryDelayMs: 800,
            headers: {
              ...HEADERS,
              Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
              Referer: chapterUrl,
              Origin: new URL(chapterUrl).origin,
            },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          skipped.push({ url: imgUrl, reason: `fetch_error:${message}` });
          continue;
        }

        const decision = await shouldKeepChapterImage({
          url: imgUrl,
          buffer: fetched.buffer,
          contentType: fetched.contentType,
        });
        if (!decision.keep) {
          skipped.push({ url: imgUrl, reason: decision.reason });
          continue;
        }

        keptIndex += 1;
        try {
          const normalized = await normalizeChapterImageBuffer({
            url: imgUrl,
            buffer: fetched.buffer,
            contentType: fetched.contentType,
          });

          const uploadedOne = await uploadImageBuffer(imgUrl, normalized.buffer, normalized.contentType, {
            prefixPath: chapterPrefix,
            filenameHintBase: `page-${String(keptIndex).padStart(3, "0")}`,
            maxSizeInBytes: 9 * 1024 * 1024,
          });
          uploaded.push(uploadedOne);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          skipped.push({ url: imgUrl, reason: `upload_error:${message}` });
          continue;
        }
      }

      if (!uploaded.length) {
        const sample = skipped.slice(0, 5).map((s) => `${s.reason}`).join(", ");
        throw new Error(
          `Không còn ảnh hợp lệ sau khi lọc (đã loại ${skipped.length}/${imageUrls.length}).` +
            (sample ? ` Ví dụ lý do: ${sample}` : ""),
        );
      }

      const contentUrls = uploaded.map((u) => u.url);
      const fullPaths = uploaded.map((u) => u.fullPath).filter(Boolean);
      const totalBytes = uploaded.reduce((sum, u) => sum + (u.sizeBytes || 0), 0);

      try {
        if (asSystem) {
          await createChapterAsAdmin({
            mangaId,
            title: chapterTitle,
            sourceChapterUrl: chapterUrl,
            contentUrls,
            contentBytes: totalBytes,
          } as any);
        } else {
          await createChapter(request, {
            mangaId,
            title: chapterTitle,
            sourceChapterUrl: chapterUrl,
            contentUrls,
            contentBytes: totalBytes,
          } as any);
        }

        result.chaptersAdded += 1;
        result.imagesUploaded += uploaded.length;
        nextChapterNumber += 1;
      } catch (e) {
        try {
          if (fullPaths.length) await deletePublicFiles(fullPaths);
        } catch {
          // ignore
        }
        throw e;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.chapterErrors.push({ chapterUrl, message });
      if (!continueOnChapterError) {
        result.message = `Cập nhật truyện OK nhưng lỗi khi tải chương: ${message}`;
        return result;
      }
    } finally {
      if (idx < missingOrdered.length - 1 && chapterDelayMs > 0) {
        await sleep(chapterDelayMs);
      }
    }
  }

  // Best-effort: set Manga.updatedAt based on source "Lần cuối".
  if (parsed.lastUpdatedAt) {
    try {
      await MangaModel.updateOne(
        { _id: mangaId },
        { $set: { updatedAt: parsed.lastUpdatedAt } },
        { timestamps: false } as any,
      );
    } catch {
      // ignore
    }
  }

  if (result.chapterErrors.length) {
    result.message = `Cập nhật xong (${result.chaptersAdded}/${missingOrdered.length}) nhưng có lỗi.`;
  } else {
    result.message = `Cập nhật xong (${result.chaptersAdded} chương, ${result.imagesUploaded} ảnh).`;
  }

  await emitProgress({ stage: "done", message: result.message });
  return result;
}
