import { type LeaderboardPeriod } from "@/services/leaderboard.svc";
import { InteractionModel } from "~/database/models/interaction.model";
import { Types } from "mongoose";
import { MangaModel, type MangaType } from "~/database/models/manga.model";
import { ENV } from "@/configs/env.config";

import { MANGA_CONTENT_TYPE, MANGA_STATUS } from "~/constants/manga";
import { getLatestChapterTitlesForMangaIds } from "./shared.latest-chapter-titles";
import { ensureSlugForDocs } from "~/database/helpers/manga-slug.helper";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";
import { toSlug } from "~/utils/slug.utils";
import { HotCarouselSnapshotModel } from "~/database/models/hot-carousel-snapshot.model";

const HOT_CAROUSEL_LIMITS = {
  MANGA: ENV.LEADERBOARD.MAX_ITEMS,
  COSPLAY: 2,
} as const;
const HOT_CAROUSEL_TOTAL = HOT_CAROUSEL_LIMITS.MANGA + HOT_CAROUSEL_LIMITS.COSPLAY;
const HOT_CAROUSEL_PIPELINE_LIMIT = Math.max(HOT_CAROUSEL_TOTAL + 40, 120);
const HOT_CAROUSEL_CACHE_TTL_MS = 60 * 1000; // cache snapshot for 60s to avoid re-aggregating per request

// HOT carousel: time-on-leaderboard decay + re-entry cooldown
const HOT_CAROUSEL_REENTRY_COOLDOWN_MS = 6 * 3600 * 1000;
const HOT_CAROUSEL_PRESENCE_PRUNE_MS = 30 * 24 * 3600 * 1000;

type HotCarouselPresenceEntry = {
  streakStartedAt: Date;
  lastSeenAt: Date;
  lastLeftAt?: Date;
};

type HotCarouselPresenceMap = Record<string, HotCarouselPresenceEntry>;

const toDateSafe = (v: unknown): Date | null => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const normalizeHotCarouselPresence = (raw: unknown): HotCarouselPresenceMap => {
  const obj: any =
    raw && typeof raw === "object"
      ? raw instanceof Map
        ? Object.fromEntries((raw as Map<any, any>).entries())
        : raw
      : {};

  const out: HotCarouselPresenceMap = {};
  for (const [id, entry] of Object.entries(obj as Record<string, any>)) {
    if (!id) continue;
    const started = toDateSafe((entry as any)?.streakStartedAt);
    const seen = toDateSafe((entry as any)?.lastSeenAt);
    const left = toDateSafe((entry as any)?.lastLeftAt);
    if (!started || !seen) continue;
    out[String(id)] = {
      streakStartedAt: started,
      lastSeenAt: seen,
      ...(left ? { lastLeftAt: left } : null),
    };
  }
  return out;
};

const getHotStreakMultiplierForHours = (hoursOnHot: number): number => {
  if (!Number.isFinite(hoursOnHot)) return 1;
  if (hoursOnHot >= 72) return 0.4; // -60%
  if (hoursOnHot >= 60) return 0.5; // -50%
  if (hoursOnHot >= 48) return 0.6; // -40%
  if (hoursOnHot >= 36) return 0.7; // -30%
  return 1;
};

const isInHotReentryCooldown = (
  storyId: string,
  presence: HotCarouselPresenceMap,
  activeHotSet: Set<string>,
  nowMs: number,
): boolean => {
  if (!storyId) return false;
  // If it's already on the leaderboard (active set), cooldown does not apply.
  if (activeHotSet.has(storyId)) return false;
  const leftAt = presence[storyId]?.lastLeftAt;
  if (!leftAt) return false;
  const dt = nowMs - leftAt.getTime();
  return dt >= 0 && dt < HOT_CAROUSEL_REENTRY_COOLDOWN_MS;
};

const updateHotCarouselPresence = (
  prevPresence: HotCarouselPresenceMap,
  prevItems: Set<string>,
  nextItems: Set<string>,
  computedAt: Date,
): HotCarouselPresenceMap => {
  const now = computedAt.getTime();
  const next: HotCarouselPresenceMap = { ...prevPresence };

  // Mark currently present items.
  for (const id of nextItems) {
    const prev = prevPresence[id];
    const continuing = prevItems.has(id);
    const streakStartedAt = continuing ? (prev?.streakStartedAt ?? computedAt) : computedAt;
    next[id] = {
      streakStartedAt,
      lastSeenAt: computedAt,
    };
  }

  // Mark items that just left.
  for (const id of prevItems) {
    if (nextItems.has(id)) continue;
    const prev = prevPresence[id];
    if (!prev) {
      next[id] = { streakStartedAt: computedAt, lastSeenAt: computedAt, lastLeftAt: computedAt };
    } else {
      next[id] = { ...prev, lastLeftAt: computedAt };
    }
  }

  // Prune old entries to avoid unbounded growth.
  for (const [id, entry] of Object.entries(next)) {
    const lastSeen = entry?.lastSeenAt instanceof Date ? entry.lastSeenAt.getTime() : 0;
    const lastLeft = entry?.lastLeftAt instanceof Date ? entry.lastLeftAt.getTime() : 0;
    const newest = Math.max(lastSeen, lastLeft);
    if (newest > 0 && now - newest > HOT_CAROUSEL_PRESENCE_PRUNE_MS) {
      delete next[id];
    }
  }

  return next;
};

type HotCarouselCache = {
  data: MangaType[];
  expiresAt: number;
};

export type HotCarouselSnapshotInfo = {
  computedAt: string | null;
};

export type HotCarouselScoreBreakdown = {
  baseScore: number;
  baseScoreViewsWeighted: number;
  baseScoreViewsContribution: number;
  baseScoreCommentsContribution: number;
  hotStreakHours: number;
  hotStreakMultiplier: number;
  chapters: number;
  lowChapterBoostMultiplier: number;
  hoursSinceUpdatedAt: number | null;
  updateBoostMultiplier: number;
  weeklyRank: number | null;
  monthlyRank: number | null;
  weeklyPenalty: number;
  monthlyPenalty: number;
  penalty: number;
  penaltyMultiplier: number;
  hasManhwaGenre: boolean;
  genreMultiplier: number;
  hasDisturbingTags: boolean;
  disturbingMultiplier: number;
  adjustedScore: number;
};

export type HotCarouselScoreRow = {
  rank: number;
  id: string;
  story: MangaType;
  baseScore: number;
  adjustedScore: number;
  breakdown: HotCarouselScoreBreakdown;
  steps: string[];
  formula: string;
  lastInteractionAt: string | null;
};

let hotCarouselCache: HotCarouselCache | null = null;

const attachLatestChapterTitles = async (items: any[]) => {
  const ids = items.map((s: any) => String(s.id ?? s._id ?? "")).filter(Boolean);
  if (ids.length === 0) return;
  const titles = await getLatestChapterTitlesForMangaIds(ids).catch(() => ({} as Record<string, string>));
  for (const it of items as any[]) {
    const sid = String(it.id ?? it._id ?? "");
    if (sid && titles[sid]) (it as any).latestChapterTitle = titles[sid];
  }
};

