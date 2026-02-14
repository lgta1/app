// app/routes/manga.$mangaId.bulk-upload-urls.ts
import { requireLogin } from "~/.server/services/auth.server";
import { isAdmin, isDichGia } from "~/helpers/user.helper";
import { BusinessError } from "~/helpers/errors.helper";
import type { Route } from "./+types/manga.$mangaId.bulk-upload-urls";

import { getMangaByIdAndOwner } from "@/queries/manga.query";
import { createChapter } from "@/mutations/chapter.mutation";
import { MANGA_STATUS } from "~/constants/manga";
import { deletePublicFiles, fileExists, getFullPathFromPublicUrl, getPublicFileUrl, moveFile } from "~/utils/minio.utils";

// 👉 Dùng server-only mutation
import { systemBanDirect } from "~/.server/mutations/system-ban.direct";

type Entry = { chapter?: string; urls: string[]; requestId?: string; contentBytes?: number };

const TMP_CHAPTER_PREFIX = "tmp/manga-images";
const FINAL_CHAPTER_PREFIX = "manga-images";

/* ============ CONFIG GIỚI HẠN ============ */
const MAX_IMAGE_BYTES = 9 * 1024 * 1024;         // 1) ảnh đơn ≤ 9MB
const MAX_CHAPTER_BYTES = 130 * 1024 * 1024;     // 2) tổng/chapter ≤ 130MB
const MAX_IMAGES_PER_CHAPTER = 300;              // 3) ảnh/chapter ≤ 300
const MAX_CHAPTERS_PER_REQUEST = 100;            // 4) mỗi request ≤ 100 chapter (mới)
const REQUIRE_KNOWN_SIZES = true;
const BAN_DAYS = 3;

/* ============ HELPERS ============ */
function toAbs(u: string, origin: string) {
  try { return new URL(u, origin).toString(); } catch { return u; }
}
async function headGetSize(url: string, signal?: AbortSignal): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal });
    if (!res.ok) return null;
    const cl = res.headers.get("content-length");
    if (!cl) return null;
    const n = Number(cl);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch { return null; }
}

async function banAndFail(uploaderId: string, reason: string) {
  // Gọi system ban trực tiếp, actor là "bulk"
  await systemBanDirect({
    targetUserId: uploaderId,
    days: BAN_DAYS,
    reason: `[Bulk] ${reason}`,
    actor: "bulk",
  });
  return Response.json(
    { error: "Yêu cầu không hợp lệ." },
    { status: 403 }
  );
}

const finalizeChapterUploads = async (
  rawUrls: string[],
  requestId?: string,
): Promise<{ urls: string[]; movedDestinationPaths: string[] }> => {
  if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
    return { urls: [], movedDestinationPaths: [] };
  }
  if (!requestId) return { urls: rawUrls, movedDestinationPaths: [] };

  const tmpPrefix = `${TMP_CHAPTER_PREFIX}/${requestId}`;
  const results: string[] = new Array(rawUrls.length);
  const movedDestinationPaths: string[] = [];
  const concurrency = 5;
  let nextIndex = 0;
  let stopped = false;

  const runNext = async (): Promise<void> => {
    if (stopped || nextIndex >= rawUrls.length) return;
    const currentIndex = nextIndex;
    nextIndex += 1;

    const url = rawUrls[currentIndex];
    const fullPath = getFullPathFromPublicUrl(url);
    if (!fullPath || !fullPath.includes(tmpPrefix)) {
      results[currentIndex] = url;
      if (nextIndex < rawUrls.length) await runNext();
      return;
    }

    const destinationFullPath = fullPath.replace(`${tmpPrefix}/`, `${FINAL_CHAPTER_PREFIX}/`);
    const sourceExists = await fileExists(fullPath);

    if (sourceExists) {
      await moveFile(fullPath, destinationFullPath);
      movedDestinationPaths.push(destinationFullPath);
    } else {
      const destExists = await fileExists(destinationFullPath);
      if (!destExists) {
        throw new BusinessError("Không tìm thấy ảnh đã tải lên, vui lòng thử lại");
      }
    }

    results[currentIndex] = getPublicFileUrl(destinationFullPath);
    if (nextIndex < rawUrls.length) await runNext();
  };

  const starters = Array.from(
    { length: Math.min(concurrency, rawUrls.length) },
    () => runNext(),
  );

  try {
    await Promise.all(starters);
  } catch (error) {
    stopped = true;
    throw error;
  }

  return { urls: results, movedDestinationPaths };
};

