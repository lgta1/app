import { Link, useFetcher, useLoaderData, useRevalidator } from "react-router-dom";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useEffect, useMemo, useState } from "react";

import { requireAdminLogin } from "@/services/auth.server";
import {
  createSayHentaiAutoUpdateQueue,
  getSayHentaiAutoUpdateEnabled,
  kickSayHentaiAutoUpdateQueue,
  setSayHentaiAutoUpdateEnabled,
  startSayHentaiAutoUpdateQueue,
} from "@/jobs/sayhentai-auto-update.server";
import { AutoUpdateSayHentaiService } from "@/services/auto-update-sayhentai.service";
import { SayHentaiAutoUpdateConfigModel } from "~/database/models/say-hentai-auto-update-config.model";
import { SayHentaiAutoUpdateMangaModel } from "~/database/models/say-hentai-auto-update-manga.model";
import { SayHentaiAutoUpdateQueueModel } from "~/database/models/say-hentai-auto-update-queue.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Auto update (sayhentai)" },
    { name: "description", content: "Auto update manga from sayhentai" },
  ];
};

type AllowItem = {
  id: string;
  sayPath: string;
  vinaPath?: string;
  createdAt: string;
};

type QueueItem = {
  index: number;
  url: string;
  status: string;
  mode?: string;
  message?: string;
};

type QueueSummary = {
  id: string;
  status: string;
  listUrl: string;
  startedAt?: string;
  finishedAt?: string;
  processed: number;
  created: number;
  updated: number;
  noop: number;
  chaptersAdded: number;
  imagesUploaded: number;
  items: QueueItem[];
};

type LoaderResult =
  | {
      ok: true;
      enabled: boolean;
      config: { origin: string; domain: string } | null;
      allowlist: AllowItem[];
      latestQueue?: QueueSummary;
      queues: QueueSummary[];
    }
  | { ok: false; error: string };

type ActionResult =
  | { ok: true; enabled?: boolean; queueId?: string }
  | { ok: false; error: string };

