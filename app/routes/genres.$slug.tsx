import {
  type LoaderFunctionArgs,
  useLoaderData,
  useSearchParams,
} from "react-router-dom";

import {
  getTotalMangaCount,
  searchMangaApprovedWithPagination,
} from "~/.server/queries/manga.query";
import { MangaCard } from "~/components/manga-card";
import { Pagination } from "~/components/pagination";
import { MANGA_STATUS } from "~/constants/manga";
import { GenresModel, type GenresType } from "~/database/models/genres.model";
import type { MangaType } from "~/database/models/manga.model";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 18;

  const genre = await GenresModel.findOne({ slug }).lean();

  if (!genre) {
    throw new Response("Không tìm thấy thể loại", { status: 404 });
  }

  const query = {
    genres: genre.slug,
    status: MANGA_STATUS.APPROVED,
  };

  const [manga, totalCount] = await Promise.all([
    searchMangaApprovedWithPagination({ page, limit, query }),
    getTotalMangaCount({ query }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return Response.json({
    genre,
    manga: manga.map((item) => ({
      ...item,
      id: item._id.toString(),
    })),
    currentPage: page,
    totalPages,
  });
}

export default function Genres() {
  const { genre, manga, currentPage, totalPages } = useLoaderData<{
    genre: GenresType;
    manga: MangaType[];
    currentPage: number;
    totalPages: number;
  }>();
  const [_, setSearchParams] = useSearchParams();

  const handlePageChange = (page: number) => {
    setSearchParams((prev) => {
      prev.set("page", page.toString());
      return prev;
    });
  };

  return (
    <div className="container-ad mx-auto px-4 py-6">
      <div className="mb-8 flex flex-col items-start justify-start gap-3.5">
        <h1 className="text-txt-primary text-4xl leading-10 font-semibold">
          {genre?.name}
        </h1>
        <div className="h-1.5 w-20 bg-fuchsia-400" />
      </div>

      {/* Manga list */}
      <div className="xs:grid-cols-3 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {manga.map((item) => (
          <div key={item.id} className="w-full">
            <MangaCard manga={item} />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
