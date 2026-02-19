import type { ActionFunctionArgs } from "react-router";
import mongoose from "mongoose";

import { ChapterModel } from "~/database/models/chapter.model";
import { InteractionModel } from "~/database/models/interaction.model";
import { MangaModel } from "~/database/models/manga.model";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Surrogate-Control": "no-store",
};

type ReadingEvent = {
  mangaId?: string;
  chapterId?: string;
  chapterNumber?: number;
  ts?: number;
};

type ReadingBatchPayload = {
  events?: ReadingEvent[];
};

const MAX_EVENTS_PER_BATCH = 200;
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EVENT_FUTURE_SKEW_MS = 5 * 60 * 1000;

const safeJsonParse = <T,>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const normalizeMangaId = (value: unknown): string => {
  const id = String(value || "").trim();
  if (!id) return "";
  return mongoose.isValidObjectId(id) ? id : "";
};

const normalizeChapterId = (value: unknown): string => {
  const id = String(value || "").trim();
  if (!id) return "";
  return mongoose.isValidObjectId(id) ? id : "";
};

const normalizeEventTimestamp = (value: unknown): Date => {
  const now = Date.now();
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return new Date(now);
  if (raw < now - MAX_EVENT_AGE_MS) return new Date(now);
  if (raw > now + MAX_EVENT_FUTURE_SKEW_MS) return new Date(now);
  return new Date(raw);
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: NO_STORE_HEADERS });
    }

    const contentType = String(request.headers.get("content-type") || "").toLowerCase();
    let payload: ReadingBatchPayload | null = null;

    if (contentType.includes("application/json") || contentType.includes("text/plain")) {
      const raw = await request.text();
      if (raw) payload = safeJsonParse<ReadingBatchPayload>(raw);
    } else {
      const form = await request.formData();
      const raw = String(form.get("payload") || "").trim();
      if (raw) payload = safeJsonParse<ReadingBatchPayload>(raw);
    }

    const source = Array.isArray(payload?.events) ? payload!.events! : [];
    if (source.length === 0) {
      return Response.json({ ok: true, accepted: 0, processed: 0 }, { headers: NO_STORE_HEADERS });
    }

    const events = source.slice(0, MAX_EVENTS_PER_BATCH);

    // CPU-first strategy:
    // - aggregate manga-level and chapter-level counters by batch
    // - tolerate duplicates and minor loss
    const mangaCounts = new Map<string, number>();
    const chapterByIdCounts = new Map<string, number>();
    const chapterByNumberCounts = new Map<string, number>();
    const interactionDocs: Array<{ story_id: string; type: "view"; created_at: Date }> = [];

    for (const event of events) {
      const mangaId = normalizeMangaId(event?.mangaId);
      if (!mangaId) continue;

      mangaCounts.set(mangaId, (mangaCounts.get(mangaId) || 0) + 1);
      interactionDocs.push({
        story_id: mangaId,
        type: "view",
        created_at: normalizeEventTimestamp(event?.ts),
      });

      const chapterId = normalizeChapterId(event?.chapterId);
      if (chapterId) {
        chapterByIdCounts.set(chapterId, (chapterByIdCounts.get(chapterId) || 0) + 1);
        continue;
      }

      const chapterNumber = Number(event?.chapterNumber);
      if (Number.isFinite(chapterNumber) && chapterNumber > 0) {
        const numberKey = `${mangaId}:${chapterNumber}`;
        chapterByNumberCounts.set(numberKey, (chapterByNumberCounts.get(numberKey) || 0) + 1);
      }
    }

    if (mangaCounts.size > 0) {
      await MangaModel.bulkWrite(
        [...mangaCounts.entries()].map(([mangaId, count]) => ({
          updateOne: {
            filter: { _id: mangaId },
            update: {
              $inc: {
                viewNumber: count,
                dailyViews: count,
                weeklyViews: count,
                monthlyViews: count,
              },
            },
            upsert: false,
            timestamps: false,
          },
        })),
        { ordered: false, timestamps: false },
      );
    }

    if (chapterByIdCounts.size > 0) {
      await ChapterModel.bulkWrite(
        [...chapterByIdCounts.entries()].map(([chapterId, count]) => ({
          updateOne: {
            filter: { _id: chapterId },
            update: { $inc: { viewNumber: count } },
            upsert: false,
            timestamps: false,
          },
        })),
        { ordered: false, timestamps: false },
      );
    }

    if (chapterByNumberCounts.size > 0) {
      await ChapterModel.bulkWrite(
        [...chapterByNumberCounts.entries()].map(([key, count]) => {
          const splitAt = key.lastIndexOf(":");
          const mangaId = splitAt > 0 ? key.slice(0, splitAt) : "";
          const chapterNumber = splitAt > 0 ? Number(key.slice(splitAt + 1)) : NaN;
          return {
            updateOne: {
              filter: {
                mangaId,
                chapterNumber: Number.isFinite(chapterNumber) ? chapterNumber : -1,
              },
              update: { $inc: { viewNumber: count } },
              upsert: false,
              timestamps: false,
            },
          };
        }),
        { ordered: false, timestamps: false },
      );
    }

    if (interactionDocs.length > 0) {
      await InteractionModel.insertMany(interactionDocs, { ordered: false });
    }

    return Response.json(
      {
        ok: true,
        accepted: source.length,
        processed: events.length,
        mangasUpdated: mangaCounts.size,
        chaptersUpdatedById: chapterByIdCounts.size,
        chaptersUpdatedByNumber: chapterByNumberCounts.size,
        interactionsInserted: interactionDocs.length,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("api.reading-events-batch error:", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
