#!/usr/bin/env tsx
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { MangaModel } from "~/database/models/manga.model";
import { ChapterModel } from "~/database/models/chapter.model";
import { getCdnBase, isLegacyCdnUrl } from "~/.server/utils/cdn-url";

const DEFAULT_MAX_URLS = 5000;
const DEFAULT_HEAD_SAMPLE = 200;
const DEFAULT_TIMEOUT_MS = 8000;

type CliOptions = {
  maxUrls: number;
  headSample: number;
  timeoutMs: number;
  includeChapters: boolean;
  includeManga: boolean;
};

type UrlEntry = {
  url: string;
  source: "manga" | "chapter";
  field: string;
  mangaId?: string;
  chapterId?: string;
};

type HeadResult = {
  url: string;
  status: number | null;
  cacheControl?: string;
  cfCacheStatus?: string;
  contentType?: string;
  age?: string;
  error?: string;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    maxUrls: DEFAULT_MAX_URLS,
    headSample: DEFAULT_HEAD_SAMPLE,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    includeChapters: true,
    includeManga: true,
  };

  for (const arg of args) {
    if (arg.startsWith("--max-urls=")) {
      const parsed = Number.parseInt(arg.split("=")[1] || "", 10);
      if (!Number.isNaN(parsed) && parsed > 0) options.maxUrls = parsed;
    } else if (arg.startsWith("--head-sample=")) {
      const parsed = Number.parseInt(arg.split("=")[1] || "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) options.headSample = parsed;
    } else if (arg.startsWith("--timeout-ms=")) {
      const parsed = Number.parseInt(arg.split("=")[1] || "", 10);
      if (!Number.isNaN(parsed) && parsed >= 1000) options.timeoutMs = parsed;
    } else if (arg === "--no-chapters") {
      options.includeChapters = false;
    } else if (arg === "--no-manga") {
      options.includeManga = false;
    }
  }

  return options;
};

const normalizeUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return trimmed;
};

const isAbsoluteUrl = (raw: string): boolean => /^https?:\/\//i.test(raw) || /^\/\//.test(raw);

const hasEmbeddedProtocol = (raw: string): boolean => {
  const idx = raw.indexOf("http://");
  const idx2 = raw.indexOf("https://");
  const first = Math.min(idx === -1 ? Number.POSITIVE_INFINITY : idx, idx2 === -1 ? Number.POSITIVE_INFINITY : idx2);
  return Number.isFinite(first) && first > 0;
};

