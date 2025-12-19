#!/usr/bin/env node
/**
 * Audit manga.genres values against the genres catalog in DB.
 * Helps detect drift: accented names, spaces, legacy values.
 *
 * Usage:
 *   MONGO_URI='mongodb://...' DB_NAME='ww' node tools/audit-manga-genres.mjs
 *
 * Optional:
 *   GENRES_COLLECTION='genres'
 *   MANGA_COLLECTION='mangas'
 *   LIMIT=5000
 */

import process from "node:process";
import { MongoClient } from "mongodb";

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI || "";
  const DB_NAME = process.env.DB_NAME || "";
  const GENRES_COLLECTION = process.env.GENRES_COLLECTION || "genres";
  const MANGA_COLLECTION = process.env.MANGA_COLLECTION || "mangas";
  const LIMIT = Number(process.env.LIMIT || "5000");

  if (!MONGO_URI || !DB_NAME) {
    console.error("Missing env vars. Example:\n  MONGO_URI='mongodb://127.0.0.1:27017' DB_NAME='ww' node tools/audit-manga-genres.mjs");
    process.exit(2);
  }

  const client = new MongoClient(MONGO_URI, { ignoreUndefined: true });
  await client.connect();
  try {
    const db = client.db(DB_NAME);
    const genresCol = db.collection(GENRES_COLLECTION);
    const mangaCol = db.collection(MANGA_COLLECTION);

    const genres = await genresCol.find({}, { projection: { slug: 1 } }).toArray();
    const slugSet = new Set(genres.map((g) => norm(g.slug)));

    const cursor = mangaCol.find(
      { genres: { $exists: true, $ne: [] } },
      { projection: { genres: 1, slug: 1, title: 1, contentType: 1, status: 1 } }
    ).limit(LIMIT);

    const freq = new Map();
    let scanned = 0;

    for await (const doc of cursor) {
      scanned++;
      const list = Array.isArray(doc.genres) ? doc.genres : [];
      for (const g of list) {
        const key = norm(g);
        if (!key) continue;
        if (slugSet.has(key)) continue;
        freq.set(key, (freq.get(key) || 0) + 1);
      }
    }

    const top = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([value, count]) => ({ value, count }));

    console.log(JSON.stringify({
      dbGenreCount: genres.length,
      scannedManga: scanned,
      unknownGenreValueCount: freq.size,
      topUnknown: top,
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(1);
});
