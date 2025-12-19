import { type LoaderFunctionArgs, type MetaFunction, useLoaderData, useSearchParams } from "react-router-dom";

import { getTotalMangaCount, searchMangaApprovedWithPagination } from "@/queries/manga.query";
import { Dropdown } from "~/components/dropdown";
import { MangaCard } from "~/components/manga-card";
import { Pagination } from "~/components/pagination";
import { MANGA_CONTENT_TYPE, MANGA_STATUS, MANGA_USER_STATUS } from "~/constants/manga";
import type { MangaType } from "~/database/models/manga.model";
import { DoujinshiModel, type DoujinshiType } from "~/database/models/doujinshi.model";

export const meta: MetaFunction = ({ data }: any) => {
  if (!data?.entity) {
    return [
      { title: "Doujinshi | Vinahentai" },
      { name: "description", content: "Danh sách doujinshi tại Vinahentai" },
    ];
  }
  return [
    { title: `${data.entity.name} | Vinahentai` },
    { name: "description", content: `Truyện thuộc doujinshi ${data.entity.name}` },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const sortParam = url.searchParams.get("sort") || "updatedAt";
  const limit = 18;

  const entity = await DoujinshiModel.findOne({ slug }).lean();
  if (!entity) throw new Response("Không tìm thấy doujinshi", { status: 404 });

  const query: Record<string, any> = {
    doujinshiSlugs: entity.slug,
    status: MANGA_STATUS.APPROVED,
    contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, MANGA_CONTENT_TYPE.COSPLAY, null] },
  };

  let sort: Record<string, 1 | -1> | undefined;
  switch (sortParam) {
    case "viewNumber":
      sort = { viewNumber: -1 };
      break;
    case "likeNumber":
      sort = { likeNumber: -1 };
      break;
    case "completed":
      query.userStatus = MANGA_USER_STATUS.COMPLETED;
      sort = { updatedAt: -1 };
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

  return Response.json({ entity, manga, currentPage: page, totalPages, sort: sortParam });
}

export default function DoujinshiPage() {
  const { entity, manga, currentPage, totalPages } = useLoaderData<{
    entity: DoujinshiType;
    manga: MangaType[];
    currentPage: number;
    totalPages: number;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const sortParam = searchParams.get("sort") || "updatedAt";

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
        <h1 className="text-txt-primary text-4xl leading-10 font-semibold">{(entity as any)?.name}</h1>
        <div className="h-1.5 w-20 bg-fuchsia-400" />
        <p className="text-txt-primary text-sm leading-tight font-normal">Truyện thuộc doujinshi {(entity as any)?.name}</p>

        <div className="mt-2 flex items-center gap-3">
          <span className="text-txt-secondary text-sm">Sắp xếp theo:</span>
          <div className="w-64">
            <Dropdown
              options={[
                { value: "updatedAt", label: "Mới cập nhật" },
                { value: "viewNumber", label: "Đọc nhiều" },
                { value: "likeNumber", label: "Được yêu thích" },
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