const tryParseHost = (raw: string): string | null => {
  try {
    const u = new URL(normalizeUrl(raw));
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
};

const pickSample = <T,>(items: T[], max: number): T[] => {
  if (max <= 0 || items.length <= max) return items.slice();
  const out: T[] = [];
  const step = Math.max(1, Math.floor(items.length / max));
  for (let i = 0; i < items.length && out.length < max; i += step) {
    out.push(items[i]);
  }
  return out;
};

const headFetch = async (url: string, timeoutMs: number): Promise<HeadResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    return {
      url,
      status: res.status,
      cacheControl: res.headers.get("cache-control") || undefined,
      cfCacheStatus: res.headers.get("cf-cache-status") || undefined,
      contentType: res.headers.get("content-type") || undefined,
      age: res.headers.get("age") || undefined,
    };
  } catch (error) {
    return {
      url,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
};

const run = async () => {
  const options = parseArgs();
  console.info(`[cache-audit] maxUrls=${options.maxUrls} headSample=${options.headSample} timeoutMs=${options.timeoutMs}`);

  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 10 });

  const urls: UrlEntry[] = [];

  if (options.includeManga) {
    const cursor = MangaModel.find({}).select({ poster: 1, shareImage: 1 }).cursor();
    try {
      for await (const doc of cursor) {
        if (urls.length >= options.maxUrls) break;
        const mangaId = String(doc._id || "");
        const poster = doc.poster ? String(doc.poster) : "";
        const shareImage = (doc as any).shareImage ? String((doc as any).shareImage) : "";
        if (poster) urls.push({ url: poster, source: "manga", field: "poster", mangaId });
        if (shareImage) urls.push({ url: shareImage, source: "manga", field: "shareImage", mangaId });
      }
    } finally {
      await cursor.close();
    }
  }

  if (options.includeChapters && urls.length < options.maxUrls) {
    const cursor = ChapterModel.find({}).select({ contentUrls: 1 }).cursor();
    try {
      for await (const doc of cursor) {
        if (urls.length >= options.maxUrls) break;
        const chapterId = String(doc._id || "");
        const list = Array.isArray((doc as any).contentUrls) ? (doc as any).contentUrls : [];
        for (const raw of list) {
          if (urls.length >= options.maxUrls) break;
          if (!raw) continue;
          urls.push({ url: String(raw), source: "chapter", field: "contentUrls", chapterId });
        }
      }
    } finally {
      await cursor.close();
    }
  }

  await mongoose.disconnect();

  console.info(`[cache-audit] collected URLs=${urls.length}`);

  const cdnBase = getCdnBase().replace(/\/+$/, "");
  const cdnHost = tryParseHost(cdnBase);

  const stats = {
    total: urls.length,
    absolute: 0,
    relative: 0,
    protocolRelative: 0,
    hasQuery: 0,
    hasFragment: 0,
    legacyHost: 0,
    nonCdnHost: 0,
    embeddedProtocol: 0,
  };

  const hostCounts = new Map<string, number>();
  const sampleBuckets: Record<string, string[]> = {
    nonCdnHost: [],
    hasQuery: [],
    relative: [],
    embeddedProtocol: [],
    legacyHost: [],
  };

  for (const entry of urls) {
    const raw = entry.url;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const protocolRelative = trimmed.startsWith("//");
    if (protocolRelative) stats.protocolRelative += 1;

    const absolute = isAbsoluteUrl(trimmed);
    if (absolute) stats.absolute += 1;
    else stats.relative += 1;

    if (trimmed.includes("?")) stats.hasQuery += 1;
    if (trimmed.includes("#")) stats.hasFragment += 1;

    if (hasEmbeddedProtocol(trimmed)) {
      stats.embeddedProtocol += 1;
      if (sampleBuckets.embeddedProtocol.length < 10) sampleBuckets.embeddedProtocol.push(trimmed);
    }

    if (isLegacyCdnUrl(trimmed)) {
      stats.legacyHost += 1;
      if (sampleBuckets.legacyHost.length < 10) sampleBuckets.legacyHost.push(trimmed);
    }

    const host = tryParseHost(trimmed);
    if (host) {
      hostCounts.set(host, (hostCounts.get(host) || 0) + 1);
      if (cdnHost && host !== cdnHost) {
        stats.nonCdnHost += 1;
        if (sampleBuckets.nonCdnHost.length < 10) sampleBuckets.nonCdnHost.push(trimmed);
      }
    } else {
      if (sampleBuckets.relative.length < 10) sampleBuckets.relative.push(trimmed);
    }

    if (trimmed.includes("?") && sampleBuckets.hasQuery.length < 10) {
      sampleBuckets.hasQuery.push(trimmed);
    }
  }

  const topHosts = Array.from(hostCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.info("\n[cache-audit] Summary");
  console.info(`total=${stats.total}`);
  console.info(`absolute=${stats.absolute} relative=${stats.relative} protocolRelative=${stats.protocolRelative}`);
  console.info(`hasQuery=${stats.hasQuery} hasFragment=${stats.hasFragment}`);
  console.info(`legacyHost=${stats.legacyHost} nonCdnHost=${stats.nonCdnHost} embeddedProtocol=${stats.embeddedProtocol}`);

  console.info("\n[cache-audit] Top hosts");
  for (const [host, count] of topHosts) {
    console.info(`${host.padEnd(30, " ")} ${count}`);
  }

  const logSamples = (label: string) => {
    const items = sampleBuckets[label];
    if (!items?.length) return;
    console.info(`\n[cache-audit] Sample ${label}`);
    items.forEach((u) => console.info(u));
  };

  logSamples("nonCdnHost");
  logSamples("hasQuery");
  logSamples("relative");
  logSamples("embeddedProtocol");
  logSamples("legacyHost");

  if (options.headSample > 0) {
    const sample = pickSample(
      urls
        .map((u) => normalizeUrl(u.url))
        .filter((u) => isAbsoluteUrl(u)),
      options.headSample,
    );

    console.info(`\n[cache-audit] HEAD sample=${sample.length}`);

    const headResults: HeadResult[] = [];
    const concurrency = 5;
    let index = 0;

    const worker = async () => {
      while (index < sample.length) {
        const i = index++;
        const url = sample[i];
        if (!url) continue;
        const res = await headFetch(url, options.timeoutMs);
        headResults.push(res);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    const byCacheStatus = new Map<string, number>();
    let missingCacheControl = 0;

    for (const r of headResults) {
      const key = r.cfCacheStatus || "(none)";
      byCacheStatus.set(key, (byCacheStatus.get(key) || 0) + 1);
      if (!r.cacheControl) missingCacheControl += 1;
    }

    console.info("\n[cache-audit] HEAD cf-cache-status distribution");
    for (const [k, v] of Array.from(byCacheStatus.entries()).sort((a, b) => b[1] - a[1])) {
      console.info(`${k.padEnd(12, " ")} ${v}`);
    }

    console.info(`[cache-audit] HEAD missing cache-control=${missingCacheControl}/${headResults.length}`);

    const sampleMiss = headResults.filter((r) => !r.cacheControl).slice(0, 10);
    if (sampleMiss.length) {
      console.info("\n[cache-audit] Sample missing cache-control");
      sampleMiss.forEach((r) => console.info(`${r.url} status=${r.status ?? "?"} cf=${r.cfCacheStatus ?? ""}`));
    }
  }
};

run().catch((error) => {
  console.error("[cache-audit] Fatal error", error);
  mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
