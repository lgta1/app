// app/routes/api.chapter-view.ts
import type { ActionFunctionArgs } from "react-router";
import mongoose from "mongoose";
import { ChapterModel } from "~/database/models/chapter.model";
import { MangaModel } from "~/database/models/manga.model";
import { recordInteraction } from "@/services/interaction.svc";

const noStoreHeaders = {
  "Cache-Control": "no-store, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Surrogate-Control": "no-store",
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method !== "POST") {
      return Response.json(
        { ok: false, error: "method_not_allowed" },
        { status: 405, headers: noStoreHeaders },
      );
    }

    // Bỏ qua bot/crawler cơ bản
    const ua = request.headers.get("user-agent") || "";
    if (/bot|crawler|spider|crawling/i.test(ua)) {
      return Response.json({ ok: true, skipped: "bot" }, { headers: noStoreHeaders });
    }

    const form = await request.formData();
    const chapterId = String(form.get("chapterId") || "").trim();
    const mangaId = String(form.get("mangaId") || "").trim();
    const chapterNumberRaw = String(form.get("chapterNumber") || "").trim();

    // --- Ưu tiên theo chapterId nếu FE có ---
    let chapterDoc: { _id: any; mangaId?: any } | null = null;
    if (chapterId && mongoose.isValidObjectId(chapterId)) {
      chapterDoc = await ChapterModel.findById(chapterId)
        .select("_id mangaId")
        .lean();
    }

    // --- Fallback: theo mangaId + chapterNumber ---
    if (!chapterDoc) {
      const validMangaId = mongoose.isValidObjectId(mangaId) ? mangaId : null;
      const chapterNumber = Number(chapterNumberRaw);
      if (validMangaId && Number.isFinite(chapterNumber) && chapterNumber > 0) {
        chapterDoc = await ChapterModel.findOne({
          mangaId: validMangaId,
          chapterNumber,
        })
          .select("_id mangaId")
          .lean();
      }
    }

    if (!chapterDoc?._id) {
      return Response.json(
        { ok: false, error: "chapter_not_found" },
        { status: 404, headers: noStoreHeaders },
      );
    }

    // +1 view cho Chapter
    await ChapterModel.updateOne(
      { _id: chapterDoc._id },
      { $inc: { viewNumber: 1 } },
      { timestamps: false },
    );

    // +1 view cho Manga
    const targetMangaId = chapterDoc.mangaId;
    if (targetMangaId) {
      await MangaModel.updateOne(
        { _id: targetMangaId },
        { $inc: { viewNumber: 1, dailyViews: 1, weeklyViews: 1, monthlyViews: 1 } },
        { timestamps: false },
      );

      // Ghi interaction "view" cho leaderboard (không chặn luồng chính)
      recordInteraction({
        story_id: String(targetMangaId),
        type: "view",
      }).catch((e) => console.error("recordInteraction(view) error:", e));
    }

    return Response.json(
      {
        ok: true,
        incremented: 1,
        chapterId: String(chapterDoc._id),
        mangaIdUsed: String(targetMangaId || ""),
        via: chapterId ? "by_id" : "by_manga_and_number",
      },
      { headers: noStoreHeaders },
    );
  } catch (e) {
    console.error("api.chapter-view error:", e);
    return Response.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