const mapWithStableId = (docs: any[]) => docs.map((d: any) => ({ id: String(d?._id ?? d?.id ?? ""), ...d }));

const normalizeMangaAssets = (story: any) => {
  if (!story || typeof story !== "object") return story;
  if (typeof (story as any).poster === "string") (story as any).poster = rewriteLegacyCdnUrl((story as any).poster);
  if (typeof (story as any).shareImage === "string") (story as any).shareImage = rewriteLegacyCdnUrl((story as any).shareImage);
  return story;
};

const getDailyViewsLeaderboard = async () => {
  const docs = await MangaModel.find({
    status: 1 /* APPROVED */,
    contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
  })
    .sort({ dailyViews: -1, updatedAt: -1 })
    .limit(ENV.LEADERBOARD.MAX_ITEMS)
    .lean();

  await ensureSlugForDocs(docs as any[]);
  const out = mapWithStableId(docs).map(normalizeMangaAssets);
  await attachLatestChapterTitles(out);
  for (const s of out as any[]) {
    (s as any).viewNumber = s.dailyViews || 0;
  }
  return out;
};

export const getLeaderboard = async (period: LeaderboardPeriod) => {
  if (period === "daily") {
    return getDailyViewsLeaderboard();
  }

  // Weekly/Monthly dùng lightweight counters trực tiếp trên MangaModel
  if (period === "weekly" || period === "monthly") {
    const sortKey = period === "weekly" ? "weeklyViews" : "monthlyViews";
    const excludeManhwa = period === "weekly";
    const docs = await MangaModel.find({
      status: 1 /* APPROVED */,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
      ...(excludeManhwa ? { genres: { $nin: ["manhwa"] } } : {}),
    })
      .sort({ [sortKey]: -1, updatedAt: -1 })
      .limit(ENV.LEADERBOARD.MAX_ITEMS)
      .lean();

    await ensureSlugForDocs(docs as any[]);
    const out = mapWithStableId(docs).map(normalizeMangaAssets);
    await attachLatestChapterTitles(out);
    for (const s of out as any[]) {
      if (period === "weekly") (s as any).viewNumber = s.weeklyViews || 0;
      if (period === "monthly") (s as any).viewNumber = s.monthlyViews || 0;
    }
    return out;
  }

  return [];
};

export const getHotCarouselLeaderboard = async () => {
  const now = Date.now();
  if (hotCarouselCache && hotCarouselCache.expiresAt > now) {
    return hotCarouselCache.data;
  }

  const fresh = await getHotCarouselLeaderboardFromSnapshotOrCompute();
  hotCarouselCache = {
    data: fresh,
    expiresAt: now + HOT_CAROUSEL_CACHE_TTL_MS,
  };

  return fresh;
};

const HOT_CAROUSEL_SNAPSHOT_KEY = "default";

export const getHotCarouselSnapshotInfo = async (): Promise<HotCarouselSnapshotInfo> => {
  const doc = await HotCarouselSnapshotModel.findOne({ key: HOT_CAROUSEL_SNAPSHOT_KEY })
    .select({ computedAt: 1 })
    .lean();

  const computedAt = (doc as any)?.computedAt instanceof Date
    ? (doc as any).computedAt.toISOString()
    : (doc as any)?.computedAt
      ? new Date((doc as any).computedAt).toISOString()
      : null;

  return { computedAt };
};

export const forceRefreshHotCarouselSnapshot = async (): Promise<HotCarouselSnapshotInfo> => {
  const { items, computedAt, presence } = await computeHotCarouselSnapshot();
  await HotCarouselSnapshotModel.findOneAndUpdate(
    { key: HOT_CAROUSEL_SNAPSHOT_KEY },
    { $set: { items, computedAt, presence } },
    { upsert: true },
  );

  hotCarouselCache = null;

  return { computedAt: computedAt.toISOString() };
};

const getHotCarouselLeaderboardFromSnapshotOrCompute = async (): Promise<MangaType[]> => {
  const snap = await HotCarouselSnapshotModel.findOne({ key: HOT_CAROUSEL_SNAPSHOT_KEY })
    .select({ items: 1, computedAt: 1 })
    .lean();

  const items = Array.isArray((snap as any)?.items) ? ((snap as any).items as unknown[]) : [];
  const ids = items.map((x) => String(x || "")).filter(Boolean);

  if (ids.length > 0) {
    return hydrateHotCarouselStoriesFromIds(ids);
  }

  // No snapshot yet → compute once and save.
  const { items: computedIds, computedAt, presence } = await computeHotCarouselSnapshot();
  await HotCarouselSnapshotModel.findOneAndUpdate(
    { key: HOT_CAROUSEL_SNAPSHOT_KEY },
    { $set: { items: computedIds, computedAt, presence } },
    { upsert: true },
  );

  return hydrateHotCarouselStoriesFromIds(computedIds);
};

const hydrateHotCarouselStoriesFromIds = async (ids: string[]): Promise<MangaType[]> => {
  const docs = (await MangaModel.find({ _id: { $in: ids } }).lean()) as any as MangaType[];
  const storyMap = new Map<string, MangaType>(
    (Array.isArray(docs) ? docs : []).map((story: MangaType) => [
      String((story as any)?._id ?? (story as any)?.id ?? ""),
      story,
    ]),
  );

  const ordered: MangaType[] = [];
  for (const id of ids) {
    const story = storyMap.get(String(id));
    if (!story) continue;
    if ((story as any).status !== MANGA_STATUS.APPROVED) continue;
    ordered.push(story);
  }

  await ensureSlugForDocs(ordered as any[]);
  await attachLatestChapterTitles(ordered);
  for (const story of ordered as MangaType[]) {
    if (!(story as any).id) (story as any).id = String((story as any)?._id ?? "");
    normalizeMangaAssets(story as any);
  }

  return ordered;
};

const computeHotCarouselSnapshot = async (): Promise<{ items: string[]; computedAt: Date; presence: HotCarouselPresenceMap }> => {
  const computedAt = new Date();

  const prev = await HotCarouselSnapshotModel.findOne({ key: HOT_CAROUSEL_SNAPSHOT_KEY })
    .select({ items: 1, presence: 1, computedAt: 1 })
    .lean();

  const prevItemsArr = Array.isArray((prev as any)?.items) ? ((prev as any).items as unknown[]) : [];
  const prevItems = new Set(prevItemsArr.map((x) => String(x || "")).filter(Boolean));
  const prevPresence = normalizeHotCarouselPresence((prev as any)?.presence);

  // Backward-compat: older snapshots won't have presence → seed minimal entries so streak starts counting.
  const prevComputedAt = toDateSafe((prev as any)?.computedAt) ?? computedAt;
  for (const id of prevItems) {
    if (prevPresence[id]) continue;
    prevPresence[id] = { streakStartedAt: prevComputedAt, lastSeenAt: prevComputedAt };
  }

  const stories = await aggregateHotCarouselSnapshot({ computedAt, prevItems, presence: prevPresence });
  const items = (Array.isArray(stories) ? stories : [])
    .map((s: any) => String(s?.id ?? s?._id ?? ""))
    .filter(Boolean);

  const nextItems = new Set(items);
  const presence = updateHotCarouselPresence(prevPresence, prevItems, nextItems, computedAt);

  return { items, computedAt, presence };
};

