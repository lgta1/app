import dotenv from "dotenv";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import mongoose from "mongoose";

import { CHAPTER_STATUS } from "../app/constants/chapter";
import { MANGA_STATUS } from "../app/constants/manga";
import { ChapterModel } from "../app/database/models/chapter.model";
import { GenresModel } from "../app/database/models/genres.model";
import { MangaModel } from "../app/database/models/manga.model";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const BUILD_CLIENT_DIR = path.join(ROOT_DIR, "build", "client");
const CANONICAL_ORIGIN = "https://vinahentai.online";
const MAX_URLS_PER_FILE = 8000;
const RESTRICTED_GENRE_SLUGS = new Set(["lolicon", "loli", "shota"]);

type UrlItem = {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
};

type SitemapFile = {
  filename: string;
  urls: UrlItem[];
};

const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toIso = (value?: Date | string | null): string | undefined => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const normalizeSlug = (value: unknown): string => {
  const str = String(value ?? "").trim().toLowerCase();
  return str;
};

const hasRestrictedGenres = (genres: unknown): boolean => {
  if (!Array.isArray(genres)) return false;
  return genres.some((genre) => RESTRICTED_GENRE_SLUGS.has(normalizeSlug(genre)));
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const buildUrlsetXml = (urls: UrlItem[]): string => {
  const rows = urls
    .map((url) => {
      const tags = [
        `    <loc>${xmlEscape(url.loc)}</loc>`,
        url.lastmod ? `    <lastmod>${url.lastmod}</lastmod>` : "",
        url.changefreq ? `    <changefreq>${url.changefreq}</changefreq>` : "",
        url.priority ? `    <priority>${url.priority}</priority>` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return `  <url>\n${tags}\n  </url>`;
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    rows,
    "</urlset>",
    "",
  ].join("\n");
};

const buildSitemapIndexXml = (entries: Array<{ loc: string; lastmod?: string }>): string => {
  const rows = entries
    .map((entry) => {
      const tags = [
        `    <loc>${xmlEscape(entry.loc)}</loc>`,
        entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return `  <sitemap>\n${tags}\n  </sitemap>`;
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    rows,
    "</sitemapindex>",
    "",
  ].join("\n");
};

const writeFileBothTargets = async (filename: string, content: string) => {
  const targets = [
    path.join(PUBLIC_DIR, filename),
    path.join(BUILD_CLIENT_DIR, filename),
  ];

  await Promise.all(
    targets.map(async (target) => {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf-8");
    }),
  );
};

const buildFileLoc = (filename: string) => `${CANONICAL_ORIGIN}/${filename}`;

const main = async () => {
  dotenv.config({ path: path.join(ROOT_DIR, ".env.production") });

  const mongoUrl =
    process.env.MONGO_URL ||
    "mongodb://admin:yourpassword@localhost:27017/?authSource=admin&retryWrites=true&retryReads=true&w=majority&readPreference=primaryPreferred";

  await mongoose.connect(mongoUrl, {
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 20,
    minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 5,
  });

  try {
    const nowIso = new Date().toISOString();

    const mangaDocs = await MangaModel.find(
      { status: MANGA_STATUS.APPROVED },
      {
        slug: 1,
        genres: 1,
        updatedAt: 1,
        createdAt: 1,
        authorSlugs: 1,
        translatorSlugs: 1,
        characterSlugs: 1,
        doujinshiSlugs: 1,
      },
    ).lean();

    const mangaPublic = mangaDocs.filter((manga: any) => {
      const slug = normalizeSlug(manga.slug);
      if (!slug) return false;
      return !hasRestrictedGenres(manga.genres);
    });

    const mangaSlugById = new Map<string, string>();
    for (const manga of mangaPublic as any[]) {
      mangaSlugById.set(String(manga._id), normalizeSlug(manga.slug));
    }

    const staticUrls: UrlItem[] = [
      { loc: `${CANONICAL_ORIGIN}/`, lastmod: nowIso, changefreq: "hourly", priority: "1.0" },
      { loc: `${CANONICAL_ORIGIN}/danh-sach`, lastmod: nowIso, changefreq: "hourly", priority: "0.9" },
      { loc: `${CANONICAL_ORIGIN}/truyen-hentai`, lastmod: nowIso, changefreq: "hourly", priority: "0.9" },
      { loc: `${CANONICAL_ORIGIN}/gioi-thieu`, lastmod: nowIso, changefreq: "monthly", priority: "0.4" },
      { loc: `${CANONICAL_ORIGIN}/genres`, lastmod: nowIso, changefreq: "daily", priority: "0.8" },
    ];

    const rankingsUrls: UrlItem[] = [
      { loc: `${CANONICAL_ORIGIN}/leaderboard`, lastmod: nowIso, changefreq: "daily", priority: "0.8" },
      { loc: `${CANONICAL_ORIGIN}/leaderboard/manga`, lastmod: nowIso, changefreq: "daily", priority: "0.7" },
      { loc: `${CANONICAL_ORIGIN}/leaderboard/member`, lastmod: nowIso, changefreq: "daily", priority: "0.6" },
      { loc: `${CANONICAL_ORIGIN}/leaderboard/translator`, lastmod: nowIso, changefreq: "daily", priority: "0.6" },
      { loc: `${CANONICAL_ORIGIN}/leaderboard/revenue`, lastmod: nowIso, changefreq: "daily", priority: "0.5" },
      { loc: `${CANONICAL_ORIGIN}/leaderboard/waifu`, lastmod: nowIso, changefreq: "daily", priority: "0.6" },
      { loc: `${CANONICAL_ORIGIN}/waifu/leaderboard`, lastmod: nowIso, changefreq: "daily", priority: "0.6" },
      { loc: `${CANONICAL_ORIGIN}/waifu/summon`, lastmod: nowIso, changefreq: "daily", priority: "0.5" },
    ];

    const genreDocs = await GenresModel.find({}, { slug: 1, updatedAt: 1 }).lean();
    const genresUrls: UrlItem[] = genreDocs
      .map((genre: any) => ({
        slug: normalizeSlug(genre.slug),
        lastmod: toIso(genre.updatedAt) || nowIso,
      }))
      .filter((genre) => genre.slug && !RESTRICTED_GENRE_SLUGS.has(genre.slug))
      .map((genre) => ({
        loc: `${CANONICAL_ORIGIN}/genres/${encodeURIComponent(genre.slug)}`,
        lastmod: genre.lastmod,
        changefreq: "daily" as const,
        priority: "0.6",
      }));

    const entitySlugs = {
      authors: new Set<string>(),
      translators: new Set<string>(),
      characters: new Set<string>(),
      doujinshi: new Set<string>(),
    };

    for (const manga of mangaPublic as any[]) {
      for (const slug of Array.isArray(manga.authorSlugs) ? manga.authorSlugs : []) {
        const normalized = normalizeSlug(slug);
        if (normalized) entitySlugs.authors.add(normalized);
      }
      for (const slug of Array.isArray(manga.translatorSlugs) ? manga.translatorSlugs : []) {
        const normalized = normalizeSlug(slug);
        if (normalized) entitySlugs.translators.add(normalized);
      }
      for (const slug of Array.isArray(manga.characterSlugs) ? manga.characterSlugs : []) {
        const normalized = normalizeSlug(slug);
        if (normalized) entitySlugs.characters.add(normalized);
      }
      for (const slug of Array.isArray(manga.doujinshiSlugs) ? manga.doujinshiSlugs : []) {
        const normalized = normalizeSlug(slug);
        if (normalized) entitySlugs.doujinshi.add(normalized);
      }
    }

    const entitiesUrls: UrlItem[] = [
      ...Array.from(entitySlugs.authors).map((slug) => ({
        loc: `${CANONICAL_ORIGIN}/authors/${encodeURIComponent(slug)}`,
        lastmod: nowIso,
        changefreq: "weekly" as const,
        priority: "0.5",
      })),
      ...Array.from(entitySlugs.translators).map((slug) => ({
        loc: `${CANONICAL_ORIGIN}/translators/${encodeURIComponent(slug)}`,
        lastmod: nowIso,
        changefreq: "weekly" as const,
        priority: "0.5",
      })),
      ...Array.from(entitySlugs.characters).map((slug) => ({
        loc: `${CANONICAL_ORIGIN}/characters/${encodeURIComponent(slug)}`,
        lastmod: nowIso,
        changefreq: "weekly" as const,
        priority: "0.5",
      })),
      ...Array.from(entitySlugs.doujinshi).map((slug) => ({
        loc: `${CANONICAL_ORIGIN}/doujinshi/${encodeURIComponent(slug)}`,
        lastmod: nowIso,
        changefreq: "weekly" as const,
        priority: "0.5",
      })),
    ];

    const mangaUrls: UrlItem[] = mangaPublic.map((manga: any) => ({
      loc: `${CANONICAL_ORIGIN}/truyen-hentai/${encodeURIComponent(normalizeSlug(manga.slug))}`,
      lastmod: toIso(manga.updatedAt || manga.createdAt) || nowIso,
      changefreq: "daily",
      priority: "0.7",
    }));

    const chapterUrls: UrlItem[] = [];
    const chapterCursor = ChapterModel.find(
      { status: CHAPTER_STATUS.APPROVED },
      { mangaId: 1, slug: 1, chapterNumber: 1, publishedAt: 1, createdAt: 1 },
    )
      .sort({ mangaId: 1, chapterNumber: 1 })
      .cursor();

    const chapterDedupe = new Set<string>();
    for await (const chapter of chapterCursor as any) {
      const mangaSlug = mangaSlugById.get(String(chapter.mangaId));
      if (!mangaSlug) continue;

      const chapterSlug = normalizeSlug(chapter.slug) || `chap-${String(chapter.chapterNumber || "")}`;
      if (!chapterSlug) continue;

      const pathname = `/truyen-hentai/${encodeURIComponent(mangaSlug)}/${encodeURIComponent(chapterSlug)}`;
      if (chapterDedupe.has(pathname)) continue;
      chapterDedupe.add(pathname);

      chapterUrls.push({
        loc: `${CANONICAL_ORIGIN}${pathname}`,
        lastmod: toIso(chapter.publishedAt || chapter.createdAt) || nowIso,
        changefreq: "weekly",
        priority: "0.6",
      });
    }

    const sitemapFiles: SitemapFile[] = [
      { filename: "sitemap_static_online.xml", urls: staticUrls },
      { filename: "sitemap_rankings_online.xml", urls: rankingsUrls },
      { filename: "sitemap_genres_online.xml", urls: genresUrls },
      { filename: "sitemap_entities_online.xml", urls: entitiesUrls },
    ];

    const mangaChunks = chunkArray(mangaUrls, MAX_URLS_PER_FILE);
    mangaChunks.forEach((chunk, index) => {
      sitemapFiles.push({
        filename: `sitemap_mangas_online_${index + 1}.xml`,
        urls: chunk,
      });
    });

    const chapterChunks = chunkArray(chapterUrls, MAX_URLS_PER_FILE);
    chapterChunks.forEach((chunk, index) => {
      sitemapFiles.push({
        filename: `sitemap_chapters_online_${index + 1}.xml`,
        urls: chunk,
      });
    });

    for (const file of sitemapFiles) {
      const xml = buildUrlsetXml(file.urls);
      await writeFileBothTargets(file.filename, xml);
    }

    const indexEntries = sitemapFiles.map((file) => ({
      loc: buildFileLoc(file.filename),
      lastmod:
        file.urls
          .map((item) => item.lastmod)
          .filter(Boolean)
          .sort()
          .at(-1) || nowIso,
    }));

    const indexXml = buildSitemapIndexXml(indexEntries);
    await writeFileBothTargets("sitemap_index_online.xml", indexXml);

    console.info(`[sitemap:online] generated ${sitemapFiles.length} sitemap files + sitemap_index_online.xml`);
    console.info(`[sitemap:online] mangas=${mangaUrls.length} chapters=${chapterUrls.length} genres=${genresUrls.length} entities=${entitiesUrls.length}`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error("[sitemap:online] failed", error);
  process.exit(1);
});
