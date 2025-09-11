// scripts/backup-genres.cjs  (CommonJS, chạy được dù project "type": "module")
const { MongoClient } = require("mongodb");
const fs = require("fs");

// ❗️Sửa URI/DB_NAME nếu DB của bạn không phải localhost
const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME   = "ww";

(async () => {
  const cli = new MongoClient(MONGO_URI);
  await cli.connect();
  const db = cli.db(DB_NAME);
  const data = await db.collection("genres").find({}).toArray();
  fs.writeFileSync("scripts/backup.genres.json", JSON.stringify(data, null, 2));
  console.log("✅ Backup xong:", "scripts/backup.genres.json", `(${data.length} records)`);
  await cli.close();
})().catch(e => { console.error(e); process.exit(1); });
