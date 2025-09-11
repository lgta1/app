const { MongoClient } = require("mongodb");

// Cho phép truyền qua env khi chạy
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const DB_NAME   = process.env.DB_NAME   || "ww";

// Mảng genres đã tách từ scripts/genres.array.js
const GENRES = require("./genres.array.js");

const now = () => new Date();

function normalize(g) {
  return {
    name: (g.name || "").toString(),
    slug: (g.slug || "").toString(),
    // Toàn bộ về "general" (đã bỏ nhóm)
    category: (g.category && !["most_viewed", "other", "hardcore"].includes(g.category))
      ? g.category
      : "general",
    description: (g.description ?? "").toString(),
    createdAt: g.createdAt ? new Date(g.createdAt) : now(),
    updatedAt: now(),
  };
}

(async () => {
  const cli = new MongoClient(MONGO_URI, { ignoreUndefined: true });
  await cli.connect();
  const db  = cli.db(DB_NAME);
  const col = db.collection("genres");

  // Unique index theo slug
  await col.createIndex({ slug: 1 }, { unique: true });

  let inserts = 0, updates = 0, skipped = 0;

  for (const raw of GENRES) {
    if (!raw || !raw.slug || !raw.name) { skipped++; continue; }
    const g = normalize(raw);

    const existed = await col.findOne(
      { slug: g.slug },
      { projection: { _id: 1, createdAt: 1 } }
    );

    if (existed) {
      const res = await col.updateOne(
        { slug: g.slug },
        {
          $set: {
            name: g.name,
            slug: g.slug,
            category: g.category,
            description: g.description,
            updatedAt: now(),
          },
          $setOnInsert: { createdAt: existed.createdAt || now() },
        },
        { upsert: true }
      );
      if (res.modifiedCount) updates += res.modifiedCount;
    } else {
      await col.insertOne(g);
      inserts++;
    }
  }

  const total = await col.countDocuments();
  console.log("✅ Seed genres DONE");
  console.log({ total, inserts, updates, skipped });

  // Kiểm tra nhanh 2 slug từng thiếu
  const check = await col.find(
    { slug: { $in: ["bondage", "slave"] } },
    { projection: { slug: 1, name: 1, _id: 0 } }
  ).toArray();
  console.log("Check bondage/slave:", check);

  await cli.close();
})().catch(e => {
  console.error("❌ Seed error:", e);
  process.exit(1);
});
