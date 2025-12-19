import { Form, Link, useActionData, useNavigation } from "react-router-dom";
import { type ActionFunctionArgs, type MetaFunction } from "react-router";

import { requireAdminLogin } from "@/services/auth.server";
import {
  importViHentaiManga,
  type ViHentaiImportResult,
} from "@/services/importers/vi-hentai-importer";
import { MANGA_CONTENT_TYPE, MANGA_USER_STATUS } from "~/constants/manga";

type ActionResult = {
  ok: boolean;
  error?: string;
  results?: Array<
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
      } & { modeLabel: string; createdId?: string })
    | {
        status: "error";
        url: string;
        message: string;
      }
  >;
};

export const meta: MetaFunction = () => ([
  { title: "Auto-import vi-hentai | Admin" },
  { name: "description", content: "Nhập truyện từ vi-hentai.pro cho admin" },
]);

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminLogin(request);
  const formData = await request.formData();

  const urlsRaw = formData.get("urls");
  const ownerId = formData.get("ownerId");
  const translationTeam = formData.get("translationTeam")?.toString().trim() || undefined;
  const approve = formData.get("approve") === "on";
  const contentTypeValue = formData.get("contentType")?.toString();
  const userStatusValue = formData.get("userStatus")?.toString();

  if (!urlsRaw || typeof urlsRaw !== "string") {
    const body: ActionResult = { ok: false, error: "Vui lòng nhập ít nhất 1 URL" };
    return Response.json(body, { status: 400 });
  }
  if (!ownerId || typeof ownerId !== "string") {
    const body: ActionResult = { ok: false, error: "Vui lòng nhập ownerId" };
    return Response.json(body, { status: 400 });
  }

  const urls = urlsRaw
    .split(/\r?\n|,/)
    .map((u) => u.trim())
    .filter(Boolean);

  if (!urls.length) {
    const body: ActionResult = { ok: false, error: "Danh sách URL không hợp lệ" };
    return Response.json(body, { status: 400 });
  }

  const contentType = contentTypeValue === "COSPLAY" ? MANGA_CONTENT_TYPE.COSPLAY : MANGA_CONTENT_TYPE.MANGA;
  let userStatusOverride: number | undefined;
  if (userStatusValue === "completed") {
    userStatusOverride = MANGA_USER_STATUS.COMPLETED;
  } else if (userStatusValue === "ongoing") {
    userStatusOverride = MANGA_USER_STATUS.ON_GOING;
  }

  const shouldDryRun = formData.get("dryRun") === "on";
  const shouldSkipIfExists = formData.get("skipIfExists") === "on";

  const results: ActionResult["results"] = [];

  for (const url of urls) {
    try {
      const result = await importViHentaiManga({
        url,
        ownerId,
        translationTeam,
        approve,
        dryRun: shouldDryRun,
        skipIfExists: shouldSkipIfExists,
        contentType,
        userStatusOverride,
      });
      results.push(formatSuccessResult(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể import truyện";
      results.push({ status: "error", url, message });
    }
  }

  const body: ActionResult = {
    ok: (results ?? []).every((item) => item.status !== "error"),
    results,
  };
  return Response.json(body);
}

const formatSuccessResult = (result: ViHentaiImportResult) => {
  const modeLabelMap: Record<ViHentaiImportResult["mode"], string> = {
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
  };
};

export default function AdminMangaImport() {
  const actionData = useActionData<ActionResult>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-txt-primary">Auto-import vi-hentai.pro</h1>
        <p className="text-sm text-txt-secondary">
          Dán 1 hoặc nhiều link (mỗi dòng), hệ thống sẽ tải metadata và tạo truyện mới.
        </p>
      </div>

      <Form method="post" className="space-y-4 rounded-xl border border-bd-default bg-bgc-layer1 p-6 shadow">
        <div className="space-y-2">
          <label htmlFor="urls" className="text-sm font-semibold text-txt-primary">
            Danh sách URL
          </label>
          <textarea
            id="urls"
            name="urls"
            required
            rows={5}
            className="w-full rounded-lg border border-bd-default bg-bgc-layer2 p-3 text-sm text-txt-primary"
            placeholder="https://vi-hentai.pro/truyen/..."
          />
          <p className="text-xs text-txt-secondary">Hỗ trợ nhiều link, mỗi dòng một link (hoặc cách nhau bởi dấu phẩy).</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ownerId" className="text-sm font-semibold text-txt-primary">
              Owner ID
            </label>
            <input
              id="ownerId"
              name="ownerId"
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
              name="translationTeam"
              className="w-full rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary"
              placeholder="Override tên nhóm dịch"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-txt-primary">Content type</label>
            <select
              name="contentType"
              className="w-full rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary"
              defaultValue="MANGA"
            >
              <option value="MANGA">Manga</option>
              <option value="COSPLAY">Cosplay</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-txt-primary">User status</label>
            <select
              name="userStatus"
              className="w-full rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary"
              defaultValue="auto"
            >
              <option value="auto">Theo trang nguồn</option>
              <option value="ongoing">Đang tiến hành</option>
              <option value="completed">Đã hoàn thành</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-txt-primary">Tùy chọn</label>
            <div className="flex flex-col gap-2 text-sm text-txt-primary">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="approve" />
                <span>Tự động duyệt</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="dryRun" defaultChecked />
                <span>Dry-run (không ghi DB)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="skipIfExists" defaultChecked />
                <span>Bỏ qua nếu đã có cùng tên</span>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-gradient-to-b from-[#C466FF] to-[#924DBF] px-4 py-2 text-sm font-semibold text-black shadow disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Đang xử lý..." : "Chạy import"}
        </button>
      </Form>

      {actionData?.error && (
        <div className="mt-4 rounded-lg border border-red-400 bg-red-950/40 p-4 text-sm text-red-200">
          {actionData.error}
        </div>
      )}

      {actionData?.results && actionData.results.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-txt-primary">Kết quả</h2>
          {actionData.results.map((result, idx) => (
            <div
              key={`${result.url}-${idx}`}
              className="flex flex-col gap-4 rounded-xl border border-bd-default bg-bgc-layer1 p-4 shadow"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs text-txt-secondary">Nguồn</p>
                  <a href={result.url} target="_blank" rel="noreferrer" className="text-sm text-blue-400 underline">
                    {result.url}
                  </a>
                </div>
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center md:gap-3">
                  {result.status === "created" ? (
                    (() => {
                      const handle = (result as any).createdId || (result as any).slug;
                      if (!handle) return null;
                      return (
                        <Link
                          to={`/truyen-hentai/preview/${handle}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-[#DD94FF]/50 px-3 py-1.5 text-xs font-semibold text-[#DD94FF] transition hover:border-[#DD94FF] hover:text-white"
                        >
                          Đi tới
                        </Link>
                      );
                    })()
                  ) : null}
                  <StatusBadge status={result.status} message={result.message} modeLabel={(result as any).modeLabel} />
                </div>
              </div>

              {result.status !== "error" ? (
                <div className="flex flex-col gap-4 md:flex-row">
                  <img
                    src={(result as any).poster}
                    alt={(result as any).title}
                    className="h-40 w-28 rounded-md object-cover"
                  />
                  <div className="flex-1 space-y-2">
                    <h3 className="text-xl font-semibold text-txt-primary">{(result as any).title}</h3>
                    <p className="text-sm text-txt-secondary">
                      Slug: <span className="text-txt-primary">{(result as any).slug}</span>
                    </p>
                    {(result as any).translationTeam && (
                      <p className="text-sm text-txt-secondary">
                        Nhóm dịch: <span className="text-txt-primary">{(result as any).translationTeam}</span>
                      </p>
                    )}
                    {(result as any).parsedStatus && (
                      <p className="text-sm text-txt-secondary">
                        Tình trạng nguồn: <span className="text-txt-primary">{(result as any).parsedStatus}</span>
                      </p>
                    )}
                    {(result as any).translatorNames?.length ? (
                      <p className="text-sm text-txt-secondary">
                        Dịch giả: <span className="text-txt-primary">{(result as any).translatorNames.join(", ")}</span>
                      </p>
                    ) : null}
                    <p className="text-sm text-txt-secondary">
                      Genres: <span className="text-txt-primary">{(result as any).matchedGenres.join(", ")}</span>
                    </p>
                    {((result as any).unknownGenres?.length ?? 0) > 0 && (
                      <p className="text-xs text-yellow-300">
                        Không map được: {(result as any).unknownGenres.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-red-300">{result.message}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type StatusType = "created" | "dry-run" | "skipped" | "error";

function StatusBadge({
  status,
  message,
  modeLabel,
}: {
  status: StatusType;
  message: string;
  modeLabel?: string;
}) {
  const map: Record<StatusType, { label: string; className: string }> = {
    created: { label: modeLabel || "Đã tạo", className: "bg-emerald-500/20 text-emerald-200" },
    "dry-run": { label: modeLabel || "Dry-run", className: "bg-blue-500/20 text-blue-200" },
    skipped: { label: modeLabel || "Bỏ qua", className: "bg-yellow-500/20 text-yellow-200" },
    error: { label: "Lỗi", className: "bg-red-500/20 text-red-200" },
  };

  const meta = map[status];
  return (
    <div className="text-right">
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
        {meta.label}
      </div>
      <p className="text-xs text-txt-secondary">{message}</p>
    </div>
  );
}
