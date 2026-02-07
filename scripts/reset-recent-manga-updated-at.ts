#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

const envPath = path.resolve(process.cwd(), ".env.production");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

import { ENV } from "@/configs/env.config";
import { MangaModel } from "~/database/models/manga.model";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {
    dryRun: false,
    hours: 1,
    months: 24,
  };
  for (const arg of args) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--hours=")) {
      const value = Number.parseFloat(arg.split("=")[1] || "");
      if (!Number.isNaN(value) && value > 0) opts.hours = value;
    } else if (arg.startsWith("--months=")) {
      const value = Number.parseInt(arg.split("=")[1] || "", 10);
      if (!Number.isNaN(value) && value > 0) opts.months = value;
    }
  }
  return opts;
};

const subtractMonths = (date: Date, months: number) => {
  const next = new Date(date.getTime());
  const desiredMonth = next.getMonth() - months;
  next.setMonth(desiredMonth);
  return next;
};

const run = async () => {
  const opts = parseArgs();
  await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 10 });

  const now = new Date();
  const threshold = new Date(now.getTime() - opts.hours * 60 * 60 * 1000);
  const targetDate = subtractMonths(now, opts.months);

  const filter = { updatedAt: { $gte: threshold } };
  const total = await MangaModel.countDocuments(filter);
  console.info(
    `reset-recent-manga-updated-at: found=${total} threshold=${threshold.toISOString()} target=${targetDate.toISOString()} dryRun=${opts.dryRun}`,
  );

  if (!opts.dryRun && total > 0) {
    const res = await MangaModel.updateMany(
      filter,
      { $set: { updatedAt: targetDate } },
      { timestamps: false },
    );
    console.info(`updated=${res.modifiedCount}`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("reset-recent-manga-updated-at failed", error);
  process.exitCode = 1;
});
