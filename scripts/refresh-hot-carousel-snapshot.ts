#!/usr/bin/env tsx
import mongoose from "mongoose";

import { initMongoDB } from "~/database/connection";
import {
  forceRefreshHotCarouselSnapshot,
  getHotCarouselSnapshotInfo,
} from "@/queries/leaderboad.query";

const waitForMongo = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) return;

  await new Promise<void>((resolve, reject) => {
    const onConnected = () => {
      cleanup();
      resolve();
    };
    const onError = (err: unknown) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      mongoose.connection.off("connected", onConnected);
      mongoose.connection.off("error", onError);
    };

    mongoose.connection.on("connected", onConnected);
    mongoose.connection.on("error", onError);
  });
};

const main = async () => {
  initMongoDB();
  await waitForMongo();

  const before = await getHotCarouselSnapshotInfo();
  console.info("[hot-snapshot] before", before);

  const refreshed = await forceRefreshHotCarouselSnapshot();
  console.info("[hot-snapshot] refreshed", refreshed);

  const after = await getHotCarouselSnapshotInfo();
  console.info("[hot-snapshot] after", after);

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("[hot-snapshot] failed", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
