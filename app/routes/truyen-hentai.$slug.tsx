import toast, { Toaster } from "react-hot-toast";
import { Trophy } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { Link, redirect, useFetcher } from "react-router";

// Lưu ý: tất cả import server-only (alias @) sẽ được dynamic import trong loader để tránh lôi vào client bundle

import type { Route } from "./+types/truyen-hentai.$slug";

import CommentDetail from "~/components/comment-detail";
import { MangaDetail } from "~/components/manga-detail";
import RatingItem from "~/components/rating-item";
import ShareButtons from "~/components/share-buttons";
import { DisturbingTagsWarningDialog } from "~/components/dialog-warning-disturbing-tags";

// Related list tại trang chapter vẫn dùng component riêng
import RecommendedManga from "~/components/recommended-manga";
import { SameAuthorManga } from "~/components/same-author-manga";
import React from "react"; // đảm bảo JSX types
import LazyRender from "~/components/lazy-render";
import ProfileUploaderCard from "~/components/profile-uploader-card";
import { toSlug } from "~/utils/slug.utils";
import { useFileOperations } from "~/hooks/use-file-operations";
import { normalizePosterImage } from "~/utils/image-compression.utils";

import type { MangaType } from "~/database/models/manga.model";
// server helpers sẽ được import trong loader bằng dynamic import
import { isAdmin } from "~/helpers/user.helper";
import { DEFAULT_SHARE_IMAGE } from "~/constants/share-images";

