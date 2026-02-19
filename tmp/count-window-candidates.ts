import mongoose from "mongoose";

async function run() {
  const uri = process.env.MONGO_URL;
  if (!uri) throw new Error("MONGO_URL missing");
  await mongoose.connect(uri, { maxPoolSize: 10 });
  const db = mongoose.connection.db;

  const from = new Date("2026-02-18T02:10:00.000Z");
  const to = new Date("2026-02-18T04:10:00.000Z");

  const r = await db.collection("mangas").aggregate([
    { $match: { status: 1, updatedAt: { $gte: from, $lte: to } } },
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
    { $set: { chapters: { $ifNull: ["$ch.chapters", 0] }, maxChapterAt: "$ch.maxChapterAt", lagMs: { $subtract: ["$updatedAt", "$ch.maxChapterAt"] } } },
    { $facet: {
      totalWindow: [{ $count: "c" }],
      candidates: [{ $match: { chapters: { $gt: 0 }, lagMs: { $gt: 15*60*1000 } } }, { $count: "c" }],
      sample: [{ $match: { chapters: { $gt: 0 }, lagMs: { $gt: 15*60*1000 } } }, { $project: { title:1, slug:1, updatedAt:1, maxChapterAt:1, lagMs:1 } }, { $sort: { lagMs: -1 } }, { $limit: 5 }]
    } }
  ]).toArray();

  console.log(JSON.stringify({ from, to, result: r[0] }, null, 2));
}

run().catch((e)=>{console.error(e);process.exit(1)}).finally(async()=>{await mongoose.disconnect()});
