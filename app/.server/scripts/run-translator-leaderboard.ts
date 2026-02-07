import mongoose from "mongoose";

import { initMongoDB } from "~/database/connection";
import { calculateTranslatorLeaderboard } from "~/.server/services/translator-leaderboard.svc";

const main = async () => {
  initMongoDB();

  if (mongoose.connection.readyState !== 1) {
    await new Promise<void>((resolve, reject) => {
      const onConnected = () => {
        cleanup();
        resolve();
      };
      const onError = (err: any) => {
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
  }

  await Promise.all([
    calculateTranslatorLeaderboard("weekly"),
    calculateTranslatorLeaderboard("monthly"),
    calculateTranslatorLeaderboard("alltime"),
  ]);

  // eslint-disable-next-line no-console
  console.log("[translator-leaderboard] snapshots updated");

  await mongoose.disconnect();
};

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error("[translator-leaderboard] failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
