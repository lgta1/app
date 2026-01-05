import { useEffect, useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { Link, useFetcher } from "react-router-dom";

import { MangaCard } from "~/components/manga-card";
import { MANGA_CONTENT_TYPE, MANGA_STATUS } from "~/constants/manga";

// (tuỳ bạn) có thể dùng json() nếu bạn đã cấu hình, còn không thì return object như các route khác
// import { json } from "@remix-run/node";

export const meta: MetaFunction = ({ params }) => {
  const title = params.slug ? `Tác giả: ${params.slug} - WW` : "Tác giả - WW";
  return [{ title }, { name: "description", content: "Danh sách truyện theo tác giả" }];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const slug = params.slug as string;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Dynamic imports keep server-only code out of client bundles.
  const [{ AuthorModel }, { MangaModel }, { UserFollowAuthorModel }] = await Promise.all([
    import("~/database/models/author.model"),
    import("~/database/models/manga.model"),
    import("~/database/models/user-follow-author.model"),
  ]);

  // 1) Lấy tác giả theo slug
  const author = await AuthorModel.findOne({ slug }).lean();
  if (!author) {
    // Fallback: nếu slug base bị mất nhưng vẫn còn bản "-2/-3..." (do slug collision),
    // redirect để người dùng không gặp 404 khi click tag.
    const escapedSlug = escapeRegExp(slug);
    const candidates = await AuthorModel.find(
      { slug: { $regex: `^${escapedSlug}-\\d+$`, $options: "i" } },
      { slug: 1 },
    )
      .limit(2)
      .lean();

    if (candidates.length === 1 && candidates[0]?.slug) {
      return redirect(encodeURI(`/authors/${candidates[0].slug}`), { status: 301 });
    }

    throw new Response("Không tìm thấy tác giả", { status: 404 });
  }

  // 2) Lấy danh sách manga theo tác giả
  // - Canonical: match theo authorSlugs (ổn định, xử lý collision -2/-3, giữ Unicode)
  // - Legacy fallback: match theo chuỗi manga.author = "Tên1, Tên2".
  const name = author.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const authorRegex = new RegExp(`(?:^|,\\s*)${name}(?:\\s*,|$)`, "i");

  // Lấy các field cần cho MangaCard
  const mangas = await MangaModel.find(
    {
      status: MANGA_STATUS.APPROVED,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, MANGA_CONTENT_TYPE.COSPLAY, null] },
      $or: [{ authorSlugs: author.slug }, { author: authorRegex }],
    },
    {
      _id: 1,
      slug: 1,
      title: 1,
      poster: 1,
      updatedAt: 1,
      createdAt: 1,
      chapters: 1,
      genres: 1,
      userStatus: 1,
      latestChapterTitle: 1,
    },
  )
    .sort({ updatedAt: -1 })
    .lean();

  // Chuẩn hoá dữ liệu để MangaCard dùng ngay
  const normalized = (mangas || []).map((m) => ({
    id: m._id.toString(),
    slug: m.slug,
    title: m.title,
    poster: m.poster,
    chapters: m.chapters ?? 0,
    genres: m.genres ?? [],
    userStatus: m.userStatus ?? undefined,
    latestChapterTitle: (m as any)?.latestChapterTitle ?? undefined,
    updatedAt: m.updatedAt ?? m.createdAt,
    createdAt: m.createdAt,
  }));

  const { getUserInfoFromSession } = await import("@/services/session.svc");
  const sessionUser = await getUserInfoFromSession(request).catch(() => null);
  const userId = (sessionUser as any)?.id as string | undefined;
  const [isFollowing, followersCount] = await Promise.all([
    userId
      ? UserFollowAuthorModel.findOne({ userId, authorSlug: String(author.slug).toLowerCase() }).then((r: any) => !!r)
      : Promise.resolve(false),
    Promise.resolve(((author as any).followNumber as number | undefined) ?? 0),
  ]);

  return {
    author: { name: author.name, slug: author.slug, followersCount },
    isFollowing,
    mangas: normalized,
  };
}

export default function AuthorPage() {
  const { author, mangas, isFollowing: initialIsFollowing } = useLoaderData<typeof loader>();

  const followFetcher = useFetcher();
  const [isFollowing, setIsFollowing] = useState<boolean>(!!initialIsFollowing);
  const [followersCount, setFollowersCount] = useState<number>((author as any)?.followersCount ?? 0);

  useEffect(() => {
    setIsFollowing(!!initialIsFollowing);
  }, [initialIsFollowing]);

  useEffect(() => {
    const data: any = (followFetcher as any).data;
    if (!data || followFetcher.state !== "idle") return;
    if (typeof data.isFollowing === "boolean") {
      setIsFollowing(data.isFollowing);
    }
    if (typeof data.followersCount === "number") {
      setFollowersCount(data.followersCount);
    }
  }, [followFetcher.data, followFetcher.state]);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:px-0">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1
            className="text-txt-primary font-sans text-2xl font-semibold sm:text-3xl"
            style={{ textShadow: "0px 0px 4px rgba(182, 25, 255, 0.59)" }}
          >
            Tác giả: <span className="text-txt-focus">{author.name}</span>
          </h1>

          <div className="flex items-center gap-3">
            <span className="text-txt-secondary text-sm">
              {(followersCount ?? 0).toLocaleString("vi-VN")} người theo dõi
            </span>

            <button
              type="button"
              disabled={followFetcher.state === "submitting"}
              className={`border-lav-500 text-txt-focus hover:bg-lav-500/10 flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                followFetcher.state === "submitting" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
              aria-pressed={isFollowing}
              aria-label={isFollowing ? "Bỏ theo dõi" : "Theo dõi"}
              onClick={() => {
                if (followFetcher.state === "submitting") return;
                const formData = new FormData();
                formData.append("intent", isFollowing ? "unfollow" : "follow");
                formData.append("authorSlug", author.slug);
                followFetcher.submit(formData, { method: "POST", action: "/api/author-follow" });
              }}
            >
              {isFollowing ? "Bỏ theo dõi" : "Theo dõi"}
            </button>
          </div>
        </div>

        <Link
          to="/"
          className="text-txt-secondary hover:text-txt-primary text-sm transition-colors"
        >
          ← Trang chủ
        </Link>
      </div>

      {/* Không có truyện */}
      {(!mangas || mangas.length === 0) && (
        <div className="text-txt-secondary rounded-xl border border-dashed border-white/15 p-6 text-center">
          Chưa có truyện nào cho tác giả này.
        </div>
      )}

      {/* Grid các truyện */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {mangas?.map((m) => (
          <div key={m.id} className="w-full">
            <MangaCard manga={m} />
          </div>
        ))}
      </div>
    </div>
  );
}
