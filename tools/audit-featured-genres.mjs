#!/usr/bin/env node
/**
 * Audit FEATURED_GENRE_SLUGS against the live DB (source of truth).
 *
 * Usage:
 *   MONGO_URI='mongodb://...' DB_NAME='ww' node tools/audit-featured-genres.mjs
 *
 * Optional:
 *   GENRES_COLLECTION='genres'
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { MongoClient } from "mongodb";

function readFeaturedSlugs(repoRoot) {
  const filePath = path.join(repoRoot, "app/constants/featured-genres.ts");
  const src = fs.readFileSync(filePath, "utf8");

  // very small parser: extract string literals inside the Set([ ... ].map(...))
  const m = src.match(/new Set\(\s*\[([\s\S]*?)\]\s*\.map/);
  if (!m) throw new Error(`Could not parse FEATURED_GENRE_SLUGS from ${filePath}`);

  const body = m[1];
  const strings = [...body.matchAll(/\"([^\"]+)\"/g)].map((x) => x[1]);
  return [...new Set(strings.map((s) => s.trim().toLowerCase()))];
}

function normalizeDbSlug(value) {
  return String(value ?? "").trim().toLowerCase();
}

async function main() {
  const repoRoot = process.cwd();
  const MONGO_URI = process.env.MONGO_URI || "";
  const DB_NAME = process.env.DB_NAME || "";
  const GENRES_COLLECTION = process.env.GENRES_COLLECTION || "genres";

  if (!MONGO_URI || !DB_NAME) {
    console.error("Missing env vars. Example:\n  MONGO_URI='mongodb://127.0.0.1:27017' DB_NAME='ww' node tools/audit-featured-genres.mjs");
    process.exit(2);
  }

  const featured = readFeaturedSlugs(repoRoot);

  const client = new MongoClient(MONGO_URI, { ignoreUndefined: true });
  await client.connect();
  try {
    const db = client.db(DB_NAME);
    const genresCol = db.collection(GENRES_COLLECTION);

    const genres = await genresCol
      .find({}, { projection: { slug: 1, name: 1 } })
      .toArray();

    const slugSet = new Set(genres.map((g) => normalizeDbSlug(g.slug)));

    const missing = featured.filter((s) => !slugSet.has(s));

    console.log(JSON.stringify({
      featuredCount: featured.length,
      dbGenreCount: genres.length,
      missingCount: missing.length,
    }, null, 2));

    if (missing.length) {
      console.log("\nMissing FEATURED slugs in DB genres:");
      for (const s of missing) console.log("-", s);
    }

    // Helpful hint: show near matches by substring
    if (missing.length) {
      console.log("\nNear matches (substring search):");
      for (const s of missing) {
        const hits = genres
          .filter((g) => normalizeDbSlug(g.slug).includes(s) || String(g.name ?? "").toLowerCase().includes(s))
          .slice(0, 5)
          .map((g) => ({ slug: g.slug, name: g.name }));
        if (hits.length) console.log(s, "->", hits);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(1);
});
