import mongoose from "mongoose";

import { ENV } from "@/configs/env.config";
import { calculateWaifuLeaderboardSnapshot } from "@/services/waifu-leaderboard.svc";

const run = async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(ENV.MONGO.URI, { maxPoolSize: 10 });
  }

  await calculateWaifuLeaderboardSnapshot();
  console.log("[waifu-leaderboard] snapshot updated");
};

run()
  .then(() => mongoose.disconnect())
  .catch((err) => {
    console.error("[waifu-leaderboard] failed:", err);
    mongoose.disconnect().finally(() => process.exit(1));
  });
