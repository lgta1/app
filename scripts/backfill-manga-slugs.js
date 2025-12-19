#!/usr/bin/env node
/**
 * Populate slug field for all manga documents.
 *
 * Usage:
 *   node scripts/backfill-manga-slugs.js                 # dry run
 *   node scripts/backfill-manga-slugs.js --apply         # apply updates
 *   MONGO_URI=... DB_NAME=app node scripts/backfill-manga-slugs.js --apply
 */

import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "app";
const COLLECTION = process.env.MANGA_COLLECTION || "mangas";

function slugify(str = "") {
  return (
    str
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
  );
}

function nextAvailableSlug(base, existing) {
  const safeBase = base || "manga";
  if (!existing.has(safeBase)) return safeBase;
  let suffix = 2;
  let candidate = `${safeBase}-${suffix}`;
  while (existing.has(candidate)) {
    suffix += 1;
    candidate = `${safeBase}-${suffix}`;
  }
  return candidate;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const APPLY = args.has("--apply");

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION);

  const docs = await col
    .find({}, { projection: { _id: 1, title: 1, slug: 1 }, sort: { createdAt: 1 } })
    .toArray();

  const existing = new Set();
  docs.forEach((doc) => {
    if (doc.slug) {
      existing.add(String(doc.slug));
    }
  });

  const updates = [];
  for (const doc of docs) {
    if (doc.slug && typeof doc.slug === "string" && doc.slug.trim()) continue;
    const base = slugify(doc.title || "");
    const slug = nextAvailableSlug(base, existing);
    existing.add(slug);
    updates.push({ filter: { _id: doc._id }, update: { $set: { slug } }, slug });
  }

  if (updates.length === 0) {
    console.log("All manga already have slugs. Nothing to do.");
    await client.close();
    return;
  }

  console.log(`Prepared ${updates.length} slug updates.`);
  if (!APPLY) {
    console.log("Dry run (pass --apply to persist):");
    console.log(updates.slice(0, 5).map((u) => u.slug));
    await client.close();
    return;
  }

  const bulkOps = updates.map(({ filter, update }) => ({ updateOne: { filter, update } }));
  const result = await col.bulkWrite(bulkOps, { ordered: false });
  console.log(`Updated ${result.modifiedCount || 0} manga documents.`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
