import { useEffect, useState } from "react";
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData, useSearchParams, useFetcher } from "react-router-dom";

import { getTotalMangaCount, searchMangaApprovedWithPagination } from "@/queries/manga.query";
import { Dropdown } from "~/components/dropdown";
import { MangaCard } from "~/components/manga-card";
import { Pagination } from "~/components/pagination";
import { MANGA_CONTENT_TYPE, MANGA_STATUS, MANGA_USER_STATUS } from "~/constants/manga";
import type { MangaType } from "~/database/models/manga.model";
import { TranslatorModel, type TranslatorType } from "~/database/models/translator.model";
import { getUserInfoFromSession } from "@/services/session.svc";
import { UserFollowTranslatorModel } from "~/database/models/user-follow-translator.model";

export const meta: MetaFunction = ({ data }: any) => {
  if (!data?.entity) {
    return [
      { title: "Dịch giả | Vinahentai" },
      { name: "description", content: "Danh sách dịch giả tại Vinahentai" },
    ];
  }
  return [
    { title: `${data.entity.name} | Vinahentai` },
    { name: "description", content: `Truyện của dịch giả ${data.entity.name}` },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const sortParam = url.searchParams.get("sort") || "updatedAt";
  const limit = 18;

  const entity = await TranslatorModel.findOne({ slug }).lean();
  if (!entity) throw new Response("Không tìm thấy dịch giả", { status: 404 });

  const sessionUser = await getUserInfoFromSession(request).catch(() => null);
  const userId = (sessionUser as any)?.id as string | undefined;
  const translatorSlug = String((entity as any)?.slug ?? "").toLowerCase();
  const [isFollowing, followersCount] = await Promise.all([
    userId
      ? UserFollowTranslatorModel.findOne({ userId, translatorSlug }).then((r: any) => !!r)
      : Promise.resolve(false),
    Promise.resolve(((entity as any)?.followNumber as number | undefined) ?? 0),
  ]);

  const query: Record<string, any> = {
    translatorSlugs: (entity as any).slug,
    status: MANGA_STATUS.APPROVED,
    contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
  };

  let sort: Record<string, 1 | -1> | undefined;
  switch (sortParam) {
    case "viewNumber":
      sort = { viewNumber: -1 };
      break;
    case "likeNumber":
      // Legacy: `likeNumber` previously meant "Được yêu thích".
      // Now map it to rating-based ordering.
      sort = { ratingScore: -1, ratingTotalVotes: -1, viewNumber: -1 };
      break;
    case "completed":
      query.userStatus = MANGA_USER_STATUS.COMPLETED;
      sort = { updatedAt: -1 };
      break;
    case "oldest":
      sort = { updatedAt: 1 };
      break;
    case "updatedAt":
    default:
      sort = { updatedAt: -1 };
      break;
  }

  const [manga, totalCount] = await Promise.all([
    searchMangaApprovedWithPagination({ page, limit, query, sort }),
    getTotalMangaCount({ query }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return Response.json({ entity, manga, currentPage: page, totalPages, sort: sortParam, isFollowing, followersCount });
}

export default function TranslatorsPage() {
  const { entity, manga, currentPage, totalPages, isFollowing: initialIsFollowing, followersCount: initialFollowersCount } = useLoaderData<{
    entity: TranslatorType;
    manga: MangaType[];
    currentPage: number;
    totalPages: number;
    isFollowing: boolean;
    followersCount: number;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const sortParam = searchParams.get("sort") || "updatedAt";

  const followFetcher = useFetcher();
  const [isFollowing, setIsFollowing] = useState<boolean>(!!initialIsFollowing);
  const [followersCount, setFollowersCount] = useState<number>(initialFollowersCount ?? 0);

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

  const handlePageChange = (page: number) => {
    setSearchParams((prev: URLSearchParams) => {
      prev.set("page", page.toString());
      return prev;
    });
  };

  const handleSortChange = (value: string) => {
    setSearchParams((prev: URLSearchParams) => {
      prev.set("sort", value);
      prev.set("page", "1");
      return prev;
    });
  };

  return (
    <div className="container-page mx-auto px-4 py-6">
      <div className="mb-8 flex flex-col items-start justify-start gap-3.5">
        <div className="flex flex-col gap-2">
          <h1 className="text-txt-primary text-4xl leading-10 font-semibold">{(entity as any)?.name}</h1>
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
                formData.append("translatorSlug", String((entity as any)?.slug ?? ""));
                followFetcher.submit(formData, { method: "POST", action: "/api/translator-follow" });
              }}
            >
              {isFollowing ? "Bỏ theo dõi" : "Theo dõi"}
            </button>
          </div>
        </div>
        <div className="h-1.5 w-20 bg-fuchsia-400" />
        <p className="text-txt-primary text-sm leading-tight font-normal">Truyện của dịch giả {(entity as any)?.name}</p>

        <div className="mt-2 flex items-center gap-3">
          <span className="text-txt-secondary text-sm">Sắp xếp theo:</span>
          <div className="w-64">
            <Dropdown
              options={[
                { value: "updatedAt", label: "Mới cập nhật" },
                { value: "oldest", label: "Cũ nhất" },
                { value: "viewNumber", label: "Đọc nhiều" },
                { value: "likeNumber", label: "Đánh giá cao" },
                { value: "completed", label: "Đã hoàn thành" },
              ]}
              value={sortParam}
              onSelect={(v) => handleSortChange(String(v))}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {manga.map((item) => (
          <MangaCard key={item.id} manga={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}
    </div>
  );
}
