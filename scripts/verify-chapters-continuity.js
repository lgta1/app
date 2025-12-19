#!/usr/bin/env node
/**
 * verify-chapters-continuity.js (ESM)
 * Quick global verification after renumber:
 *  - Reports counts of problematic manga (gaps, missing chapter 1, count!=max, duplicate pairs)
 *  - Lists up to N sample problematic mangaIds per category
 * Usage:
 *   MONGO_URI="mongodb://..." DB_NAME="app" node scripts/verify-chapters-continuity.js
 * Env:
 *   MONGO_URI, DB_NAME, COLLECTION (default chapters)
 */
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'app';
const COLLECTION = process.env.COLLECTION || 'chapters';
const SAMPLE_LIMIT = parseInt(process.env.SAMPLE_LIMIT || '10', 10);

async function main(){
  console.log('=== Chapters Continuity Verification ===');
  console.log('Mongo URI:', MONGO_URI);
  console.log('DB Name:', DB_NAME);
  console.log('Collection:', COLLECTION);

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION);

  // Duplicate pairs
  const dupCountArr = await col.aggregate([
    { $group: { _id: { mangaId: '$mangaId', chapterNumber: '$chapterNumber' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'c' }
  ]).toArray();
  const duplicatePairs = dupCountArr.length ? dupCountArr[0].c : 0;

  // Problem continuity
  const problemAgg = await col.aggregate([
    { $group: { _id: '$mangaId', nums: { $addToSet: '$chapterNumber' }, min: { $min: '$chapterNumber' }, max: { $max: '$chapterNumber' }, count: { $sum: 1 } } },
    { $project: { min:1, max:1, count:1, uniqueCount: { $size: '$nums' }, hasOne: { $in: [1,'$nums'] }, missing: { $setDifference: [ { $range: [1,{ $add: ['$max',1] }] }, '$nums' ] } } },
    { $addFields: { hasGaps: { $gt: [ { $size: '$missing' }, 0 ] } } },
    { $match: { $or: [ { hasGaps: true }, { hasOne: false }, { $expr: { $ne: ['$count','$max'] } }, { $expr: { $ne: ['$uniqueCount','$count'] } } ] } }
  ]).toArray();

  const continuityIssues = problemAgg.length;
  const sampleIssues = problemAgg.slice(0, SAMPLE_LIMIT).map(r => ({ mangaId: r._id, min: r.min, max: r.max, count: r.count }));

  const summary = {
    duplicatePairs,
    continuityIssues,
    sampleIssues,
    ok: duplicatePairs === 0 && continuityIssues === 0
  };

  console.log('\nSummary:');
  console.log(JSON.stringify(summary, null, 2));

  if (summary.ok) {
    console.log('✅ All good: no duplicates or continuity gaps detected.');
  } else {
    console.log('⚠ Issues detected. See sampleIssues for details.');
    console.log('To auto-fix: use --issues flag on renumber-chapters.js');
  }

  await client.close();
  console.log('Done.');
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
