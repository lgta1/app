import dotenv from "dotenv";
import { Client } from "minio";
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const getArgValue = (key, fallback = undefined) => {
  const hit = process.argv.find((a) => a.startsWith(`${key}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

const ENV_PATH = getArgValue("--env", ".env.production");
const MAX_OBJECTS = Number.parseInt(getArgValue("--max-objects", "5000"), 10);
const MAX_MANGA = Number.parseInt(getArgValue("--max-manga", "0"), 10);
const WITH_URLS = !args.has("--no-urls");
const OVERRIDE_ENV = args.has("--override-env");
const LIST_TIMEOUT_MS = Number.parseInt(getArgValue("--list-timeout-ms", "30000"), 10);
const OUT_DIR = getArgValue("--out", "tmp/recovery");
const PREFIXES = (getArgValue("--prefixes", "manga-images,story-images,test/manga-images,test/story-images") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Load env
if (ENV_PATH) {
  dotenv.config({ path: ENV_PATH, override: OVERRIDE_ENV });
}

const bucket = process.env.MINIO_DEFAULT_BUCKET || "vnht-images";
const cdnBase = (process.env.CDN_BASE || process.env.VITE_CDN_BASE || "").replace(/\/+$/, "");

const endPoint = process.env.MINIO_ENDPOINT;
if (!endPoint) {
  console.error("Missing MINIO_ENDPOINT");
  process.exit(2);
}

const useSSL = (process.env.MINIO_USE_SSL || "true").toLowerCase() === "true";
const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;
const region = process.env.MINIO_REGION || "auto";
const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || "").toLowerCase() === "true";

const isR2 = endPoint.includes(".r2.cloudflarestorage.com");
const pathStyle = forcePathStyle ? true : !isR2;

const client = new Client({
  endPoint,
  useSSL,
  accessKey,
  secretKey,
  region,
  port: isR2 ? 443 : undefined,
  pathStyle,
});

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const normalizeKey = (key) => key.replace(/^\/+/, "");

const parseKey = (key) => {
  const normalized = normalizeKey(key);
  const matchedPrefix = PREFIXES.find((p) => normalized.startsWith(`${p}/`));
  if (!matchedPrefix) return null;

  const rest = normalized.slice(matchedPrefix.length + 1);
  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 3) return null; // mangaId/chapter/file

  const [mangaId, chapterRaw] = parts;
  const chapterNumber = Number.parseInt(chapterRaw, 10);
  if (!mangaId || Number.isNaN(chapterNumber)) return null;

  return { mangaId, chapterNumber, key: normalized };
};

const scanPrefix = async (prefix, state) => {
  return new Promise((resolve, reject) => {
    const stream = client.listObjectsV2(bucket, prefix, true);
    let stopped = false;
    const timeout = setTimeout(() => {
      if (stopped) return;
      stopped = true;
      stream.destroy();
      resolve();
    }, LIST_TIMEOUT_MS);
    stream.on("data", (obj) => {
      if (!obj?.name) return;
      if (state.totalObjects >= MAX_OBJECTS) {
        if (!stopped) {
          stopped = true;
          stream.destroy();
          resolve();
        }
        return;
      }

      const parsed = parseKey(obj.name);
      if (!parsed) return;

      if (!state.manga.has(parsed.mangaId)) {
        if (MAX_MANGA > 0 && state.manga.size >= MAX_MANGA) {
          if (!stopped) {
            stopped = true;
            stream.destroy();
            resolve();
          }
          return;
        }
        state.manga.set(parsed.mangaId, new Map());
      }

      const chapters = state.manga.get(parsed.mangaId);
      if (!chapters.has(parsed.chapterNumber)) {
        chapters.set(parsed.chapterNumber, []);
      }
      chapters.get(parsed.chapterNumber).push(parsed.key);
      state.totalObjects += 1;
    });
    stream.on("error", (err) => {
      if (stopped) return;
      clearTimeout(timeout);
      reject(err);
    });
    stream.on("end", () => {
      if (stopped) return;
      clearTimeout(timeout);
      resolve();
    });
  });
};

const main = async () => {
  const state = { manga: new Map(), totalObjects: 0 };
  for (const prefix of PREFIXES) {
    if (state.totalObjects >= MAX_OBJECTS) break;
    await scanPrefix(prefix, state);
  }

  ensureDir(OUT_DIR);

  const summary = {
    generatedAt: new Date().toISOString(),
    bucket,
    endPoint,
    cdnBase,
    prefixes: PREFIXES,
    totalObjects: state.totalObjects,
    mangaCount: state.manga.size,
  };

  fs.writeFileSync(path.join(OUT_DIR, "recovery-summary.json"), JSON.stringify(summary, null, 2));

  const outPath = path.join(OUT_DIR, "recovery-chapters.ndjson");
  const out = fs.createWriteStream(outPath, { flags: "w" });

  for (const [mangaId, chapters] of state.manga.entries()) {
    const chapterNumbers = Array.from(chapters.keys()).sort((a, b) => a - b);
    for (const chapterNumber of chapterNumbers) {
      const keys = chapters.get(chapterNumber) || [];
      const sortedKeys = keys.slice().sort();
      const contentUrls = WITH_URLS && cdnBase
        ? sortedKeys.map((k) => `${cdnBase}/${k}`)
        : [];

      const line = {
        mangaId,
        chapterNumber,
        objectKeys: sortedKeys,
        contentUrls,
        imageCount: sortedKeys.length,
      };
      out.write(`${JSON.stringify(line)}\n`);
    }
  }

  out.end();
  console.log("Recovery scan done:", summary);
  console.log("NDJSON:", outPath);
};

main().catch((err) => {
  console.error("Recovery scan failed:", err);
  process.exit(1);
});