const normalizeVinaPath = (raw: string): string | null => {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  const decodePathSafe = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  try {
    const url = new URL(trimmed, "https://vinahentai.local");
    const pathname = decodePathSafe(url.pathname).replace(/\/+$/, "");
    if (!pathname.startsWith("/")) return null;
    if (/^\/truyen-hentai\//i.test(pathname) || /^\/truyen\//i.test(pathname)) return pathname;
    const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `/truyen-hentai/${normalized.replace(/^\//, "")}`;
  } catch {
    const normalized = decodePathSafe(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
    if (/^\/truyen-hentai\//i.test(normalized) || /^\/truyen\//i.test(normalized)) {
      return normalized.replace(/\/+$/, "");
    }
    const slug = normalized.replace(/^\//, "");
    if (!slug) return null;
    return `/truyen-hentai/${slug}`;
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdminLogin(request);

  const [enabled, configDoc, allowlist, queues] = await Promise.all([
    getSayHentaiAutoUpdateEnabled(),
    SayHentaiAutoUpdateConfigModel.findOne({ key: "primary" })
      .select({ origin: 1, domain: 1 })
      .lean(),
    SayHentaiAutoUpdateMangaModel.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .select({ sayPath: 1, vinaPath: 1, path: 1, createdAt: 1 })
      .lean(),
    SayHentaiAutoUpdateQueueModel.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const latest = queues[0] as any;

  const body: LoaderResult = {
    ok: true,
    enabled,
    config: configDoc
      ? { origin: String((configDoc as any).origin || ""), domain: String((configDoc as any).domain || "") }
      : null,
    allowlist: allowlist.map((it: any) => ({
      id: String(it._id),
      sayPath: String(it.sayPath || it.path || ""),
      vinaPath: it.vinaPath ? String(it.vinaPath) : undefined,
      createdAt: it.createdAt ? new Date(it.createdAt).toISOString() : "",
    })),
    latestQueue: latest
      ? {
          id: String(latest._id),
          status: String(latest.status || ""),
          listUrl: String(latest.listUrl || ""),
          startedAt: latest.startedAt ? new Date(latest.startedAt).toISOString() : undefined,
          finishedAt: latest.finishedAt ? new Date(latest.finishedAt).toISOString() : undefined,
          processed: Number(latest.processed || 0),
          created: Number(latest.created || 0),
          updated: Number(latest.updated || 0),
          noop: Number(latest.noop || 0),
          chaptersAdded: Number(latest.chaptersAdded || 0),
          imagesUploaded: Number(latest.imagesUploaded || 0),
          items: Array.isArray(latest.items)
            ? latest.items.map((it: any) => ({
                index: Number(it.index || 0),
                url: String(it.url || ""),
                status: String(it.status || ""),
                mode: it.mode ? String(it.mode) : undefined,
                message: it.message ? String(it.message) : undefined,
              }))
            : [],
        }
      : undefined,
    queues: queues.map((q: any) => ({
      id: String(q._id),
      status: String(q.status || ""),
      listUrl: String(q.listUrl || ""),
      startedAt: q.startedAt ? new Date(q.startedAt).toISOString() : undefined,
      finishedAt: q.finishedAt ? new Date(q.finishedAt).toISOString() : undefined,
      processed: Number(q.processed || 0),
      created: Number(q.created || 0),
      updated: Number(q.updated || 0),
      noop: Number(q.noop || 0),
      chaptersAdded: Number(q.chaptersAdded || 0),
      imagesUploaded: Number(q.imagesUploaded || 0),
      items: Array.isArray(q.items)
        ? q.items.slice(0, 5).map((it: any) => ({
            index: Number(it.index || 0),
            url: String(it.url || ""),
            status: String(it.status || ""),
            mode: it.mode ? String(it.mode) : undefined,
            message: it.message ? String(it.message) : undefined,
          }))
        : [],
    })),
  };

  return Response.json(body, { status: 200 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAdminLogin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "toggleEnabled") {
    const desired = String(formData.get("enabled") || "").trim();
    const nextEnabled = desired === "1" || desired === "true";
    const saved = await setSayHentaiAutoUpdateEnabled(nextEnabled);
    const body: ActionResult = { ok: true, enabled: saved };
    return Response.json(body, { status: 200 });
  }

  if (intent === "saveDomain") {
    const raw = String(formData.get("domain") || "").trim();
    try {
      await AutoUpdateSayHentaiService.saveDomain(raw);
      const body: ActionResult = { ok: true };
      return Response.json(body, { status: 200 });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Failed to save domain";
      const body: ActionResult = { ok: false, error };
      return Response.json(body, { status: 400 });
    }
  }

  if (intent === "addManga") {
    try {
      let rawSay = String(formData.get("sayPath") || "").trim();
      const rawVina = String(formData.get("vinaPath") || "").trim();
      const config = await AutoUpdateSayHentaiService.getConfig();
      const base = config?.origin || "https://sayhentai.invalid";
      if (rawSay && !rawSay.startsWith("/") && !/^https?:\/\//i.test(rawSay)) {
        rawSay = `/${rawSay}`;
      }
      const normalizedSay = AutoUpdateSayHentaiService.normalizeMangaPath(rawSay, base);
      if (!normalizedSay) {
        const body: ActionResult = { ok: false, error: "Invalid manga path" };
        return Response.json(body, { status: 400 });
      }

      const normalizedVina = normalizeVinaPath(rawVina) || undefined;

      await SayHentaiAutoUpdateMangaModel.updateOne(
        { sayPath: normalizedSay },
        { $set: { sayPath: normalizedSay, path: normalizedSay, vinaPath: normalizedVina } },
        { upsert: true },
      );
      const body: ActionResult = { ok: true };
      return Response.json(body, { status: 200 });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected server error";
      const code = (e as any)?.code;
      const isDup = code === 11000 || String(message).includes("E11000");
      const error = isDup ? "Duplicate say path (already exists)" : message;
      const body: ActionResult = { ok: false, error };
      return Response.json(body, { status: 500 });
    }
  }

  if (intent === "deleteManga") {
    const id = String(formData.get("id") || "").trim();
    if (!id) {
      const body: ActionResult = { ok: false, error: "Missing id" };
      return Response.json(body, { status: 400 });
    }
    await SayHentaiAutoUpdateMangaModel.deleteOne({ _id: id });
    const body: ActionResult = { ok: true };
    return Response.json(body, { status: 200 });
  }

  if (intent === "runNow") {
    const created = await createSayHentaiAutoUpdateQueue();
    if (!created.ok || !created.queueId) {
      const body: ActionResult = { ok: false, error: created.message || "Cannot create queue" };
      return Response.json(body, { status: 200 });
    }

    const started = await startSayHentaiAutoUpdateQueue(created.queueId, { manual: true });
    if (!started) {
      const kicked = await kickSayHentaiAutoUpdateQueue(created.queueId);
      if (!kicked.ok) {
        const body: ActionResult = { ok: false, error: kicked.message || "Cannot start queue" };
        return Response.json(body, { status: 200 });
      }
    } else {
      void kickSayHentaiAutoUpdateQueue(created.queueId);
    }

    const body: ActionResult = { ok: true, queueId: created.queueId };
    return Response.json(body, { status: 200 });
  }

  if (intent === "cancelQueue") {
    const queueId = String(formData.get("queueId") || "").trim();
    if (!queueId) {
      const body: ActionResult = { ok: false, error: "Missing queueId" };
      return Response.json(body, { status: 400 });
    }
    await SayHentaiAutoUpdateQueueModel.updateOne(
      { _id: queueId },
      { $set: { status: "succeeded", finishedAt: new Date() } },
    );
    const body: ActionResult = { ok: true };
    return Response.json(body, { status: 200 });
  }

  if (intent === "deleteQueue") {
    const queueId = String(formData.get("queueId") || "").trim();
    if (!queueId) {
      const body: ActionResult = { ok: false, error: "Missing queueId" };
      return Response.json(body, { status: 400 });
    }
    await SayHentaiAutoUpdateQueueModel.deleteOne({ _id: queueId });
    const body: ActionResult = { ok: true };
    return Response.json(body, { status: 200 });
  }

  const body: ActionResult = { ok: false, error: "Invalid intent" };
  return Response.json(body, { status: 400 });
};

export default function AdminMangaAutoUpdateSayHentai() {
  const data = useLoaderData() as LoaderResult;
  const fetcher = useFetcher<ActionResult>();
  const listFetcher = useFetcher<ActionResult>();
  const controlFetcher = useFetcher<ActionResult>();
  const queueFetcher = useFetcher<ActionResult>();
  const revalidator = useRevalidator();

  const [enabled, setEnabled] = useState(() => (data.ok ? Boolean(data.enabled) : true));
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    if (!fetcher.data) return;
    if (!fetcher.data.ok) return;
    if (typeof fetcher.data.enabled === "boolean") {
      setEnabled(fetcher.data.enabled);
      setStatusMessage(fetcher.data.enabled ? "Auto-update enabled" : "Auto-update disabled");
      return;
    }
    setStatusMessage("Action completed");
    revalidator.revalidate();
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    if (fetcher.state === "idle") return;
    setStatusMessage("Processing...");
  }, [fetcher.state]);

  useEffect(() => {
    if (listFetcher.state !== "idle") return;
    if (!listFetcher.data) return;
    if (!listFetcher.data.ok) return;
    revalidator.revalidate();
  }, [listFetcher.state, listFetcher.data]);

  useEffect(() => {
    if (controlFetcher.state !== "idle") return;
    if (!controlFetcher.data) return;
    if (!controlFetcher.data.ok) return;
    revalidator.revalidate();
  }, [controlFetcher.state, controlFetcher.data]);

  useEffect(() => {
    if (queueFetcher.state !== "idle") return;
    if (!queueFetcher.data) return;
    if (!queueFetcher.data.ok) return;
    revalidator.revalidate();
  }, [queueFetcher.state, queueFetcher.data]);

  const fetcherIntent = String(fetcher.formData?.get("intent") || "");
  const isSavingDomain = fetcher.state !== "idle" && fetcherIntent === "saveDomain";
  const isTogglingEnabled = fetcher.state !== "idle" && fetcherIntent === "toggleEnabled";
  const isRunningNow = fetcher.state !== "idle" && fetcherIntent === "runNow";

  const isAddingManga = listFetcher.state !== "idle";
  const isDeletingManga = controlFetcher.state !== "idle";
  const isQueueAction = queueFetcher.state !== "idle";

  const allowlist = data.ok ? data.allowlist : [];
  const queues = data.ok ? data.queues : [];
  const latestQueue = data.ok ? data.latestQueue : undefined;
  const origin = data.ok && data.config?.origin ? data.config.origin : "";

  const itemBadge = (status?: string) => {
    const s = String(status || "");
    const base = "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold";
    if (s === "running") return <span className={`${base} bg-yellow-500/15 text-yellow-200`}>running</span>;
    if (s === "succeeded") return <span className={`${base} bg-green-500/15 text-green-200`}>ok</span>;
    if (s === "noop") return <span className={`${base} bg-zinc-500/20 text-zinc-200`}>noop</span>;
    if (s === "failed") return <span className={`${base} bg-red-500/15 text-red-200`}>failed</span>;
    return <span className={`${base} bg-zinc-500/20 text-zinc-200`}>{s || "-"}</span>;
  };

  const listUrl = useMemo(() => {
    if (!origin) return "";
    return `${origin.replace(/\/+$/, "")}/?page=1`;
  }, [origin]);

  return (
    <div className="p-4">
      <div className="mb-3">
        <Link to="/admin/manga" className="text-sm text-txt-secondary hover:text-txt-primary">
          ← Quan ly truyen
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-txt-primary">Auto update (sayhentai)</h1>
          <p className="text-sm text-txt-secondary">Domain dynamic + allowlist manga.</p>
        </div>

        <fetcher.Form method="post" className="flex flex-col gap-2 rounded border border-border bg-card p-3">
          <div className="text-sm font-semibold text-txt-primary">Domain config</div>
          <label className="flex flex-col gap-1 text-sm text-txt-secondary">
            <span>Active domain</span>
            <input
              name="domain"
              defaultValue={origin}
              placeholder="https://sayhentai.world"
              className="w-full rounded border border-border bg-card px-2 py-1 text-sm text-txt-primary outline-none"
            />
          </label>
          <div className="text-xs text-txt-secondary">Listing URL: {listUrl || "-"}</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              name="intent"
              value="saveDomain"
              disabled={fetcher.state !== "idle"}
              className={`rounded px-3 py-2 text-sm font-medium text-white ${isSavingDomain ? "bg-primary/70 animate-pulse" : "bg-primary"} disabled:opacity-60`}
            >
              {isSavingDomain ? "Saving..." : "Save domain"}
            </button>
            <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
            <button
              type="submit"
              name="intent"
              value="toggleEnabled"
              disabled={fetcher.state !== "idle"}
              className={`rounded px-3 py-2 text-sm font-medium text-white ${enabled ? "bg-red-600" : "bg-sky-600"} ${isTogglingEnabled ? "animate-pulse" : ""} disabled:opacity-60`}
            >
              {isTogglingEnabled ? "Updating..." : enabled ? "Disable" : "Enable"}
            </button>
            <button
              type="submit"
              name="intent"
              value="runNow"
              disabled={!enabled || fetcher.state !== "idle"}
              className={`rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 ${isRunningNow ? "animate-pulse" : ""}`}
            >
              {isRunningNow ? "Starting..." : "Run now"}
            </button>
          </div>
          <div className="text-xs text-txt-secondary">{statusMessage || "Ready"}</div>
        </fetcher.Form>

        <listFetcher.Form method="post" className="flex flex-col gap-2 rounded border border-border bg-card p-3">
          <div className="text-sm font-semibold text-txt-primary">Allowlist manga</div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              name="sayPath"
              placeholder="Say path: /truyen-abc.html"
              className="w-full rounded border border-border bg-card px-2 py-1 text-sm text-txt-primary outline-none"
            />
            <input
              name="vinaPath"
              placeholder="Vina path: /truyen-hentai/slug (optional)"
              className="w-full rounded border border-border bg-card px-2 py-1 text-sm text-txt-primary outline-none"
            />
            <button
              type="submit"
              name="intent"
              value="addManga"
              disabled={isAddingManga}
              className={`rounded bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60 ${isAddingManga ? "animate-pulse" : ""}`}
            >
              {isAddingManga ? "Adding..." : "Add"}
            </button>
          </div>
          <div className="text-xs text-txt-secondary">Total: {allowlist.length}</div>
        </listFetcher.Form>

        <div className="overflow-x-auto rounded border border-border">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-card text-left text-txt-secondary">
              <tr>
                <th className="p-2">Say path</th>
                <th className="p-2">Vina path</th>
                <th className="p-2">Created</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allowlist.map((it) => (
                <tr key={it.id}>
                  <td className="p-2 text-txt-primary break-all">{it.sayPath}</td>
                  <td className="p-2 text-txt-secondary break-all">{it.vinaPath || "-"}</td>
                  <td className="p-2 text-txt-secondary">{it.createdAt || "-"}</td>
                  <td className="p-2">
                    <controlFetcher.Form method="post">
                      <input type="hidden" name="id" value={it.id} />
                      <button
                        type="submit"
                        name="intent"
                        value="deleteManga"
                        disabled={isDeletingManga}
                        className={`rounded bg-red-700 px-2 py-1 text-xs text-white disabled:opacity-60 ${isDeletingManga ? "animate-pulse" : ""}`}
                      >
                        {isDeletingManga ? "Deleting..." : "Delete"}
                      </button>
                    </controlFetcher.Form>
                  </td>
                </tr>
              ))}
              {!allowlist.length ? (
                <tr>
                  <td className="p-3 text-sm text-txt-secondary" colSpan={5}>
                    No allowlist entries yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="rounded border border-border bg-card p-3">
          <div className="text-sm font-semibold text-txt-primary">Latest queue</div>
          <div className="mt-2 text-xs text-txt-secondary">
            {latestQueue ? (
              <div className="space-y-1">
                <div>Status: {latestQueue.status}</div>
                <div>List: {latestQueue.listUrl}</div>
                <div>Processed: {latestQueue.processed}</div>
                <div>Created: {latestQueue.created}</div>
                <div>Updated: {latestQueue.updated}</div>
                <div>Noop: {latestQueue.noop}</div>
              </div>
            ) : (
              <div>No queue yet.</div>
            )}
          </div>

          {latestQueue?.items?.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[640px] w-full text-sm">
                <thead className="bg-card text-left text-txt-secondary">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">URL</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {latestQueue.items.map((it) => (
                    <tr key={`${latestQueue.id}-${it.index}`}>
                      <td className="p-2 text-txt-secondary">{it.index}</td>
                      <td className="p-2 text-txt-primary break-all">
                        {it.url}
                        {it.message ? <div className="text-xs text-txt-secondary">{it.message}</div> : null}
                      </td>
                      <td className="p-2">{itemBadge(it.status)}</td>
                      <td className="p-2 text-txt-secondary">{it.mode || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="rounded border border-border bg-card p-3">
          <div className="text-sm font-semibold text-txt-primary">Recent queues</div>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-[880px] w-full text-sm">
              <thead className="bg-card text-left text-txt-secondary">
                <tr>
                  <th className="p-2">Status</th>
                  <th className="p-2">List</th>
                  <th className="p-2">Processed</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Updated</th>
                  <th className="p-2">Noop</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queues.map((q) => (
                  <tr key={q.id}>
                    <td className="p-2">{q.status}</td>
                    <td className="p-2 text-txt-secondary break-all">{q.listUrl}</td>
                    <td className="p-2">{q.processed}</td>
                    <td className="p-2">{q.created}</td>
                    <td className="p-2">{q.updated}</td>
                    <td className="p-2">{q.noop}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <queueFetcher.Form method="post">
                          <input type="hidden" name="queueId" value={q.id} />
                          <button
                            type="submit"
                            name="intent"
                            value="cancelQueue"
                            disabled={isQueueAction || q.status === "succeeded"}
                            className="rounded bg-yellow-700 px-2 py-1 text-xs text-white disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </queueFetcher.Form>
                        <queueFetcher.Form method="post">
                          <input type="hidden" name="queueId" value={q.id} />
                          <button
                            type="submit"
                            name="intent"
                            value="deleteQueue"
                            disabled={isQueueAction}
                            className="rounded bg-red-700 px-2 py-1 text-xs text-white disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </queueFetcher.Form>
                      </div>
                    </td>
                  </tr>
                ))}
                {!queues.length ? (
                  <tr>
                    <td className="p-3 text-sm text-txt-secondary" colSpan={7}>
                      No queues yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {fetcher.data && !fetcher.data.ok ? (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {fetcher.data.error}
          </div>
        ) : null}
        {listFetcher.data && !listFetcher.data.ok ? (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {listFetcher.data.error}
          </div>
        ) : null}
        {controlFetcher.data && !controlFetcher.data.ok ? (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {controlFetcher.data.error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
