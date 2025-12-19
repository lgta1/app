import { Types } from "mongoose";

import { MangaModel } from "~/database/models/manga.model";
import { slugify } from "~/utils/slug.utils";

const DEFAULT_FALLBACK_SLUG = "manga";
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export function isLikelyObjectId(value: string): boolean {
  return typeof value === "string" && OBJECT_ID_REGEX.test(value);
}

export async function generateUniqueMangaSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title || "") || DEFAULT_FALLBACK_SLUG;
  const criteria: Record<string, any> = { slug: { $regex: new RegExp(`^${base}(?:-(\\d+))?$`, "i") } };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    criteria._id = { $ne: new Types.ObjectId(excludeId) };
  }

  const existing = await MangaModel.find(criteria).select("slug").lean();
  if (!existing.length) {
    return base;
  }

  const suffixes = existing
    .map((doc) => {
      const slug = String((doc as any)?.slug || "").toLowerCase();
      if (slug === base) return 1;
      const match = slug.match(/-(\d+)$/);
      return match ? Number(match[1]) : 1;
    })
    .filter((n) => Number.isFinite(n)) as number[];

  const max = suffixes.length ? Math.max(...suffixes) : 1;
  const nextNumber = max + 1;

  // Nếu slug gốc chưa bị chiếm, dùng ngay
  if (!existing.some((doc) => String((doc as any)?.slug).toLowerCase() === base)) {
    return base;
  }

  return `${base}-${nextNumber}`;
}

export async function findMangaBySlug(slug: string) {
  if (!slug) return null;
  return MangaModel.findOne({ slug }).lean();
}

export async function resolveMangaHandle(handle: string) {
  if (!handle) return null;
  const bySlug = await findMangaBySlug(handle);
  if (bySlug) return bySlug;
  if (isLikelyObjectId(handle)) {
    return MangaModel.findById(handle).lean();
  }
  return null;
}

export function needsSlugBackfill(slug?: string | null) {
  if (typeof slug !== "string") return true;
  const trimmed = slug.trim();
  if (!trimmed) return true;
  return isLikelyObjectId(trimmed);
}

function resolveSlugSource(doc: any) {
  const candidates = [doc?.title, doc?.alternateTitle];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  if (typeof doc?.code === "number" || typeof doc?.code === "string") {
    return `manga-${doc.code}`;
  }
  const fallback = String(doc?._id ?? doc?.id ?? Date.now());
  return `manga-${fallback.slice(-6)}`;
}

export async function ensureMangaSlug(doc: any) {
  if (!doc) return null;
  const current = typeof doc.slug === "string" ? doc.slug.trim() : "";
  if (current && !needsSlugBackfill(current)) {
    return current;
  }

  const docId = String(doc?._id ?? doc?.id ?? "");
  if (!docId) return current;

  const nextSlug = await generateUniqueMangaSlug(resolveSlugSource(doc), docId);
  await MangaModel.updateOne({ _id: docId }, { $set: { slug: nextSlug } }, { timestamps: false }).catch(() => null);
  doc.slug = nextSlug;
  return nextSlug;
}

export async function ensureSlugForDocs(docs: any[]) {
  if (!Array.isArray(docs) || !docs.length) return;
  await Promise.all(docs.filter(Boolean).map((doc) => ensureMangaSlug(doc)));
}
