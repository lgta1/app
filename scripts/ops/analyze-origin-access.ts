import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

type OriginAccessEntry = {
  ts?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  bytes?: number;
  cacheControl?: string;
  hasSessionCookie?: boolean;
  cf?: {
    ray?: string;
    connectingIp?: string;
    ipCountry?: string;
    visitor?: string;
    cacheStatus?: string;
  };
};

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, "logs");
const SINCE_MINUTES = Number.parseInt(process.argv[2] || "60", 10);
const SINCE = Number.isFinite(SINCE_MINUTES)
  ? new Date(Date.now() - Math.max(1, SINCE_MINUTES) * 60_000)
  : new Date(Date.now() - 60 * 60_000);

const combinedFiles = fs
  .readdirSync(LOG_DIR)
  .filter((name) => /^ww-\d+-combined\.log$/.test(name))
  .sort();

const totals = {
  rows: 0,
  withSession: 0,
  withoutSession: 0,
  bytes: 0,
  byStatus: new Map<string, number>(),
  byPath: new Map<string, number>(),
  byPathNoSession: new Map<string, number>(),
  byCacheControl: new Map<string, number>(),
};

const addCount = (map: Map<string, number>, key: string) => {
  map.set(key, (map.get(key) || 0) + 1);
};

const toTop = (map: Map<string, number>, limit = 20) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

const parseOriginEntry = (line: string): OriginAccessEntry | null => {
  const marker = "[origin-access] ";
  const at = line.indexOf(marker);
  if (at < 0) return null;

  const jsonPart = line.slice(at + marker.length).trim();
  if (!jsonPart.startsWith("{")) return null;

  try {
    return JSON.parse(jsonPart) as OriginAccessEntry;
  } catch {
    return null;
  }
};

for (const name of combinedFiles) {
  const fullPath = path.join(LOG_DIR, name);
  const stream = fs.createReadStream(fullPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.includes("[origin-access]")) continue;
    const entry = parseOriginEntry(line);
    if (!entry) continue;

    if (!entry.ts) continue;
    const ts = new Date(entry.ts);
    if (Number.isNaN(ts.getTime())) continue;
    if (ts < SINCE) continue;

    totals.rows += 1;
    if (entry.hasSessionCookie) totals.withSession += 1;
    else totals.withoutSession += 1;

    if (typeof entry.bytes === "number" && Number.isFinite(entry.bytes)) {
      totals.bytes += entry.bytes;
    }

    addCount(totals.byStatus, String(entry.status ?? "unknown"));
    addCount(totals.byPath, String(entry.path || "(unknown)"));
    if (!entry.hasSessionCookie) {
      addCount(totals.byPathNoSession, String(entry.path || "(unknown)"));
    }
    addCount(totals.byCacheControl, String(entry.cacheControl || "(none)"));
  }
}

const mb = (totals.bytes / (1024 * 1024)).toFixed(2);

console.log(`\n[origin-access-report] since=${SINCE.toISOString()} (${SINCE_MINUTES}m)`);
console.log(`[origin-access-report] rows=${totals.rows} noSession=${totals.withoutSession} withSession=${totals.withSession} bytesMB=${mb}`);

console.log("\n[top status]");
for (const [key, value] of toTop(totals.byStatus, 10)) {
  console.log(`${value}\t${key}`);
}

console.log("\n[top cache-control]");
for (const [key, value] of toTop(totals.byCacheControl, 15)) {
  console.log(`${value}\t${key}`);
}

console.log("\n[top paths - all]");
for (const [key, value] of toTop(totals.byPath, 30)) {
  console.log(`${value}\t${key}`);
}

console.log("\n[top paths - anonymous only]");
for (const [key, value] of toTop(totals.byPathNoSession, 30)) {
  console.log(`${value}\t${key}`);
}
