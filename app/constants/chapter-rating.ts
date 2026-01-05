// Lightweight chapter-based rating system.
// - Users react at chapter level (like/dislike)
// - Chapter score uses Bayesian average to avoid low-vote inflation
// - Story score aggregates chapter scores with vote-based weights

export const CHAPTER_RATING_CONFIG = {
  C: 6.0, // default prior mean (0..10)
  m: 5, // minimum votes for confidence
  minVotesToDisplay: 5,
  minChaptersWithVotesToShowText: 3,
  minTotalVotesToShowNonZero: 5,
} as const;

export type ChapterReaction = "like" | "dislike";

export function calcChapterScore(like: number, dislike: number): number {
  const l = Math.max(0, Number(like) || 0);
  const d = Math.max(0, Number(dislike) || 0);
  const v = l + d;
  if (v <= 0) return CHAPTER_RATING_CONFIG.C;

  const R = (l / v) * 10;
  const { C, m } = CHAPTER_RATING_CONFIG;
  const score = (v / (v + m)) * R + (m / (v + m)) * C;
  // clamp to 0..10 (safety)
  return Math.max(0, Math.min(10, score));
}

export function calcChapterWeight(votes: number): number {
  const v = Math.max(0, Number(votes) || 0);
  // Weight by log(v+1) as specified
  return Math.log(v + 1);
}

export function calcStoryScoreFromAggregates(sumWeightedScore: number, sumWeight: number): number {
  const w = Number(sumWeight) || 0;
  if (w <= 0) return 0;
  const s = (Number(sumWeightedScore) || 0) / w;
  return Math.max(0, Math.min(10, s));
}
