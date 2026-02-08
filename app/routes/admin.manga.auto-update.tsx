import { Link, useFetcher, useLoaderData } from "react-router-dom";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import os from "node:os";

import { requireAdminLogin } from "@/services/auth.server";
import {
  createViHentaiAutoUpdateQueue,
  getViHentaiAutoUpdateEnabled,
  getViHentaiAutoUpdateStopEarlyEnabled,
  setViHentaiAutoUpdateStopEarlyEnabled,
  setViHentaiAutoUpdateEnabled,
  startViHentaiAutoUpdateQueue,
} from "@/jobs/vi-hentai-auto-update.server";

import { ViHentaiAutoUpdateQueueModel } from "~/database/models/vi-hentai-auto-update-queue.model";
import { ViHentaiAutoDownloadJobModel } from "~/database/models/vi-hentai-auto-download-job.model";
import { SystemLockModel } from "~/database/models/system-lock.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Auto cập nhật (vi-hentai)" },
    { name: "description", content: "Auto cập nhật truyện và chương mới từ vi-hentai" },
  ];
};

type LoaderResult =
  | ({
      ok: true;
      enabled: boolean;
      stopEarlyEnabled: boolean;
      queues: QueueSummary[];
      latestQueue?: QueueDetail;
      systemStatus: SystemStatus;
    } & Record<string, unknown>)
  | { ok: false; error: string };

type SystemStatus = {
  lock: {
    key: string;
    lockedUntil?: string;
    lockedBy?: string;
    isActive: boolean;
  } | null;
  autoUpdate: {
    runningQueue?: {
      id: string;
      listUrl: string;
      startedAt?: string;
    };
    counts: Record<string, number>;
  };
  autoDownload: {
    runningJob?: {
      id: string;
      url: string;
      startedAt?: string;
      lastHeartbeatAt?: string;
    };
    counts: Record<string, number>;
    pausedQueued: number;
  };
};

type QueueSummary = {
  id: string;
  status: string;
  listUrl: string;
  startedAt?: string;
  finishedAt?: string;
  maxManga: number;
  processed: number;
  created: number;
  updated: number;
  noop: number;
  chaptersAdded: number;
  imagesUploaded: number;
  errorCount: number;
  errorsSample: Array<{ url: string; message: string }>;
  itemsCount: number;
};

type QueueItem = {
  index: number;
  url: string;
  status: string;
  mode?: string;
  parsedTitle?: string;
  mangaId?: string;
  mangaSlug?: string;
  chaptersAdded?: number;
  imagesUploaded?: number;
  message?: string;
};

type QueueDetail = {
  id: string;
  status: string;
  listUrl: string;
  startedAt?: string;
  finishedAt?: string;
  maxManga: number;
  processed: number;
  created: number;
  updated: number;
  noop: number;
  chaptersAdded: number;
  imagesUploaded: number;
  items: QueueItem[];
};

type ActionResult =
  | { ok: true; queueId?: string; enabled?: boolean; stopEarlyEnabled?: boolean }
  | { ok: false; error: string };

type ControlActionResult =
  | { ok: true; action: "pauseQueue" | "deleteQueue" | "pauseAllRunning" | "deleteAllQueues" | "clearSystemLock"; queueId?: string; count?: number }
  | { ok: false; error: string };

type PollResult =
  | { ok: true; queue: QueueDetail }
  | { ok: false; error: string };

const DEFAULT_OWNER_ID = "68f0f839b69df690049aba65";
const DEFAULT_LIST_URL = "https://vi-hentai.pro/danh-sach?page=1";
const DEFAULT_MAX_MANGA = 30;

