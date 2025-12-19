import type { LoaderFunctionArgs } from "react-router-dom";

import { FEATURED_GENRE_SLUGS } from "~/constants/featured-genres";
import { GenresModel } from "~/database/models/genres.model";

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  const now = new Date();

  // SEO policy (crawl budget): strategic/hub sitemap.
  // Goal: help Google discover site structure and the most important entry pages,
  // without dumping the whole inventory (manga/chapter) into the sitemap.
  //
  // Include:
  // - Homepage
  // - Core hub pages (listing/search/leaderboard)
  // - /genres index + a curated set of "featured" genre pages

  // Curated slugs: keep this small on purpose.
  // Priority order is tuned to match current UX (homepage quick links + pinned).
  const STRATEGIC_GENRE_SLUGS: string[] = [
    "ntr",
    "milf",
    "3d-hentai",
    "doujinshi",
    "anh-cosplay",
    "manhwa",
  ];

  // Also allow anything in FEATURED_GENRE_SLUGS to be used later if you expand the curated list.
  const strategicGenreSet = new Set(
    STRATEGIC_GENRE_SLUGS.map((s) => s.trim().toLowerCase()).filter(Boolean).filter((s) => FEATURED_GENRE_SLUGS.has(s)),
  );

  const genreDocs = strategicGenreSet.size
    ? await GenresModel.find({ slug: { $in: Array.from(strategicGenreSet) } }).select({ slug: 1, updatedAt: 1 }).lean()
    : [];

  const genreUpdatedAtBySlug = new Map<string, any>();
  for (const g of genreDocs as any[]) {
    const slug = String(g?.slug ?? "").trim().toLowerCase();
    if (!slug) continue;
    genreUpdatedAtBySlug.set(slug, g?.updatedAt);
  }

  const fmt = (d?: any) => {
    const date = d ? new Date(d) : now;
    return Number.isFinite(date.getTime()) ? date.toISOString() : now.toISOString();
  };

  const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [];

  // Homepage + hub pages
  urls.push({
    loc: `${origin}/`,
    lastmod: fmt(now),
    changefreq: "daily",
    priority: "1.0",
  });
  urls.push({
    loc: `${origin}/truyen-hentai`,
    lastmod: fmt(now),
    changefreq: "daily",
    priority: "1.0",
  });
  urls.push({
    loc: `${origin}/genres`,
    lastmod: fmt(now),
    changefreq: "weekly",
    priority: "1.0",
  });
  urls.push({
    loc: `${origin}/danh-sach`,
    lastmod: fmt(now),
    changefreq: "daily",
    priority: "0.9",
  });
  urls.push({
    loc: `${origin}/leaderboard/manga`,
    lastmod: fmt(now),
    changefreq: "daily",
    priority: "0.7",
  });
  urls.push({
    loc: `${origin}/search/advanced`,
    lastmod: fmt(now),
    changefreq: "weekly",
    priority: "0.4",
  });
  urls.push({
    loc: `${origin}/waifu/summon`,
    lastmod: fmt(now),
    changefreq: "monthly",
    priority: "0.5",
  });
  urls.push({
    loc: `${origin}/gioi-thieu`,
    lastmod: fmt(now),
    changefreq: "monthly",
    priority: "0.8",
  });

  // Featured genre detail pages (curated)
  // Note: we only include slugs that exist in the DB (avoid 404s).
  for (const slug of STRATEGIC_GENRE_SLUGS) {
    const normalized = String(slug ?? "").trim().toLowerCase();
    if (!normalized) continue;
    if (!genreUpdatedAtBySlug.has(normalized)) continue;

    const priority = normalized === "3d-hentai" ? "0.9" : normalized === "ntr" ? "0.8" : "0.7";

    urls.push({
      loc: `${origin}/genres/${encodeURIComponent(normalized)}`,
      lastmod: fmt(genreUpdatedAtBySlug.get(normalized)),
      changefreq: "weekly",
      priority,
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (url) =>
        `  <url>\n    <loc>${url.loc}</loc>\n    <lastmod>${url.lastmod}</lastmod>\n    <changefreq>${url.changefreq}</changefreq>\n    <priority>${url.priority}</priority>\n  </url>`,
    )
    .join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
