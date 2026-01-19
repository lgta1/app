import { Link, useFetcher, useLoaderData, useRevalidator } from "react-router-dom";
import { type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { load } from "cheerio";

import { requireAdminLogin } from "@/services/auth.server";
import {
  autoDownloadViHentaiManga,
  type ViHentaiAutoDownloadResult,
} from "@/services/importers/vi-hentai-importer";
import { MANGA_CONTENT_TYPE, MANGA_USER_STATUS } from "~/constants/manga";

import { Trash2 } from "lucide-react";

import {
  ViHentaiAutoDownloadJobModel,
  type ViHentaiAutoDownloadJobStatus,
} from "~/database/models/vi-hentai-auto-download-job.model";
import { ViHentaiListingExtractHistoryModel } from "~/database/models/vi-hentai-listing-extract-history.model";

type ActionResult = {
  ok: boolean;
  error?: string;
  result?:
    | ({
        status: "created" | "dry-run" | "skipped";
        title: string;
        slug?: string;
        poster: string;
        url: string;
        message: string;
        matchedGenres: string[];
        unknownGenres: string[];
        parsedStatus?: string;
        translationTeam?: string;
        translatorNames?: string[];
        chaptersImported: number;
        imagesUploaded: number;
        chapterErrors?: Array<{ chapterUrl: string; message: string }>;
      } & { modeLabel: string; createdId?: string })
    | {
        status: "error";
        url: string;
        message: string;
      };
};

type EnqueueBatchActionResult =
  | { ok: true; batchId: string; items: Array<{ rowId: string; jobId: string; url: string }> }
  | { ok: false; error: string };

type PauseBatchActionResult =
  | { ok: true; batchId: string; paused: boolean }
  | { ok: false; error: string };

type BatchControlActionResult =
  | { ok: true; batchId: string; action: "stop" | "delete" | "hard-delete" }
  | { ok: false; error: string };

type PollBatchLoaderResult =
  | {
      ok: true;
      batchId: string;
      jobs: Array<{
        jobId: string;
        url: string;
        status: ViHentaiAutoDownloadJobStatus;
        paused?: boolean;
        startedAt?: string;
        finishedAt?: string;
        progress?: {
          stage?: string;
          message?: string;
          chapterIndex?: number;
          chapterCount?: number;
          chapterTitle?: string;
          imageIndex?: number;
          imageCount?: number;
        };
        result?: {
          message?: string;
          createdId?: string;
          createdSlug?: string;
          chaptersImported?: number;
          imagesUploaded?: number;
          chapterErrors?: number;
        };
        errorMessage?: string;
      }>;
    }
  | { ok: false; error: string };

type InitialLoaderResult =
  | {
      ok: true;
      activeBatchId: string | null;
      recentListingUrls: Array<{ url: string; ok?: boolean; linksCount?: number; capped?: boolean; createdAt: string; errorMessage?: string }>;
      batches: Array<{
        batchId: string;
        status: "queued" | "running" | "stopped" | "succeeded" | "failed";
        createdAt: string;
        lastActivityAt: string;
        counts: { total: number; queued: number; running: number; succeeded: number; failed: number; pausedQueued: number };
      }>;
      jobs: Array<{
        jobId: string;
        url: string;
        status: ViHentaiAutoDownloadJobStatus;
        paused?: boolean;
        startedAt?: string;
        finishedAt?: string;
        progress?: {
          stage?: string;
          message?: string;
          chapterIndex?: number;
          chapterCount?: number;
          chapterTitle?: string;
          imageIndex?: number;
          imageCount?: number;
        };
        result?: {
          message?: string;
          createdId?: string;
          createdSlug?: string;
          chaptersImported?: number;
          imagesUploaded?: number;
          chapterErrors?: number;
        };
        errorMessage?: string;
      }>;
    }
  | { ok: false; error: string };

type ExtractListingActionResult =
  | { ok: true; url: string; links: string[]; count: number; capped?: boolean }
  | { ok: false; error: string };

export const meta: MetaFunction = () => ([
  { title: "Tự động tải truyện | Admin" },
  { name: "description", content: "Tạo truyện + tải chương từ vi-hentai.pro" },
]);

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminLogin(request);

  const url = new URL(request.url);
  const intent = url.searchParams.get("intent") || "";

  if (intent !== "pollBatch") {
    try {
      const [activeJob, latestJob] = await Promise.all([
        ViHentaiAutoDownloadJobModel.findOne({ status: { $in: ["queued", "running"] } })
          .sort({ createdAt: -1 })
          .select({ batchId: 1 })
          .lean(),
        ViHentaiAutoDownloadJobModel.findOne({})
          .sort({ createdAt: -1 })
          .select({ batchId: 1 })
          .lean(),
      ]);

      const batchIdFromActive = activeJob?.batchId ? String(activeJob.batchId) : null;
      const batchIdFromLatest = latestJob?.batchId ? String(latestJob.batchId) : null;
      const activeBatchId = batchIdFromActive || batchIdFromLatest;

      const [jobs, listingHistory, batchSummariesRaw] = await Promise.all([
        activeBatchId
          ? ViHentaiAutoDownloadJobModel.find({ batchId: activeBatchId })
              .sort({ createdAt: 1 })
              .select({
                _id: 1,
                url: 1,
                status: 1,
                paused: 1,
                startedAt: 1,
                finishedAt: 1,
                progress: 1,
                result: 1,
                errorMessage: 1,
              })
              .lean()
          : Promise.resolve([] as any[]),
        ViHentaiListingExtractHistoryModel.find({ url: { $exists: true, $ne: "" } })
          .sort({ createdAt: -1 })
          .limit(10)
          .select({ url: 1, ok: 1, linksCount: 1, capped: 1, createdAt: 1, errorMessage: 1 })
          .lean(),
        ViHentaiAutoDownloadJobModel.aggregate([
          { $match: { batchId: { $exists: true, $ne: "" } } },
          {
            $group: {
              _id: "$batchId",
              createdAt: { $min: "$createdAt" },
              lastCreatedAt: { $max: "$createdAt" },
              lastStartedAt: { $max: "$startedAt" },
              lastFinishedAt: { $max: "$finishedAt" },
              total: { $sum: 1 },
              queued: { $sum: { $cond: [{ $eq: ["$status", "queued"] }, 1, 0] } },
              running: { $sum: { $cond: [{ $eq: ["$status", "running"] }, 1, 0] } },
              succeeded: { $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] } },
              failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
              pausedQueued: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ["$status", "queued"] }, { $eq: ["$paused", true] }] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { lastCreatedAt: -1 } },
          { $limit: 50 },
        ]),
      ]);

      const recentListingUrls = listingHistory
        .map((h) => ({
          url: String((h as any).url || ""),
          ok: typeof (h as any).ok === "boolean" ? Boolean((h as any).ok) : undefined,
          linksCount: typeof (h as any).linksCount === "number" ? Number((h as any).linksCount) : undefined,
          capped: typeof (h as any).capped === "boolean" ? Boolean((h as any).capped) : undefined,
          createdAt: (h as any).createdAt ? new Date((h as any).createdAt).toISOString() : new Date().toISOString(),
          errorMessage: (h as any).errorMessage ? String((h as any).errorMessage) : undefined,
        }))
        .filter((x) => x.url);

      const batches = (batchSummariesRaw as any[]).map((b) => {
        const queued = Number(b.queued || 0);
        const running = Number(b.running || 0);
        const failed = Number(b.failed || 0);
        const succeeded = Number(b.succeeded || 0);
        const pausedQueued = Number(b.pausedQueued || 0);

        const lastActivity = b.lastFinishedAt || b.lastStartedAt || b.lastCreatedAt || b.createdAt;
        const status: "queued" | "running" | "stopped" | "succeeded" | "failed" =
          running > 0
            ? "running"
            : queued > 0 && pausedQueued >= queued
              ? "stopped"
              : queued > 0
                ? "queued"
                : failed > 0
                  ? "failed"
                  : succeeded > 0
                    ? "succeeded"
                    : "queued";

        return {
          batchId: String(b._id || ""),
          status,
          createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString(),
          lastActivityAt: lastActivity ? new Date(lastActivity).toISOString() : new Date().toISOString(),
          counts: {
            total: Number(b.total || 0),
            queued,
            running,
            succeeded,
            failed,
            pausedQueued,
          },
        };
      }).filter((x) => x.batchId);

      const body: InitialLoaderResult = {
        ok: true,
        activeBatchId,
        recentListingUrls,
        batches,
        jobs: jobs.map((j) => ({
          jobId: String(j._id),
          url: String(j.url || ""),
          status: j.status as ViHentaiAutoDownloadJobStatus,
          paused: Boolean((j as any).paused),
          startedAt: j.startedAt ? new Date(j.startedAt).toISOString() : undefined,
          finishedAt: j.finishedAt ? new Date(j.finishedAt).toISOString() : undefined,
          progress: j.progress
            ? {
                stage: (j.progress as any).stage,
                message: (j.progress as any).message,
                chapterIndex: (j.progress as any).chapterIndex,
                chapterCount: (j.progress as any).chapterCount,
                chapterTitle: (j.progress as any).chapterTitle,
                imageIndex: (j.progress as any).imageIndex,
                imageCount: (j.progress as any).imageCount,
              }
            : undefined,
          result: (j as any).result
            ? {
                message: (j as any).result?.message,
                createdId: (j as any).result?.createdId,
                createdSlug: (j as any).result?.createdSlug,
                chaptersImported: (j as any).result?.chaptersImported,
                imagesUploaded: (j as any).result?.imagesUploaded,
                chapterErrors: (j as any).result?.chapterErrors,
              }
            : undefined,
          errorMessage: (j as any).errorMessage || undefined,
        })),
      };

      return Response.json(body, { status: 200 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tải trạng thái auto-load";
      const body: InitialLoaderResult = { ok: false, error: message };
      return Response.json(body, { status: 200 });
    }
  }

  const batchId = (url.searchParams.get("batchId") || "").trim();
  if (!batchId) {
    const body: PollBatchLoaderResult = { ok: false, error: "Thiếu batchId" };
    return Response.json(body, { status: 400 });
  }

  const jobs = await ViHentaiAutoDownloadJobModel.find({ batchId })
    .sort({ createdAt: 1 })
    .select({
      _id: 1,
      url: 1,
      status: 1,
      paused: 1,
      startedAt: 1,
      finishedAt: 1,
      progress: 1,
      result: 1,
      errorMessage: 1,
    })
    .lean();

  const body: PollBatchLoaderResult = {
    ok: true,
    batchId,
    jobs: jobs.map((j) => ({
      jobId: String(j._id),
      url: String(j.url || ""),
      status: j.status as ViHentaiAutoDownloadJobStatus,
      paused: Boolean((j as any).paused),
      startedAt: j.startedAt ? new Date(j.startedAt).toISOString() : undefined,
      finishedAt: j.finishedAt ? new Date(j.finishedAt).toISOString() : undefined,
      progress: j.progress
        ? {
            stage: (j.progress as any).stage,
            message: (j.progress as any).message,
            chapterIndex: (j.progress as any).chapterIndex,
            chapterCount: (j.progress as any).chapterCount,
            chapterTitle: (j.progress as any).chapterTitle,
            imageIndex: (j.progress as any).imageIndex,
            imageCount: (j.progress as any).imageCount,
          }
        : undefined,
      result: (j as any).result
        ? {
            message: (j as any).result?.message,
            createdId: (j as any).result?.createdId,
            createdSlug: (j as any).result?.createdSlug,
            chaptersImported: (j as any).result?.chaptersImported,
            imagesUploaded: (j as any).result?.imagesUploaded,
            chapterErrors: (j as any).result?.chapterErrors,
          }
        : undefined,
      errorMessage: (j as any).errorMessage || undefined,
    })),
  };

  return Response.json(body, { status: 200 });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminLogin(request);
  const formData = await request.formData();

  const intent = (formData.get("intent") || "autoDownloadOne").toString();

  // ---- Server-side queue (background) ----
  if (intent === "enqueueBatch") {
    const MAX_QUEUE_ITEMS = 2000;
    const batchId = (formData.get("batchId") || "").toString().trim();
    const itemsRaw = (formData.get("items") || "").toString();

    const ownerId = (formData.get("ownerId") || "").toString().trim();
    const translationTeam = formData.get("translationTeam")?.toString().trim() || undefined;
    const approve = formData.get("approve") === "on";
    const dryRun = formData.get("dryRun") === "on";
    const skipIfExists = formData.get("skipIfExists") === "on";
    const downloadPoster = formData.get("downloadPoster") === "on";
    const contentType = formData.get("contentType")?.toString() || "MANGA";
    const userStatus = formData.get("userStatus")?.toString() || "auto";
    const maxChapters = Number(formData.get("maxChapters")?.toString() || "500");

    if (!batchId) {
      const body: EnqueueBatchActionResult = { ok: false, error: "Thiếu batchId" };
      return Response.json(body, { status: 400 });
    }
    if (!ownerId) {
      const body: EnqueueBatchActionResult = { ok: false, error: "Vui lòng nhập ownerId" };
      return Response.json(body, { status: 400 });
    }

    let items: Array<{ rowId: string; url: string }> = [];
    try {
      const parsed = JSON.parse(itemsRaw);
      if (Array.isArray(parsed)) {
        items = parsed
          .map((x) => ({ rowId: String(x?.rowId || ""), url: String(x?.url || "").trim() }))
          .filter((x) => x.rowId && x.url);
      }
    } catch {
      // ignore
    }

    if (!items.length) {
      const body: EnqueueBatchActionResult = { ok: false, error: "Không có URL hợp lệ để đưa vào queue" };
      return Response.json(body, { status: 400 });
    }

    if (items.length > MAX_QUEUE_ITEMS) {
      const body: EnqueueBatchActionResult = {
        ok: false,
        error: `Queue vượt giới hạn ${MAX_QUEUE_ITEMS} link/lần. Hiện có: ${items.length}`,
      };
      return Response.json(body, { status: 400 });
    }

    const docs = items.map((it) => ({
      batchId,
      url: it.url,
      ownerId,
      translationTeam,
      approve,
      dryRun,
      skipIfExists,
      downloadPoster,
      contentType,
      userStatus,
      maxChapters: Number.isFinite(maxChapters) && maxChapters > 0 ? maxChapters : 500,
      status: "queued" as const,
      paused: false,
    }));

    const created = await ViHentaiAutoDownloadJobModel.insertMany(docs);
    const body: EnqueueBatchActionResult = {
      ok: true,
      batchId,
      items: created.map((job, idx) => ({
        rowId: items[idx].rowId,
        jobId: String(job._id),
        url: items[idx].url,
      })),
    };
    return Response.json(body, { status: 200 });
  }

  if (intent === "pauseBatch" || intent === "resumeBatch") {
    const batchId = (formData.get("batchId") || "").toString().trim();
    if (!batchId) {
      const body: PauseBatchActionResult = { ok: false, error: "Thiếu batchId" };
      return Response.json(body, { status: 400 });
    }

    const paused = intent === "pauseBatch";
    await ViHentaiAutoDownloadJobModel.updateMany(
      { batchId, status: "queued" },
      { $set: { paused } },
    );

    const body: PauseBatchActionResult = { ok: true, batchId, paused };
    return Response.json(body, { status: 200 });
  }

  if (intent === "stopBatch") {
    const batchId = (formData.get("batchId") || "").toString().trim();
    if (!batchId) {
      const body: BatchControlActionResult = { ok: false, error: "Thiếu batchId" };
      return Response.json(body, { status: 400 });
    }

    // Soft-stop: pause all queued jobs. Running job (if any) will finish.
    await ViHentaiAutoDownloadJobModel.updateMany(
      { batchId, status: "queued" },
      { $set: { paused: true } },
    );

    const body: BatchControlActionResult = { ok: true, batchId, action: "stop" };
    return Response.json(body, { status: 200 });
  }

  if (intent === "deleteBatch") {
    const batchId = (formData.get("batchId") || "").toString().trim();
    if (!batchId) {
      const body: BatchControlActionResult = { ok: false, error: "Thiếu batchId" };
      return Response.json(body, { status: 400 });
    }

    const running = await ViHentaiAutoDownloadJobModel.findOne({ batchId, status: "running" })
      .select({ _id: 1 })
      .lean();
    if (running) {
      const body: BatchControlActionResult = { ok: false, error: "Batch đang chạy, vui lòng dừng/pause trước" };
      return Response.json(body, { status: 400 });
    }

    await ViHentaiAutoDownloadJobModel.deleteMany({ batchId });
    const body: BatchControlActionResult = { ok: true, batchId, action: "delete" };
    return Response.json(body, { status: 200 });
  }

  if (intent === "hardDeleteBatch") {
    const batchId = (formData.get("batchId") || "").toString().trim();
    if (!batchId) {
      const body: BatchControlActionResult = { ok: false, error: "Thiếu batchId" };
      return Response.json(body, { status: 400 });
    }

    const now = new Date();

    // 1) Request cancel for ALL jobs in batch (queued + running).
    await ViHentaiAutoDownloadJobModel.updateMany(
      { batchId },
      { $set: { paused: true, cancelRequestedAt: now, hardDeleteRequestedAt: now } },
    );

    // 2) Best-effort in-process abort (if this request hits the same instance running the worker).
    try {
      const { requestAbortViHentaiAutoDownloadBatch } = await import("~/.server/jobs/vi-hentai-auto-download-queue.server");
      await requestAbortViHentaiAutoDownloadBatch(batchId);
    } catch {
      // ignore
    }

    // 3) Wait a bit for running job to abort (to avoid racing cleanup).
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const timeoutMs = 20_000;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const running = await ViHentaiAutoDownloadJobModel.findOne({ batchId, status: "running" })
        .select({ _id: 1 })
        .lean();
      if (!running) break;
      await sleep(250);
    }

    const stillRunning = await ViHentaiAutoDownloadJobModel.findOne({ batchId, status: "running" })
      .select({ _id: 1 })
      .lean();
    if (stillRunning) {
      const body: BatchControlActionResult = {
        ok: false,
        error: "Không thể dừng job đang chạy kịp thời (timeout). Vui lòng bấm Hard delete lại sau vài giây.",
      };
      return Response.json(body, { status: 409 });
    }

    // 4) Collect created manga IDs from jobs (even partial runs).
    const jobs = await ViHentaiAutoDownloadJobModel.find({ batchId })
      .select({ createdMangaId: 1, progress: 1, result: 1 })
      .lean();
    const mangaIds = new Set<string>();
    for (const j of jobs) {
      const createdMangaId = String((j as any).createdMangaId || "");
      const progressMangaId = String((j as any).progress?.mangaId || "");
      const resultMangaId = String((j as any).result?.createdId || "");
      if (createdMangaId) mangaIds.add(createdMangaId);
      if (progressMangaId) mangaIds.add(progressMangaId);
      if (resultMangaId) mangaIds.add(resultMangaId);
    }

    // 5) Cleanup storage + DB docs.
    if (mangaIds.size) {
      const { MangaModel } = await import("~/database/models/manga.model");
      const { deleteManga } = await import("~/.server/mutations/manga.mutation");
      const { listFiles, deleteFiles, getEnvironmentPrefix } = await import("~/utils/minio.utils");
      const { MINIO_CONFIG } = await import("@/configs/minio.config");

      const envPrefix = getEnvironmentPrefix();
      const bucketMarker = `/${String((MINIO_CONFIG as any).DEFAULT_BUCKET || "")}/`;
      const cdnBase = ((process.env.CDN_BASE ?? "").trim() || "https://cdn.hoangsatruongsalacuavietnam.site").replace(/\/+$/, "");

      const toFullPathIfInternal = (urlRaw?: string | null) => {
        const u = (urlRaw || "").toString().trim();
        if (!u) return null;
        if (!(u.startsWith(cdnBase + "/") || u.includes(bucketMarker))) return null;
        try {
          const url = new URL(u);
          if (bucketMarker && url.pathname.includes(bucketMarker)) {
            const rest = url.pathname.split(bucketMarker)[1];
            return rest ? rest.replace(/^\/+/, "") : null;
          }
          return url.pathname.replace(/^\/+/, "");
        } catch {
          return null;
        }
      };

      const deletePrefix = async (prefixPath: string) => {
        const normalized = prefixPath.replace(/^\/+|\/+$/g, "");
        const actualPrefix = envPrefix ? `${envPrefix}/${normalized}` : normalized;
        const files = await listFiles({ prefixPath: actualPrefix, recursive: true, isPublic: true } as any);
        const fullPaths = files.map((f: any) => String(f.fullPath || "")).filter(Boolean);
        const CHUNK = 500;
        for (let i = 0; i < fullPaths.length; i += CHUNK) {
          await deleteFiles(fullPaths.slice(i, i + CHUNK));
        }
      };

      await Promise.allSettled(
        Array.from(mangaIds).map(async (mangaId) => {
          try {
            // 5.1) delete all chapter images under prefix
            await deletePrefix(`manga-images/${mangaId}`);

            // 5.2) delete poster/shareImage if they are internal URLs
            const manga = await MangaModel.findById(mangaId)
              .select({ poster: 1, shareImage: 1 })
              .lean();

            const posterFullPath = toFullPathIfInternal((manga as any)?.poster);
            const shareFullPath = toFullPathIfInternal((manga as any)?.shareImage);
            const toDelete = [posterFullPath, shareFullPath].filter(Boolean) as string[];
            if (toDelete.length) {
              try {
                await deleteFiles(toDelete);
              } catch {
                // ignore
              }
            }

            // 5.3) delete DB cascade
            await deleteManga(request, mangaId);
          } catch {
            // Best-effort cleanup; keep going
          }
        }),
      );
    }

    // 6) Finally, delete the whole batch jobs.
    await ViHentaiAutoDownloadJobModel.deleteMany({ batchId });

    const body: BatchControlActionResult = { ok: true, batchId, action: "hard-delete" };
    return Response.json(body, { status: 200 });
  }

  // ---- Extract links from listing/genre page ----
  if (intent === "extractListing") {
    const listingUrlRaw = formData.get("listingUrl");
    if (!listingUrlRaw || typeof listingUrlRaw !== "string") {
      const body: ExtractListingActionResult = { ok: false, error: "Vui lòng nhập URL trang thể loại" };
      return Response.json(body, { status: 400 });
    }

    let listingUrl: URL;
    try {
      listingUrl = new URL(listingUrlRaw.trim());
    } catch {
      const body: ExtractListingActionResult = { ok: false, error: "URL không hợp lệ" };
      return Response.json(body, { status: 400 });
    }

    if (!/^https?:$/.test(listingUrl.protocol)) {
      const body: ExtractListingActionResult = { ok: false, error: "URL không hợp lệ (chỉ hỗ trợ http/https)" };
      return Response.json(body, { status: 400 });
    }

    // SSRF guardrail: only allow vi-hentai.pro pages.
    const host = listingUrl.hostname.toLowerCase();
    if (!(host === "vi-hentai.pro" || host.endsWith(".vi-hentai.pro"))) {
      const body: ExtractListingActionResult = { ok: false, error: "Chỉ hỗ trợ link thuộc vi-hentai.pro" };
      return Response.json(body, { status: 400 });
    }

    const MAX_LINKS = 2000;

    const history = await ViHentaiListingExtractHistoryModel.create({
      url: listingUrl.toString(),
      ok: undefined,
    });

    try {
      const res = await fetch(listingUrl.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept-Language": "vi,en;q=0.9",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!res.ok) {
        const error = `Không thể tải trang (${res.status} ${res.statusText})`;
        await ViHentaiListingExtractHistoryModel.updateOne(
          { _id: (history as any)._id },
          { $set: { ok: false, errorMessage: error } },
        );
        const body: ExtractListingActionResult = { ok: false, error };
        return Response.json(body, { status: 200 });
      }

      const html = await res.text();
      const $ = load(html);

    const isMangaPathname = (pathname: string) => {
      // Only accept /truyen/<slug> (optionally trailing slash).
      // Reject /truyen/<slug>/<something> (usually chapter pages).
      return /^\/truyen\/[^\/]+\/?$/.test(pathname);
    };

    const normalizeMangaUrl = (rawHref: string) => {
      try {
        const u = new URL(rawHref, listingUrl.origin);
        // Only keep canonical manga page: origin + pathname, strip query/hash.
        const pathname = u.pathname.replace(/\/+$/, "");
        if (!isMangaPathname(`${pathname}/`)) return null;
        return `${listingUrl.origin}${pathname}`;
      } catch {
        return null;
      }
    };

    const seen = new Set<string>();
    const links: string[] = [];

    $("a[href]")
      .toArray()
      .forEach((el) => {
        if (links.length >= MAX_LINKS) return;
        const href = String($(el).attr("href") || "").trim();
        if (!href) return;
        if (href.includes("/truyen-hentai")) return;
        if (!href.includes("/truyen/")) return;

        const normalized = normalizeMangaUrl(href);
        if (!normalized) return;
        if (seen.has(normalized)) return;
        seen.add(normalized);
        links.push(normalized);
      });

      const capped = links.length >= MAX_LINKS;
      await ViHentaiListingExtractHistoryModel.updateOne(
        { _id: (history as any)._id },
        { $set: { ok: true, linksCount: links.length, capped }, $unset: { errorMessage: 1 } },
      );

      const body: ExtractListingActionResult = {
        ok: true,
        url: listingUrl.toString(),
        links,
        count: links.length,
        capped,
      };
      return Response.json(body, { status: 200 });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Không thể trích xuất link";
      await ViHentaiListingExtractHistoryModel.updateOne(
        { _id: (history as any)._id },
        { $set: { ok: false, errorMessage: error } },
      );
      const body: ExtractListingActionResult = { ok: false, error };
      return Response.json(body, { status: 200 });
    }
  }

  const urlRaw = formData.get("url") ?? formData.get("urls");
  const ownerId = formData.get("ownerId");
  const translationTeam = formData.get("translationTeam")?.toString().trim() || undefined;
  const approve = formData.get("approve") === "on";
  const contentTypeValue = formData.get("contentType")?.toString();
  const userStatusValue = formData.get("userStatus")?.toString();

  if (!urlRaw || typeof urlRaw !== "string") {
    const body: ActionResult = { ok: false, error: "Vui lòng nhập URL" };
    return Response.json(body, { status: 400 });
  }
  if (!ownerId || typeof ownerId !== "string") {
    const body: ActionResult = { ok: false, error: "Vui lòng nhập ownerId" };
    return Response.json(body, { status: 400 });
  }

  const url = urlRaw
    .split(/\r?\n|,/)
    .map((u) => u.trim())
    .filter(Boolean)[0];

  if (!url) {
    const body: ActionResult = { ok: false, error: "URL không hợp lệ" };
    return Response.json(body, { status: 400 });
  }

  const contentType =
    contentTypeValue === "COSPLAY" ? MANGA_CONTENT_TYPE.COSPLAY : MANGA_CONTENT_TYPE.MANGA;

  let userStatusOverride: number | undefined;
  if (userStatusValue === "completed") {
    userStatusOverride = MANGA_USER_STATUS.COMPLETED;
  } else if (userStatusValue === "ongoing") {
    userStatusOverride = MANGA_USER_STATUS.ON_GOING;
  }

  const shouldDryRun = formData.get("dryRun") === "on";
  const shouldSkipIfExists = formData.get("skipIfExists") === "on";
  const shouldDownloadPoster = formData.get("downloadPoster") === "on";
  const maxChaptersRaw = formData.get("maxChapters")?.toString().trim();
  const maxChapters = maxChaptersRaw ? Number(maxChaptersRaw) : 500;

  try {
    const result = await autoDownloadViHentaiManga({
      request,
      url,
      ownerId,
      translationTeam,
      approve,
      dryRun: shouldDryRun,
      skipIfExists: shouldSkipIfExists,
      contentType,
      userStatusOverride,
      downloadPoster: shouldDownloadPoster,
      downloadChapters: true,
      maxChapters: Number.isFinite(maxChapters) && maxChapters > 0 ? maxChapters : 500,
    });

    const body: ActionResult = {
      ok: true,
      result: formatSuccessResult(result),
    };
    return Response.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tải truyện";
    const body: ActionResult = { ok: false, result: { status: "error", url, message } };
    return Response.json(body, { status: 200 });
  }
}

