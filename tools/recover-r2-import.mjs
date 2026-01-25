import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

const args = new Set(process.argv.slice(2));
const getArgValue = (key, fallback = undefined) => {
  const hit = process.argv.find((a) => a.startsWith(`${key}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

const ENV_PATH = getArgValue("--env", ".env.production");
const NDJSON_PATH = getArgValue("--ndjson", "tmp/recovery-full/recovery-chapters.ndjson");
const DRY_RUN = args.has("--dry-run");
const OWNER_EMAIL = getArgValue("--owner-email", "admin@local");
const OWNER_NAME = getArgValue("--owner-name", "admin");
const OWNER_PASSWORD = getArgValue("--owner-pass", "ChangeMe123!");

if (ENV_PATH) {
  dotenv.config({ path: ENV_PATH, override: false });
}

const MONGO_URI = getArgValue("--mongo-uri", process.env.MONGO_URI || process.env.MONGO_URL || "");
const DB_NAME = getArgValue("--db", process.env.DB_NAME || "ww");
const CDN_BASE = (process.env.CDN_BASE || process.env.VITE_CDN_BASE || "").replace(/\/+$/, "");

if (!MONGO_URI) {
  console.error("Missing MONGO_URI. Pass --mongo-uri or set MONGO_URI/MONGO_URL.");
  process.exit(2);
}

if (!fs.existsSync(NDJSON_PATH)) {
  console.error(`NDJSON not found: ${NDJSON_PATH}`);
  process.exit(2);
}

const hashPassword = (password, salt) =>
  crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");

const parseLine = (line) => {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
};

const isObjectId = (value) => ObjectId.isValid(value) && String(new ObjectId(value)) === value;

const main = async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const users = db.collection("users");
  const mangas = db.collection("mangas");
  const chapters = db.collection("chapters");

  let owner = await users.findOne({ email: OWNER_EMAIL });
  if (!owner && !DRY_RUN) {
    const salt = crypto.randomBytes(16).toString("hex");
    const password = hashPassword(OWNER_PASSWORD, salt);
    const insert = {
      name: OWNER_NAME,
      email: OWNER_EMAIL,
      password,
      salt,
      faction: 0,
      gender: 2,
      avatar: "",
      role: "ADMIN",
      level: 1,
      exp: 0,
      gold: 0,
      isBanned: false,
      isDeleted: false,
      summonCount: 0,
      mangasCount: 0,
      warningsCount: 0,
      bio: "",
      currentWaifu: null,
      waifuFilename: null,
      currentWaifuName: null,
      claimedMilestones: [],
      blacklistTags: [],
      hasConfiguredBlacklistTags: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const res = await users.insertOne(insert);
    owner = { ...insert, _id: res.insertedId };
  }

  const ownerId = owner?._id ? String(owner._id) : "system";

  const rl = readline.createInterface({
    input: fs.createReadStream(NDJSON_PATH, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  const mangaStats = new Map();
  let totalChapters = 0;
  let totalImages = 0;

  const chapterOps = [];
  const mangaOps = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = parseLine(line);
    if (!row) continue;

    const mangaIdRaw = String(row.mangaId || "");
    if (!mangaIdRaw) continue;

    const mangaObjectId = isObjectId(mangaIdRaw) ? new ObjectId(mangaIdRaw) : new ObjectId();
    const mangaId = String(mangaObjectId);

    const chapterNumber = Number(row.chapterNumber || 0);
    if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) continue;

    const contentUrls = Array.isArray(row.contentUrls) && row.contentUrls.length > 0
      ? row.contentUrls
      : (Array.isArray(row.objectKeys) && CDN_BASE)
        ? row.objectKeys.map((k) => `${CDN_BASE}/${k}`)
        : [];

    if (!contentUrls.length) continue;

    totalChapters += 1;
    totalImages += contentUrls.length;

    if (!mangaStats.has(mangaId)) {
      mangaStats.set(mangaId, { chapters: 0, firstImage: contentUrls[0] || "" });
    }
    const stat = mangaStats.get(mangaId);
    stat.chapters += 1;
    if (!stat.firstImage && contentUrls[0]) stat.firstImage = contentUrls[0];

    if (!DRY_RUN) {
      chapterOps.push({
        updateOne: {
          filter: { mangaId, chapterNumber },
          update: {
            $setOnInsert: {
              title: `Chapter ${chapterNumber}`,
              slug: "",
              sourceChapterUrl: null,
              viewNumber: 0,
              likeNumber: 0,
              dislikeNumber: 0,
              chapScore: 0,
              commentNumber: 0,
              chapterNumber,
              contentUrls,
              contentBytes: 0,
              mangaId,
              status: 1,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      });

      if (chapterOps.length >= 1000) {
        await chapters.bulkWrite(chapterOps, { ordered: false });
        chapterOps.length = 0;
      }
    }

    if (!mangaStats.has(mangaId)) continue;
  }

  if (!DRY_RUN && chapterOps.length > 0) {
    await chapters.bulkWrite(chapterOps, { ordered: false });
  }

  if (!DRY_RUN) {
    for (const [mangaId, stat] of mangaStats.entries()) {
      const _id = isObjectId(mangaId) ? new ObjectId(mangaId) : new ObjectId();
      mangaOps.push({
        updateOne: {
          filter: { _id },
          update: {
            $setOnInsert: {
              _id,
              title: `Recovered ${mangaId}`,
              slug: mangaId,
              alternateTitle: "",
              description: "",
              poster: stat.firstImage || "",
              shareImage: "",
              chapters: stat.chapters,
              author: "",
              authorNames: [],
              authorSlugs: [],
              status: 1,
              userStatus: 0,
              genres: [],
              doujinshiNames: [],
              doujinshiSlugs: [],
              translatorNames: [],
              translatorSlugs: [],
              characterNames: [],
              characterSlugs: [],
              likeNumber: 0,
              viewNumber: 0,
              dailyViews: 0,
              weeklyViews: 0,
              monthlyViews: 0,
              followNumber: 0,
              ratingSumWeightedScore: 0,
              ratingSumWeight: 0,
              ratingTotalVotes: 0,
              ratingChaptersWithVotes: 0,
              ratingScore: 0,
              ratingUpdatedAt: null,
              translationTeam: "Recovered",
              ownerId,
              keywords: "",
              contentType: "MANGA",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      });

      if (mangaOps.length >= 500) {
        await mangas.bulkWrite(mangaOps, { ordered: false });
        mangaOps.length = 0;
      }
    }

    if (mangaOps.length > 0) {
      await mangas.bulkWrite(mangaOps, { ordered: false });
    }
  }

  console.log("Import summary:", {
    dryRun: DRY_RUN,
    mangaCount: mangaStats.size,
    chapterCount: totalChapters,
    imageCount: totalImages,
  });

  await client.close();
};

main().catch((err) => {
  console.error("Recovery import failed:", err);
  process.exit(1);
});
