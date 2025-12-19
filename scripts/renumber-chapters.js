#!/usr/bin/env node
/**
 * Renumber chapters so that each manga has a continuous sequence 1..N (STT = chapterNumber).
 * ESM version (package.json has "type": "module").
 * Rules:
 *  - Keep current relative ordering: by existing chapterNumber ascending; missing/null chapterNumber put last; tie-break by createdAt ascending.
 *  - Only drag-drop (future) will change order; this migration just repairs gaps / nulls.
 *  - Two-phase update to avoid unique index collisions on (mangaId, chapterNumber):
 *      Phase 1: set temporary values OFFSET+newNumber
 *      Phase 2: set final newNumber
 *  - Dry run by default; requires --apply to commit.
 *
 * Usage examples:
 *   node scripts/renumber-chapters.js                  # dry-run all mangas
 *   node scripts/renumber-chapters.js --m <id1,id2>     # dry-run selected mangaIds
 *   node scripts/renumber-chapters.js --apply --m <id>  # apply for a single manga
 *   node scripts/renumber-chapters.js --apply --all     # apply for all mangaIds
 *   MONGO_URI="mongodb://user:pass@host:27017" DB_NAME="mydb" node scripts/renumber-chapters.js --apply
 *
 * Env vars:
 *   MONGO_URI   Mongo connection string (default: mongodb://localhost:27017)
 *   DB_NAME     Database name (default: app)
 *   COLLECTION  Collection name (default: chapters)
 */

import { MongoClient } from 'mongodb';