const aggregateHotCarouselSnapshot = async (opts?: {
  computedAt: Date;
  prevItems: Set<string>;
  presence: HotCarouselPresenceMap;
}) => {
  const leaderboardDocs = await InteractionModel.aggregate(buildHotCarouselPipeline(HOT_CAROUSEL_PIPELINE_LIMIT) as any);
  if (!leaderboardDocs?.length) return [];

  // Diversity & freshness adjustments for HOT carousel ordering.
  // - Penalize items already dominating weekly/monthly leaderboards.
  // - Boost items that have a very recent chapter (approx via Manga.updatedAt).
  const computedAt = opts?.computedAt ?? new Date();
  const now = computedAt.getTime();
  const activeHotSet = opts?.prevItems ?? new Set<string>();
  const presence = opts?.presence ?? ({} as HotCarouselPresenceMap);
  const TOP_RANK_PENALTY = [0.35, 0.25, 0.2, 0.15, 0.1] as const;
  const [weeklyTopDocs, monthlyTopDocs] = await Promise.all([
    MangaModel.find({
      status: 1 /* APPROVED */,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
      genres: { $nin: ["manhwa"] },
    })
      .sort({ weeklyViews: -1, updatedAt: -1 })
      .limit(5)
      .select({ _id: 1 })
      .lean(),
    MangaModel.find({
      status: 1 /* APPROVED */,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
    })
      .sort({ monthlyViews: -1, updatedAt: -1 })
      .limit(5)
      .select({ _id: 1 })
      .lean(),
  ]);

  const weeklyRankMap = new Map<string, number>();
  for (let i = 0; i < weeklyTopDocs.length; i++) {
    const id = String((weeklyTopDocs[i] as any)?._id ?? "");
    if (id) weeklyRankMap.set(id, i + 1);
  }
  const monthlyRankMap = new Map<string, number>();
  for (let i = 0; i < monthlyTopDocs.length; i++) {
    const id = String((monthlyTopDocs[i] as any)?._id ?? "");
    if (id) monthlyRankMap.set(id, i + 1);
  }

  const leaderboardIds = leaderboardDocs
    .map((doc: any) => String(doc?.story_id ?? doc?._id ?? ""))
    .filter(Boolean);
  if (!leaderboardIds.length) return [];

  const stories = (await MangaModel.find({ _id: { $in: leaderboardIds } }).lean()) as any as MangaType[];
  const storyMap = new Map<string, MangaType>(
    (Array.isArray(stories) ? stories : []).map((story: MangaType) => [
      String((story as any)?._id ?? (story as any)?.id ?? ""),
      story,
    ]),
  );

  const getHotCarouselScoreBreakdown = (doc: any, story?: MangaType | null): HotCarouselScoreBreakdown => {
    const sid = String(doc?.story_id ?? doc?._id ?? "");
    const baseScore = typeof doc?.score === "number" ? doc.score : 0;

    // HOT streak penalty: apply only if the story is already on the HOT leaderboard (continuous streak).
    // New entrants start at 0h → no penalty until they have stayed long enough.
    const streakStartedAt = activeHotSet.has(sid) ? presence[sid]?.streakStartedAt : null;
    const hotStreakHours = streakStartedAt ? (now - streakStartedAt.getTime()) / (3600 * 1000) : 0;
    const hotStreakMultiplier = streakStartedAt ? getHotStreakMultiplierForHours(hotStreakHours) : 1;

    // Base score breakdown (rolling 36h buckets)
    const views0_2h = Math.max(0, Number(doc?.views_0_2h) || 0);
    const views2_8h = Math.max(0, Number(doc?.views_2_8h) || 0);
    const views8_24h = Math.max(0, Number(doc?.views_8_24h) || 0);
    const views24_36h = Math.max(0, Number(doc?.views_24_36h) || 0);
    const baseScoreViewsWeighted = views0_2h * 1.5 + views2_8h * 1.3 + views8_24h * 1.0 + views24_36h * 0.5;
    const baseScoreViewsContribution = baseScoreViewsWeighted * (ENV.LEADERBOARD?.daily?.VIEW_WEIGHT ?? 1);
    const baseScoreCommentsContribution = 0;

    // Rank-based penalties (additive):
    // - Weekly top 1..5: 25%, 21%, 18%, 15%, 12%
    // - Monthly top 1..5: 25%, 21%, 18%, 15%, 12%
    // If a manga is top #1 in both weekly & monthly, penalty becomes 50%.
    const weeklyRank = weeklyRankMap.get(sid) ?? null;
    const monthlyRank = monthlyRankMap.get(sid) ?? null;
    const weeklyPenalty = weeklyRank && weeklyRank <= 5 ? TOP_RANK_PENALTY[weeklyRank - 1] : 0;
    const monthlyPenalty = monthlyRank && monthlyRank <= 5 ? TOP_RANK_PENALTY[monthlyRank - 1] : 0;
    const penalty = Math.min(weeklyPenalty + monthlyPenalty, 0.7);
    const penaltyMultiplier = 1 - penalty;

    // Genre penalty: if manga has genre "manhwa", reduce score by 60%.
    // Apply to manga only (not COSPLAY).
    const contentType = (story as any)?.contentType ?? MANGA_CONTENT_TYPE.MANGA;
    const genres = Array.isArray((story as any)?.genres) ? ((story as any).genres as unknown[]) : [];
    const hasManhwaGenre =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      genres.some((g) => typeof g === "string" && g.trim().toLowerCase() === "manhwa");
    const genreMultiplier = hasManhwaGenre ? 0.4 : 1;

    // Disturbing tags (guro/scat): -50% score and no recent bonus.
    const genreSlugs = genres
      .filter((g) => typeof g === "string")
      .map((g) => toSlug(String(g)).toLowerCase());
    const hasDisturbingTags =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      (genreSlugs.includes("guro") || genreSlugs.includes("scat"));
    const disturbingMultiplier = hasDisturbingTags ? 0.5 : 1;

    // Boost new/short series:
    // - 1 chapter: +30%
    // - 2..5 chapters: +10%
    // Apply to manga only (not COSPLAY).
    const chapters = Math.max(0, Number((story as any)?.chapters) || 0);
    const lowChapterBoostMultiplier =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) && chapters <= 1
        ? 1.3
        : (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) && chapters <= 5
          ? 1.1
          : 1;

    // Update boost applies to manga only (contentType MANGA/null) and uses updatedAt as proxy for latest chapter time.
    // Do NOT apply update boost for disturbing tags.
    const storyUpdatedAt = (story as any)?.updatedAt instanceof Date
      ? (story as any).updatedAt
      : (story as any)?.updatedAt
        ? new Date((story as any).updatedAt)
        : null;
    const hoursSinceUpdatedAt =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      !!storyUpdatedAt &&
      !Number.isNaN(storyUpdatedAt.getTime())
        ? (now - storyUpdatedAt.getTime()) / (3600 * 1000)
        : null;

    let updateBoostMultiplier = 1;
    if (hoursSinceUpdatedAt != null && !hasDisturbingTags) {
      if (hoursSinceUpdatedAt < 2) updateBoostMultiplier = 1.5;
      else if (hoursSinceUpdatedAt < 6) updateBoostMultiplier = 1.4;
      else if (hoursSinceUpdatedAt < 12) updateBoostMultiplier = 1.3;
      else if (hoursSinceUpdatedAt < 24) updateBoostMultiplier = 1.2;
      else updateBoostMultiplier = 1;
    }

    const adjustedScore =
      baseScore *
      hotStreakMultiplier *
      penaltyMultiplier *
      updateBoostMultiplier *
      genreMultiplier *
      disturbingMultiplier *
      lowChapterBoostMultiplier;

    return {
      baseScore,
      baseScoreViewsWeighted,
      baseScoreViewsContribution,
      baseScoreCommentsContribution,
      hotStreakHours,
      hotStreakMultiplier,
      chapters,
      lowChapterBoostMultiplier,
      hoursSinceUpdatedAt,
      updateBoostMultiplier,
      weeklyRank,
      monthlyRank,
      weeklyPenalty,
      monthlyPenalty,
      penalty,
      penaltyMultiplier,
      hasManhwaGenre,
      genreMultiplier,
      hasDisturbingTags,
      disturbingMultiplier,
      adjustedScore,
    };
  };

  // Re-rank documents using adjusted score (tie-break by base score then most recent interaction).
  const rankedDocs = [...leaderboardDocs].sort((a: any, b: any) => {
    const aId = String(a?.story_id ?? a?._id ?? "");
    const bId = String(b?.story_id ?? b?._id ?? "");
    const aStory = storyMap.get(aId);
    const bStory = storyMap.get(bId);

    const aAdj = getHotCarouselScoreBreakdown(a, aStory).adjustedScore;
    const bAdj = getHotCarouselScoreBreakdown(b, bStory).adjustedScore;
    if (bAdj !== aAdj) return bAdj - aAdj;

    const aBase = typeof a?.score === "number" ? a.score : 0;
    const bBase = typeof b?.score === "number" ? b.score : 0;
    if (bBase !== aBase) return bBase - aBase;

    const aT = a?.last_interaction_at instanceof Date ? a.last_interaction_at.getTime() : (a?.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0);
    const bT = b?.last_interaction_at instanceof Date ? b.last_interaction_at.getTime() : (b?.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0);
    return bT - aT;
  });

  const mangaList: MangaType[] = [];
  const cosplayList: MangaType[] = [];
  const seen = new Set<string>();

  for (const doc of rankedDocs as any[]) {
    const sid = String(doc?.story_id ?? doc?._id ?? "");
    if (!sid || seen.has(sid)) continue;

    // Cooldown: if a story just left the HOT snapshot, keep it out for at least 6 hours.
    if (isInHotReentryCooldown(sid, presence, activeHotSet, now)) continue;

    const story = storyMap.get(sid);
    if (!story) continue;
    if (story.status !== MANGA_STATUS.APPROVED) continue;

    const type = story.contentType ?? MANGA_CONTENT_TYPE.MANGA;
    if (type === MANGA_CONTENT_TYPE.COSPLAY) {
      if (cosplayList.length < HOT_CAROUSEL_LIMITS.COSPLAY) {
        cosplayList.push(story);
        seen.add(sid);
      }
    } else {
      if (mangaList.length < HOT_CAROUSEL_LIMITS.MANGA) {
        mangaList.push(story);
        seen.add(sid);
      }
    }

    if (
      mangaList.length >= HOT_CAROUSEL_LIMITS.MANGA &&
      cosplayList.length >= HOT_CAROUSEL_LIMITS.COSPLAY
    ) {
      break;
    }
  }

  const FIRST_COSPLAY_INSERT_INDEX = 5;
  const combined: MangaType[] = [];
  combined.push(...mangaList.slice(0, FIRST_COSPLAY_INSERT_INDEX));
  if (cosplayList.length > 0) {
    combined.push(cosplayList[0]);
  }
  combined.push(...mangaList.slice(FIRST_COSPLAY_INSERT_INDEX));
  if (cosplayList.length > 1) {
    combined.push(cosplayList[1]);
  }
  if (cosplayList.length > 2) {
    combined.push(...cosplayList.slice(2));
  }

  await ensureSlugForDocs(combined as any[]);
  await attachLatestChapterTitles(combined);
  for (const story of combined as MangaType[]) {
    if (!story.id) {
      story.id = String((story as any)?._id ?? "");
    }
    normalizeMangaAssets(story as any);
  }

  return combined;
};

