import { grantGoldReward } from "@/services/gold-reward.svc";
import { getTranslatorLeaderboardSnapshot, calculateTranslatorLeaderboard } from "@/services/translator-leaderboard.svc";
import { TranslatorWeeklyRewardModel } from "~/database/models/translator-weekly-reward.model";

const VIETNAM_TZ = "Asia/Ho_Chi_Minh";
const REWARD_PER_1000_VIEWS = 1000;

const getVietnamDateParts = (d = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = formatter.format(d).split("-");
  return { year: Number(year), month: Number(month), day: Number(day) };
};

const formatUtcDateKey = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getLastWeekKey = (d = new Date()) => {
  const vn = getVietnamDateParts(d);
  const vnUtc = new Date(Date.UTC(vn.year, vn.month - 1, vn.day));
  const dayOfWeek = vnUtc.getUTCDay();
  const diffToMonday = (dayOfWeek + 6) % 7; // Monday => 0

  const currentMondayUtc = new Date(vnUtc);
  currentMondayUtc.setUTCDate(vnUtc.getUTCDate() - diffToMonday);

  const lastWeekMondayUtc = new Date(currentMondayUtc);
  lastWeekMondayUtc.setUTCDate(currentMondayUtc.getUTCDate() - 7);
  return formatUtcDateKey(lastWeekMondayUtc);
};

const computeGoldReward = (views: number) => Math.round(views / REWARD_PER_1000_VIEWS);

export const rewardWeeklyTranslatorLeaderboard = async () => {
  const weekKey = getLastWeekKey();
  const rewardedAt = new Date();

  await calculateTranslatorLeaderboard("weekly");
  const rows = await getTranslatorLeaderboardSnapshot("weekly", 200);

  if (!rows.length) return { weekKey, rewardedCount: 0 };

  const results = await Promise.allSettled(
    rows.map(async (row: any) => {
      const userId = row.userId;
      const totalViews = Number(row.totalViews ?? 0);
      const gold = computeGoldReward(totalViews);

      try {
        await TranslatorWeeklyRewardModel.create({
          userId,
          weekKey,
          totalViews,
          gold,
          rewardedAt,
        });
      } catch (error: any) {
        const message = String(error?.message ?? "");
        if (/E11000/i.test(message)) return { skipped: true };
        throw error;
      }

      const viewsText = totalViews.toLocaleString("vi-VN");
      const goldText = gold.toLocaleString("vi-VN");

      try {
        await grantGoldReward({
          userId: String(userId),
          amount: gold,
          title: "Thưởng BXH dịch giả tuần",
          subtitle: `Tuần vừa rồi bạn đạt ${viewsText} lượt xem và nhận ${goldText} Dâm Ngọc.`,
        });
      } catch (error) {
        await TranslatorWeeklyRewardModel.deleteOne({ userId, weekKey });
        throw error;
      }

      return { skipped: false };
    }),
  );

  const rewardedCount = results.filter((res) => res.status === "fulfilled" && !res.value?.skipped).length;
  return { weekKey, rewardedCount };
};
