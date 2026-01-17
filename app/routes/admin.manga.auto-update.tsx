import { Link, useFetcher, useLoaderData } from "react-router-dom";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { requireAdminLogin } from "@/services/auth.server";
import { runViHentaiAutoUpdateOnce } from "@/jobs/vi-hentai-auto-update.server";

import { ViHentaiAutoUpdateRunModel } from "~/database/models/vi-hentai-auto-update-run.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Auto cập nhật (vi-hentai)" },
    { name: "description", content: "Auto cập nhật truyện và chương mới từ vi-hentai" },
  ];
};

type LoaderResult =
  | ({ ok: true; runs: RunSummary[]; latestRun?: RunDetail } & Record<string, unknown>)
  | { ok: false; error: string };

type RunSummary = {
  id: string;
  status: string;
  listUrl: string;
  startedAt: string;
  finishedAt?: string;
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

type RunItem = {
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

type RunDetail = {
  id: string;
  status: string;
  listUrl: string;
  startedAt: string;
  finishedAt?: string;
  processed: number;
  created: number;
  updated: number;
  noop: number;
  chaptersAdded: number;
  imagesUploaded: number;
  items: RunItem[];
};

type ActionResult =
  | { ok: true; runId?: string }
  | { ok: false; error: string };

type PollResult =
  | { ok: true; run: RunDetail }
  | { ok: false; error: string };

const DEFAULT_OWNER_ID = "68f0f839b69df690049aba65";
const DEFAULT_LIST_URL = "https://vi-hentai.pro/danh-sach?page=1";

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

  const url = new URL(request.url);
  const intent = String(url.searchParams.get("intent") || "");
  if (intent === "poll") {
    const runId = String(url.searchParams.get("runId") || "").trim();
    if (!runId) return Response.json({ ok: false, error: "Thiếu runId" } satisfies PollResult, { status: 400 });

    const run = await ViHentaiAutoUpdateRunModel.findById(runId).lean();
    if (!run) return Response.json({ ok: false, error: "Không tìm thấy run" } satisfies PollResult, { status: 404 });

    const body: PollResult = {
      ok: true,
      run: {
        id: String((run as any)._id),
        status: String((run as any).status),
        listUrl: String((run as any).listUrl || ""),
        startedAt: (run as any).startedAt ? new Date((run as any).startedAt).toISOString() : "",
        finishedAt: (run as any).finishedAt ? new Date((run as any).finishedAt).toISOString() : undefined,
        processed: Number((run as any).processed || 0),
        created: Number((run as any).created || 0),
        updated: Number((run as any).updated || 0),
        noop: Number((run as any).noop || 0),
        chaptersAdded: Number((run as any).chaptersAdded || 0),
        imagesUploaded: Number((run as any).imagesUploaded || 0),
        items: Array.isArray((run as any).items)
          ? (run as any).items.map((it: any) => ({
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

  const runs = await ViHentaiAutoUpdateRunModel.find({})
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const latest = runs[0] as any;

  const body: LoaderResult = {
    ok: true,
    runs: runs.map((r: any): RunSummary => ({
      id: String(r._id),
      status: String(r.status),
      listUrl: String(r.listUrl || ""),
      startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : "",
      finishedAt: r.finishedAt ? new Date(r.finishedAt).toISOString() : undefined,
      processed: Number(r.processed || 0),
      created: Number(r.created || 0),
      updated: Number(r.updated || 0),
      noop: Number(r.noop || 0),
      chaptersAdded: Number(r.chaptersAdded || 0),
      imagesUploaded: Number(r.imagesUploaded || 0),
      errorCount: Array.isArray(r.errors) ? r.errors.length : 0,
      errorsSample: Array.isArray(r.errors) ? r.errors.slice(0, 5) : [],
      itemsCount: Array.isArray(r.items) ? r.items.length : 0,
    })),
    latestRun: latest
      ? ({
          id: String(latest._id),
          status: String(latest.status),
          listUrl: String(latest.listUrl || ""),
          startedAt: latest.startedAt ? new Date(latest.startedAt).toISOString() : "",
          finishedAt: latest.finishedAt ? new Date(latest.finishedAt).toISOString() : undefined,
          processed: Number(latest.processed || 0),
          created: Number(latest.created || 0),
          updated: Number(latest.updated || 0),
          noop: Number(latest.noop || 0),
          chaptersAdded: Number(latest.chaptersAdded || 0),
          imagesUploaded: Number(latest.imagesUploaded || 0),
          items: Array.isArray(latest.items)
            ? latest.items.map((it: any): RunItem => ({
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
        } satisfies RunDetail)
      : undefined,
  };

  return Response.json(body, { status: 200 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAdminLogin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "runNow") {
    const body: ActionResult = { ok: false, error: "intent không hợp lệ" };
    return Response.json(body, { status: 400 });
  }

  // Always allow creating new manga on auto-update.
  const allowCreateNewManga = true;
  const ownerId = String(formData.get("ownerId") || "").trim();
  const autoApproveNewManga = formData.get("autoApproveNewManga") === "on";

  const result = await runViHentaiAutoUpdateOnce({
    allowCreateNewManga,
    ownerId: ownerId || DEFAULT_OWNER_ID,
    approveNewManga: autoApproveNewManga,
  });

  if (!result.ok) {
    const body: ActionResult = { ok: false, error: result.message || "Chạy thất bại" };
    return Response.json(body, { status: 200 });
  }

  const body: ActionResult = { ok: true, runId: result.runId };
  return Response.json(body, { status: 200 });
};

export default function AdminMangaAutoUpdate() {
  const data = useLoaderData() as LoaderResult;
  const fetcher = useFetcher<ActionResult>();
  const pollFetcher = useFetcher<PollResult>();

  const [activeRun, setActiveRun] = useState<RunDetail | undefined>(data.ok ? data.latestRun : undefined);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const running = fetcher.state !== "idle";

  const [cronNow, setCronNow] = useState(() => new Date());
  const nextCronAt = useMemo(() => getNextHourTick(cronNow), [cronNow]);
  const remainingMs = useMemo(() => nextCronAt.getTime() - cronNow.getTime(), [nextCronAt, cronNow]);

  useEffect(() => {
    const t = setInterval(() => setCronNow(new Date()), 1_000);
    return () => clearInterval(t);
  }, []);

  const anyItemRunning = useMemo(() => {
    const items = activeRun?.items || [];
    return items.some((it: any) => it.status === "running");
  }, [activeRun]);

  const pollRun = (runId?: string) => {
    if (!runId) return;
    pollFetcher.load(`/admin/manga/auto-update?intent=poll&runId=${encodeURIComponent(runId)}`);
  };

  // Start polling after manual trigger.
  useEffect(() => {
    if (fetcher.state !== "idle") return;
    if (!fetcher.data) return;
    if (!fetcher.data.ok) return;
    if (!fetcher.data.runId) return;

    const runId = fetcher.data.runId;
    pollRun(runId);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => pollRun(runId), 5_000);
  }, [fetcher.state, fetcher.data]);

  // Apply polled run details to the UI.
  useEffect(() => {
    if (pollFetcher.state !== "idle") return;
    if (!pollFetcher.data) return;
    if (!pollFetcher.data.ok) return;

    setActiveRun(pollFetcher.data.run as any);

    const finished = Boolean((pollFetcher.data.run as any)?.finishedAt);
    const stillRunning = (pollFetcher.data.run as any)?.status === "running" || (pollFetcher.data.run as any)?.items?.some((it: any) => it.status === "running");
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-txt-primary">Auto cập nhật (vi-hentai)</h1>
          <p className="text-sm text-txt-secondary">Cron mỗi 1 giờ (primary instance) + có thể chạy thủ công.</p>
          <div className="mt-1 text-xs text-txt-secondary">
            Lần kiểm tra list tiếp theo: <span className="text-txt-primary">{nextCronAt.toLocaleString()}</span> — còn lại{" "}
            <span className="font-semibold text-txt-primary">{formatMs(remainingMs)}</span> (list: {DEFAULT_LIST_URL})
          </div>
        </div>

        <fetcher.Form method="post" className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="intent" value="runNow" />
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
              className="w-[320px] max-w-[60vw] rounded border border-border bg-card px-2 py-1 text-sm text-txt-primary outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={running}
            className="rounded bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {running ? "Đang chạy..." : "Chạy ngay"}
          </button>
        </fetcher.Form>
      </div>

      <div className="mt-4 rounded border border-border bg-card p-3 text-sm text-txt-secondary">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div>
            <span className="font-semibold text-txt-primary">Run</span>: {activeRun?.id || "-"}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">List</span>: {activeRun?.listUrl || "-"}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Status</span>: {activeRun?.status || "-"}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Processed</span>: {activeRun?.processed ?? 0}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Created</span>: {activeRun?.created ?? 0}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Updated</span>: {activeRun?.updated ?? 0}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Noop</span>: {activeRun?.noop ?? 0}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Chapters</span>: {activeRun?.chaptersAdded ?? 0}
          </div>
          <div>
            <span className="font-semibold text-txt-primary">Images</span>: {activeRun?.imagesUploaded ?? 0}
          </div>
          {anyItemRunning ? <div className="text-yellow-200">Đang chạy (poll 5s)...</div> : null}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded border border-border">
        <table className="w-full text-sm">
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
            {(activeRun?.items || []).map((it: any) => {
              const openHref = it.mangaSlug ? `/truyen-hentai/${it.mangaSlug}` : undefined;
              const openEditHref = it.mangaId ? `/truyen-hentai/edit/${it.mangaId}` : undefined;
              return (
                <tr key={String(it.index)} className={it.status === "running" ? "bg-card/60" : ""}>
                  <td className="p-2 text-txt-secondary">{it.index}</td>
                  <td className="p-2">
                    <div className="truncate text-txt-primary">{it.url}</div>
                    {it.parsedTitle ? <div className="truncate text-xs text-txt-secondary">{it.parsedTitle}</div> : null}
                    {it.message ? <div className="truncate text-xs text-txt-secondary">{it.message}</div> : null}
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
            {!activeRun?.items?.length ? (
              <tr>
                <td className="p-3 text-sm text-txt-secondary" colSpan={5}>
                  Chưa có dữ liệu. Bấm “Chạy ngay” để tạo run mới.
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

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-txt-primary">Lịch sử chạy gần đây</h2>
        {data.ok ? (
          <div className="mt-3 overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-card">
                <tr className="text-left text-txt-secondary">
                  <th className="p-2">Status</th>
                  <th className="p-2">Started</th>
                  <th className="p-2">Finished</th>
                  <th className="p-2">Processed</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Updated</th>
                  <th className="p-2">Noop</th>
                  <th className="p-2">Chapters</th>
                  <th className="p-2">Images</th>
                  <th className="p-2">Errors</th>
                  <th className="p-2">Items</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2">{r.status}</td>
                    <td className="p-2">{r.startedAt}</td>
                    <td className="p-2">{r.finishedAt || "-"}</td>
                    <td className="p-2">{r.processed}</td>
                    <td className="p-2">{r.created}</td>
                    <td className="p-2">{r.updated}</td>
                    <td className="p-2">{r.noop}</td>
                    <td className="p-2">{r.chaptersAdded}</td>
                    <td className="p-2">{r.imagesUploaded}</td>
                    <td className="p-2">{r.errorCount}</td>
                    <td className="p-2">{r.itemsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 text-sm text-red-200">{data.error}</div>
        )}

        {data.ok && data.runs[0]?.errorsSample?.length ? (
          <div className="mt-4 rounded border border-border bg-card p-3">
            <div className="text-sm font-medium text-txt-primary">Lỗi gần nhất (sample)</div>
            <ul className="mt-2 space-y-2 text-xs text-txt-secondary">
              {data.runs[0].errorsSample.map((e, idx) => (
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