// Simple arg parser (avoid extra deps)
function parseArgs(argv) {
  const out = { flags: {}, values: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      const key = arg.slice(2, eqIdx);
      const val = arg.slice(eqIdx + 1);
      out.values[key] = val;
      continue;
    }
    const key = arg.slice(2);
    // If next token exists and is not another flag, treat it as value
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out.values[key] = next;
      i++; // skip consumed
    } else {
      out.flags[key] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const APPLY = !!args.flags.apply;
const ALL = !!args.flags.all;
const mangaIdsArg = args.values.m || '';
const mangaIds = mangaIdsArg
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'app';
const COLLECTION = process.env.COLLECTION || 'chapters';
const OFFSET = 1_000_000_000; // large temporary offset

function stableSortChapters(docs) {
  return docs.sort((a, b) => {
    const aNum = a.chapterNumber == null ? Number.POSITIVE_INFINITY : a.chapterNumber;
    const bNum = b.chapterNumber == null ? Number.POSITIVE_INFINITY : b.chapterNumber;
    if (aNum !== bNum) return aNum - bNum;
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aCreated - bCreated;
  });
}

async function collectTargetMangaIds(col) {
  if (ALL || mangaIds.length === 0) {
    const rows = await col.aggregate([
      { $group: { _id: '$mangaId', count: { $sum: 1 } } },
      { $match: { _id: { $ne: null } } }
    ]).toArray();
    return rows.map((r) => r._id);
  }
  return mangaIds;
}

function buildMapping(docs) {
  return docs.map((d, idx) => ({ _id: d._id, old: d.chapterNumber, proposed: idx + 1 }));
}

function printMappingSample(mangaId, mapping) {
  console.log(`Proposed mapping for mangaId=${mangaId} (show up to 40):`);
  mapping.slice(0, 40).forEach((m) => {
    console.log(`${m._id.toString()} old=${m.old == null ? 'null' : m.old} -> ${m.proposed}`);
  });
  if (mapping.length > 40) console.log(`... (${mapping.length - 40} more)`);
}

function buildPhaseUpdateOps(mapping, phase) {
  if (phase === 1) {
    return mapping.map((m) => ({
      updateOne: {
        filter: { _id: m._id },
        update: { $set: { chapterNumber: m.proposed + OFFSET, updatedAt: new Date() } }
      }
    }));
  }
  return mapping.map((m) => ({
    updateOne: {
      filter: { _id: m._id },
      update: { $set: { chapterNumber: m.proposed, updatedAt: new Date() } }
    }
  }));
}

async function verifyAfter(col, mangaId) {
  const docs = await col.find({ mangaId }).toArray();
  if (!docs.length) return { chapters: 0, ok: true };
  const nums = docs.map((d) => d.chapterNumber).filter((n) => typeof n === 'number');
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const set = new Set(nums);
  const gaps = [];
  for (let i = 1; i <= max; i++) {
    if (!set.has(i)) gaps.push(i);
  }
  const hasOne = set.has(1);
  const ok = hasOne && gaps.length === 0 && nums.length === docs.length && max === docs.length;
  return { chapters: docs.length, min, max, hasOne, gaps, ok };
}

async function run() {
  console.log('=== Renumber Chapters Migration ===');
  console.log('Mongo URI:', MONGO_URI);
  console.log('DB Name:', DB_NAME);
  console.log('Collection:', COLLECTION);
  console.log('Apply mode:', APPLY ? 'YES' : 'NO (dry-run)');

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION);

  let targets = await collectTargetMangaIds(col);

  // Optional: auto-select only problematic mangaIds when --issues flag is provided.
  if (args.flags.issues) {
    console.log('Detecting problematic mangaIds (gaps, missing 1, count!=max)...');
    const problemRows = await col.aggregate([
      { $group: { _id: '$mangaId', nums: { $addToSet: '$chapterNumber' }, min: { $min: '$chapterNumber' }, max: { $max: '$chapterNumber' }, count: { $sum: 1 } } },
      { $project: { min: 1, max: 1, count: 1, uniqueCount: { $size: '$nums' }, hasOne: { $in: [1, '$nums'] }, missing: { $setDifference: [ { $range: [1, { $add: ['$max', 1] }] }, '$nums' ] } } },
      { $addFields: { hasGaps: { $gt: [ { $size: '$missing' }, 0 ] } } },
      { $match: { $or: [ { hasGaps: true }, { hasOne: false }, { $expr: { $ne: ['$count', '$max'] } }, { $expr: { $ne: ['$uniqueCount', '$count'] } } ] } },
      { $project: { _id: 1 } }
    ]).toArray();
    const problemIds = problemRows.map(r => r._id);
    console.log('Problematic mangaIds found:', problemIds.length);
    if (problemIds.length === 0) {
      console.log('No problematic mangaIds detected. Nothing to do.');
      return;
    }
    // If user also passed explicit --m list, intersect
    if (mangaIds.length > 0 && !ALL) {
      targets = problemIds.filter(id => mangaIds.includes(id));
      console.log('Intersected with provided --m list -> final targets:', targets.length);
    } else {
      targets = problemIds;
    }
  }

  console.log('Total mangaIds to process:', targets.length);
  if (targets.length === 0) {
    console.warn('WARNING: No target mangaIds found. Possible causes:');
    console.warn(' - Provided IDs not found in collection');
    console.warn(' - Database name incorrect (current DB:', DB_NAME, ')');
    console.warn(' - Collection name incorrect (current collection:', COLLECTION, ')');
    console.warn(' - You intended --m <ids> but parser previously missed them. Now supports space form.');
    console.warn('Try: node scripts/renumber-chapters.js --m="id1,id2"  or  --m id1,id2');
  }

  const summary = [];

  for (const mid of targets) {
    console.log('\n--- Processing mangaId:', mid);
    const docs = await col.find({ mangaId: mid }).toArray();
    if (!docs.length) {
      console.log(' No chapters found, skip.');
      continue;
    }

    stableSortChapters(docs);
    const mapping = buildMapping(docs);
    printMappingSample(mid, mapping);

    if (!APPLY) {
      summary.push({ mangaId: mid, chapters: docs.length, applied: false });
      continue; // dry-run only
    }

    // Phase 1: temporary high numbers
    const phase1Ops = buildPhaseUpdateOps(mapping, 1);
    try {
      const r1 = await col.bulkWrite(phase1Ops, { ordered: false });
      console.log(' Phase1 OK: modified:', r1.modifiedCount ?? 'n/a');
    } catch (err) {
      console.error(' Phase1 error:', err.message);
      summary.push({ mangaId: mid, chapters: docs.length, applied: false, error: 'phase1' });
      continue;
    }

    // Phase 2: final numbering
    const phase2Ops = buildPhaseUpdateOps(mapping, 2);
    try {
      const r2 = await col.bulkWrite(phase2Ops, { ordered: false });
      console.log(' Phase2 OK: modified:', r2.modifiedCount ?? 'n/a');
    } catch (err) {
      console.error(' Phase2 error:', err.message);
      summary.push({ mangaId: mid, chapters: docs.length, applied: false, error: 'phase2' });
      continue;
    }

    // Verification
    const verify = await verifyAfter(col, mid);
    console.log(' Verification:', verify);
    summary.push({ mangaId: mid, chapters: docs.length, applied: true, verify });
  }

  console.log('\n=== Summary ===');
  summary.forEach((s) => {
    console.log(JSON.stringify(s));
  });

  await client.close();
  console.log('\nDone.');
}

// Top-level invoke (ESM safe)
run().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