export const getHotCarouselLeaderboardWithScores = async (): Promise<HotCarouselScoreRow[]> => {
  const leaderboardDocs = await InteractionModel.aggregate(buildHotCarouselPipeline(HOT_CAROUSEL_PIPELINE_LIMIT) as any);
  if (!leaderboardDocs?.length) return [];

  const snap = await HotCarouselSnapshotModel.findOne({ key: HOT_CAROUSEL_SNAPSHOT_KEY })
    .select({ items: 1, presence: 1 })
    .lean();

  const activeHotSet = new Set(
    (Array.isArray((snap as any)?.items) ? ((snap as any).items as unknown[]) : [])
      .map((x) => String(x || ""))
      .filter(Boolean),
  );
  const presence = normalizeHotCarouselPresence((snap as any)?.presence);

  const now = Date.now();
  const TOP_RANK_PENALTY = [0.35, 0.25, 0.2, 0.15, 0.1] as const;

  const [weeklyTopDocs, monthlyTopDocs] = await Promise.all([
    MangaModel.find({
      status: 1 /* APPROVED */,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
    })
      .sort({ weeklyViews: -1, updatedAt: -1 })
      .limit(5)
      .select({ _id: 1 })
      .lean(),
    MangaModel.find({
      status: 1 /* APPROVED */,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
    })
      .sort({ monthlyViews: -1, updatedAt: -1 })
      .limit(5)
      .select({ _id: 1 })
      .lean(),
  ]);

  const weeklyRankMap = new Map<string, number>();
  for (let i = 0; i < weeklyTopDocs.length; i++) {
    const id = String((weeklyTopDocs[i] as any)?._id ?? "");
    if (id) weeklyRankMap.set(id, i + 1);
  }
  const monthlyRankMap = new Map<string, number>();
  for (let i = 0; i < monthlyTopDocs.length; i++) {
    const id = String((monthlyTopDocs[i] as any)?._id ?? "");
    if (id) monthlyRankMap.set(id, i + 1);
  }

  const leaderboardIds = leaderboardDocs
    .map((doc: any) => String(doc?.story_id ?? doc?._id ?? ""))
    .filter(Boolean);
  if (!leaderboardIds.length) return [];

  const stories = (await MangaModel.find({ _id: { $in: leaderboardIds } }).lean()) as any as MangaType[];
  const storyMap = new Map<string, MangaType>(
    (Array.isArray(stories) ? stories : []).map((story: MangaType) => [
      String((story as any)?._id ?? (story as any)?.id ?? ""),
      story,
    ]),
  );

  const getHotCarouselScoreBreakdown = (doc: any, story?: MangaType | null): HotCarouselScoreBreakdown => {
    const sid = String(doc?.story_id ?? doc?._id ?? "");
    const baseScore = typeof doc?.score === "number" ? doc.score : 0;

    const streakStartedAt = activeHotSet.has(sid) ? presence[sid]?.streakStartedAt : null;
    const hotStreakHours = streakStartedAt ? (now - streakStartedAt.getTime()) / (3600 * 1000) : 0;
    const hotStreakMultiplier = streakStartedAt ? getHotStreakMultiplierForHours(hotStreakHours) : 1;

    // Base score breakdown (rolling 36h buckets)
    const views0_2h = Math.max(0, Number(doc?.views_0_2h) || 0);
    const views2_8h = Math.max(0, Number(doc?.views_2_8h) || 0);
    const views8_24h = Math.max(0, Number(doc?.views_8_24h) || 0);
    const views24_36h = Math.max(0, Number(doc?.views_24_36h) || 0);
    const baseScoreViewsWeighted = views0_2h * 1.5 + views2_8h * 1.3 + views8_24h * 1.0 + views24_36h * 0.5;
    const baseScoreViewsContribution = baseScoreViewsWeighted * (ENV.LEADERBOARD?.daily?.VIEW_WEIGHT ?? 1);
    const baseScoreCommentsContribution = 0;

    const weeklyRank = weeklyRankMap.get(sid) ?? null;
    const monthlyRank = monthlyRankMap.get(sid) ?? null;
    const weeklyPenalty = weeklyRank && weeklyRank <= 5 ? TOP_RANK_PENALTY[weeklyRank - 1] : 0;
    const monthlyPenalty = monthlyRank && monthlyRank <= 5 ? TOP_RANK_PENALTY[monthlyRank - 1] : 0;
    const penalty = Math.min(weeklyPenalty + monthlyPenalty, 0.7);
    const penaltyMultiplier = 1 - penalty;

    // Genre penalty: if manga has genre "manhwa", reduce score by 60%.
    // Apply to manga only (not COSPLAY).
    const contentType = (story as any)?.contentType ?? MANGA_CONTENT_TYPE.MANGA;
    const genres = Array.isArray((story as any)?.genres) ? ((story as any).genres as unknown[]) : [];
    const hasManhwaGenre =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      genres.some((g) => typeof g === "string" && g.trim().toLowerCase() === "manhwa");
    const genreMultiplier = hasManhwaGenre ? 0.4 : 1;

    const genreSlugs = genres
      .filter((g) => typeof g === "string")
      .map((g) => toSlug(String(g)).toLowerCase());
    const hasDisturbingTags =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      (genreSlugs.includes("guro") || genreSlugs.includes("scat"));
    const disturbingMultiplier = hasDisturbingTags ? 0.5 : 1;

    // Boost new/short series:
    // - 1 chapter: +30%
    // - 2..5 chapters: +10%
    // Apply to manga only (not COSPLAY).
    const chapters = Math.max(0, Number((story as any)?.chapters) || 0);
    const lowChapterBoostMultiplier =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) && chapters <= 1
        ? 1.3
        : (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) && chapters <= 5
          ? 1.1
          : 1;

    const storyUpdatedAt = (story as any)?.updatedAt instanceof Date
      ? (story as any).updatedAt
      : (story as any)?.updatedAt
        ? new Date((story as any).updatedAt)
        : null;
    const hoursSinceUpdatedAt =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      !!storyUpdatedAt &&
      !Number.isNaN(storyUpdatedAt.getTime())
        ? (now - storyUpdatedAt.getTime()) / (3600 * 1000)
        : null;

    let updateBoostMultiplier = 1;
    if (hoursSinceUpdatedAt != null && !hasDisturbingTags) {
      if (hoursSinceUpdatedAt < 2) updateBoostMultiplier = 1.5;
      else if (hoursSinceUpdatedAt < 6) updateBoostMultiplier = 1.4;
      else if (hoursSinceUpdatedAt < 12) updateBoostMultiplier = 1.3;
      else if (hoursSinceUpdatedAt < 24) updateBoostMultiplier = 1.2;
      else updateBoostMultiplier = 1;
    }

    const adjustedScore =
      baseScore *
      hotStreakMultiplier *
      penaltyMultiplier *
      updateBoostMultiplier *
      genreMultiplier *
      disturbingMultiplier *
      lowChapterBoostMultiplier;

    return {
      baseScore,
      baseScoreViewsWeighted,
      baseScoreViewsContribution,
      baseScoreCommentsContribution,
      hotStreakHours,
      hotStreakMultiplier,
      chapters,
      lowChapterBoostMultiplier,
      hoursSinceUpdatedAt,
      updateBoostMultiplier,
      weeklyRank,
      monthlyRank,
      weeklyPenalty,
      monthlyPenalty,
      penalty,
      penaltyMultiplier,
      hasManhwaGenre,
      genreMultiplier,
      hasDisturbingTags,
      disturbingMultiplier,
      adjustedScore,
    };
  };

  const rankedDocs = [...leaderboardDocs].sort((a: any, b: any) => {
    const aId = String(a?.story_id ?? a?._id ?? "");
    const bId = String(b?.story_id ?? b?._id ?? "");
    const aStory = storyMap.get(aId);
    const bStory = storyMap.get(bId);

    const aAdj = getHotCarouselScoreBreakdown(a, aStory).adjustedScore;
    const bAdj = getHotCarouselScoreBreakdown(b, bStory).adjustedScore;
    if (bAdj !== aAdj) return bAdj - aAdj;

    const aBase = typeof a?.score === "number" ? a.score : 0;
    const bBase = typeof b?.score === "number" ? b.score : 0;
    if (bBase !== aBase) return bBase - aBase;

    const aT = a?.last_interaction_at instanceof Date ? a.last_interaction_at.getTime() : (a?.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0);
    const bT = b?.last_interaction_at instanceof Date ? b.last_interaction_at.getTime() : (b?.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0);
    return bT - aT;
  });

  const mangaList: any[] = [];
  const cosplayList: any[] = [];
  const seen = new Set<string>();
  for (const doc of rankedDocs as any[]) {
    const sid = String(doc?.story_id ?? doc?._id ?? "");
    if (!sid || seen.has(sid)) continue;

    if (isInHotReentryCooldown(sid, presence, activeHotSet, now)) continue;

    const story = storyMap.get(sid);
    if (!story) continue;
    if ((story as any).status !== MANGA_STATUS.APPROVED) continue;

    const type = (story as any).contentType ?? MANGA_CONTENT_TYPE.MANGA;
    if (type === MANGA_CONTENT_TYPE.COSPLAY) {
      if (cosplayList.length < HOT_CAROUSEL_LIMITS.COSPLAY) {
        cosplayList.push({ doc, sid, story });
        seen.add(sid);
      }
    } else {
      if (mangaList.length < HOT_CAROUSEL_LIMITS.MANGA) {
        mangaList.push({ doc, sid, story });
        seen.add(sid);
      }
    }

    if (mangaList.length >= HOT_CAROUSEL_LIMITS.MANGA && cosplayList.length >= HOT_CAROUSEL_LIMITS.COSPLAY) {
      break;
    }
  }

  const FIRST_COSPLAY_INSERT_INDEX = 5;
  const combined: any[] = [];
  combined.push(...mangaList.slice(0, FIRST_COSPLAY_INSERT_INDEX));
  if (cosplayList.length > 0) combined.push(cosplayList[0]);
  combined.push(...mangaList.slice(FIRST_COSPLAY_INSERT_INDEX));
  if (cosplayList.length > 1) combined.push(cosplayList[1]);
  if (cosplayList.length > 2) combined.push(...cosplayList.slice(2));

  const combinedStories = combined.map((x) => x.story);
  await ensureSlugForDocs(combinedStories as any[]);
  await attachLatestChapterTitles(combinedStories);
  for (const story of combinedStories as MangaType[]) {
    if (!(story as any).id) (story as any).id = String((story as any)?._id ?? "");
    normalizeMangaAssets(story as any);
  }

  const formula =
    "adjusted = baseScore * hotStreakMultiplier * (1 - clamp(weeklyPenalty + monthlyPenalty, 0..0.70)) * updateBoostMultiplier * genreMultiplier * disturbingMultiplier * lowChapterBoostMultiplier";

  const rows: HotCarouselScoreRow[] = [];
  for (let i = 0; i < combined.length; i++) {
    const { doc, sid, story } = combined[i];
    const breakdown = getHotCarouselScoreBreakdown(doc, story);
    const lastInteractionAt = doc?.last_interaction_at
      ? (doc.last_interaction_at instanceof Date ? doc.last_interaction_at.toISOString() : new Date(doc.last_interaction_at).toISOString())
      : null;

    const steps: string[] = [];
    steps.push("BASE SCORE (rolling 36h buckets)");
    steps.push(`views_0_2h=${Math.max(0, Number((doc as any)?.views_0_2h) || 0)}, views_2_8h=${Math.max(0, Number((doc as any)?.views_2_8h) || 0)}, views_8_24h=${Math.max(0, Number((doc as any)?.views_8_24h) || 0)}, views_24_36h=${Math.max(0, Number((doc as any)?.views_24_36h) || 0)}`);
    steps.push(`viewsWeighted = v0_2h*1.5 + v2_8h*1.3 + v8_24h*1.0 + v24_36h*1.0 = ${breakdown.baseScoreViewsWeighted}`);
    steps.push(`viewsScore = viewsWeighted * VIEW_WEIGHT(${ENV.LEADERBOARD?.daily?.VIEW_WEIGHT ?? 1}) = ${breakdown.baseScoreViewsContribution}`);
    steps.push("commentScore is ignored in HOT carousel scoring");
    steps.push(`baseScore = viewsScore = ${breakdown.baseScore}`);
    steps.push("\nADJUSTMENTS");
    steps.push(`hotStreak: ${breakdown.hotStreakHours.toFixed(2)}h => hotStreakMultiplier = ${breakdown.hotStreakMultiplier}`);
    steps.push(`weeklyRank=${breakdown.weeklyRank ?? "-"}, weeklyPenalty=${breakdown.weeklyPenalty}`);
    steps.push(`monthlyRank=${breakdown.monthlyRank ?? "-"}, monthlyPenalty=${breakdown.monthlyPenalty}`);
    steps.push(`penaltyTotal = ${breakdown.penalty} => penaltyMultiplier = ${breakdown.penaltyMultiplier}`);
    steps.push(`updatedAt: ${breakdown.hoursSinceUpdatedAt != null ? `${breakdown.hoursSinceUpdatedAt.toFixed(2)}h ago` : "n/a"} => updateBoostMultiplier = ${breakdown.updateBoostMultiplier}`);
    steps.push(`genre manhwa: ${breakdown.hasManhwaGenre ? "-60%" : "no"} => genreMultiplier = ${breakdown.genreMultiplier}`);
    steps.push(`tags guro/scat: ${breakdown.hasDisturbingTags ? "-50%" : "no"} => disturbingMultiplier = ${breakdown.disturbingMultiplier}`);
    steps.push(`chapters=${breakdown.chapters} (1 => +30%, 2-5 => +10%) => lowChapterBoostMultiplier = ${breakdown.lowChapterBoostMultiplier}`);
    steps.push(`adjustedScore = ${breakdown.baseScore} * ${breakdown.hotStreakMultiplier} * ${breakdown.penaltyMultiplier} * ${breakdown.updateBoostMultiplier} * ${breakdown.genreMultiplier} * ${breakdown.disturbingMultiplier} * ${breakdown.lowChapterBoostMultiplier} = ${breakdown.adjustedScore}`);

    rows.push({
      rank: i + 1,
      id: sid,
      story,
      baseScore: breakdown.baseScore,
      adjustedScore: breakdown.adjustedScore,
      breakdown,
      steps,
      formula,
      lastInteractionAt,
    });
  }

  return rows;
};

