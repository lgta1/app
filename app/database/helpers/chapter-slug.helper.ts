import { Types } from "mongoose";

import { ChapterModel } from "~/database/models/chapter.model";
import { slugify } from "~/utils/slug.utils";

const DEFAULT_FALLBACK_SLUG = "chap";

function normalizeSlugCandidate(value: string) {
  return slugify(value || "").replace(/^-+|-+$/g, "");
}

function buildFallbackTitle(doc: any) {
  const title = typeof doc?.title === "string" ? doc.title.trim() : "";
  if (title) return title;
  const n = Number(doc?.chapterNumber);
  if (Number.isFinite(n) && n >= 1) return `Chap ${n}`;
  return DEFAULT_FALLBACK_SLUG;
}

export async function generateUniqueChapterSlug(
  mangaId: string,
  title: string,
  excludeChapterId?: string,
): Promise<string> {
  const base = normalizeSlugCandidate(title) || DEFAULT_FALLBACK_SLUG;

  const criteria: Record<string, any> = {
    mangaId,
    slug: { $regex: new RegExp(`^${base}(?:-(\\d+))?$`, "i") },
  };

  if (excludeChapterId && Types.ObjectId.isValid(excludeChapterId)) {
    criteria._id = { $ne: new Types.ObjectId(excludeChapterId) };
  }

  const existing = await ChapterModel.find(criteria).select("slug").lean();
  if (!existing.length) return base;

  // If base isn't used, return base
  if (!existing.some((doc: any) => String(doc?.slug || "").toLowerCase() === base)) {
    return base;
  }

  const suffixes = existing
    .map((doc: any) => {
      const slug = String(doc?.slug || "").toLowerCase();
      if (slug === base) return 1;
      const match = slug.match(/-(\d+)$/);
      return match ? Number(match[1]) : 1;
    })
    .filter((n: any) => Number.isFinite(n)) as number[];

  const max = suffixes.length ? Math.max(...suffixes) : 1;
  return `${base}-${max + 1}`;
}

export function needsChapterSlugBackfill(slug?: string | null) {
  if (typeof slug !== "string") return true;
  const trimmed = slug.trim();
  if (!trimmed) return true;
  return false;
}

/**
 * Ensure a single chapter has a stable slug.
 * - Only fills when missing/blank
 * - Never changes existing slug
 */
export async function ensureChapterSlug(doc: any) {
  if (!doc) return null;

  const current = typeof doc.slug === "string" ? doc.slug.trim() : "";
  if (current && !needsChapterSlugBackfill(current)) return current;

  const mangaId = String(doc?.mangaId ?? "");
  const chapterId = String(doc?._id ?? doc?.id ?? "");
  if (!mangaId || !chapterId) return current;

  const nextSlug = await generateUniqueChapterSlug(mangaId, buildFallbackTitle(doc), chapterId);
  await ChapterModel.updateOne({ _id: chapterId }, { $set: { slug: nextSlug } }, { timestamps: false }).catch(
    () => null,
  );
  doc.slug = nextSlug;
  return nextSlug;
}

/**
 * Backfill missing slugs for all chapters of a manga in a deterministic way (by chapterNumber asc).
 * This avoids per-chapter DB queries and stabilizes suffix assignment.
 */
export async function ensureChapterSlugsForManga(mangaId: string) {
  if (!mangaId) return;

  const chapters = await ChapterModel.find({ mangaId })
    .select("_id title chapterNumber slug")
    .sort({ chapterNumber: 1, createdAt: 1 })
    .lean();

  if (!chapters.length) return;

  const reserved = new Set<string>();
  for (const c of chapters as any[]) {
    const s = typeof c?.slug === "string" ? c.slug.trim().toLowerCase() : "";
    if (s) reserved.add(s);
  }

  const ops: any[] = [];
  for (const c of chapters as any[]) {
    const current = typeof c?.slug === "string" ? c.slug.trim() : "";
    if (current) continue;

    const base = normalizeSlugCandidate(buildFallbackTitle(c)) || DEFAULT_FALLBACK_SLUG;
    let candidate = base;
    let i = 2;
    while (reserved.has(candidate.toLowerCase())) {
      candidate = `${base}-${i}`;
      i += 1;
    }
    reserved.add(candidate.toLowerCase());

    ops.push({
      updateOne: {
        filter: { _id: c._id, mangaId },
        update: { $set: { slug: candidate } },
      },
    });
  }

  if (ops.length) {
    await ChapterModel.bulkWrite(ops);
  }
}
