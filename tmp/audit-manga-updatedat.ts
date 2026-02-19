import mongoose from "mongoose";

async function run() {
  const uri = process.env.MONGO_URL;
  if (!uri) throw new Error("MONGO_URL missing");
  await mongoose.connect(uri, { maxPoolSize: 10 });

  const db = mongoose.connection.db;
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const suspect = await db.collection("mangas").aggregate([
    { $match: { status: 1, updatedAt: { $gte: sixHoursAgo } } },
    {
      $lookup: {
        from: "chapters",
        let: { mangaIdStr: { $toString: "$_id" } },
        pipeline: [
          { $match: { $expr: { $eq: ["$mangaId", "$$mangaIdStr"] } } },
          { $project: { t: { $ifNull: ["$updatedAt", "$createdAt"] } } },
          { $group: { _id: null, maxChapterAt: { $max: "$t" }, chapters: { $sum: 1 } } },
        ],
        as: "ch",
      },
    },
    { $set: { ch: { $first: "$ch" } } },
    {
      $set: {
        maxChapterAt: "$ch.maxChapterAt",
        chapters: { $ifNull: ["$ch.chapters", 0] },
        lagMs: {
          $cond: [
            { $and: [{ $ne: ["$ch.maxChapterAt", null] }, { $ne: ["$updatedAt", null] }] },
            { $subtract: ["$updatedAt", "$ch.maxChapterAt"] },
            null,
          ],
        },
      },
    },
    { $match: { chapters: { $gt: 0 }, lagMs: { $gt: 15 * 60 * 1000 } } },
    { $count: "count" },
  ]).toArray();

  const suspectSample = await db.collection("mangas").aggregate([
    { $match: { status: 1, updatedAt: { $gte: sixHoursAgo } } },
    {
      $lookup: {
        from: "chapters",
        let: { mangaIdStr: { $toString: "$_id" } },
        pipeline: [
          { $match: { $expr: { $eq: ["$mangaId", "$$mangaIdStr"] } } },
          { $project: { t: { $ifNull: ["$updatedAt", "$createdAt"] }, chapterNumber: 1 } },
          { $sort: { t: -1, chapterNumber: -1 } },
          { $limit: 1 },
        ],
        as: "latest",
      },
    },
    { $set: { latest: { $first: "$latest" } } },
    { $match: { "latest.t": { $ne: null } } },
    { $set: { lagMs: { $subtract: ["$updatedAt", "$latest.t"] } } },
    { $match: { lagMs: { $gt: 15 * 60 * 1000 } } },
    { $project: { title: 1, slug: 1, updatedAt: 1, latestChapterAt: "$latest.t", latestChapterNumber: "$latest.chapterNumber", lagMs: 1 } },
    { $sort: { lagMs: -1 } },
    { $limit: 30 },
  ]).toArray();

  console.log(JSON.stringify({
    now: now.toISOString(),
    sixHoursAgo: sixHoursAgo.toISOString(),
    suspectCount: suspect?.[0]?.count || 0,
    suspectSample,
  }, null, 2));
}

run().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await mongoose.disconnect(); });