export const getHotCarouselSnapshotWithScores = async (): Promise<HotCarouselScoreRow[]> => {
  const snap = await HotCarouselSnapshotModel.findOne({ key: HOT_CAROUSEL_SNAPSHOT_KEY })
    .select({ items: 1, presence: 1 })
    .lean();

  const items = Array.isArray((snap as any)?.items) ? ((snap as any).items as unknown[]) : [];
  const ids = items.map((x) => String(x || "")).filter(Boolean);
  if (!ids.length) return [];

  const leaderboardDocs = await InteractionModel.aggregate(buildHotCarouselPipelineForIds(ids) as any);
  const docMap = new Map<string, any>();
  for (const doc of leaderboardDocs as any[]) {
    const sid = String(doc?.story_id ?? doc?._id ?? "");
    if (sid) docMap.set(sid, doc);
  }

  const presence = normalizeHotCarouselPresence((snap as any)?.presence);
  const activeHotSet = new Set(ids);
  const now = Date.now();
  const TOP_RANK_PENALTY = [0.35, 0.25, 0.2, 0.15, 0.1] as const;

  const [weeklyTopDocs, monthlyTopDocs] = await Promise.all([
    MangaModel.find({
      status: 1 /* APPROVED */,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
      genres: { $nin: ["manhwa"] },
    })
      .sort({ weeklyViews: -1, updatedAt: -1 })
      .limit(5)
      .select({ _id: 1 })
      .lean(),
    MangaModel.find({
      status: 1 /* APPROVED */,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
    })
      .sort({ monthlyViews: -1, updatedAt: -1 })
      .limit(5)
      .select({ _id: 1 })
      .lean(),
  ]);

  const weeklyRankMap = new Map<string, number>();
  for (let i = 0; i < weeklyTopDocs.length; i++) {
    const id = String((weeklyTopDocs[i] as any)?._id ?? "");
    if (id) weeklyRankMap.set(id, i + 1);
  }
  const monthlyRankMap = new Map<string, number>();
  for (let i = 0; i < monthlyTopDocs.length; i++) {
    const id = String((monthlyTopDocs[i] as any)?._id ?? "");
    if (id) monthlyRankMap.set(id, i + 1);
  }

  const stories = (await MangaModel.find({ _id: { $in: ids } }).lean()) as any as MangaType[];
  const storyMap = new Map<string, MangaType>(
    (Array.isArray(stories) ? stories : []).map((story: MangaType) => [
      String((story as any)?._id ?? (story as any)?.id ?? ""),
      story,
    ]),
  );

  const getHotCarouselScoreBreakdown = (doc: any, story?: MangaType | null): HotCarouselScoreBreakdown => {
    const sid = String(doc?.story_id ?? doc?._id ?? "");
    const baseScore = typeof doc?.score === "number" ? doc.score : 0;

    const streakStartedAt = activeHotSet.has(sid) ? presence[sid]?.streakStartedAt : null;
    const hotStreakHours = streakStartedAt ? (now - streakStartedAt.getTime()) / (3600 * 1000) : 0;
    const hotStreakMultiplier = streakStartedAt ? getHotStreakMultiplierForHours(hotStreakHours) : 1;

    const views0_2h = Math.max(0, Number(doc?.views_0_2h) || 0);
    const views2_8h = Math.max(0, Number(doc?.views_2_8h) || 0);
    const views8_24h = Math.max(0, Number(doc?.views_8_24h) || 0);
    const views24_36h = Math.max(0, Number(doc?.views_24_36h) || 0);
    const baseScoreViewsWeighted = views0_2h * 1.5 + views2_8h * 1.3 + views8_24h * 1.0 + views24_36h * 0.5;
    const baseScoreViewsContribution = baseScoreViewsWeighted * (ENV.LEADERBOARD?.daily?.VIEW_WEIGHT ?? 1);
    const baseScoreCommentsContribution = 0;

    const weeklyRank = weeklyRankMap.get(sid) ?? null;
    const monthlyRank = monthlyRankMap.get(sid) ?? null;
    const weeklyPenalty = weeklyRank && weeklyRank <= 5 ? TOP_RANK_PENALTY[weeklyRank - 1] : 0;
    const monthlyPenalty = monthlyRank && monthlyRank <= 5 ? TOP_RANK_PENALTY[monthlyRank - 1] : 0;
    const penalty = Math.min(weeklyPenalty + monthlyPenalty, 0.7);
    const penaltyMultiplier = 1 - penalty;

    const contentType = (story as any)?.contentType ?? MANGA_CONTENT_TYPE.MANGA;
    const genres = Array.isArray((story as any)?.genres) ? ((story as any).genres as unknown[]) : [];
    const hasManhwaGenre =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      genres.some((g) => typeof g === "string" && g.trim().toLowerCase() === "manhwa");
    const genreMultiplier = hasManhwaGenre ? 0.4 : 1;

    const genreSlugs = genres
      .filter((g) => typeof g === "string")
      .map((g) => toSlug(String(g)).toLowerCase());
    const hasDisturbingTags =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      (genreSlugs.includes("guro") || genreSlugs.includes("scat"));
    const disturbingMultiplier = hasDisturbingTags ? 0.5 : 1;

    const chapters = Math.max(0, Number((story as any)?.chapters) || 0);
    const lowChapterBoostMultiplier =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) && chapters <= 1
        ? 1.3
        : (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) && chapters <= 5
          ? 1.1
          : 1;

    const storyUpdatedAt = (story as any)?.updatedAt instanceof Date
      ? (story as any).updatedAt
      : (story as any)?.updatedAt
        ? new Date((story as any).updatedAt)
        : null;
    const hoursSinceUpdatedAt =
      (contentType === MANGA_CONTENT_TYPE.MANGA || contentType == null) &&
      !!storyUpdatedAt &&
      !Number.isNaN(storyUpdatedAt.getTime())
        ? (now - storyUpdatedAt.getTime()) / (3600 * 1000)
        : null;

    let updateBoostMultiplier = 1;
    if (hoursSinceUpdatedAt != null && !hasDisturbingTags) {
      if (hoursSinceUpdatedAt < 2) updateBoostMultiplier = 1.5;
      else if (hoursSinceUpdatedAt < 6) updateBoostMultiplier = 1.4;
      else if (hoursSinceUpdatedAt < 12) updateBoostMultiplier = 1.3;
      else if (hoursSinceUpdatedAt < 24) updateBoostMultiplier = 1.2;
      else updateBoostMultiplier = 1;
    }

    const adjustedScore =
      baseScore *
      hotStreakMultiplier *
      penaltyMultiplier *
      updateBoostMultiplier *
      genreMultiplier *
      disturbingMultiplier *
      lowChapterBoostMultiplier;

    return {
      baseScore,
      baseScoreViewsWeighted,
      baseScoreViewsContribution,
      baseScoreCommentsContribution,
      hotStreakHours,
      hotStreakMultiplier,
      chapters,
      lowChapterBoostMultiplier,
      hoursSinceUpdatedAt,
      updateBoostMultiplier,
      weeklyRank,
      monthlyRank,
      weeklyPenalty,
      monthlyPenalty,
      penalty,
      penaltyMultiplier,
      hasManhwaGenre,
      genreMultiplier,
      hasDisturbingTags,
      disturbingMultiplier,
      adjustedScore,
    };
  };

  const orderedStories: MangaType[] = [];
  for (const id of ids) {
    const story = storyMap.get(String(id));
    if (!story) continue;
    if ((story as any).status !== MANGA_STATUS.APPROVED) continue;
    orderedStories.push(story);
  }

  await ensureSlugForDocs(orderedStories as any[]);
  await attachLatestChapterTitles(orderedStories);
  for (const story of orderedStories as MangaType[]) {
    if (!(story as any).id) (story as any).id = String((story as any)?._id ?? "");
    normalizeMangaAssets(story as any);
  }

  const formula =
    "adjusted = baseScore * hotStreakMultiplier * (1 - clamp(weeklyPenalty + monthlyPenalty, 0..0.70)) * updateBoostMultiplier * genreMultiplier * disturbingMultiplier * lowChapterBoostMultiplier";

  const rows: HotCarouselScoreRow[] = [];
  for (let i = 0; i < orderedStories.length; i++) {
    const story = orderedStories[i];
    const sid = String((story as any)?._id ?? (story as any)?.id ?? "");
    const doc = docMap.get(sid) || {
      story_id: sid,
      score: 0,
      views_0_2h: 0,
      views_2_8h: 0,
      views_8_24h: 0,
      views_24_36h: 0,
      last_interaction_at: null,
    };

    const breakdown = getHotCarouselScoreBreakdown(doc, story);
    const lastInteractionAt = doc?.last_interaction_at
      ? (doc.last_interaction_at instanceof Date
          ? doc.last_interaction_at.toISOString()
          : new Date(doc.last_interaction_at).toISOString())
      : null;

    const steps: string[] = [];
    steps.push("BASE SCORE (rolling 36h buckets)");
    steps.push(`views_0_2h=${Math.max(0, Number((doc as any)?.views_0_2h) || 0)}, views_2_8h=${Math.max(0, Number((doc as any)?.views_2_8h) || 0)}, views_8_24h=${Math.max(0, Number((doc as any)?.views_8_24h) || 0)}, views_24_36h=${Math.max(0, Number((doc as any)?.views_24_36h) || 0)}`);
    steps.push(`viewsWeighted = v0_2h*1.5 + v2_8h*1.3 + v8_24h*1.0 + v24_36h*1.0 = ${breakdown.baseScoreViewsWeighted}`);
    steps.push(`viewsScore = viewsWeighted * VIEW_WEIGHT(${ENV.LEADERBOARD?.daily?.VIEW_WEIGHT ?? 1}) = ${breakdown.baseScoreViewsContribution}`);
    steps.push("commentScore is ignored in HOT carousel scoring");
    steps.push(`baseScore = viewsScore = ${breakdown.baseScore}`);
    steps.push("\nADJUSTMENTS");
    steps.push(`hotStreak: ${breakdown.hotStreakHours.toFixed(2)}h => hotStreakMultiplier = ${breakdown.hotStreakMultiplier}`);
    steps.push(`weeklyRank=${breakdown.weeklyRank ?? "-"}, weeklyPenalty=${breakdown.weeklyPenalty}`);
    steps.push(`monthlyRank=${breakdown.monthlyRank ?? "-"}, monthlyPenalty=${breakdown.monthlyPenalty}`);
    steps.push(`penaltyTotal = ${breakdown.penalty} => penaltyMultiplier = ${breakdown.penaltyMultiplier}`);
    steps.push(`updatedAt: ${breakdown.hoursSinceUpdatedAt != null ? `${breakdown.hoursSinceUpdatedAt.toFixed(2)}h ago` : "n/a"} => updateBoostMultiplier = ${breakdown.updateBoostMultiplier}`);
    steps.push(`genre manhwa: ${breakdown.hasManhwaGenre ? "-60%" : "no"} => genreMultiplier = ${breakdown.genreMultiplier}`);
    steps.push(`tags guro/scat: ${breakdown.hasDisturbingTags ? "-50%" : "no"} => disturbingMultiplier = ${breakdown.disturbingMultiplier}`);
    steps.push(`chapters=${breakdown.chapters} (1 => +30%, 2-5 => +10%) => lowChapterBoostMultiplier = ${breakdown.lowChapterBoostMultiplier}`);
    steps.push(`adjustedScore = ${breakdown.baseScore} * ${breakdown.hotStreakMultiplier} * ${breakdown.penaltyMultiplier} * ${breakdown.updateBoostMultiplier} * ${breakdown.genreMultiplier} * ${breakdown.disturbingMultiplier} * ${breakdown.lowChapterBoostMultiplier} = ${breakdown.adjustedScore}`);

    rows.push({
      rank: i + 1,
      id: sid,
      story,
      baseScore: breakdown.baseScore,
      adjustedScore: breakdown.adjustedScore,
      breakdown,
      steps,
      formula,
      lastInteractionAt,
    });
  }

  return rows;
};

