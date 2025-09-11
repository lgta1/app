import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { Link } from "react-router-dom";

import { MangaCard } from "~/components/manga-card";
import { AuthorModel } from "~/database/models/author.model";
import { MangaModel } from "~/database/models/manga.model";

// (tuỳ bạn) có thể dùng json() nếu bạn đã cấu hình, còn không thì return object như các route khác
// import { json } from "@remix-run/node";

export const meta: MetaFunction = ({ params }) => {
  const title = params.slug ? `Tác giả: ${params.slug} - WW` : "Tác giả - WW";
  return [{ title }, { name: "description", content: "Danh sách truyện theo tác giả" }];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug as string;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  // 1) Lấy tác giả theo slug
  const author = await AuthorModel.findOne({ slug }).lean();
  if (!author) {
    throw new Response("Không tìm thấy tác giả", { status: 404 });
  }

  // 2) Lấy danh sách manga chứa tên tác giả trong field 'author'
  //    Field 'author' hiện đang là chuỗi, có thể là "Tên1, Tên2".
  //    Regex khớp nguyên tên trong danh sách, không ăn nhầm tên con.
  const name = author.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const authorRegex = new RegExp(`(?:^|,\\s*)${name}(?:\\s*,|$)`, "i");

  // Lấy các field cần cho MangaCard
  const mangas = await MangaModel.find(
    { author: authorRegex },
    {
      _id: 1,
      title: 1,
      poster: 1,
      updatedAt: 1,
      createdAt: 1,
      chaptersCount: 1, // nếu schema có
      latestChapterNumber: 1, // nếu schema có
    },
  )
    .sort({ updatedAt: -1 })
    .lean();

  // Chuẩn hoá dữ liệu để MangaCard dùng ngay
  const normalized = (mangas || []).map((m) => ({
    id: m._id.toString(),
    title: m.title,
    poster: m.poster,
    // MangaCard chỉ cần 1 trong các field chap + 1 field thời gian,
    // nên đưa cả 2 biến thể vào để nó tự ưu tiên.
    chaptersCount: m.chaptersCount ?? undefined,
    latestChapterNumber: m.latestChapterNumber ?? undefined,
    updatedAt: m.updatedAt ?? m.createdAt,
  }));

  return {
    author: { name: author.name, slug: author.slug },
    mangas: normalized,
  };
}

export default function AuthorPage() {
  const { author, mangas } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:px-0">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1
          className="text-txt-primary font-sans text-2xl font-semibold sm:text-3xl"
          style={{ textShadow: "0px 0px 4px rgba(182, 25, 255, 0.59)" }}
        >
          Tác giả: <span className="text-txt-focus">{author.name}</span>
        </h1>

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
