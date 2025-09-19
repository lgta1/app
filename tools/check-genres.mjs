import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL ||
  "mongodb+srv://hungnm:hungnm@test.jboefj0.mongodb.net/?retryWrites=true&w=majority&appName=test";
const DB_NAME = process.env.DB_NAME || "ww";

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection("genres");
  const count = await col.countDocuments();
  const sample = await col.find({}, {projection:{_id:0,slug:1,name:1}}).limit(10).toArray();

  console.log("DB đang dùng:", DB_NAME);
  console.log("Số genres hiện có:", count);
  console.log("10 mục đầu tiên:", sample);
  await client.close();
})();
