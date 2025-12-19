import { Link, type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router-dom";

import { getAllGenres } from "~/.server/queries/genres.query";
import type { GenresType } from "~/database/models/genres.model";

export const meta: MetaFunction = ({ data }) => {
  const origin = data?.origin ?? "";
  const canonical = origin ? `${origin}/genres` : "/genres";
  return [
    { title: "Tất cả thể loại truyện hentai của Vinahentai" },
    {
      name: "description",
      content:
        "Trang tổng hợp tất cả thể loại truyện hentai của Vinahentai như NTR, MILF, 3D, Doujinshi, ảnh cosplay và nhiều nhánh phụ khác. Mỗi thể loại dẫn tới danh sách truyện riêng được cập nhật thường xuyên, giúp bạn nhanh chóng tìm đúng nội dung hợp gu mà không phải dò tìm từng trang lẻ.",
    },
    { tagName: "link", rel: "canonical", href: canonical },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const genres = await getAllGenres();
  const sortedGenres = (genres || []).sort((a, b) => a.name.localeCompare(b.name, "vi"));

  const url = new URL(request.url);
  return Response.json({ genres: sortedGenres, origin: url.origin });
}

export default function GenresIndex() {
  const { genres } = useLoaderData<{ genres: GenresType[] }>();

  return (
    <div className="container-page mx-auto px-4 py-10">
      <div className="max-w-3xl space-y-4">
        <h1 className="text-txt-primary text-4xl font-semibold leading-tight">Tất cả thể loại truyện Hentai</h1>
        <div className="h-1 w-28 rounded-full bg-gradient-to-r from-lav-600 to-lav-500" />
        <p className="rounded-2xl border border-white/5 bg-bgc-layer2/60 p-4 text-sm leading-relaxed text-txt-secondary">
          <strong className="text-txt-primary">Cảnh báo 18+:</strong> Đây là trang web 18+, nghiêm cấm người dưới 18 tuổi truy cập.
        </p>
        <p className="text-base leading-relaxed text-txt-secondary">
          Trang trụ cột tập hợp các thể loại hentai/18+ phổ biến: NTR, MILF, 3D, Doujinshi, ảnh cosplay, học đường,
          giả tưởng, hardcore nhẹ đến nặng và nhiều nhánh phụ khác. Mỗi thể loại có kho truyện riêng được kiểm duyệt,
          cập nhật thường xuyên, giúp bạn định hướng nhanh và chuyển trang đúng gu mà không phải dò tìm từng danh sách lẻ.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
          <Link
            to="/danh-sach"
            className="rounded-full border border-white/10 bg-bgc-layer2/80 px-4 py-2 text-txt-primary transition hover:-translate-y-0.5 hover:border-lav-500 hover:text-white"
          >
            Danh sách truyện
          </Link>
          <Link
            to="/leaderboard/manga"
            className="rounded-full border border-white/10 bg-bgc-layer2/80 px-4 py-2 text-txt-primary transition hover:-translate-y-0.5 hover:border-lav-500 hover:text-white"
          >
            Bảng xếp hạng manga
          </Link>
        </div>
      </div>

      <div className="mt-8">
        {genres.length === 0 ? (
          <p className="text-txt-secondary">Chưa có thể loại nào được công bố. Vui lòng quay lại sau.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {genres.map((genre) => (
              <Link
                key={genre.slug}
                to={`/genres/${genre.slug}`}
                className="group rounded-2xl border border-white/5 bg-bgc-layer2/80 p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-lav-500 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-txt-primary text-lg font-semibold group-hover:text-white">{genre.name}</div>
                  <span className="text-xs uppercase tracking-wide text-lav-500 group-hover:text-white">Xem</span>
                </div>
                {genre.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-txt-secondary">{genre.description}</p>
                ) : (
                  <p className="mt-2 text-xs text-txt-secondary">Khám phá truyện thuộc thể loại này.</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
