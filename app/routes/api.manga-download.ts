import type { ActionFunctionArgs } from "react-router";

import { requireLogin } from "~/.server/services/auth.server";
import { isAdmin } from "~/helpers/user.helper";
import { MangaModel } from "~/database/models/manga.model";
import { ChapterModel } from "~/database/models/chapter.model";
import { UserModel } from "~/database/models/user.model";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";
import { getCdnBase } from "~/.server/utils/cdn-url";
import { MINIO_CONFIG } from "@/configs/minio.config";
import { toSlug } from "~/utils/slug.utils";

const COST_PER_CHAPTER_ONESHOT = 3;
const COST_PER_CHAPTER_DEFAULT = 1;

const parseNumbers = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
      }
    } catch {
      return value
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v) && v > 0);
    }
  }
  return [];
};

const normalizeHost = (value: string) => value.replace(/:\d+$/, "").toLowerCase();

const isInternalPublicUrl = (value: string, cdnBase: string): boolean => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/") && (trimmed.includes("/manga-images/") || trimmed.includes("/test/manga-images/"))) {
    return true;
  }
  try {
    const url = new URL(value);
    const host = normalizeHost(url.hostname);
    if (!host) return false;
    let cdnHost = "";
    try {
      cdnHost = normalizeHost(new URL(cdnBase).hostname);
    } catch {
      cdnHost = "";
    }
    if (cdnHost && host === cdnHost) return true;
    const minioHost = normalizeHost(MINIO_CONFIG.ENDPOINT);
    if (minioHost && host === minioHost) return true;
    const path = url.pathname || "";
    if (path.includes("/manga-images/") || path.includes("/test/manga-images/")) return true;
  } catch {
    return false;
  }
  return false;
};

const fullPathFromPublicUrl = (url: string): string => {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) {
    return trimmed.replace(/^\/+/, "");
  }
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/^\/+/, "");
    const bucket = MINIO_CONFIG.DEFAULT_BUCKET;
    if (path.startsWith(bucket + "/")) {
      path = path.substring(bucket.length + 1);
    }
    return path;
  } catch {
    return trimmed.replace(/^\/+/, "");
  }
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireLogin(request);
    const contentType = request.headers.get("content-type") || "";

    let mangaId = "";
    let chapterNumbers: number[] = [];

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      mangaId = String(body?.mangaId ?? "").trim();
      chapterNumbers = parseNumbers(body?.chapterNumbers);
    } else {
      const formData = await request.formData();
      mangaId = String(formData.get("mangaId") ?? "").trim();
      chapterNumbers = parseNumbers(formData.get("chapterNumbers"));
    }

    if (!mangaId) {
      return Response.json({ success: false, error: "Thiếu mangaId" }, { status: 400 });
    }

    const manga = await MangaModel.findById(mangaId)
      .select({ _id: 1, ownerId: 1, title: 1, slug: 1, genres: 1 })
      .lean();
    if (!manga) {
      return Response.json({ success: false, error: "Không tìm thấy truyện" }, { status: 404 });
    }

    const query: any = { mangaId: String(manga._id) };
    if (chapterNumbers.length > 0) {
      query.chapterNumber = { $in: chapterNumbers };
    }

    const chapters = await ChapterModel.find(query)
      .select({ chapterNumber: 1, title: 1, contentUrls: 1 })
      .sort({ chapterNumber: 1 })
      .lean();

    if (!chapters.length) {
      return Response.json({ success: false, error: "Không tìm thấy chương để tải" }, { status: 404 });
    }

    const isAdminUser = isAdmin((user as any)?.role ?? "");
    const isOwner = String((manga as any).ownerId) === String(user.id);
    const genreList = Array.isArray((manga as any)?.genres) ? (manga as any).genres : [];
    const isOneshot = genreList
      .map((item: any) => toSlug(String(item)))
      .map((slug: string) => slug.toLowerCase())
      .includes("oneshot");
    const costPerChapter = isOneshot ? COST_PER_CHAPTER_ONESHOT : COST_PER_CHAPTER_DEFAULT;
    const totalCost = isAdminUser || isOwner ? 0 : chapters.length * costPerChapter;

    let goldRemaining: number | undefined = undefined;
    if (totalCost > 0) {
      const updated = await UserModel.findOneAndUpdate(
        { _id: user.id, gold: { $gte: totalCost } },
        { $inc: { gold: -totalCost } },
        { new: true },
      )
        .select({ gold: 1 })
        .lean();

      if (!updated) {
        return Response.json(
          { success: false, error: `Bạn cần ${totalCost} Dâm Ngọc để tải (không đủ số dư)` },
          { status: 400 },
        );
      }
      goldRemaining = Number((updated as any)?.gold ?? 0);
    }

    const cdnBase = getCdnBase(request);
    const payload = chapters.map((c: any) => {
      const urls = Array.isArray(c?.contentUrls)
        ? c.contentUrls.map((u: any) => (typeof u === "string" ? rewriteLegacyCdnUrl(u, cdnBase) : String(u ?? "")))
        : [];

      const downloadUrls = urls.map((u) => {
        if (!u) return "";
        const fullPath = fullPathFromPublicUrl(u);
        if (!fullPath) return u;
        if (!isInternalPublicUrl(u, cdnBase) && !fullPath.includes("manga-images/")) return u;
        return `/api/files/download?fullPath=${encodeURIComponent(fullPath)}&download=true`;
      });

      return {
        chapterNumber: Number(c?.chapterNumber ?? 0),
        title: String(c?.title ?? ""),
        contentUrls: urls,
        downloadUrls,
      };
    });

    return Response.json({
      success: true,
      cost: totalCost,
      goldRemaining,
      chapters: payload,
    });
  } catch (error) {
    console.error("[api.manga-download] error", error);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
