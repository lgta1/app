export const GIFT_MILESTONES = [50, 100, 200, 400];

export const GOLD_COST_PER_SUMMON = {
  rateUp: 1, // 2 gold per summon (rate up)
  normal: 1, // 1 gold per summon (normal)
};

export const GOLD_COST_PER_SUMMON_MULTI = {
  rateUp: 9, // 18 gold per summon (rate up)
  normal: 9, // 9 gold per summon (normal)
};

export const MILESTONE_REWARDS = {
  50: { gold: 5 as const },
  100: { gold: 10 as const, waifuStars: 3 as const },
  200: { gold: 20 as const, waifuStars: 4 as const },
  400: { gold: 40 as const, waifuStars: 5 as const },
} as const;

export type MilestoneThreshold = keyof typeof MILESTONE_REWARDS; // 50|100|200|400

export function getMilestoneRewardDescription(m: MilestoneThreshold): string {
  const r = MILESTONE_REWARDS[m];
  if (!r) return "";
  if ("waifuStars" in r) {
    return `+${r.gold} Vàng + 1 Waifu ${r.waifuStars}★`;
  }
  return `+${r.gold} Vàng`;
}
