// /home/devuser/ww-new/scripts/seed-genres-inline.cjs
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const DB_NAME   = process.env.DB_NAME   || "ww";

// Quan trọng: dùng file CJS
const GENRES = require("./genres.array.cjs");

const now = () => new Date();

(async () => {
  console.log("→ Connecting MongoDB:", MONGO_URI, "DB:", DB_NAME);
  const cli = new MongoClient(MONGO_URI, { ignoreUndefined: true });
  await cli.connect();
  const db  = cli.db(DB_NAME);
  const col = db.collection("genres");
  console.log("→ Connected. Ensuring index…");

  await col.createIndex({ slug: 1 }, { unique: true });

  let inserts = 0, updates = 0, skipped = 0;
  console.log("→ Seeding", GENRES.length, "records…");

  for (const raw of GENRES) {
    if (!raw || !raw.slug || !raw.name) { skipped++; continue; }

    const g = {
      name: String(raw.name),
      slug: String(raw.slug),
      // gom hết về "general" (bỏ most_viewed/other/hardcore)
      category: (raw.category && !["most_viewed","other","hardcore"].includes(raw.category))
        ? raw.category
        : "general",
      description: (raw.description ?? "").toString(),
      createdAt: raw.createdAt ? new Date(raw.createdAt) : now(),
      updatedAt: now(),
    };

    const existed = await col.findOne({ slug: g.slug }, { projection: { _id: 1, createdAt: 1 } });
    if (existed) {
      const r = await col.updateOne(
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
      if (r.modifiedCount) updates += r.modifiedCount;
    } else {
      await col.insertOne(g);
      inserts++;
    }
  }

  const total = await col.countDocuments();
  console.log("✅ DONE", { total, inserts, updates, skipped });

  const ck = await col.find(
    { slug: { $in: ["bondage", "slave"] } },
    { projection: { _id: 0, slug: 1, name: 1 } }
  ).toArray();
  console.log("Check bondage/slave:", ck);

  await cli.close();
})().catch(e => {
  console.error("❌ Seed error:", e);
  process.exit(1);
});