export async function loader({ params, request }: Route.LoaderArgs) {
  const [mangaQuery, chapterQuery, leaderboardQuery, sessionSvc, userModel, genreDisplayUtils, ttlCacheUtils] =
    await Promise.all([
      import("@/queries/manga.query"),
      import("@/queries/chapter.query"),
      import("@/queries/leaderboad.query"),
      import("@/services/session.svc"),
      import("~/database/models/user.model"),
      import("~/.server/utils/genre-display-map"),
      import("~/.server/utils/ttl-cache"),
    ]);

  const { getMangaPublishedById, getMangaBySameAuthor, getRecommendedByFeaturedGenres } = mangaQuery as any;
  const { getChaptersByMangaId } = chapterQuery as any;
  const { getLeaderboard } = leaderboardQuery as any;
  const { getUserInfoFromSession } = sessionSvc as any;
  const { UserModel } = userModel as any;
  const { buildGenreDisplayMap } = genreDisplayUtils as any;
  const { sharedTtlCache } = ttlCacheUtils as any;

  const { getCanonicalOrigin } = await import("~/.server/utils/canonical-url");
  const { hasRestrictedGenres } = await import("~/.server/utils/seo-blocklist");

  const handle = params.slug;
  const origin = getCanonicalOrigin(request as any);
  const currentUser = await getUserInfoFromSession(request);

  // Anonymous traffic is the hottest: cache the heavy payload briefly to reduce DB/CPU.
  if (!currentUser && handle) {
    const cacheKey = `loader:truyen-hentai.$slug:${handle.toLowerCase()}`;

    const cached = await sharedTtlCache.getOrSet(cacheKey, 30_000, async () => {
      const manga = await getMangaPublishedById(handle);
      if (!manga) return null;

      const uploaderUser = await UserModel.findById(manga.ownerId)
        .select("name avatar bio level mangasCount role")
        .lean();

      const uploader = {
        displayName: uploaderUser?.name ?? manga.translationTeam ?? "Ẩn danh",
        avatarUrl: uploaderUser?.avatar ?? null,
        bio: uploaderUser?.bio ?? "",
        level: uploaderUser?.level ?? undefined,
        totalManga: uploaderUser?.mangasCount ?? 0,
        uploaderRole: uploaderUser?.role ?? null,
        profileUrl: `/profile/${manga.ownerId}`,
      };

      const [chapters, weeklyLeaderboard, sameAuthorManga, recommendedManga, genreDisplayMap] =
        await Promise.all([
          getChaptersByMangaId(manga.id, null),
          getLeaderboard("weekly"),
          getMangaBySameAuthor(manga.author, manga.id, 4, {
            requireApproved: true,
            contentType: manga.contentType,
            fallbackToOwnerId: manga.contentType === "COSPLAY",
            ownerId: manga.ownerId,
          }),
          getRecommendedByFeaturedGenres(manga, 5),
          buildGenreDisplayMap(manga.genres as string[]),
        ]);

      return {
        manga,
        chapters,
        weeklyLeaderboard,
        sameAuthorManga,
        recommendedManga,
        genreDisplayMap,
        uploader,
        robotsNoIndex: hasRestrictedGenres(manga.genres),
      };
    });

    if (!cached?.manga) throw new Response("Không tìm thấy truyện", { status: 404 });

    // Canonical slug enforcement (no fallback to pillar)
    const incomingHandle = handle.toLowerCase();
    const canonicalSlug = cached.manga.slug?.toLowerCase();
    if (incomingHandle && canonicalSlug && incomingHandle !== canonicalSlug) {
      return redirect(encodeURI(`/truyen-hentai/${cached.manga.slug}`));
    }

    return {
      ...cached,
      isLoggedIn: false,
      isAdmin: false,
      canManageManga: false,
      origin,
    };
  }

  const manga = handle ? await getMangaPublishedById(handle) : null;
  if (!manga) throw new Response("Không tìm thấy truyện", { status: 404 });

  // Canonical slug enforcement (no fallback to pillar)
  const incomingHandle = handle?.toLowerCase();
  const canonicalSlug = manga.slug?.toLowerCase();
  if (incomingHandle && canonicalSlug && incomingHandle !== canonicalSlug) {
    return redirect(encodeURI(`/truyen-hentai/${manga.slug}`));
  }

  const isAdminUser = isAdmin(currentUser?.role ?? "");
  const isOwner = currentUser ? String(currentUser.id) === String(manga.ownerId) : false;

  // 🔹 Lấy thông tin uploader
  const uploaderUser = await UserModel.findById(manga.ownerId)
    .select("name avatar bio level mangasCount role")
    .lean();

  const uploader = {
    displayName: uploaderUser?.name ?? manga.translationTeam ?? "Ẩn danh",
    avatarUrl: uploaderUser?.avatar ?? null,
    bio: uploaderUser?.bio ?? "",
    level: uploaderUser?.level ?? undefined,
    totalManga: uploaderUser?.mangasCount ?? 0,
    uploaderRole: uploaderUser?.role ?? null,
    profileUrl: `/profile/${manga.ownerId}`,
  };

  const [chapters, weeklyLeaderboard, sameAuthorManga, recommendedManga, genreDisplayMap] =
    await Promise.all([
      getChaptersByMangaId(manga.id, currentUser),
      getLeaderboard("weekly"),
      // Bỏ lấy monthlyLeaderboard để lazy load phía client
      getMangaBySameAuthor(manga.author, manga.id, 4, {
        requireApproved: true,
        contentType: manga.contentType,
        fallbackToOwnerId: manga.contentType === "COSPLAY",
        ownerId: manga.ownerId,
      }),
      getRecommendedByFeaturedGenres(manga, 5),
      buildGenreDisplayMap(manga.genres as string[]),
    ]);

  return {
    manga,
    chapters,
    weeklyLeaderboard,
    sameAuthorManga,
    recommendedManga,
    genreDisplayMap,
    uploader,
    isLoggedIn: !!currentUser,
    isAdmin: isAdminUser,
    canManageManga: isAdminUser || isOwner,
    origin,
    robotsNoIndex: hasRestrictedGenres(manga.genres),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const formData = await request.formData();
    const actionType = String(formData.get("actionType") ?? "");
    if (actionType !== "adminUpdatePoster") {
      return Response.json({ success: false, error: "Hành động không hợp lệ" }, { status: 400 });
    }

    const [{ requireLogin }, { resolveMangaHandle }, { MangaModel }] = await Promise.all([
      import("~/.server/services/auth.server"),
      import("~/database/helpers/manga-slug.helper"),
      import("~/database/models/manga.model"),
    ]);

    const user = await requireLogin(request);
    if (!isAdmin((user as any)?.role ?? "")) {
      return Response.json({ success: false, error: "Chỉ admin mới có quyền đổi ảnh bìa" }, { status: 403 });
    }

    const handle = String(params.slug ?? "").trim();
    if (!handle) {
      return Response.json({ success: false, error: "Thiếu thông tin truyện" }, { status: 400 });
    }

    const target = await resolveMangaHandle(handle);
    if (!target) {
      return Response.json({ success: false, error: "Không tìm thấy truyện" }, { status: 404 });
    }

    const mangaId = String((target as any).id ?? (target as any)._id ?? "");
    if (!mangaId) {
      return Response.json({ success: false, error: "Không tìm thấy mangaId" }, { status: 404 });
    }

    const posterUrl = formData.get("posterUrl");
    if (typeof posterUrl !== "string" || !posterUrl.trim()) {
      return Response.json({ success: false, error: "Vui lòng tải lên ảnh bìa hợp lệ" }, { status: 400 });
    }

    await MangaModel.findByIdAndUpdate(
      mangaId,
      { $set: { poster: posterUrl.trim() } },
      { timestamps: false },
    );

    return Response.json({ success: true, poster: posterUrl.trim(), message: "Đã cập nhật ảnh bìa" });
  } catch (error) {
    console.error("[manga detail] adminUpdatePoster error", error);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export function meta({ data }: Route.MetaArgs) {
  if (!data?.manga) {
    return [
      { title: "Không tìm thấy truyện | VinaHentai" },
      { name: "description", content: "Trang truyện không tồn tại" },
    ];
  }

  const robots = data?.robotsNoIndex
    ? [{ name: "robots", content: "noindex, nofollow, noarchive, noimageindex" }]
    : [];

  const origin = data.origin || "https://vinahentai.fun";
  const canonicalPath = data.manga.slug
    ? `/truyen-hentai/${data.manga.slug}`
    : `/truyen-hentai/${data.manga.id}`;
  const canonicalUrl = `${origin}${canonicalPath}`;
  const image = data.manga.shareImage || data.manga.poster || DEFAULT_SHARE_IMAGE;

  // Title cắt tối đa 50 ký tự trước khi thêm suffix
  const truncate = (str: string, max: number) =>
    str.length > max ? `${str.slice(0, Math.max(0, max - 3))}...` : str;
  const pageTitleBase = data.manga.title || "";
  const pageTitle = `${truncate(pageTitleBase, 50)} | VinaHentai`;

  // Xây dựng description theo yêu cầu
  let altNames: string[] = [];
  if (Array.isArray((data.manga as any).altNames)) {
    altNames = (data.manga as any).altNames.filter((n: any) => n && n.trim()).map((n: any) => n.trim());
  } else if (typeof (data.manga as any).altName === "string" && (data.manga as any).altName.trim()) {
    altNames = [(data.manga as any).altName.trim()];
  }

  const desc = String((data.manga as any).description || "").trim();

  let doujinshi = "";
  if (Array.isArray((data.manga as any).doujinshi) && (data.manga as any).doujinshi.length > 0) {
    doujinshi = (data.manga as any).doujinshi.join(", ");
  } else if (typeof (data.manga as any).doujinshi === "string" && (data.manga as any).doujinshi.trim()) {
    doujinshi = (data.manga as any).doujinshi.trim();
  }

  let characters = "";
  if (Array.isArray((data.manga as any).characters) && (data.manga as any).characters.length > 0) {
    characters = (data.manga as any).characters.join(", ");
  } else if (typeof (data.manga as any).characters === "string" && (data.manga as any).characters.trim()) {
    characters = (data.manga as any).characters.trim();
  }

  const descriptionParts: string[] = [];
  if (altNames.length > 0) descriptionParts.push(altNames[0]);
  if (desc) descriptionParts.push(desc);
  if (doujinshi) descriptionParts.push(`Doujinshi: ${doujinshi}`);
  if (characters) descriptionParts.push(characters);
  descriptionParts.push(`Cập nhật truyện "${data.manga.title}" sớm nhất tại Vinahentai.`);

  let description = descriptionParts.filter(Boolean).join(" ");
  if (description.length > 140) {
    description = `${description.slice(0, 137)}...`;
  }

  return [
    { title: pageTitle },
    { name: "description", content: description },
    { property: "og:title", content: pageTitle },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: pageTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:url", content: canonicalUrl },
    ...robots,
  ];
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const {
    manga,
    chapters,
    weeklyLeaderboard,
    isLoggedIn,
    isAdmin: userIsAdmin,
    canManageManga,
    uploader,
    sameAuthorManga,
    recommendedManga,
    genreDisplayMap,
  } = loaderData;
  const manageHandle = manga.slug || manga.id;

  const { uploadMultipleFiles } = useFileOperations();
  const posterUpdateFetcher = useFetcher<typeof action>();
  const posterUpdateInFlightRef = React.useRef(false);
  const pendingPosterUrlRef = React.useRef<string | null>(null);
  const [posterUrl, setPosterUrl] = React.useState<string>(manga.poster || "");
  const [isPosterUpdating, setIsPosterUpdating] = React.useState(false);

  const displayManga = React.useMemo(() => ({ ...manga, poster: posterUrl }), [manga, posterUrl]);

  const handlePosterDrop = async (file: File) => {
    if (!userIsAdmin || isPosterUpdating) return;
    setIsPosterUpdating(true);
    try {
      const normalized = await normalizePosterImage(file);
      const [upload] = await uploadMultipleFiles([{ file: normalized.file, options: { prefixPath: "story-images" } }]);
      const remoteUrl = (upload as any)?.url || (upload as any)?.location || (upload as any)?.path || (upload as any)?.key;
      if (!remoteUrl) {
        throw new Error("Không thể tải ảnh lên");
      }

      const formData = new FormData();
      formData.append("actionType", "adminUpdatePoster");
      formData.append("posterUrl", String(remoteUrl));
      pendingPosterUrlRef.current = String(remoteUrl);
      posterUpdateInFlightRef.current = true;
      posterUpdateFetcher.submit(formData, {
        method: "POST",
        action: `/truyen-hentai/${manageHandle}`,
        encType: "multipart/form-data",
      });
    } catch (error) {
      console.error("[manga detail] update poster", error);
      toast.error(error instanceof Error ? error.message : "Cập nhật ảnh bìa thất bại");
      pendingPosterUrlRef.current = null;
      posterUpdateInFlightRef.current = false;
      setIsPosterUpdating(false);
    }
  };

  React.useEffect(() => {
    if (!posterUpdateInFlightRef.current) return;
    if (posterUpdateFetcher.state !== "idle") return;

    const data = posterUpdateFetcher.data as
      | { success?: boolean; error?: string; message?: string; poster?: string }
      | undefined;

    if (data?.success) {
      const nextPoster = data.poster || pendingPosterUrlRef.current;
      if (nextPoster) setPosterUrl(nextPoster);
      toast.success(data.message || "Đã cập nhật ảnh bìa");
    } else {
      toast.error(data?.error || "Cập nhật ảnh bìa thất bại");
    }

    pendingPosterUrlRef.current = null;
    posterUpdateInFlightRef.current = false;
    setIsPosterUpdating(false);
  }, [posterUpdateFetcher.state, posterUpdateFetcher.data]);

  const disturbingTagSlugs = React.useMemo(() => {
    const raw = Array.isArray((manga as any)?.genres) ? (manga as any).genres : [];
    const normalized = raw
      .map((item: any) => toSlug(String(item)))
      .map((s: string) => s.toLowerCase())
      .filter(Boolean);

    const hit = new Set<string>();
    for (const slug of normalized) {
      if (slug === "guro" || slug === "scat") hit.add(slug);
    }

    return Array.from(hit);
  }, [manga]);

  const disturbingTagNames = React.useMemo(() => {
    const map = (genreDisplayMap || {}) as Record<string, string>;
    return disturbingTagSlugs.map((slug) => map[slug] || slug);
  }, [disturbingTagSlugs, genreDisplayMap]);

  const disturbingTagWarningKey = React.useMemo(
    () => `disturbing_tags_warning_confirmed:${manga?.id || "unknown"}`,
    [manga?.id],
  );

  const [isDisturbingTagWarningOpen, setIsDisturbingTagWarningOpen] = React.useState(false);

  React.useEffect(() => {
    if (!disturbingTagSlugs.length) return;
    try {
      if (sessionStorage.getItem(disturbingTagWarningKey) === "true") return;
    } catch {
      // ignore
    }

    setIsDisturbingTagWarningOpen(true);
  }, [disturbingTagSlugs, disturbingTagWarningKey]);

  return (
    <div className="container-page mx-auto px-4 pb-24 pt-1 md:pt-6 md:pb-32">
      <DisturbingTagsWarningDialog
        open={isDisturbingTagWarningOpen}
        onOpenChange={(open: boolean) => {
          setIsDisturbingTagWarningOpen(open);
          if (!open) {
            try {
              sessionStorage.setItem(disturbingTagWarningKey, "true");
            } catch {
              // ignore
            }
          }
        }}
        tags={disturbingTagNames}
      />
      <Toaster position="bottom-right" />

      {/* Header row (Tablet/Desktop): breadcrumb + manage button */}
      <div className="mb-4 hidden items-start justify-between gap-4 md:flex">
        <nav aria-label="Breadcrumb" className="text-txt-focus font-sans text-sm font-medium">
          <ol className="flex flex-wrap items-center gap-0.5 sm:gap-1">
            <li className="flex items-center gap-0.5 sm:gap-1">
              <Link to="/" className="transition-colors hover:text-lav-500">
                Trang chủ
              </Link>
              <span className="text-txt-secondary/60 px-0.5">/</span>
            </li>
            <li>
              <span className="text-txt-focus" title={manga.title || "Manga"}>
                {(manga.title || "Manga").length > 20
                  ? (manga.title || "Manga").slice(0, 19).trimEnd() + "…"
                  : (manga.title || "Manga")}
              </span>
            </li>
          </ol>
        </nav>

        {canManageManga ? (
          <Link
            to={`/truyen-hentai/preview/${manageHandle}`}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(225,29,72,0.35)] transition-transform hover:scale-[1.02]"
          >
            Quản lý
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_27vw] lg:grid-cols-[minmax(0,1fr)_22vw]">
        {/* ===== CỘT TRÁI: CHI TIẾT TRUYỆN ===== */}
        <section>
          {/* Mobile: keep existing breadcrumb + manage button placement */}
          <nav aria-label="Breadcrumb" className="text-txt-focus font-sans text-sm font-medium mb-3 md:hidden">
            <ol className="flex flex-wrap items-center gap-0.5 sm:gap-1">
              <li className="flex items-center gap-0.5 sm:gap-1">
                <Link to="/" className="transition-colors hover:text-lav-500">
                  Trang chủ
                </Link>
                <span className="text-txt-secondary/60 px-0.5">/</span>
              </li>
              <li>
                <span className="text-txt-focus" title={manga.title || "Manga"}>
                  {(manga.title || "Manga").length > 20
                    ? (manga.title || "Manga").slice(0, 19).trimEnd() + "…"
                    : (manga.title || "Manga")}
                </span>
              </li>
            </ol>
          </nav>

          {canManageManga ? (
            <div className="mb-4 flex justify-end md:hidden">
              <Link
                to={`/truyen-hentai/preview/${manageHandle}`}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(225,29,72,0.35)] transition-transform hover:scale-[1.02]"
              >
                Quản lý
              </Link>
            </div>
          ) : null}

          <MangaDetail
            manga={displayManga as any}
            chapters={chapters}
            genreDisplayMap={genreDisplayMap}
            isLoggedIn={isLoggedIn}
            posterDropEnabled={userIsAdmin}
            onPosterDrop={handlePosterDrop}
            posterDropUploading={isPosterUpdating}
            posterDropHint="Ảnh mới được lưu ngay khi thả"
          />
          <ShareButtons title={manga.title} />

          {uploader ? (
            <div className="mt-6 md:hidden">
              <ProfileUploaderCard {...uploader} />
            </div>
          ) : null}

          <LazyRender
            rootMargin="600px"
            placeholder={
              <div className="mt-6 space-y-4">
                <div className="h-12 w-40 rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
                <div className="h-36 w-full rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
              </div>
            }
            once
          >
            <CommentDetail mangaId={manga.id} isLoggedIn={isLoggedIn} isAdmin={userIsAdmin} />
          </LazyRender>
        </section>

        {/* ===== CỘT PHẢI: UPLOADER CARD + BXH TRUYỆN ===== */}
        <section className="mt-8 md:mt-0">
          <div className="space-y-10">
            {uploader ? (
              <div className="hidden md:block">
                <ProfileUploaderCard {...uploader} />
              </div>
            ) : null}
            <SameAuthorManga items={sameAuthorManga} />
            <RecommendedManga mangaList={recommendedManga} variant="detail-vertical" />

            <LazyRender
              rootMargin="600px"
              placeholder={
                <div className="space-y-4">
                  <div className="h-8 w-36 rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
                  <div className="h-40 w-full rounded bg-[rgba(255,255,255,0.02)] animate-pulse" />
                </div>
              }
              once
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Trophy className="h-6 w-6 text-lav-500" />
                  <h2 className="text-txt-primary text-xl font-semibold uppercase">bảng xếp hạng</h2>
                </div>

                <div className="bg-bgc-layer1 border-bd-default overflow-hidden rounded-2xl border p-0">
                  <LeaderboardWeeklyMonthlyDetail weekly={weeklyLeaderboard as MangaType[]} />
                </div>
              </div>
            </LazyRender>
          </div>
        </section>
      </div>
    </div>
  );
}

function LeaderboardWeeklyMonthlyDetail({ weekly }: { weekly: MangaType[] }) {
  const [tab, setTab] = React.useState("weekly");
  const [weeklyPage, setWeeklyPage] = React.useState(1);
  const [monthlyLoaded, setMonthlyLoaded] = React.useState(false);
  const [monthlyLoading, setMonthlyLoading] = React.useState(false);
  const [monthlyData, setMonthlyData] = React.useState<MangaType[]>([]);
  const [monthlyPage, setMonthlyPage] = React.useState(1);

  const weeklyPage1 = (weekly || []).slice(0, 5);
  const weeklyPage2 = (weekly || []).slice(5, 10);
  const monthlyPage1 = (monthlyData || []).slice(0, 5);
  const monthlyPage2 = (monthlyData || []).slice(5, 10);

  return (
    <Tabs.Root
      value={tab}
      onValueChange={(v) => {
        setTab(v);
        if (v === "monthly" && !monthlyLoaded) {
          setMonthlyLoaded(true);
          setMonthlyLoading(true);
          fetch(`/api/leaderboard/manga?period=monthly&limit=10`)
            .then((r) => r.json())
            .then((json) => {
              if (json?.success) setMonthlyData(json.data || []);
            })
            .catch(() => {})
            .finally(() => setMonthlyLoading(false));
        }
      }}
    >
      <Tabs.List className="border-bd-default flex border-b">
        <Tabs.Trigger
          value="weekly"
          className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex-1 cursor-pointer bg-transparent px-3 py-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
        >
          Top tuần
        </Tabs.Trigger>
        <Tabs.Trigger
          value="monthly"
          className="data-[state=active]:border-lav-500 data-[state=active]:text-txt-primary text-txt-secondary hover:text-txt-primary flex-1 cursor-pointer bg-transparent px-3 py-3 text-base font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:font-semibold"
        >
          Top tháng
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="weekly" className="space-y-0 pb-4">
        {(weeklyPage === 1 ? weeklyPage1 : weeklyPage2).map((m, i) => (
          <RatingItem
            key={(m as MangaType).id}
            manga={m as MangaType}
            index={weeklyPage === 1 ? i + 1 : i + 6}
            usePortraitThumb
          />
        ))}
        {weeklyPage === 1 && weeklyPage2.length > 0 && (
          <div className="px-3 pb-2 pt-1">
            <button
              onClick={() => setWeeklyPage(2)}
              className="w-full rounded-md bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Trang 2 ▸
            </button>
          </div>
        )}
        {weeklyPage === 2 && (
          <div className="px-3 pb-2 pt-1">
            <button
              onClick={() => setWeeklyPage(1)}
              className="w-full rounded-md bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              ◂ Trang 1
            </button>
          </div>
        )}
      </Tabs.Content>

      <Tabs.Content value="monthly" className="space-y-0 pb-4">
        {monthlyLoading ? (
          <div className="text-txt-secondary py-6 text-center text-sm">Đang tải…</div>
        ) : (
          (monthlyPage === 1 ? monthlyPage1 : monthlyPage2).map((m, i) => (
            <RatingItem
              key={(m as MangaType).id}
              manga={m as MangaType}
              index={monthlyPage === 1 ? i + 1 : i + 6}
              usePortraitThumb
            />
          ))
        )}

        {monthlyPage === 1 && monthlyPage2.length > 0 && (
          <div className="px-3 pb-2 pt-1">
            <button
              onClick={() => setMonthlyPage(2)}
              className="w-full rounded-md bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Trang 2 ▸
            </button>
          </div>
        )}
        {monthlyPage === 2 && (
          <div className="px-3 pb-2 pt-1">
            <button
              onClick={() => setMonthlyPage(1)}
              className="w-full rounded-md bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              ◂ Trang 1
            </button>
          </div>
        )}
      </Tabs.Content>
    </Tabs.Root>
  );
}