const buildHotCarouselPipeline = (limit: number) => {
  // Custom HOT carousel pipeline (request-time) using rolling 36h window.
  const now = new Date();
  const t2 = new Date(now.getTime() - 2 * 3600 * 1000);
  const t8 = new Date(now.getTime() - 8 * 3600 * 1000);
  const t24 = new Date(now.getTime() - 24 * 3600 * 1000);
  const t36 = new Date(now.getTime() - 36 * 3600 * 1000);

  return [
    {
      $match: {
        created_at: { $gte: t36 },
        type: "view",
      },
    },
    {
      $group: {
        _id: "$story_id",
        views_0_2h: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$type", "view"] }, { $gte: ["$created_at", t2] }] },
              1,
              0,
            ],
          },
        },
        views_2_8h: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "view"] },
                  { $gte: ["$created_at", t8] },
                  { $lt: ["$created_at", t2] },
                ],
              },
              1,
              0,
            ],
          },
        },
        views_8_24h: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "view"] },
                  { $gte: ["$created_at", t24] },
                  { $lt: ["$created_at", t8] },
                ],
              },
              1,
              0,
            ],
          },
        },
        views_24_36h: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "view"] },
                  { $gte: ["$created_at", t36] },
                  { $lt: ["$created_at", t24] },
                ],
              },
              1,
              0,
            ],
          },
        },
        last_interaction_at: { $max: "$created_at" },
      },
    },
    {
      $addFields: {
        _views_weighted: {
          $add: [
            { $multiply: [{ $ifNull: ["$views_0_2h", 0] }, 1.5] },
            { $multiply: [{ $ifNull: ["$views_2_8h", 0] }, 1.3] },
            { $multiply: [{ $ifNull: ["$views_8_24h", 0] }, 1.0] },
            { $multiply: [{ $ifNull: ["$views_24_36h", 0] }, 1.0] },
          ],
        },
      },
    },
    {
      $addFields: {
        score: {
          $add: [
            {
              $multiply: [
                { $ifNull: ["$_views_weighted", 0] },
                ENV.LEADERBOARD.daily.VIEW_WEIGHT,
              ],
            },
          ],
        },
      },
    },
    {
      $sort: {
        score: -1,
        last_interaction_at: -1,
        views_0_2h: -1,
        views_2_8h: -1,
        views_8_24h: -1,
        views_24_36h: -1,
      },
    },
    { $limit: limit },
    {
      $project: {
        _id: "$_id",
        rank: { $literal: null },
        score: 1,
        story_id: "$_id",
        last_interaction_at: 1,
        views_0_2h: 1,
        views_2_8h: 1,
        views_8_24h: 1,
        views_24_36h: 1,
        views_in_period: {
          $add: [
            { $ifNull: ["$views_0_2h", 0] },
            { $ifNull: ["$views_2_8h", 0] },
            { $ifNull: ["$views_8_24h", 0] },
            { $ifNull: ["$views_24_36h", 0] },
          ],
        },
        likes_in_period: { $literal: 0 },
        comments_in_period: { $literal: 0 },
        calculated_at: now,
      },
    },
  ];
};

const buildHotCarouselPipelineForIds = (ids: string[]) => {
  const limit = Math.max(ids.length, 1);
  const base = buildHotCarouselPipeline(limit);
  if (!ids.length) return base;

  const objectIds = ids
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const matchIds = objectIds.length ? { $in: objectIds } : { $in: ids };
  return [{ $match: { story_id: matchIds } }, ...base];
};
