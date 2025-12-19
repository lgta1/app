// app/routes/api.manga-progress.ts
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Types } from "mongoose";
import { MangaModel } from "~/database/models/manga.model";
import { ChapterModel } from "~/database/models/chapter.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { getUserInfoFromSession } from "@/services/session.svc";
import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";

// Helper: build mảng candidate cho mangaId (string và ObjectId nếu hợp lệ)
function buildMangaIdCandidates(id: string) {
  const candidates: any[] = [id];
  if (Types.ObjectId.isValid(id)) {
    candidates.push(new Types.ObjectId(id));
  }
  return candidates;
}

// GET /api/manga-progress?mangaId=...
// YÊU CẦU ĐĂNG NHẬP. Trả 200 { chapterNumber: number|null }
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");

    if (!mangaId) {
      return Response.json({ error: "mangaId là bắt buộc" }, { status: 400 });
    }

    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json({ error: "Vui lòng đăng nhập" }, { status: 401 });
    }

    // Chấp nhận cả Manga._id dạng string code lẫn ObjectId
    const mangaCandidates = buildMangaIdCandidates(mangaId);

    // Tồn tại manga?
    const mangaExists = await MangaModel.exists({ _id: { $in: mangaCandidates } })
      .lean()
      .catch(() => null);
    if (!mangaExists) {
      // Trong nhiều hệ, _id của Manga có thể là string, vì vậy thử findOne theo _id đúng string
      const fallback = await MangaModel.findOne({ _id: mangaId }).select({ _id: 1 }).lean();
      if (!fallback) {
        return Response.json({ error: "Truyện không tồn tại" }, { status: 404 });
      }
    }

    // Pipeline: hỗ trợ cả dữ liệu cũ (chapterId dạng string) bằng cách convert sang ObjectId
    const result = await UserReadChapterModel.aggregate([
      { $match: { userId: String(user.id) } },

      // Convert nếu chapterId lỡ lưu là string
      {
        $addFields: {
          chapterIdObj: {
            $convert: { input: "$chapterId", to: "objectId", onError: null, onNull: null },
          },
        },
      },

      {
        $lookup: {
          from: "chapters",
          localField: "chapterIdObj", // dùng field đã convert (hoặc ObjectId chuẩn)
          foreignField: "_id",
          as: "chapter",
        },
      },
      { $unwind: "$chapter" },

      // Match theo chapter.mangaId: chấp nhận cả string & ObjectId
      { $match: { "chapter.mangaId": { $in: mangaCandidates } } },

      { $sort: { "chapter.chapterNumber": -1, updatedAt: -1 } },
      { $limit: 1 },
      { $project: { _id: 0, chapterNumber: "$chapter.chapterNumber" } },
    ]);

    const chapterNumber =
      result?.[0]?.chapterNumber != null ? Number(result[0].chapterNumber) : null;

    return Response.json({ chapterNumber }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/manga-progress] error:", error);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}

// POST /api/manga-progress
// Body: { mangaId, chapterNumber } (FormData hoặc JSON)
export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Chỉ chấp nhận POST method" }, { status: 405 });
    }

    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json({ error: "Vui lòng đăng nhập" }, { status: 401 });
    }

    let mangaId = "";
    let chapterNumber: number | null = null;
    const ct = request.headers.get("content-type") || "";

    if (ct.includes("application/json")) {
      const body = await request.json();
      mangaId = String(body?.mangaId || "");
      chapterNumber = Number(body?.chapterNumber);
    } else {
      const form = await request.formData();
      mangaId = String(form.get("mangaId") || "");
      chapterNumber = Number(form.get("chapterNumber"));
    }

    if (!mangaId || !Number.isFinite(chapterNumber) || (chapterNumber as number) < 1) {
      return Response.json(
        { error: "mangaId và chapterNumber hợp lệ là bắt buộc" },
        { status: 400 },
      );
    }

    const mangaCandidates = buildMangaIdCandidates(mangaId);

    // Tìm chapter theo (mangaId bất kể kiểu, chapterNumber)
    const chapter = await ChapterModel.findOne({
      mangaId: { $in: mangaCandidates },
      chapterNumber: Number(chapterNumber),
    })
      .select({ _id: 1 })
      .lean();

    if (!chapter?._id) {
      return Response.json({ error: "Chương không tồn tại" }, { status: 404 });
    }

    // Upsert theo (userId, chapterId:ObjectId).
    await UserReadChapterModel.updateOne(
      { userId: String(user.id), chapterId: chapter._id }, // chapter._id là ObjectId
      {
        $set: { userId: String(user.id), chapterId: chapter._id },
        $setOnInsert: { createdAt: new Date() },
        $currentDate: { updatedAt: true },
      },
      { upsert: true },
    );

    return Response.json(
      { success: true, chapterId: String(chapter._id), chapterNumber },
      { status: 200 },
    );
  } catch (error) {
    if (isBusinessError?.(error)) {
      return returnBusinessError(error);
    }
    console.error("[POST /api/manga-progress] error:", error);
    return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
  }
}
