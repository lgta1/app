export const REACTION_TYPES = [
  "like",
  "love",
  "care",
  "haha",
  "wow",
  "sad",
  "angry",
] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];

export type ReactionCounts = Record<ReactionType, number>;

export const REACTION_META: Record<ReactionType, { label: string; emoji: string; priority: number }> = {
  // Tie-break priority: lower = higher priority
  love: { label: "Yêu thích", emoji: "❤️", priority: 0 },
  like: { label: "Like", emoji: "👍", priority: 1 },
  care: { label: "Thương thương", emoji: "🥰", priority: 2 },
  haha: { label: "Haha", emoji: "😂", priority: 3 },
  wow: { label: "Wow", emoji: "😮", priority: 4 },
  sad: { label: "Buồn", emoji: "😢", priority: 5 },
  angry: { label: "Phẫn nộ", emoji: "😡", priority: 6 },
};

export const normalizeReactionType = (value: unknown): ReactionType | null => {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return (REACTION_TYPES as readonly string[]).includes(v) ? (v as ReactionType) : null;
};

export const emptyReactionCounts = (): ReactionCounts => ({
  like: 0,
  love: 0,
  care: 0,
  haha: 0,
  wow: 0,
  sad: 0,
  angry: 0,
});

export const sumReactionCounts = (counts: Partial<Record<string, number>> | null | undefined): number => {
  if (!counts || typeof counts !== "object") return 0;
  return REACTION_TYPES.reduce((sum, key) => sum + (Number((counts as any)[key]) || 0), 0);
};

export const normalizeReactionCounts = (
  input: any,
  fallbackLikeNumber: number = 0,
): ReactionCounts => {
  const base = emptyReactionCounts();

  if (input && typeof input === "object") {
    for (const key of REACTION_TYPES) {
      const n = Number(input[key]);
      base[key] = Number.isFinite(n) ? n : 0;
    }
    return base;
  }

  base.like = Math.max(0, Number(fallbackLikeNumber) || 0);
  return base;
};

export const getTopReactions = (counts: Partial<Record<string, number>> | null | undefined, max: number = 3) => {
  const normalized = normalizeReactionCounts(counts);
  return REACTION_TYPES
    .filter((t) => (normalized as any)[t] > 0)
    .sort((a, b) => {
      const diff = (normalized as any)[b] - (normalized as any)[a];
      if (diff !== 0) return diff;
      return REACTION_META[a].priority - REACTION_META[b].priority;
    })
    .slice(0, Math.max(0, max));
};