const formatMs = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const getNextHourTick = (now: Date) => {
  const next = new Date(now.getTime());
  next.setMilliseconds(0);
  next.setSeconds(0);
  next.setMinutes(0);
  next.setHours(next.getHours() + 1);
  return next;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdminLogin(request);

  const enabled = await getViHentaiAutoUpdateEnabled();
  const stopEarlyEnabled = await getViHentaiAutoUpdateStopEarlyEnabled();

  const url = new URL(request.url);
  const intent = String(url.searchParams.get("intent") || "");
  if (intent === "pollQueue") {
    const queueId = String(url.searchParams.get("queueId") || "").trim();
    if (!queueId) return Response.json({ ok: false, error: "Thiếu queueId" } satisfies PollResult, { status: 400 });

    const queue = await ViHentaiAutoUpdateQueueModel.findById(queueId).lean();
    if (!queue) return Response.json({ ok: false, error: "Không tìm thấy queue" } satisfies PollResult, { status: 404 });

    const body: PollResult = {
      ok: true,
      queue: {
        id: String((queue as any)._id),
        status: String((queue as any).status),
        listUrl: String((queue as any).listUrl || ""),
        startedAt: (queue as any).startedAt ? new Date((queue as any).startedAt).toISOString() : undefined,
        finishedAt: (queue as any).finishedAt ? new Date((queue as any).finishedAt).toISOString() : undefined,
        maxManga: Number((queue as any).maxManga || 0),
        processed: Number((queue as any).processed || 0),
        created: Number((queue as any).created || 0),
        updated: Number((queue as any).updated || 0),
        noop: Number((queue as any).noop || 0),
        chaptersAdded: Number((queue as any).chaptersAdded || 0),
        imagesUploaded: Number((queue as any).imagesUploaded || 0),
        items: Array.isArray((queue as any).items)
          ? (queue as any).items.map((it: any) => ({
              index: Number(it.index || 0),
              url: String(it.url || ""),
              status: String(it.status || ""),
              mode: it.mode ? String(it.mode) : undefined,
              parsedTitle: it.parsedTitle ? String(it.parsedTitle) : undefined,
              mangaId: it.mangaId ? String(it.mangaId) : undefined,
              mangaSlug: it.mangaSlug ? String(it.mangaSlug) : undefined,
              chaptersAdded: typeof it.chaptersAdded === "number" ? it.chaptersAdded : undefined,
              imagesUploaded: typeof it.imagesUploaded === "number" ? it.imagesUploaded : undefined,
              message: it.message ? String(it.message) : undefined,
            }))
          : [],
      },
    };

    return Response.json(body, { status: 200 });
  }

  const queues = await ViHentaiAutoUpdateQueueModel.find({})
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const [lock, updateRunning, downloadRunning, updateCountsRaw, downloadCountsRaw, pausedQueuedRaw] =
    await Promise.all([
      SystemLockModel.findOne({ key: "vi-hentai-auto-update" })
        .select({ key: 1, lockedUntil: 1, lockedBy: 1 })
        .lean(),
      ViHentaiAutoUpdateQueueModel.findOne({ status: "running" })
        .sort({ startedAt: 1, createdAt: 1 })
        .select({ _id: 1, listUrl: 1, startedAt: 1 })
        .lean(),
      ViHentaiAutoDownloadJobModel.findOne({ status: "running" })
        .sort({ startedAt: 1 })
        .select({ _id: 1, url: 1, startedAt: 1, lastHeartbeatAt: 1 })
        .lean(),
      ViHentaiAutoUpdateQueueModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      ViHentaiAutoDownloadJobModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      ViHentaiAutoDownloadJobModel.countDocuments({ status: "queued", paused: true }),
    ]);

  const updateCounts = (updateCountsRaw as Array<{ _id: string; count: number }>).reduce(
    (acc, item) => {
      if (item?._id) acc[item._id] = Number(item.count || 0);
      return acc;
    },
    {} as Record<string, number>,
  );

  const downloadCounts = (downloadCountsRaw as Array<{ _id: string; count: number }>).reduce(
    (acc, item) => {
      if (item?._id) acc[item._id] = Number(item.count || 0);
      return acc;
    },
    {} as Record<string, number>,
  );

  const now = new Date();
  const lockedUntil = lock ? (lock as any).lockedUntil : undefined;
  const lockActive = lockedUntil ? new Date(lockedUntil).getTime() > now.getTime() : false;

  const latest = queues[0] as any;

  const body: LoaderResult = {
    ok: true,
    enabled,
    stopEarlyEnabled,
    systemStatus: {
      lock: lock
        ? {
            key: String((lock as any).key || ""),
            lockedUntil: (lock as any).lockedUntil
              ? new Date((lock as any).lockedUntil).toISOString()
              : undefined,
            lockedBy: (lock as any).lockedBy ? String((lock as any).lockedBy) : undefined,
            isActive: lockActive,
          }
        : null,
      autoUpdate: {
        runningQueue: updateRunning
          ? {
              id: String((updateRunning as any)._id),
              listUrl: String((updateRunning as any).listUrl || ""),
              startedAt: (updateRunning as any).startedAt
                ? new Date((updateRunning as any).startedAt).toISOString()
                : undefined,
            }
          : undefined,
        counts: updateCounts,
      },
      autoDownload: {
        runningJob: downloadRunning
          ? {
              id: String((downloadRunning as any)._id),
              url: String((downloadRunning as any).url || ""),
              startedAt: (downloadRunning as any).startedAt
                ? new Date((downloadRunning as any).startedAt).toISOString()
                : undefined,
              lastHeartbeatAt: (downloadRunning as any).lastHeartbeatAt
                ? new Date((downloadRunning as any).lastHeartbeatAt).toISOString()
                : undefined,
            }
          : undefined,
        counts: downloadCounts,
        pausedQueued: Number(pausedQueuedRaw || 0),
      },
    },
    queues: queues.map((q: any): QueueSummary => ({
      id: String(q._id),
      status: String(q.status),
      listUrl: String(q.listUrl || ""),
      startedAt: q.startedAt ? new Date(q.startedAt).toISOString() : undefined,
      finishedAt: q.finishedAt ? new Date(q.finishedAt).toISOString() : undefined,
      maxManga: Number(q.maxManga || 0),
      processed: Number(q.processed || 0),
      created: Number(q.created || 0),
      updated: Number(q.updated || 0),
      noop: Number(q.noop || 0),
      chaptersAdded: Number(q.chaptersAdded || 0),
      imagesUploaded: Number(q.imagesUploaded || 0),
      errorCount: Array.isArray(q.errors) ? q.errors.length : 0,
      errorsSample: Array.isArray(q.errors) ? q.errors.slice(0, 5) : [],
      itemsCount: Array.isArray(q.items) ? q.items.length : 0,
    })),
    latestQueue: latest
      ? ({
          id: String(latest._id),
          status: String(latest.status),
          listUrl: String(latest.listUrl || ""),
          startedAt: latest.startedAt ? new Date(latest.startedAt).toISOString() : undefined,
          finishedAt: latest.finishedAt ? new Date(latest.finishedAt).toISOString() : undefined,
          maxManga: Number(latest.maxManga || 0),
          processed: Number(latest.processed || 0),
          created: Number(latest.created || 0),
          updated: Number(latest.updated || 0),
          noop: Number(latest.noop || 0),
          chaptersAdded: Number(latest.chaptersAdded || 0),
          imagesUploaded: Number(latest.imagesUploaded || 0),
          items: Array.isArray(latest.items)
            ? latest.items.map((it: any): QueueItem => ({
                index: Number(it.index || 0),
                url: String(it.url || ""),
                status: String(it.status || ""),
                mode: it.mode ? String(it.mode) : undefined,
                parsedTitle: it.parsedTitle ? String(it.parsedTitle) : undefined,
                mangaId: it.mangaId ? String(it.mangaId) : undefined,
                mangaSlug: it.mangaSlug ? String(it.mangaSlug) : undefined,
                chaptersAdded: typeof it.chaptersAdded === "number" ? it.chaptersAdded : undefined,
                imagesUploaded: typeof it.imagesUploaded === "number" ? it.imagesUploaded : undefined,
                message: it.message ? String(it.message) : undefined,
              }))
            : [],
        } satisfies QueueDetail)
      : undefined,
  };

  return Response.json(body, { status: 200 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const admin = await requireAdminLogin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "toggleEnabled") {
    const desired = String(formData.get("enabled") || "").trim();
    const nextEnabled = desired === "1" || desired === "true";
    const saved = await setViHentaiAutoUpdateEnabled(nextEnabled);
    const body: ActionResult = { ok: true, enabled: saved };
    return Response.json(body, { status: 200 });
  }

  if (intent === "toggleStopEarly") {
    const desired = String(formData.get("stopEarlyEnabled") || "").trim();
    const nextEnabled = desired === "1" || desired === "true";
    const saved = await setViHentaiAutoUpdateStopEarlyEnabled(nextEnabled);
    const body: ActionResult = { ok: true, stopEarlyEnabled: saved };
    return Response.json(body, { status: 200 });
  }

  if (intent === "extractQueue") {
    if (!(await getViHentaiAutoUpdateEnabled())) {
      const body: ActionResult = { ok: false, error: "Auto-update đang tắt" };
      return Response.json(body, { status: 200 });
    }
    const ownerId = String(formData.get("ownerId") || "").trim();
    const autoApproveNewManga = formData.get("autoApproveNewManga") === "on";

    const result = await createViHentaiAutoUpdateQueue({
      listUrl: DEFAULT_LIST_URL,
      maxManga: DEFAULT_MAX_MANGA,
      ownerId: ownerId || DEFAULT_OWNER_ID,
      approveNewManga: autoApproveNewManga,
    });

    if (!result.ok) {
      const body: ActionResult = { ok: false, error: result.message || "Trích xuất thất bại" };
      return Response.json(body, { status: 200 });
    }

    const body: ActionResult = { ok: true, queueId: result.queueId };
    return Response.json(body, { status: 200 });
  }

  if (intent === "startQueue") {
    if (!(await getViHentaiAutoUpdateEnabled())) {
      const body: ActionResult = { ok: false, error: "Auto-update đang tắt" };
      return Response.json(body, { status: 200 });
    }
    const queueId = String(formData.get("queueId") || "").trim();
    if (!queueId) {
      const body: ActionResult = { ok: false, error: "Thiếu queueId" };
      return Response.json(body, { status: 200 });
    }

    const started = await startViHentaiAutoUpdateQueue(queueId, { manual: true });
    if (!started) {
      const body: ActionResult = { ok: false, error: "Không thể start queue (có thể đang có queue khác running)" };
      return Response.json(body, { status: 200 });
    }

    const body: ActionResult = { ok: true, queueId };
    return Response.json(body, { status: 200 });
  }

  if (intent === "pauseQueue") {
    const queueId = String(formData.get("queueId") || "").trim();
    if (!queueId) {
      const body: ControlActionResult = { ok: false, error: "Thiếu queueId" };
      return Response.json(body, { status: 200 });
    }

    const now = new Date();
    const q = await ViHentaiAutoUpdateQueueModel.findById(queueId)
      .select({ _id: 1, status: 1, listUrl: 1, items: 1 })
      .lean();
    if (!q) {
      const body: ControlActionResult = { ok: false, error: "Không tìm thấy queue" };
      return Response.json(body, { status: 200 });
    }

    const items = Array.isArray((q as any).items) ? (q as any).items : [];
    const patchedItems = items.map((it: any) => {
      if (it?.status === "running") return { ...it, status: "queued" };
      return it;
    });

    await ViHentaiAutoUpdateQueueModel.updateOne(
      { _id: (q as any)._id },
      {
        $set: {
          status: "paused",
          finishedAt: now,
          items: patchedItems,
        },
        $unset: { lockedBy: "" },
        $push: {
          errors: {
            url: String((q as any).listUrl || ""),
            message: "Admin đã hủy queue (paused)",
          },
        },
      },
    );

    const body: ControlActionResult = { ok: true, action: "pauseQueue", queueId };
    return Response.json(body, { status: 200 });
  }

  if (intent === "deleteQueue") {
    const queueId = String(formData.get("queueId") || "").trim();
    if (!queueId) {
      const body: ControlActionResult = { ok: false, error: "Thiếu queueId" };
      return Response.json(body, { status: 200 });
    }

    // Best-effort: pause first so a running worker can notice and stop between items.
    try {
      await ViHentaiAutoUpdateQueueModel.updateOne(
        { _id: queueId },
        { $set: { status: "paused", finishedAt: new Date() }, $unset: { lockedBy: "" } },
      );
    } catch {
      // ignore
    }

    const res = await ViHentaiAutoUpdateQueueModel.deleteOne({ _id: queueId });
    const deleted = Number((res as any).deletedCount || 0);
    const body: ControlActionResult = { ok: true, action: "deleteQueue", queueId, count: deleted };
    return Response.json(body, { status: 200 });
  }

  if (intent === "pauseAllRunning") {
    const now = new Date();
    const runningQueues = await ViHentaiAutoUpdateQueueModel.find({ status: "running" })
      .select({ _id: 1, listUrl: 1, items: 1 })
      .lean();

    for (const q of runningQueues as any[]) {
      const items = Array.isArray(q.items) ? q.items : [];
      const patchedItems = items.map((it: any) => {
        if (it?.status === "running") return { ...it, status: "queued" };
        return it;
      });

      await ViHentaiAutoUpdateQueueModel.updateOne(
        { _id: q._id },
        {
          $set: { status: "paused", finishedAt: now, items: patchedItems },
          $unset: { lockedBy: "" },
          $push: { errors: { url: String(q.listUrl || ""), message: "Admin đã hủy queue (paused)" } },
        },
      );
    }

    const body: ControlActionResult = { ok: true, action: "pauseAllRunning", count: runningQueues.length };
    return Response.json(body, { status: 200 });
  }

  if (intent === "deleteAllQueues") {
    // Best-effort: pause running queues first so workers can stop.
    try {
      await ViHentaiAutoUpdateQueueModel.updateMany(
        { status: "running" },
        { $set: { status: "paused", finishedAt: new Date() }, $unset: { lockedBy: "" } },
      );
    } catch {
      // ignore
    }
    const res = await ViHentaiAutoUpdateQueueModel.deleteMany({});
    const deleted = Number((res as any).deletedCount || 0);
    const body: ControlActionResult = { ok: true, action: "deleteAllQueues", count: deleted };
    return Response.json(body, { status: 200 });
  }

  if (intent === "clearSystemLock") {
    const now = new Date();
    const lockedBy = `admin-ui|user:${String((admin as any).id || (admin as any)._id || "unknown")}|host:${os.hostname()}`;
    await SystemLockModel.findOneAndUpdate(
      { key: "vi-hentai-auto-update" },
      { $set: { lockedUntil: now, lockedBy } },
      { upsert: true, new: true },
    );
    const body: ControlActionResult = { ok: true, action: "clearSystemLock" };
    return Response.json(body, { status: 200 });
  }

  const body: ActionResult = { ok: false, error: "intent không hợp lệ" };
  return Response.json(body, { status: 400 });
};

export default function AdminMangaAutoUpdate() {
  const data = useLoaderData() as LoaderResult;
  const fetcher = useFetcher<ActionResult>();
  const pollFetcher = useFetcher<PollResult>();
  const controlFetcher = useFetcher<ControlActionResult>();

  const systemStatus = data.ok ? (data as any).systemStatus : undefined;

  const [enabled, setEnabled] = useState(() => (data.ok ? Boolean((data as any).enabled) : true));
  const [stopEarlyEnabled, setStopEarlyEnabled] = useState(() => (data.ok ? Boolean((data as any).stopEarlyEnabled) : true));

  const [activeQueue, setActiveQueue] = useState<QueueDetail | undefined>(data.ok ? data.latestQueue : undefined);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const running = fetcher.state !== "idle";

  const [cronNow, setCronNow] = useState(() => new Date());
  const nextCronAt = useMemo(() => getNextHourTick(cronNow), [cronNow]);
  const remainingMs = useMemo(() => (enabled ? nextCronAt.getTime() - cronNow.getTime() : 0), [enabled, nextCronAt, cronNow]);

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setCronNow(new Date()), 1_000);
    return () => clearInterval(t);
  }, [enabled]);

  const anyItemRunning = useMemo(() => {
    const items = activeQueue?.items || [];
    return items.some((it: any) => it.status === "running");
  }, [activeQueue]);

  const lockStatusLabel = systemStatus?.lock
    ? systemStatus.lock.isActive
      ? "Đang khóa"
      : "Đã mở"
    : "Không có";

  const pollQueue = (queueId?: string) => {
    if (!queueId) return;
    pollFetcher.load(`/admin/manga/auto-update?intent=pollQueue&queueId=${encodeURIComponent(queueId)}`);
  };

  const startPollingQueue = (queueId: string) => {
    pollQueue(queueId);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => pollQueue(queueId), 5_000);
  };

  const pauseQueueOnServer = (queueId: string) => {
    const ok = confirm("Hủy queue này? (sẽ dừng chạy giữa các truyện, giữ lại lịch sử)");
    if (!ok) return;
    const fd = new FormData();
    fd.set("intent", "pauseQueue");
    fd.set("queueId", queueId);
    controlFetcher.submit(fd, { method: "post" });
  };

  const deleteQueueOnServer = (queueId: string) => {
    const ok = confirm("Xóa queue này khỏi server? (Nếu đang chạy: sẽ dừng ở checkpoint và xóa lịch sử)");
    if (!ok) return;
    const fd = new FormData();
    fd.set("intent", "deleteQueue");
    fd.set("queueId", queueId);
    controlFetcher.submit(fd, { method: "post" });
  };

  const pauseAllRunningOnServer = () => {
    const ok = confirm("Hủy TẤT CẢ queue đang running?");
    if (!ok) return;
    const fd = new FormData();
    fd.set("intent", "pauseAllRunning");
    controlFetcher.submit(fd, { method: "post" });
  };

  const deleteAllQueuedOnServer = () => {
    const ok = confirm("Xóa TẤT CẢ queue? (mọi trạng thái, sẽ mất lịch sử)");
    if (!ok) return;
    const fd = new FormData();
    fd.set("intent", "deleteAllQueues");
    controlFetcher.submit(fd, { method: "post" });
  };

  const clearSystemLockOnServer = () => {
    const ok = confirm("Clear lock hệ thống? (dùng khi queue bị kẹt enqueued)");
    if (!ok) return;
    const fd = new FormData();
    fd.set("intent", "clearSystemLock");
    controlFetcher.submit(fd, { method: "post" });
  };

  const updateCounts = systemStatus?.autoUpdate?.counts || {};
  const downloadCounts = systemStatus?.autoDownload?.counts || {};

  // Start polling after manual trigger.
  useEffect(() => {
    if (fetcher.state !== "idle") return;
    if (!fetcher.data) return;
    if (!fetcher.data.ok) return;

    if (typeof fetcher.data.enabled === "boolean") {
      setEnabled(fetcher.data.enabled);
      if (!fetcher.data.enabled) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
      return;
    }

    if (typeof fetcher.data.stopEarlyEnabled === "boolean") {
      setStopEarlyEnabled(fetcher.data.stopEarlyEnabled);
      return;
    }

    const queueId = fetcher.data.queueId;
    if (!queueId) return;

    pollQueue(queueId);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => pollQueue(queueId), 5_000);
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    if (enabled) return;
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, [enabled]);

  // Apply polled run details to the UI.
  useEffect(() => {
    if (pollFetcher.state !== "idle") return;
    if (!pollFetcher.data) return;
    if (!pollFetcher.data.ok) return;

    setActiveQueue(pollFetcher.data.queue as any);

    const finished = Boolean((pollFetcher.data.queue as any)?.finishedAt);
    const stillRunning = (pollFetcher.data.queue as any)?.status === "running" || (pollFetcher.data.queue as any)?.items?.some((it: any) => it.status === "running");
    if (finished || !stillRunning) {
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

  const itemBadge = (status?: string) => {
    const s = String(status || "");
    const base = "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold";
    if (s === "running") return <span className={`${base} bg-yellow-500/15 text-yellow-200`}>running</span>;
    if (s === "succeeded") return <span className={`${base} bg-green-500/15 text-green-200`}>ok</span>;
    if (s === "noop") return <span className={`${base} bg-zinc-500/20 text-zinc-200`}>noop</span>;
    if (s === "failed") return <span className={`${base} bg-red-500/15 text-red-200`}>failed</span>;
    return <span className={`${base} bg-zinc-500/20 text-zinc-200`}>{s || "-"}</span>;
  };

  return (
    <div className="p-4">
      <div className="mb-3">
        <Link to="/admin/manga" className="text-sm text-txt-secondary hover:text-txt-primary">
          ← Quản lý truyện
        </Link>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-txt-primary">Auto cập nhật (vi-hentai)</h1>
          <p className="text-sm text-txt-secondary">Tách 2 bước: trích xuất 30 URL → chạy queue tải chương/ảnh.</p>
          <div className="mt-1 text-xs text-txt-secondary">
            Auto-update: <span className={enabled ? "text-emerald-300" : "text-red-300"}>{enabled ? "ON" : "OFF"}</span>.{" "}
            {enabled ? (
              <>
                Cron mỗi 1 giờ sẽ tự trích xuất <span className="text-txt-primary">{DEFAULT_MAX_MANGA}</span> URL và auto chạy (primary). Lần tiếp theo:{" "}
                <span className="text-txt-primary">{nextCronAt.toLocaleString()}</span> — còn lại{" "}
                <span className="font-semibold text-txt-primary">{formatMs(remainingMs)}</span> (list: {DEFAULT_LIST_URL})
              </>
            ) : (
              <>Đang tắt — dừng hoàn toàn cho tới khi bật lại.</>
            )}
            <div className="mt-1">
              Dừng sớm khi có 5 truyện noop/failed liên tiếp:{" "}
              <span className={stopEarlyEnabled ? "text-emerald-300" : "text-red-300"}>{stopEarlyEnabled ? "ON" : "OFF"}</span>.
            </div>
          </div>
        </div>

        <fetcher.Form method="post" className="flex flex-col items-start gap-3 md:flex-row md:flex-wrap md:items-center">
          <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
          <input type="hidden" name="stopEarlyEnabled" value={stopEarlyEnabled ? "0" : "1"} />
          <div className="text-sm text-txt-secondary">Cho phép tạo truyện mới: <span className="font-semibold text-txt-primary">Luôn bật</span></div>

          <label className="flex items-center gap-2 text-sm text-txt-secondary">
            <input type="checkbox" name="autoApproveNewManga" defaultChecked={true} />
            Auto duyệt truyện mới
          </label>

          <label className="flex items-center gap-2 text-sm text-txt-secondary">
            <span>ownerId</span>
            <input
              name="ownerId"
              defaultValue={DEFAULT_OWNER_ID}
              placeholder={DEFAULT_OWNER_ID}
              className="w-full max-w-full rounded border border-border bg-card px-2 py-1 text-sm text-txt-primary outline-none md:w-[320px] md:max-w-[60vw]"
            />
          </label>

          <button
            type="submit"
            name="intent"
            value="extractQueue"
            disabled={running || !enabled}
            className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
          >
            {running ? "Đang trích xuất..." : `Trích xuất ${DEFAULT_MAX_MANGA} URL`}
          </button>

          <button
            type="submit"
            name="intent"
            value="startQueue"
            disabled={running || !enabled || !activeQueue?.id || activeQueue.status === "running"}
            className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
          >
            {running ? "Đang gửi lệnh..." : "Bắt đầu chạy queue"}
          </button>

          <button
            type="submit"
            name="intent"
            value="toggleEnabled"
            disabled={running}
            className={`w-full rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto ${enabled ? "bg-red-600" : "bg-sky-600"}`}
          >
            {enabled ? "Tắt" : "Bật"}
          </button>

          <button
            type="submit"
            name="intent"
            value="toggleStopEarly"
            disabled={running}
            className={`w-full rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto ${stopEarlyEnabled ? "bg-red-600" : "bg-sky-600"}`}
          >
            {stopEarlyEnabled ? "Tắt dừng sớm" : "Bật dừng sớm"}
          </button>

          <button
            type="button"
            onClick={clearSystemLockOnServer}
            className="w-full rounded border border-border bg-transparent px-3 py-2 text-sm font-medium text-txt-primary hover:bg-white/5 sm:w-auto"
          >
            Clear lock (queue kẹt)
          </button>

          <input type="hidden" name="queueId" value={activeQueue?.id || ""} />
        </fetcher.Form>
      </div>

      <div className="mt-4 rounded border border-border bg-card p-3 text-sm text-txt-secondary">
        <div className="mb-2 text-sm font-semibold text-txt-primary">Trạng thái hệ thống (auto-update + auto-download)</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded border border-border/60 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-txt-secondary">System Lock</div>
            <div className="mt-1 text-sm text-txt-primary">
              {systemStatus?.lock ? (
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold">Key:</span> {systemStatus.lock.key}
                  </div>
                  <div>
                    <span className="font-semibold">Trạng thái:</span> {lockStatusLabel}
                  </div>
                  <div>
                    <span className="font-semibold">Locked until:</span> {systemStatus.lock.lockedUntil || "-"}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold">Locked by:</span> {systemStatus.lock.lockedBy || "-"}
                  </div>
                </div>
              ) : (
                <div className="text-txt-secondary">Không có lock</div>
              )}
            </div>
          </div>

          <div className="rounded border border-border/60 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-txt-secondary">Auto-update</div>
            <div className="mt-1 text-sm text-txt-primary">
              {systemStatus?.autoUpdate?.runningQueue ? (
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold">Running queue:</span> {systemStatus.autoUpdate.runningQueue.id}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold">List:</span> {systemStatus.autoUpdate.runningQueue.listUrl}
                  </div>
                  <div>
                    <span className="font-semibold">Started:</span> {systemStatus.autoUpdate.runningQueue.startedAt || "-"}
                  </div>
                </div>
              ) : (
                <div className="text-txt-secondary">Không có queue running</div>
              )}
              <div className="mt-2 text-xs text-txt-secondary">
                Counts: queued {updateCounts.queued || 0} · running {updateCounts.running || 0} · paused {updateCounts.paused || 0} · succeeded {updateCounts.succeeded || 0} · failed {updateCounts.failed || 0}
              </div>
            </div>
          </div>

          <div className="rounded border border-border/60 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-txt-secondary">Auto-download</div>
            <div className="mt-1 text-sm text-txt-primary">
              {systemStatus?.autoDownload?.runningJob ? (
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold">Running job:</span> {systemStatus.autoDownload.runningJob.id}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold">URL:</span> {systemStatus.autoDownload.runningJob.url}
                  </div>
                  <div>
                    <span className="font-semibold">Started:</span> {systemStatus.autoDownload.runningJob.startedAt || "-"}
                  </div>
                  <div>
                    <span className="font-semibold">Heartbeat:</span> {systemStatus.autoDownload.runningJob.lastHeartbeatAt || "-"}
                  </div>
                </div>
              ) : (
                <div className="text-txt-secondary">Không có job running</div>
              )}
              <div className="mt-2 text-xs text-txt-secondary">
                Counts: queued {downloadCounts.queued || 0} · running {downloadCounts.running || 0} · succeeded {downloadCounts.succeeded || 0} · failed {downloadCounts.failed || 0} · pausedQueued {systemStatus?.autoDownload?.pausedQueued || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded border border-border bg-card p-3 text-sm text-txt-secondary">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div>
            <span className="font-semibold text-txt-primary">Queue</span>: {activeQueue?.id || "-"}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">List</span>: {activeQueue?.listUrl || "-"}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Status</span>: {activeQueue?.status || "-"}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Max</span>: {activeQueue?.maxManga ?? DEFAULT_MAX_MANGA}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Processed</span>: {activeQueue?.processed ?? 0}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Created</span>: {activeQueue?.created ?? 0}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Updated</span>: {activeQueue?.updated ?? 0}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Noop</span>: {activeQueue?.noop ?? 0}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Chapters</span>: {activeQueue?.chaptersAdded ?? 0}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Images</span>: {activeQueue?.imagesUploaded ?? 0}
          </div>
          {anyItemRunning ? <div className="text-yellow-200">Đang chạy (poll 5s)...</div> : null}
          {!enabled ? <div className="text-red-200">Auto-update đang tắt: worker không xử lý queue.</div> : null}
        </div>

        {activeQueue?.id ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => startPollingQueue(activeQueue.id)}
              className="rounded border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-txt-primary hover:bg-white/5"
            >
              Refresh/Poll
            </button>
            <button
              type="button"
              onClick={() => pauseQueueOnServer(activeQueue.id)}
              className="rounded bg-yellow-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-600"
            >
              Hủy queue
            </button>
            <button
              type="button"
              onClick={() => deleteQueueOnServer(activeQueue.id)}
              className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
            >
              Xóa queue
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto rounded border border-border">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-card text-left text-txt-secondary">
            <tr>
              <th className="w-12 p-2">STT</th>
              <th className="p-2">URL gốc</th>
              <th className="w-28 p-2">Trạng thái</th>
              <th className="w-28 p-2">Chế độ</th>
              <th className="w-56 p-2">Mở truyện</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(activeQueue?.items || []).map((it: any) => {
              const openHref = it.mangaSlug ? `/truyen-hentai/${it.mangaSlug}` : undefined;
              const openEditHref = it.mangaId ? `/truyen-hentai/edit/${it.mangaId}` : undefined;
              return (
                <tr key={String(it.index)} className={it.status === "running" ? "bg-card/60" : ""}>
                  <td className="p-2 text-txt-secondary">{it.index}</td>
                  <td className="p-2">
                    <div className="break-all text-txt-primary md:truncate">{it.url}</div>
                    {it.parsedTitle ? (
                      <div className="break-words text-xs text-txt-secondary md:truncate">{it.parsedTitle}</div>
                    ) : null}
                    {it.message ? (
                      <div className="break-words text-xs text-txt-secondary md:truncate">{it.message}</div>
                    ) : null}
                  </td>
                  <td className="p-2">{itemBadge(it.status)}</td>
                  <td className="p-2 text-txt-secondary">{it.mode || "-"}</td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      {openHref ? (
                        <a className="text-xs text-primary hover:underline" href={openHref} target="_blank" rel="noreferrer">
                          Mở trang truyện
                        </a>
                      ) : (
                        <span className="text-xs text-txt-secondary">-</span>
                      )}
                      {openEditHref ? (
                        <a className="text-xs text-primary hover:underline" href={openEditHref} target="_blank" rel="noreferrer">
                          Mở trang sửa
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!activeQueue?.items?.length ? (
              <tr>
                <td className="p-3 text-sm text-txt-secondary" colSpan={5}>
                  Chưa có queue. Bấm “Trích xuất 30 URL” để tạo danh sách chờ.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {fetcher.data && !fetcher.data.ok ? (
        <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {fetcher.data.error}
        </div>
      ) : null}

      {controlFetcher.data && !controlFetcher.data.ok ? (
        <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {controlFetcher.data.error}
        </div>
      ) : null}

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-txt-primary">Lịch sử queue gần đây</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={pauseAllRunningOnServer}
              className="rounded bg-yellow-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-600"
            >
              Hủy tất cả running
            </button>
            <button
              type="button"
              onClick={deleteAllQueuedOnServer}
              className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
            >
              Xóa tất cả queue
            </button>
          </div>
        </div>
        {data.ok ? (
          <div className="mt-3 overflow-x-auto rounded border border-border">
            <table className="min-w-[960px] w-full text-sm">
              <thead className="bg-card">
                <tr className="text-left text-txt-secondary">
                  <th className="p-2">Status</th>
                  <th className="p-2">Started</th>
                  <th className="p-2">Finished</th>
                  <th className="p-2">Max</th>
                  <th className="p-2">Processed</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Updated</th>
                  <th className="p-2">Noop</th>
                  <th className="p-2">Chapters</th>
                  <th className="p-2">Images</th>
                  <th className="p-2">Errors</th>
                  <th className="p-2">Items</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.queues.map((q) => (
                  <tr key={q.id} className="border-t border-border">
                    <td className="p-2">{q.status}</td>
                    <td className="p-2">{q.startedAt || "-"}</td>
                    <td className="p-2">{q.finishedAt || "-"}</td>
                    <td className="p-2">{q.maxManga}</td>
                    <td className="p-2">{q.processed}</td>
                    <td className="p-2">{q.created}</td>
                    <td className="p-2">{q.updated}</td>
                    <td className="p-2">{q.noop}</td>
                    <td className="p-2">{q.chaptersAdded}</td>
                    <td className="p-2">{q.imagesUploaded}</td>
                    <td className="p-2">{q.errorCount}</td>
                    <td className="p-2">{q.itemsCount}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startPollingQueue(q.id)}
                          className="rounded border border-border bg-transparent px-2 py-1 text-xs text-txt-primary hover:bg-white/5"
                        >
                          Mở
                        </button>
                        <button
                          type="button"
                          onClick={() => pauseQueueOnServer(q.id)}
                          className="rounded bg-yellow-700 px-2 py-1 text-xs text-white hover:bg-yellow-600"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQueueOnServer(q.id)}
                          className="rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-600"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 text-sm text-red-200">{data.error}</div>
        )}

        {data.ok && data.queues[0]?.errorsSample?.length ? (
          <div className="mt-4 rounded border border-border bg-card p-3">
            <div className="text-sm font-medium text-txt-primary">Lỗi gần nhất (sample)</div>
            <ul className="mt-2 space-y-2 text-xs text-txt-secondary">
              {data.queues[0].errorsSample.map((e, idx) => (
                <li key={idx}>
                  <div className="truncate">{e.url}</div>
                  <div className="truncate">{e.message}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