/* ============ ACTION ============ */
export async function action({ request, params }: Route.ActionArgs) {
  try {
    const user = await requireLogin(request);
    const isAdminUser = isAdmin(user.role);
    const isDichGiaUser = isDichGia(user.role);

    const mangaHandle = params.mangaId;
    if (!mangaHandle) return Response.json({ error: "Missing mangaId" }, { status: 400 });

    const manga = await getMangaByIdAndOwner(mangaHandle, user.id, isAdminUser);
    if (!manga) return Response.json({ error: "Không tìm thấy truyện" }, { status: 404 });
    const mangaId = manga.id;

    // Cho phép: Admin hoặc Dịch giả (owner). Endpoint chỉ được gọi nếu đã hiển thị nút.
    if (!(isAdminUser || isDichGiaUser)) {
      return Response.json({ error: "Chỉ admin hoặc dịch giả được phép tải hàng loạt" }, { status: 403 });
    }

    // Payload
    let payload: { entries: Entry[] } | null = null;
    try { payload = await request.json(); }
    catch { return Response.json({ error: "Body phải là JSON { entries: [...] }" }, { status: 400 }); }

    const entries = Array.isArray(payload?.entries) ? payload!.entries : [];
    if (!entries.length) return Response.json({ error: "entries rỗng" }, { status: 400 });

    // 🔁 Giới hạn mới: per-request ≤ 100 chapter (không phụ thuộc tổng chương của manga)
    if (entries.length > MAX_CHAPTERS_PER_REQUEST) {
      // Chỉ trả 400, KHÔNG ban — tránh quá tay khi user lỡ gửi quá nhiều
      return Response.json({ error: "Số chapter trong một lần upload vượt giới hạn cho phép" }, { status: 400 });
      // Nếu muốn ban thay vì 400:
      // return await banAndFail(user.id, "[Bulk] SPAM");
    }

    const origin = new URL(request.url).origin;
    let createdChapters = 0;
    let savedImages = 0;
    const warnings: string[] = [];

    for (const entry of entries) {
      const rawUrls = Array.isArray(entry?.urls) ? entry.urls : [];
      const requestId = typeof entry?.requestId === "string" ? entry.requestId.trim() : "";
      const providedContentBytes = Number.isFinite((entry as any)?.contentBytes)
        ? Number((entry as any).contentBytes)
        : 0;
      if (rawUrls.length === 0) {
        return Response.json({ error: `Chapter "${entry?.chapter ?? ""}" không có ảnh.` }, { status: 400 });
      }

      // Rule: số ảnh/chapter
      if (rawUrls.length > MAX_IMAGES_PER_CHAPTER) {
        return await banAndFail(
          user.id,
          `[Bulk] SPAM`,
        );
      }

  // Allow blank; server will convert to "Chap N" based on final chapter number.
  const title = (entry?.chapter ?? "").trim();
      const urls = rawUrls.map((u) => toAbs(String(u), origin));

      // Rule: size từng ảnh + tổng size chapter
      let total = 0;
      if (providedContentBytes > 0) {
        total = providedContentBytes;
        if (total > MAX_CHAPTER_BYTES) {
          return await banAndFail(
            user.id,
            "[Bulk] SPAM",
          );
        }
      } else {
        for (const u of urls) {
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), 12_000);
          let size: number | null = null;
          try { size = await headGetSize(u, ctl.signal); }
          finally { clearTimeout(timer); }

          if (size === null) {
            if (REQUIRE_KNOWN_SIZES) {
              return Response.json(
                {
                  error: `Không xác định được dung lượng ảnh ở "${title}" → dừng bulk, KHÔNG ban.`,
                  createdChapters,
                  savedImages,
                  warnings,
                },
                { status: 400 },
              );
            }
            continue;
          }

          if (size > MAX_IMAGE_BYTES) {
            return await banAndFail(
              user.id,
              "[Bulk] SPAM",
            );
          }

          total += size;
          if (total > MAX_CHAPTER_BYTES) {
            return await banAndFail(
              user.id,
              "[Bulk] SPAM",
            );
          }
        }
      }

      const finalized = await finalizeChapterUploads(urls, requestId);
      const finalUrls = finalized.urls;
      const movedDestinationPaths = finalized.movedDestinationPaths;

      const hasTmpUrlWithoutRequestId =
        !requestId &&
        finalUrls.some((url) => {
          const fullPath = getFullPathFromPublicUrl(String(url || ""));
          return String(fullPath || "").includes(`${TMP_CHAPTER_PREFIX}/`);
        });
      if (hasTmpUrlWithoutRequestId) {
        return Response.json(
          {
            error: `Thiếu mã phiên upload ở chapter "${title}", vui lòng tải lại ảnh`,
            createdChapters,
            savedImages,
            warnings,
          },
          { status: 400 },
        );
      }

      // Tạo chapter
      try {
        await createChapter(request, {
          title,
          contentUrls: finalUrls,
          mangaId,
          contentBytes: total,
        });
        createdChapters += 1;
        savedImages += finalUrls.length;
      } catch (e: any) {
        if (requestId) {
          try {
            const toDelete = movedDestinationPaths.filter((fullPath) =>
              String(fullPath || "").includes(`${FINAL_CHAPTER_PREFIX}/`),
            );
            if (toDelete.length) {
              await deletePublicFiles(toDelete);
            }
          } catch (cleanupError) {
            console.warn("[bulk-upload-urls] cleanup moved files failed", cleanupError);
          }
        }
        console.error("[bulk-upload-urls] createChapter error:", e?.stack || e);
        return Response.json(
          { error: `Tạo chapter "${title}" lỗi: ${e?.message || String(e)}`, createdChapters, savedImages, warnings },
          { status: 500 },
        );
      }
    }

    return Response.json({ createdChapters, savedImages, warnings });
  } catch (error) {
    const message = error instanceof BusinessError ? error.message : "Internal server error";
    console.error("[bulk-upload-urls] FATAL:", (error as any)?.stack || error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export default function NoUI() { return null; }
