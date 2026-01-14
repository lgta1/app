import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { CHAPTER_STATUS } from "~/constants/chapter";
import { MANGA_STATUS } from "~/constants/manga";
import { ChapterModel } from "~/database/models/chapter.model";
import { GenresModel } from "~/database/models/genres.model";
import { MangaModel } from "~/database/models/manga.model";
import { UserModel } from "~/database/models/user.model";
import { AuthorModel } from "~/database/models/author.model";
import { TranslatorModel } from "~/database/models/translator.model";
import { CharacterModel } from "~/database/models/character.model";
import { DoujinshiModel } from "~/database/models/doujinshi.model";

export type SitemapGenerateOptions = {
  origin?: string;
  outputDir?: string;
  /** Preferred max URLs per chapters sitemap file. Default 10000. */
  chaptersPerFile?: number;
  /** Max user profiles to include. Default 1000 (avoid thin/spam). */
  maxUserProfiles?: number;
};

const DEFAULT_CHAPTERS_PER_FILE = 10_000;
const DEFAULT_MAX_USER_PROFILES = 1_000;

function normalizeOrigin(raw: string | undefined): string {
  const v = (raw || "").trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    // Force https in sitemap (canonical requirement)
    u.protocol = "https:";
    // Strip trailing slash
    return u.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function toIso(d: any, fallback: Date): string {
  const dt = d ? new Date(d) : fallback;
  return Number.isFinite(dt.getTime()) ? dt.toISOString() : fallback.toISOString();
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, filePath);
}

type UrlEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
};

