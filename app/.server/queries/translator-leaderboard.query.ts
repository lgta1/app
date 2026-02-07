import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";
import type { TranslatorLeaderboardPeriod } from "~/.server/services/translator-leaderboard.svc";
import { getTranslatorLeaderboardSnapshot } from "~/.server/services/translator-leaderboard.svc";

export type TranslatorLeaderboardItem = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  rank: number;
  totalViews: number;
  calculatedAt?: Date;
};

export const getTranslatorLeaderboard = async (
  period: TranslatorLeaderboardPeriod,
  limit?: number,
): Promise<TranslatorLeaderboardItem[]> => {
  const rows = await getTranslatorLeaderboardSnapshot(period, limit);
  return (rows as any[]).map((row) => ({
    id: String((row as any)._id ?? ""),
    userId: String((row as any).userId ?? ""),
    userName: String((row as any).userName ?? ""),
    userAvatar:
      typeof (row as any).userAvatar === "string"
        ? rewriteLegacyCdnUrl((row as any).userAvatar)
        : (row as any).userAvatar,
    rank: Number((row as any).rank ?? 0),
    totalViews: Number((row as any).totalViews ?? 0),
    calculatedAt: (row as any).calculatedAt,
  }));
};