const formatSuccessResult = (result: ViHentaiAutoDownloadResult) => {
  const modeLabelMap: Record<ViHentaiAutoDownloadResult["mode"], string> = {
    "dry-run": "Dry-run",
    created: "Đã tạo",
    skipped: "Bỏ qua",
  };

  return {
    status: result.mode,
    url: result.url,
    message: result.message,
    title: result.payload.title,
    poster: result.payload.poster,
    slug: result.createdSlug ?? result.payload.slug,
    matchedGenres: result.matchedGenres,
    unknownGenres: result.unknownGenres,
    parsedStatus: result.parsed.statusText,
    translationTeam: result.payload.translationTeam,
    translatorNames: result.payload.translatorNames,
    createdId: result.createdId,
    modeLabel: modeLabelMap[result.mode],
    chaptersImported: result.chaptersImported,
    imagesUploaded: result.imagesUploaded,
    chapterErrors: result.chapterErrors,
  };
};

export default function AdminMangaAutoDownload() {
  const loaderData = useLoaderData() as InitialLoaderResult | null;
  const revalidator = useRevalidator();
  const fetcher = useFetcher<ActionResult>();
  const listingFetcher = useFetcher<ExtractListingActionResult>();
  const enqueueFetcher = useFetcher<EnqueueBatchActionResult>();
  const pollFetcher = useFetcher<PollBatchLoaderResult>();
  const pauseFetcher = useFetcher<PauseBatchActionResult>();
  const batchControlFetcher = useFetcher<BatchControlActionResult>();

  type QueueRowStatus = "idle" | "running" | "done" | "error";
  type QueueRow = {
    id: string;
    url: string;
    status: QueueRowStatus;
    message?: string;
    lastResult?: ActionResult["result"];
    startedAt?: string;
    finishedAt?: string;
    jobId?: string;
  };

  const storageKey = "admin:autoDownloadViHentai:queue:v1";
  const storageKeySettings = "admin:autoDownloadViHentai:settings:v1";

  const hydratedFromServerRef = useRef(false);

  const makeId = () => {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  };

  const [rows, setRows] = useState<QueueRow[]>(() => [{ id: makeId(), url: "", status: "idle" }]);
  const rowsRef = useRef<QueueRow[]>(rows);
  const [ownerId, setOwnerId] = useState<string>("");
  const [translationTeam, setTranslationTeam] = useState<string>("");
  const [contentType, setContentType] = useState<string>("MANGA");
  const [userStatus, setUserStatus] = useState<string>("auto");
  const [maxChapters, setMaxChapters] = useState<number>(500);
  const [approve, setApprove] = useState<boolean>(false);
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [skipIfExists, setSkipIfExists] = useState<boolean>(true);
  const [downloadPoster, setDownloadPoster] = useState<boolean>(true);

  const [listingUrlInput, setListingUrlInput] = useState<string>("");

  const [isRunning, setIsRunning] = useState(false);
  const activeBatchIdRef = useRef<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Hydrate from server so the page is live/persistent across devices.
  useEffect(() => {
    if (!loaderData) return;
    if (!loaderData.ok) return;
    if (hydratedFromServerRef.current) return;

    hydratedFromServerRef.current = true;

    if (!loaderData.activeBatchId) {
      return;
    }

    const batchId = loaderData.activeBatchId;
    activeBatchIdRef.current = batchId;
    setActiveBatchId(batchId);

    const rowsFromServer: QueueRow[] = loaderData.jobs.map((job) => {
      const progressText = (() => {
        const p = job.progress;
        if (!p) return "";
        const parts: string[] = [];
        if (typeof p.chapterIndex === "number" && typeof p.chapterCount === "number") {
          parts.push(`Chương ${p.chapterIndex}/${p.chapterCount}`);
        }
        if (typeof p.imageIndex === "number" && typeof p.imageCount === "number") {
          parts.push(`Ảnh ${p.imageIndex}/${p.imageCount}`);
        }
        if (p.chapterTitle) parts.push(p.chapterTitle);
        if (p.message) parts.push(p.message);
        return parts.filter(Boolean).join(" · ");
      })();

      if (job.status === "queued" || job.status === "running") {
        return {
          id: makeId(),
          url: job.url,
          jobId: job.jobId,
          status: "running",
          message: job.paused
            ? "Đã pause (đang chờ)"
            : progressText || (job.status === "queued" ? "Đang chờ..." : "Đang chạy..."),
          startedAt: job.startedAt,
        };
      }

      if (job.status === "succeeded") {
        return {
          id: makeId(),
          url: job.url,
          jobId: job.jobId,
          status: "done",
          message:
            job.result?.message ||
            `Xong · ${job.result?.chaptersImported ?? 0} chương · ${job.result?.imagesUploaded ?? 0} ảnh`,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
          lastResult: job.result?.createdId
            ? ({ status: "created", createdId: job.result.createdId } as any)
            : undefined,
        };
      }

      return {
        id: makeId(),
        url: job.url,
        jobId: job.jobId,
        status: "error",
        message: job.errorMessage || "Lỗi",
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      };
    });

    setRows(rowsFromServer.length ? rowsFromServer : [{ id: makeId(), url: "", status: "idle" }]);

    const anyRunning = loaderData.jobs.some((j) => j.status === "queued" || j.status === "running");
    setIsRunning(anyRunning);

    // Start polling immediately for live progress.
    pollFetcher.load(`/admin/manga/auto-download?intent=pollBatch&batchId=${encodeURIComponent(batchId)}`);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => pollBatch(batchId), 5_000);
  }, [loaderData]);

  useEffect(() => {
    try {
      // If server snapshot exists, do not override queue rows from localStorage.
      if (!hydratedFromServerRef.current) {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setRows(
            parsed.map((r: any) => ({
              id: typeof r?.id === "string" ? r.id : makeId(),
              url: typeof r?.url === "string" ? r.url : "",
              status: (r?.status as QueueRowStatus) || "idle",
              message: typeof r?.message === "string" ? r.message : undefined,
              lastResult: r?.lastResult,
              startedAt: typeof r?.startedAt === "string" ? r.startedAt : undefined,
              finishedAt: typeof r?.finishedAt === "string" ? r.finishedAt : undefined,
              jobId: typeof r?.jobId === "string" ? r.jobId : undefined,
            }))
          );
        }
      }
      }
      const settingsRaw = localStorage.getItem(storageKeySettings);
      if (settingsRaw) {
        const s = JSON.parse(settingsRaw);
        setOwnerId(typeof s?.ownerId === "string" ? s.ownerId : "");
        setTranslationTeam(typeof s?.translationTeam === "string" ? s.translationTeam : "");
        setContentType(typeof s?.contentType === "string" ? s.contentType : "MANGA");
        setUserStatus(typeof s?.userStatus === "string" ? s.userStatus : "auto");
        setMaxChapters(typeof s?.maxChapters === "number" ? s.maxChapters : 500);
        setApprove(Boolean(s?.approve));
        setDryRun(Boolean(s?.dryRun));
        setSkipIfExists(s?.skipIfExists !== false);
        setDownloadPoster(s?.downloadPoster !== false);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch {
      // ignore
    }
  }, [rows]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKeySettings,
        JSON.stringify({
          ownerId,
          translationTeam,
          contentType,
          userStatus,
          maxChapters,
          approve,
          dryRun,
          skipIfExists,
          downloadPoster,
        })
      );
    } catch {
      // ignore
    }
  }, [
    ownerId,
    translationTeam,
    contentType,
    userStatus,
    maxChapters,
    approve,
    dryRun,
    skipIfExists,
    downloadPoster,
  ]);

  const canStart = useMemo(() => {
    if (isRunning) return false;
    if (enqueueFetcher.state !== "idle") return false;
    if (!ownerId.trim()) return false;
    return rows.some((r) => r.url.trim());
  }, [isRunning, enqueueFetcher.state, ownerId, rows]);

  const submitOne = (url: string) => {
    const fd = new FormData();
    fd.set("intent", "autoDownloadOne");
    fd.set("url", url);
    fd.set("ownerId", ownerId);
    if (translationTeam.trim()) fd.set("translationTeam", translationTeam.trim());
    fd.set("contentType", contentType);
    fd.set("userStatus", userStatus);
    fd.set("maxChapters", String(maxChapters));
    if (approve) fd.set("approve", "on");
    if (dryRun) fd.set("dryRun", "on");
    if (skipIfExists) fd.set("skipIfExists", "on");
    if (downloadPoster) fd.set("downloadPoster", "on");
    fetcher.submit(fd, { method: "post" });
  };

  const enqueueBatch = (batchId: string, items: Array<{ rowId: string; url: string }>) => {
    const fd = new FormData();
    fd.set("intent", "enqueueBatch");
    fd.set("batchId", batchId);
    fd.set("items", JSON.stringify(items));
    fd.set("ownerId", ownerId);
    if (translationTeam.trim()) fd.set("translationTeam", translationTeam.trim());
    fd.set("contentType", contentType);
    fd.set("userStatus", userStatus);
    fd.set("maxChapters", String(maxChapters));
    if (approve) fd.set("approve", "on");
    if (dryRun) fd.set("dryRun", "on");
    if (skipIfExists) fd.set("skipIfExists", "on");
    if (downloadPoster) fd.set("downloadPoster", "on");
    enqueueFetcher.submit(fd, { method: "post" });
  };

  const pollBatch = (batchId: string) => {
    pollFetcher.load(`/admin/manga/auto-download?intent=pollBatch&batchId=${encodeURIComponent(batchId)}`);
  };

  const pauseBatch = (batchId: string, paused: boolean) => {
    const fd = new FormData();
    fd.set("intent", paused ? "pauseBatch" : "resumeBatch");
    fd.set("batchId", batchId);
    pauseFetcher.submit(fd, { method: "post" });
  };

  const stopBatchOnServer = (batchId: string) => {
    const ok = confirm("Dừng batch này? (Job đang chạy sẽ chạy xong; các job còn lại sẽ bị pause)");
    if (!ok) return;
    const fd = new FormData();
    fd.set("intent", "stopBatch");
    fd.set("batchId", batchId);
    batchControlFetcher.submit(fd, { method: "post" });
  };

  const deleteBatchOnServer = (batchId: string) => {
    const ok = confirm("Xóa batch này khỏi server? (sẽ xóa toàn bộ lịch sử job trong batch)");
    if (!ok) return;
    const fd = new FormData();
    fd.set("intent", "deleteBatch");
    fd.set("batchId", batchId);
    batchControlFetcher.submit(fd, { method: "post" });
  };

  const hardDeleteBatchOnServer = (batchId: string) => {
    const ok = confirm(
      "HARD DELETE batch này?\n- Dừng ngay job đang chạy\n- Xóa truyện/chương/ảnh đã tạo dở\n- Xóa toàn bộ job trong batch\n\nThao tác này không thể hoàn tác.",
    );
    if (!ok) return;
    const fd = new FormData();
    fd.set("intent", "hardDeleteBatch");
    fd.set("batchId", batchId);
    batchControlFetcher.submit(fd, { method: "post" });
  };

  const submitExtractListing = (url: string) => {
    const fd = new FormData();
    fd.set("intent", "extractListing");
    fd.set("listingUrl", url);
    listingFetcher.submit(fd, { method: "post" });
  };

  const normalizeQueueUrl = (raw: string) => {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return "";
    try {
      const u = new URL(trimmed);
      return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
    } catch {
      return trimmed.replace(/\s+/g, "");
    }
  };

  useEffect(() => {
    if (listingFetcher.state !== "idle") return;
    if (!listingFetcher.data) return;
    if (!listingFetcher.data.ok) {
      alert(listingFetcher.data.error);
      return;
    }

    const { count, links } = listingFetcher.data;
    const ok = confirm(`Đã lấy được ${count} link truyện từ trang tổng.\nBạn có muốn thêm vào hàng đợi (queue) không?`);
    if (!ok) return;

    setRows((prev) => {
      const existing = new Set(prev.map((r) => normalizeQueueUrl(r.url)).filter(Boolean));
      const toAdd = links.filter((u) => {
        const key = normalizeQueueUrl(u);
        if (!key) return false;
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });

      const skipped = links.length - toAdd.length;
      if (skipped > 0) {
        alert(`Đã bỏ qua ${skipped} link trùng trong queue.`);
      }

      const newRows = toAdd.map((u) => ({ id: makeId(), url: u, status: "idle" as const }));
      // If queue currently only has one empty row, replace it.
      if (prev.length === 1 && !prev[0].url.trim()) {
        return newRows.length ? newRows : prev;
      }
      return [...prev, ...newRows];
    });
  }, [listingFetcher.state, listingFetcher.data]);

  const start = () => {
    if (!ownerId.trim()) return;

    const batchId = makeId();
    activeBatchIdRef.current = batchId;
    setActiveBatchId(batchId);
    setIsRunning(true);

    const items = rowsRef.current
      .map((r) => ({ rowId: r.id, url: r.url.trim() }))
      .filter((x) => Boolean(x.url));

    // Optimistically mark as running/queued locally.
    setRows((prev) =>
      prev.map((r) =>
        r.url.trim()
          ? { ...r, status: "running", message: "Đã gửi lên server, đang chờ xử lý..." }
          : r,
      ),
    );

    enqueueBatch(batchId, items);
  };

  const enqueueNewRowsToCurrentBatch = () => {
    if (!isRunning) return;
    const batchId = activeBatchIdRef.current;
    if (!batchId) return;

    const items = rowsRef.current
      .filter((r) => Boolean(r.url.trim()) && !r.jobId)
      .map((r) => ({ rowId: r.id, url: r.url.trim() }));

    if (!items.length) {
      alert("Không có link mới để đưa lên server.");
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        items.some((it) => it.rowId === r.id)
          ? { ...r, status: "running", message: "Đã gửi lên server, đang chờ xử lý..." }
          : r,
      ),
    );

    enqueueBatch(batchId, items);
  };

  const stop = () => {
    const batchId = activeBatchIdRef.current;
    if (batchId) {
      pauseBatch(batchId, true);
    }
    setIsRunning(false);
  };

  // Refresh server batch lists after control actions.
  useEffect(() => {
    if (batchControlFetcher.state !== "idle") return;
    if (!batchControlFetcher.data) return;
    if (!batchControlFetcher.data.ok) {
      alert(batchControlFetcher.data.error);
      return;
    }

    const action = batchControlFetcher.data.action;
    const batchId = batchControlFetcher.data.batchId;
    if ((action === "delete" || action === "hard-delete") && activeBatchIdRef.current === batchId) {
      activeBatchIdRef.current = null;
      setActiveBatchId(null);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
    revalidator.revalidate();
  }, [batchControlFetcher.state, batchControlFetcher.data]);

  // After enqueue returns, store jobIds per row.
  useEffect(() => {
    if (enqueueFetcher.state !== "idle") return;
    const data = enqueueFetcher.data;
    if (!data) return;
    if (!data.ok) {
      alert(data.error);
      setIsRunning(false);
      setRows((prev) => prev.map((r) => (r.status === "running" ? { ...r, status: "idle", message: undefined } : r)));
      return;
    }

    const batchId = data.batchId;
    activeBatchIdRef.current = batchId;
    setActiveBatchId(batchId);

    setRows((prev) => {
      const map = new Map<string, { rowId: string; jobId: string; url: string }>(
        data.items.map((item) => [item.rowId, item]),
      );
      return prev.map((r) => {
        const matched = map.get(r.id);
        if (!matched) return r;
        return {
          ...r,
          jobId: matched.jobId,
          status: "running",
          message: "Đã vào queue server...",
          startedAt: new Date().toISOString(),
        };
      });
    });

    // Start polling for live progress.
    pollBatch(batchId);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => pollBatch(batchId), 5_000);
  }, [enqueueFetcher.state, enqueueFetcher.data]);

  // Apply polled job statuses/progress to the UI rows.
  useEffect(() => {
    if (pollFetcher.state !== "idle") return;
    if (!pollFetcher.data) return;
    if (!pollFetcher.data.ok) return;

    const jobsById = new Map(pollFetcher.data.jobs.map((j) => [j.jobId, j]));

    setRows((prev) =>
      prev.map((r) => {
        if (!r.jobId) return r;
        const job = jobsById.get(r.jobId);
        if (!job) return r;

        const progressText = (() => {
          const p = job.progress;
          if (!p) return "";
          const parts: string[] = [];
          if (typeof p.chapterIndex === "number" && typeof p.chapterCount === "number") {
            parts.push(`Chương ${p.chapterIndex}/${p.chapterCount}`);
          }
          if (typeof p.imageIndex === "number" && typeof p.imageCount === "number") {
            parts.push(`Ảnh ${p.imageIndex}/${p.imageCount}`);
          }
          if (p.chapterTitle) parts.push(p.chapterTitle);
          if (p.message) parts.push(p.message);
          return parts.filter(Boolean).join(" · ");
        })();

        if (job.status === "queued" || job.status === "running") {
          return {
            ...r,
            status: "running",
            message: job.paused ? "Đã pause (đang chờ)" : progressText || (job.status === "queued" ? "Đang chờ..." : "Đang chạy..."),
          };
        }

        if (job.status === "succeeded") {
          return {
            ...r,
            status: "done",
            message:
              job.result?.message ||
              `Xong · ${job.result?.chaptersImported ?? 0} chương · ${job.result?.imagesUploaded ?? 0} ảnh`,
            finishedAt: new Date().toISOString(),
            lastResult:
              job.result?.createdId
                ? ({ status: "created", createdId: job.result.createdId } as any)
                : r.lastResult,
          };
        }

        if (job.status === "failed") {
          return {
            ...r,
            status: "error",
            message: job.errorMessage || "Lỗi",
            finishedAt: new Date().toISOString(),
          };
        }

        return r;
      }),
    );

    const anyRunning = pollFetcher.data.jobs.some((j) => j.status === "queued" || j.status === "running");
    if (!anyRunning) {
      setIsRunning(false);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, [pollFetcher.state, pollFetcher.data]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const updateRowUrl = (id: string, url: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, url } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { id: makeId(), url: "", status: "idle" }]);
  };

  const clearAllRows = () => {
    if (isRunning) return;
    const ok = confirm("Xóa tất cả link trong danh sách đợi?");
    if (!ok) return;
    setRows([{ id: makeId(), url: "", status: "idle" }]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length ? next : [{ id: makeId(), url: "", status: "idle" }];
    });
  };

  const resetStatuses = () => {
    if (isRunning) return;
    setRows((prev) =>
      prev.map((r) => ({ ...r, status: "idle", message: undefined, lastResult: undefined, jobId: undefined })),
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-txt-primary">Tự động tải truyện (vi-hentai.pro)</h1>
          <p className="text-sm text-txt-secondary">
            Dán link trang truyện, hệ thống sẽ tạo truyện và tự động tải chương (từ chương cũ nhất → mới nhất).
          </p>
        </div>
        <Link
          to="/admin/manga/import"
          className="rounded-lg border border-bd-default px-3 py-1.5 text-xs font-semibold text-txt-primary hover:bg-bgc-layer2/80"
        >
          Auto-import (cũ)
        </Link>
      </div>

      <div className="space-y-4 rounded-xl border border-bd-default bg-bgc-layer1 p-6 shadow">
        {loaderData && loaderData.ok ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-bd-default bg-bgc-layer2/30 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-txt-primary">10 trang tổng/thể loại gần nhất</div>
                <button
                  type="button"
                  onClick={() => revalidator.revalidate()}
                  className="rounded-lg border border-bd-default px-3 py-1.5 text-xs font-semibold text-txt-primary hover:bg-bgc-layer2/80"
                >
                  Refresh
                </button>
              </div>
              {loaderData.recentListingUrls.length ? (
                <ul className="space-y-1 text-xs">
                  {loaderData.recentListingUrls.map((it) => (
                    <li key={`${it.createdAt}:${it.url}`} className="flex flex-col gap-1 rounded-md border border-bd-default/60 bg-bgc-layer1/40 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-txt-primary">
                          {it.ok === true ? "OK" : it.ok === false ? "Lỗi" : "Đang xử lý"}
                          {typeof it.linksCount === "number" ? ` · ${it.linksCount} link` : ""}
                          {it.capped ? " · capped" : ""}
                        </div>
                        <div className="text-txt-secondary">{new Date(it.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="break-all text-txt-secondary">{it.url}</div>
                      {it.errorMessage ? (
                        <div className="text-[11px] text-red-200">{it.errorMessage}</div>
                      ) : null}
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-txt-secondary">Dùng để trích xuất link truyện</div>
                        <button
                          type="button"
                          onClick={() => {
                            setListingUrlInput(it.url);
                            submitExtractListing(it.url);
                          }}
                          className="rounded-lg border border-bd-default px-3 py-1 text-[11px] font-semibold text-txt-primary hover:bg-bgc-layer2/80"
                        >
                          Trích xuất lại
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-txt-secondary">Chưa có dữ liệu.</div>
              )}
            </div>

            <div className="rounded-lg border border-bd-default bg-bgc-layer2/30 p-4">
              <div className="mb-2 text-sm font-semibold text-txt-primary">Batch trên server</div>
              {loaderData.batches.length ? (
                <div className="overflow-hidden rounded-lg border border-bd-default">
                  <table className="w-full text-xs">
                    <thead className="bg-bgc-layer2 text-txt-secondary">
                      <tr>
                        <th className="px-3 py-2 text-left">Batch</th>
                        <th className="w-24 px-3 py-2 text-left">Trạng thái</th>
                        <th className="w-28 px-3 py-2 text-right">Queue</th>
                        <th className="w-48 px-3 py-2 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bd-default">
                      {loaderData.batches.map((b) => {
                        const canDelete = b.counts.running === 0;
                        const isBusy = batchControlFetcher.state !== "idle";
                        const pausedAllQueued = b.counts.queued > 0 && b.counts.pausedQueued >= b.counts.queued;

                        return (
                          <tr key={b.batchId} className={activeBatchId === b.batchId ? "bg-bgc-layer2/60" : ""}>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-txt-primary">{b.batchId}</div>
                              <div className="text-[11px] text-txt-secondary">
                                {new Date(b.createdAt).toLocaleString()} · last: {new Date(b.lastActivityAt).toLocaleString()}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-txt-primary">{b.status}</div>
                              {pausedAllQueued ? (
                                <div className="text-[11px] text-txt-secondary">(paused)</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-right text-txt-secondary">
                              <div>{b.counts.total} jobs</div>
                              <div className="text-[11px]">
                                Q:{b.counts.queued} R:{b.counts.running} OK:{b.counts.succeeded} F:{b.counts.failed}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    activeBatchIdRef.current = b.batchId;
                                    setActiveBatchId(b.batchId);
                                    pollFetcher.load(`/admin/manga/auto-download?intent=pollBatch&batchId=${encodeURIComponent(b.batchId)}`);
                                    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                                    pollTimerRef.current = setInterval(() => pollBatch(b.batchId), 5_000);
                                  }}
                                  className="rounded-lg border border-bd-default px-3 py-1 text-[11px] font-semibold text-txt-primary hover:bg-bgc-layer2/80"
                                >
                                  Xem
                                </button>

                                <button
                                  type="button"
                                  onClick={() => pauseBatch(b.batchId, true)}
                                  disabled={pauseFetcher.state !== "idle"}
                                  className="rounded-lg border border-bd-default px-3 py-1 text-[11px] font-semibold text-txt-primary hover:bg-bgc-layer2/80 disabled:opacity-50"
                                >
                                  Pause
                                </button>
                                <button
                                  type="button"
                                  onClick={() => pauseBatch(b.batchId, false)}
                                  disabled={pauseFetcher.state !== "idle"}
                                  className="rounded-lg border border-bd-default px-3 py-1 text-[11px] font-semibold text-txt-primary hover:bg-bgc-layer2/80 disabled:opacity-50"
                                >
                                  Resume
                                </button>

                                <button
                                  type="button"
                                  onClick={() => stopBatchOnServer(b.batchId)}
                                  disabled={isBusy}
                                  className="rounded-lg border border-bd-default px-3 py-1 text-[11px] font-semibold text-txt-primary hover:bg-bgc-layer2/80 disabled:opacity-50"
                                >
                                  Dừng
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteBatchOnServer(b.batchId)}
                                  disabled={!canDelete || isBusy}
                                  className="rounded-lg border border-red-500/30 px-3 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                                  title={!canDelete ? "Không thể xóa khi đang có job running" : "Xóa batch"}
                                >
                                  Xóa
                                </button>

                                <button
                                  type="button"
                                  onClick={() => hardDeleteBatchOnServer(b.batchId)}
                                  disabled={isBusy}
                                  className="rounded-lg border border-red-500 px-3 py-1 text-[11px] font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-50"
                                  title="Hard delete: dừng ngay + xóa sạch dữ liệu đã tạo"
                                >
                                  Hard delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-txt-secondary">Chưa có batch nào.</div>
              )}
              <div className="mt-2 text-[11px] text-txt-secondary">
                Gợi ý: Dừng/Pause để tránh chạy nhầm song song. Xóa chỉ áp dụng khi không có job running.
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-semibold text-txt-primary">Thêm nhanh từ trang thể loại / trang tổng</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={listingUrlInput}
              onChange={(e) => setListingUrlInput(e.target.value)}
              className="w-full flex-1 rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary"
              placeholder="https://vi-hentai.pro/the-loai/black-skin?sort=-views..."
            />
            <button
              type="button"
              onClick={() => submitExtractListing(listingUrlInput)}
              disabled={!listingUrlInput.trim() || listingFetcher.state !== "idle"}
              className="rounded-lg border border-bd-default px-4 py-2 text-sm font-semibold text-txt-primary hover:bg-bgc-layer2/80 disabled:opacity-50"
            >
              {listingFetcher.state !== "idle" ? "Đang lấy..." : "Trích xuất link"}
            </button>
          </div>
          <p className="text-xs text-txt-secondary">
            Dán link trang thể loại (có thể có sort/filter/page). Hệ thống sẽ tự trích xuất các link <span className="font-semibold">/truyen/...</span> trên trang đó và hỏi bạn có muốn thêm vào queue không.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-semibold text-txt-primary">Danh sách chờ (queue)</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearAllRows}
                disabled={isRunning}
                title="Xóa tất cả"
                className="rounded-lg border border-bd-default px-3 py-1.5 text-xs font-semibold text-txt-primary hover:bg-bgc-layer2/80 disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Xóa tất cả
                </span>
              </button>
              <button
                type="button"
                onClick={addRow}
                disabled={enqueueFetcher.state !== "idle"}
                className="rounded-lg border border-bd-default px-3 py-1.5 text-xs font-semibold text-txt-primary hover:bg-bgc-layer2/80 disabled:opacity-50"
              >
                + Thêm link
              </button>
              <button
                type="button"
                onClick={enqueueNewRowsToCurrentBatch}
                disabled={!isRunning || !activeBatchId || enqueueFetcher.state !== "idle"}
                className="rounded-lg border border-bd-default px-3 py-1.5 text-xs font-semibold text-txt-primary hover:bg-bgc-layer2/80 disabled:opacity-50"
                title="Đẩy các link mới lên queue server"
              >
                Đẩy link mới
              </button>
              <button
                type="button"
                onClick={resetStatuses}
                disabled={isRunning}
                className="rounded-lg border border-bd-default px-3 py-1.5 text-xs font-semibold text-txt-primary hover:bg-bgc-layer2/80 disabled:opacity-50"
              >
                Reset trạng thái
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-bd-default">
            <table className="w-full text-sm">
              <thead className="bg-bgc-layer2 text-txt-secondary">
                <tr>
                  <th className="w-12 px-3 py-2 text-left">STT</th>
                  <th className="px-3 py-2 text-left">URL</th>
                  <th className="w-40 px-3 py-2 text-left">Trạng thái</th>
                  <th className="w-28 px-3 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bd-default">
                {rows.map((row, index) => (
                  <tr key={row.id} className={row.status === "running" ? "bg-bgc-layer2/60" : ""}>
                    <td className="px-3 py-2 text-txt-secondary">{index + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        value={row.url}
                        onChange={(e) => updateRowUrl(row.id, e.target.value)}
                        disabled={row.status === "running"}
                        className="w-full rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary disabled:opacity-60"
                        placeholder="https://vi-hentai.pro/truyen/..."
                      />
                      {row.lastResult && row.lastResult.status !== "error" && (row.lastResult as any).createdId ? (
                        <div className="mt-1">
                          <Link
                            to={`/truyen-hentai/preview/${(row.lastResult as any).createdId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-[#DD94FF] hover:underline"
                          >
                            Mở truyện đã tạo
                          </Link>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs font-semibold text-txt-primary">
                        {row.status === "idle" ? "Chưa chạy" : null}
                        {row.status === "running" ? "Đang chạy" : null}
                        {row.status === "done" ? "Xong" : null}
                        {row.status === "error" ? "Lỗi" : null}
                      </div>
                      {row.message ? (
                        <div className={row.status === "error" ? "text-xs text-red-200" : "text-xs text-txt-secondary"}>
                          {row.message}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={isRunning || row.status === "running"}
                        className="rounded-lg border border-bd-default px-3 py-1.5 text-xs font-semibold text-txt-primary hover:bg-bgc-layer2/80 disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-txt-secondary">
            Bấm “Start” để chạy từ trên xuống dưới theo STT. Nếu có lỗi, hệ thống sẽ ghi rõ lý do và tiếp tục truyện kế tiếp.
            Bạn có thể thêm link mới vào cuối danh sách trong lúc đang chạy.
          </p>
        </div>

        {pollFetcher.data && (pollFetcher.data as any).ok ? (
          <div className="rounded-lg border border-bd-default bg-bgc-layer2/40 p-3 text-xs text-txt-secondary">
            {(() => {
              const data = pollFetcher.data as Extract<PollBatchLoaderResult, { ok: true }>;
              const running = data.jobs.find((j) => j.status === "running") || data.jobs.find((j) => j.status === "queued");
              if (!running) return "Không có job đang chạy";
              const p = running.progress;
              const parts: string[] = [];
              parts.push(`URL: ${running.url}`);
              if (p?.chapterIndex && p?.chapterCount) parts.push(`Chương ${p.chapterIndex}/${p.chapterCount}`);
              if (p?.imageIndex && p?.imageCount) parts.push(`Ảnh ${p.imageIndex}/${p.imageCount}`);
              if (p?.chapterTitle) parts.push(p.chapterTitle);
              if (p?.message) parts.push(p.message);
              return `Live: ${parts.filter(Boolean).join(" · ")}`;
            })()}
          </div>
        ) : null}

        {activeBatchId ? (
          <div className="text-xs text-txt-secondary">Batch: {activeBatchId}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ownerId" className="text-sm font-semibold text-txt-primary">
              Owner ID
            </label>
            <input
              id="ownerId"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              required
              className="w-full rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary"
              placeholder="ID user sẽ sở hữu truyện"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="translationTeam" className="text-sm font-semibold text-txt-primary">
              Nhóm dịch (tùy chọn)
            </label>
            <input
              id="translationTeam"
              value={translationTeam}
              onChange={(e) => setTranslationTeam(e.target.value)}
              className="w-full rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary"
              placeholder="Override tên nhóm dịch"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-txt-primary">Content type</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary"
            >
              <option value="MANGA">Manga</option>
              <option value="COSPLAY">Cosplay</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-txt-primary">User status</label>
            <select
              value={userStatus}
              onChange={(e) => setUserStatus(e.target.value)}
              className="w-full rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary"
            >
              <option value="auto">Theo trang nguồn</option>
              <option value="ongoing">Đang tiến hành</option>
              <option value="completed">Đã hoàn thành</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-txt-primary">Giới hạn chương</label>
            <input
              value={String(maxChapters)}
              onChange={(e) => setMaxChapters(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary"
              placeholder="500"
            />
            <p className="text-[11px] text-txt-secondary">Tránh request quá lâu (có thể tăng nếu cần).</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-txt-primary">Tùy chọn</label>
            <div className="flex flex-col gap-2 text-sm text-txt-primary">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} />
                <span>Tự động duyệt</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                <span>Dry-run (không ghi DB)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={skipIfExists} onChange={(e) => setSkipIfExists(e.target.checked)} />
                <span>Bỏ qua nếu đã tồn tại</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={downloadPoster} onChange={(e) => setDownloadPoster(e.target.checked)} />
                <span>Tải poster về CDN</span>
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={start}
            disabled={!canStart}
            className="w-full rounded-lg bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {isRunning ? "Đang chạy..." : "Start (tự động tải theo queue)"}
          </button>
          <button
            type="button"
            onClick={stop}
            disabled={!isRunning}
            className="w-full rounded-lg border border-bd-default bg-bgc-layer2 px-4 py-3 text-sm font-semibold text-txt-primary disabled:opacity-50"
          >
            Stop
          </button>
        </div>

        {fetcher.data?.error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {fetcher.data.error}
          </div>
        ) : null}

        <div className="text-xs text-txt-secondary">
          Chế độ mới: Start sẽ đưa toàn bộ queue lên server chạy nền. UI poll tiến độ mỗi ~5s (không còn bị treo do timeout).
        </div>
      </div>
    </div>
  );
}