function buildUrlsetXml(urls: UrlEntry[]): string {
  const lines = urls.map((u) => {
    const loc = escapeXml(u.loc);
    const lastmod = u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : "";
    const changefreq = u.changefreq ? `\n    <changefreq>${escapeXml(u.changefreq)}</changefreq>` : "";
    const priority = u.priority ? `\n    <priority>${escapeXml(u.priority)}</priority>` : "";
    return `  <url>\n    <loc>${loc}</loc>${lastmod}${changefreq}${priority}\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</urlset>\n`;
}

type SitemapIndexEntry = {
  loc: string;
  lastmod: string;
};

function buildSitemapIndexXml(sitemaps: SitemapIndexEntry[]): string {
  const lines = sitemaps.map((s) => {
    return `  <sitemap>\n    <loc>${escapeXml(s.loc)}</loc>\n    <lastmod>${escapeXml(s.lastmod)}</lastmod>\n  </sitemap>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</sitemapindex>\n`;
}

function uniqUrls(urls: UrlEntry[]): UrlEntry[] {
  const seen = new Set<string>();
  const out: UrlEntry[] = [];
  for (const u of urls) {
    const loc = String(u.loc || "").trim();
    if (!loc) continue;
    if (seen.has(loc)) continue;
    seen.add(loc);
    out.push({ ...u, loc });
  }
  return out;
}

async function ensureMongoConnected(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  const uri = ENV.MONGO.URI;
  await mongoose.connect(uri, { maxPoolSize: 20 });
}

export async function generateSitemapsToDisk(options: SitemapGenerateOptions = {}): Promise<{
  outputDir: string;
  files: Array<{ file: string; urlCount?: number }>;
}> {
  const now = new Date();

  const origin = (() => {
    const configured = normalizeOrigin(options.origin || ENV.CANONICAL_ORIGIN || process.env.VITE_CANONICAL_ORIGIN);
    if (configured) return configured;

    // Operational fallback: CLI runs may not inherit PM2 env.
    // Only allow a safe default in production to avoid generating localhost URLs.
    if (ENV.IS_PRODUCTION) return "https://vinahentai.top";

    throw new Error("Missing CANONICAL_ORIGIN/VITE_CANONICAL_ORIGIN for sitemap generation");
  })();

  const outputDir = options.outputDir
    ? path.resolve(process.cwd(), options.outputDir)
    : (await (async () => {
        const buildClient = path.resolve(process.cwd(), "build/client");
        try {
          await fs.access(buildClient);
          return buildClient;
        } catch {
          return path.resolve(process.cwd(), "public");
        }
      })());

  const chaptersPerFile = Number(options.chaptersPerFile || DEFAULT_CHAPTERS_PER_FILE);
  const maxUserProfiles = Number(options.maxUserProfiles || DEFAULT_MAX_USER_PROFILES);

  await ensureMongoConnected();

  // ---------------------------------------------------------------------------
  // 1) Static/hub pages
  // ---------------------------------------------------------------------------
  const staticUrls: UrlEntry[] = uniqUrls([
    { loc: `${origin}/`, lastmod: toIso(now, now), changefreq: "daily", priority: "1.0" },
    { loc: `${origin}/truyen-hentai`, lastmod: toIso(now, now), changefreq: "daily", priority: "1.0" },
    { loc: `${origin}/danh-sach`, lastmod: toIso(now, now), changefreq: "daily", priority: "0.9" },
    { loc: `${origin}/genres`, lastmod: toIso(now, now), changefreq: "weekly", priority: "0.9" },
    { loc: `${origin}/search/advanced`, lastmod: toIso(now, now), changefreq: "weekly", priority: "0.5" },
    { loc: `${origin}/gioi-thieu`, lastmod: toIso(now, now), changefreq: "yearly", priority: "0.6" },
    { loc: `${origin}/random`, lastmod: toIso(now, now), changefreq: "daily", priority: "0.4" },
    { loc: `${origin}/cosplay`, lastmod: toIso(now, now), changefreq: "daily", priority: "0.6" },
    // Game hóa
    { loc: `${origin}/waifu/summon`, lastmod: toIso(now, now), changefreq: "weekly", priority: "0.5" },
    { loc: `${origin}/waifu/leaderboard`, lastmod: toIso(now, now), changefreq: "daily", priority: "0.4" },
  ]);

  // ---------------------------------------------------------------------------
  // 2) Rankings pages (daily/weekly/monthly are tabs inside these canonical URLs)
  // ---------------------------------------------------------------------------
  const rankingUrls: UrlEntry[] = uniqUrls([
    { loc: `${origin}/leaderboard/manga`, lastmod: toIso(now, now), changefreq: "daily", priority: "0.7" },
    { loc: `${origin}/leaderboard/member`, lastmod: toIso(now, now), changefreq: "daily", priority: "0.5" },
    { loc: `${origin}/leaderboard/waifu`, lastmod: toIso(now, now), changefreq: "daily", priority: "0.5" },
    { loc: `${origin}/leaderboard/revenue`, lastmod: toIso(now, now), changefreq: "weekly", priority: "0.3" },
  ]);

  // ---------------------------------------------------------------------------
  // 3) Genres
  // ---------------------------------------------------------------------------
  const genres = await GenresModel.find({}, { slug: 1, updatedAt: 1 }).lean();
  const genreUrls: UrlEntry[] = uniqUrls(
    (Array.isArray(genres) ? genres : []).flatMap((g: any) => {
      const slug = String(g?.slug || "").trim().toLowerCase();
      if (!slug) return [];
      return [
        {
          loc: `${origin}/genres/${encodeURIComponent(slug)}`,
          lastmod: toIso(g?.updatedAt, now),
          changefreq: "weekly",
          priority: "0.6",
        },
      ];
    }),
  );

  // ---------------------------------------------------------------------------
  // 4) Comics (manga detail)
  // ---------------------------------------------------------------------------
  const mangas = await MangaModel.find(
    { status: MANGA_STATUS.APPROVED },
    { _id: 1, slug: 1, updatedAt: 1 },
  )
    .lean();

  const mangaIdToSlug = new Map<string, string>();
  const mangaUrls: UrlEntry[] = [];
  for (const m of Array.isArray(mangas) ? (mangas as any[]) : []) {
    const slug = String(m?.slug || "").trim();
    const id = String(m?._id || "").trim();
    if (!slug || !id) continue;
    mangaIdToSlug.set(id, slug);
    mangaUrls.push({
      loc: `${origin}/truyen-hentai/${encodeURIComponent(slug)}`,
      lastmod: toIso(m?.updatedAt, now),
      changefreq: "daily",
      priority: "0.8",
    });
  }

  // ---------------------------------------------------------------------------
  // 5) Chapters (read pages)
  // ---------------------------------------------------------------------------
  // We stream via cursor to avoid large memory spikes.
  const chapterCursor = ChapterModel.find(
    {
      // Public read route allows APPROVED + PENDING.
      // Also include legacy docs with missing status.
      status: { $in: [CHAPTER_STATUS.APPROVED, CHAPTER_STATUS.PENDING, null] },
      slug: { $exists: true, $ne: "" },
    },
    { mangaId: 1, slug: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .lean()
    .cursor();

  const chapterSitemapFiles: Array<{ file: string; urlCount: number }> = [];
  let chunkIndex = 1;
  let chunkUrls: UrlEntry[] = [];

  async function flushChapterChunk(): Promise<void> {
    if (!chunkUrls.length) return;
    const file = `sitemap-chapters-${chunkIndex}.xml`;
    const xml = buildUrlsetXml(uniqUrls(chunkUrls));
    await writeAtomic(path.join(outputDir, file), xml);
    chapterSitemapFiles.push({ file, urlCount: chunkUrls.length });
    chunkUrls = [];
    chunkIndex += 1;
  }

  for await (const ch of chapterCursor as any) {
    const mangaId = String(ch?.mangaId || "").trim();
    const mangaSlug = mangaIdToSlug.get(mangaId);
    if (!mangaSlug) continue;

    const chapterSlug = String(ch?.slug || "").trim();
    if (!chapterSlug) continue;

    chunkUrls.push({
      loc: `${origin}/truyen-hentai/${encodeURIComponent(mangaSlug)}/${encodeURIComponent(chapterSlug)}`,
      lastmod: toIso(ch?.createdAt, now),
      changefreq: "monthly",
      priority: "0.3",
    });

    if (chunkUrls.length >= chaptersPerFile) {
      await flushChapterChunk();
    }
  }
  await flushChapterChunk();

  // ---------------------------------------------------------------------------
  // 6) Entities (authors/translators/characters/doujinshi)
  // Only include canonical first-page URL (no query params).
  // ---------------------------------------------------------------------------
  const [authors, translators, characters, doujinshis] = await Promise.all([
    AuthorModel.find({}, { slug: 1, updatedAt: 1 }).lean().catch(() => []),
    TranslatorModel.find({}, { slug: 1, updatedAt: 1 }).lean().catch(() => []),
    CharacterModel.find({}, { slug: 1, updatedAt: 1 }).lean().catch(() => []),
    DoujinshiModel.find({}, { slug: 1, updatedAt: 1 }).lean().catch(() => []),
  ]);

  const entityUrls: UrlEntry[] = uniqUrls([
    ...(Array.isArray(authors)
      ? (authors as any[])
          .map((a) => ({
            loc: `${origin}/authors/${encodeURIComponent(String(a?.slug || "").trim())}`,
            lastmod: toIso(a?.updatedAt, now),
            changefreq: "weekly",
            priority: "0.4",
          }))
          .filter((u) => !u.loc.endsWith("/authors/"))
      : []),
    ...(Array.isArray(translators)
      ? (translators as any[])
          .map((t) => ({
            loc: `${origin}/translators/${encodeURIComponent(String(t?.slug || "").trim())}`,
            lastmod: toIso(t?.updatedAt, now),
            changefreq: "weekly",
            priority: "0.4",
          }))
          .filter((u) => !u.loc.endsWith("/translators/"))
      : []),
    ...(Array.isArray(characters)
      ? (characters as any[])
          .map((c) => ({
            loc: `${origin}/characters/${encodeURIComponent(String(c?.slug || "").trim())}`,
            lastmod: toIso(c?.updatedAt, now),
            changefreq: "weekly",
            priority: "0.3",
          }))
          .filter((u) => !u.loc.endsWith("/characters/"))
      : []),
    ...(Array.isArray(doujinshis)
      ? (doujinshis as any[])
          .map((d) => ({
            loc: `${origin}/doujinshi/${encodeURIComponent(String(d?.slug || "").trim())}`,
            lastmod: toIso(d?.updatedAt, now),
            changefreq: "weekly",
            priority: "0.3",
          }))
          .filter((u) => !u.loc.endsWith("/doujinshi/"))
      : []),
  ]);

  // ---------------------------------------------------------------------------
  // 7) User profiles (SEO-safe subset)
  // ---------------------------------------------------------------------------
  const users = await UserModel.find(
    { isDeleted: false, isBanned: false },
    { _id: 1, updatedAt: 1, exp: 1 },
  )
    .sort({ exp: -1 })
    .limit(maxUserProfiles)
    .lean();

  const userUrls: UrlEntry[] = uniqUrls(
    (Array.isArray(users) ? users : []).flatMap((u: any) => {
      const id = String(u?._id || "").trim();
      if (!id) return [];
      return [
        {
          loc: `${origin}/profile/${encodeURIComponent(id)}`,
          lastmod: toIso(u?.updatedAt, now),
          changefreq: "weekly",
          priority: "0.2",
        },
      ];
    }),
  );

  // ---------------------------------------------------------------------------
  // Write files
  // ---------------------------------------------------------------------------
  const files: Array<{ file: string; urlCount?: number }> = [];

  const write = async (file: string, xml: string, urlCount?: number) => {
    await writeAtomic(path.join(outputDir, file), xml);
    files.push({ file, urlCount });
  };

  await write("sitemap-static.xml", buildUrlsetXml(staticUrls), staticUrls.length);
  await write("sitemap-rankings.xml", buildUrlsetXml(rankingUrls), rankingUrls.length);
  await write("sitemap-genres.xml", buildUrlsetXml(genreUrls), genreUrls.length);
  await write("sitemap-comics.xml", buildUrlsetXml(uniqUrls(mangaUrls)), mangaUrls.length);
  await write("sitemap-entities.xml", buildUrlsetXml(entityUrls), entityUrls.length);
  await write("sitemap-users.xml", buildUrlsetXml(userUrls), userUrls.length);

  // chapter sitemap files already written in flush
  for (const f of chapterSitemapFiles) files.push(f);

  // Index
  const indexEntries: SitemapIndexEntry[] = [];
  const addIndex = (file: string) => {
    indexEntries.push({
      loc: `${origin}/${file}`,
      lastmod: toIso(now, now),
    });
  };

  addIndex("sitemap-static.xml");
  addIndex("sitemap-rankings.xml");
  addIndex("sitemap-genres.xml");
  addIndex("sitemap-comics.xml");
  addIndex("sitemap-entities.xml");
  addIndex("sitemap-users.xml");
  for (const f of chapterSitemapFiles) addIndex(f.file);

  await write("sitemap_index.xml", buildSitemapIndexXml(indexEntries));

  return { outputDir, files };
}
