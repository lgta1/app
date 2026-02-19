#!/usr/bin/env tsx
import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { basicSearch } from "~/services/search/basic-search.server";

type CliOptions = {
  queries: string[];
  runs: number;
  mongoUri?: string;
};

const LIMIT_CANDIDATES = [40, 60, 100] as const;

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    queries: [],
    runs: 5,
  };

  for (const arg of args) {
    if (arg.startsWith("--queries=")) {
      const [, raw] = arg.split("=");
      const values = (raw || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      options.queries.push(...values);
      continue;
    }

    if (arg.startsWith("--runs=")) {
      const [, raw] = arg.split("=");
      const parsed = Number.parseInt(raw || "", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.runs = parsed;
      }
      continue;
    }

    if (arg.startsWith("--mongo=")) {
      const [, raw] = arg.split("=");
      const value = (raw || "").trim();
      if (value) {
        options.mongoUri = value;
      }
      continue;
    }

    const direct = arg.trim();
    if (direct) options.queries.push(direct);
  }

  if (options.queries.length === 0) {
    options.queries = ["hentai", "naruto", "one piece"];
  }

  return options;
};

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
};

const avg = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const run = async () => {
  const options = parseArgs();

  console.info(
    `[search-benchmark] queries=${options.queries.length} runs=${options.runs} limits=${LIMIT_CANDIDATES.join(",")}`,
  );

  await mongoose.connect(options.mongoUri || ENV.MONGO.URI, {
    maxPoolSize: 20,
    minPoolSize: 2,
  });

  try {
    for (const query of options.queries) {
      const normalized = query.trim().toLowerCase();
      if (!normalized) continue;

      await basicSearch({ query: normalized, limit: 40 });

      console.info(`\n[search-benchmark] query="${query}"`);
      for (const limit of LIMIT_CANDIDATES) {
        const durations: number[] = [];
        let total = 0;
        let returned = 0;

        for (let index = 0; index < options.runs; index += 1) {
          const startedAt = Date.now();
          const result = await basicSearch({ query: normalized, limit });
          const tookMs = Date.now() - startedAt;

          durations.push(tookMs);
          total = result.total;
          returned = result.items.length;
        }

        console.info(
          `  limit=${limit} avg=${avg(durations).toFixed(1)}ms p95=${percentile(durations, 95).toFixed(
            1,
          )}ms min=${Math.min(...durations).toFixed(1)}ms max=${Math.max(...durations).toFixed(1)}ms returned=${returned} total=${total}`,
        );
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  console.info("\n[search-benchmark] done");
};

run().catch((error) => {
  console.error("[search-benchmark] fatal", error);
  process.exit(1);
});
