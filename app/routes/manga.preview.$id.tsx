import toast, { Toaster } from "react-hot-toast";
import { type ClientActionFunctionArgs, Link, useSubmit } from "react-router";
import { Edit, Menu, Plus, Star } from "lucide-react";

import { submitMangaToReview } from "@/mutations/manga.mutation";
import { getChaptersByMangaId } from "@/queries/chapter.query";
import { getMangaByIdAndOwner } from "@/queries/manga.query";
import { requireLogin } from "@/services/auth.server";

import type { Route } from "./+types/manga.$id";

import { CHAPTER_STATUS } from "~/constants/chapter";
import { BusinessError } from "~/helpers/errors.helper";
import { formatDate, formatTime } from "~/utils/date.utils";

export async function loader({ params, request }: Route.LoaderArgs) {
  const { id } = params;
  const user = await requireLogin(request);

  const manga = await getMangaByIdAndOwner(id, user.id);

  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  const chapters = await getChaptersByMangaId(manga.id);

  return {
    manga,
    chapters,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const { id } = params;
    const result = await submitMangaToReview(request, id);

    return Response.json(result);
  } catch (error) {
    if (error instanceof BusinessError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const clientAction = async ({ serverAction }: ClientActionFunctionArgs) => {
  const result = await serverAction<{
    success: boolean;
    message?: string;
    error?: string;
  }>();

  if (result.success) {
    toast.success(result.message || "Nộp truyện thành công!");
  } else {
    toast.error(result.error || "Có lỗi xảy ra khi nộp truyện!");
  }

  return result;
};

export function meta({ data }: Route.MetaArgs) {
  if (!data?.manga) {
    return [
      { title: "Không tìm thấy truyện | WuxiaWorld" },
      { name: "description", content: "Trang truyện không tồn tại" },
    ];
  }

  return [
    { title: `${data.manga.title} | WuxiaWorld` },
    {
      name: "description",
      content: data.manga.description || `Preview ${data.manga.title} tại WuxiaWorld`,
    },
  ];
}

const statuses = {
  [CHAPTER_STATUS.PENDING]: {
    label: "Chờ duyệt",
    text: "text-yellow-300",
    bg: "bg-yellow-300/10",
  },
  [CHAPTER_STATUS.REJECTED]: {
    label: "Bị trả về",
    text: "text-rose-500",
    bg: "bg-rose-500/10",
  },
  [CHAPTER_STATUS.APPROVED]: {
    label: "Đã duyệt",
    text: "text-teal-400",
    bg: "bg-teal-400/10",
  },
};

export default function Index({ loaderData }: Route.ComponentProps) {
  const { manga, chapters } = loaderData;
  const submit = useSubmit();

  const {
    id,
    title,
    poster,
    author,
    genres,
    viewNumber,
    description,
    updatedAt,
    followNumber,
    translationTeam,
  } = manga;

  // Mock data cho demo (sẽ được thay thế bằng dữ liệu thực)
  const rating = 5.0;
  const reviewCount = Math.floor(Math.random() * 100);

  return (
    <div className="container-ad mx-auto px-4 py-6">
      <Toaster position="bottom-right" />
      <div className="w-full">
        <div className="flex flex-col gap-10 lg:flex-row">
          {/* Ảnh bìa */}
          <div className="flex flex-shrink-0 items-center justify-center">
            <img src={poster} alt={title} className="h-96 w-64 rounded-lg object-cover" />
          </div>

          {/* Thông tin chi tiết */}
          <div className="flex w-full flex-col gap-4">
            {/* Tiêu đề và đánh giá */}
            <div className="flex flex-col gap-3">
              <h1 className="text-txt-primary text-2xl leading-loose font-semibold">
                {title}
              </h1>
              <div className="flex items-start gap-3">
                {/* Sao đánh giá */}
                <div className="flex items-center">
                  {[...Array(5)].map((_, index) => (
                    <Star
                      key={index}
                      className="h-6 w-6 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                {/* Điểm và số đánh giá */}
                <div className="flex items-center gap-2">
                  <span className="text-txt-primary text-base font-medium">{rating}</span>
                  <div className="bg-txt-primary h-1 w-1 rounded-full" />
                  <span className="text-txt-primary text-base font-medium">
                    {reviewCount} đánh giá
                  </span>
                </div>
              </div>
            </div>

            {/* Đường phân cách */}
            <div className="border-bd-default h-0 border-t" />

            {/* Thông tin chi tiết */}
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div className="text-txt-secondary w-28 text-base font-medium">
                Nhóm dịch:
              </div>
              <div className="text-txt-focus text-base font-medium">
                {translationTeam}
              </div>

              <div className="text-txt-secondary w-28 text-base font-medium">
                Tác giả:
              </div>
              <div className="text-txt-primary text-base font-medium">{author}</div>

              <div className="text-txt-secondary w-28 text-base font-medium">
                Cập nhật:
              </div>
              <div className="flex items-start gap-2">
                <div className="text-txt-primary text-base font-medium">
                  {formatTime(updatedAt)}
                </div>
                <div className="text-txt-primary text-base font-medium">
                  {formatDate(updatedAt)}
                </div>
              </div>

              <div className="text-txt-secondary w-28 text-base font-medium">
                Thể loại:
              </div>
              <div className="text-txt-focus text-base font-medium">
                {genres.join(", ")}
              </div>

              <div className="text-txt-secondary w-28 text-base font-medium">
                Lượt xem:
              </div>
              <div className="text-txt-primary text-base font-medium">
                {viewNumber?.toLocaleString()}
              </div>

              <div className="text-txt-secondary w-28 text-base font-medium">
                Lượt theo dõi:
              </div>
              <div className="text-txt-primary text-base font-medium">
                {followNumber?.toLocaleString()}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-4">
              <Link to={`/manga/edit/${manga.id}`}>
                <button className="border-lav-500 text-txt-focus hover:bg-lav-500/10 flex min-w-32 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 shadow-[0px_4px_8.9px_0px_rgba(146,53,190,0.25)] transition-colors">
                  <Edit className="h-5 w-5" />
                  <span className="text-sm font-semibold">Sửa</span>
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Phần nội dung */}
        <div className="mt-8 flex flex-col gap-6">
          {/* Tiêu đề nội dung */}
          <div className="border-bd-default flex items-center gap-3 border-b pb-3">
            {/* Icon trang trí */}
            <div className="relative h-[15px] w-[15px]">
              <img
                src="/images/home/star-icon-1.svg"
                alt=""
                className="absolute top-0 left-[4.62px] h-4"
              />
            </div>
            <h2 className="text-txt-primary text-xl font-semibold uppercase">NỘI DUNG</h2>
          </div>

          {/* Nội dung mô tả */}
          <div className="text-txt-primary text-base leading-normal font-medium">
            {description.split("\n").map((paragraph, index) => (
              <p key={index} className={index > 0 ? "mt-4" : ""}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Danh sách chapter */}
        <div className="mt-8 flex flex-col gap-4">
          {/* Header danh sách chương */}
          <div className="border-bd-default flex items-center gap-3 border-b pb-3">
            {/* Icons trang trí */}
            <div className="relative h-[15px] w-[15px]">
              <img
                src="/images/home/star-icon-1.svg"
                alt=""
                className="absolute top-0 left-[4.62px] h-4"
              />
            </div>
            <h2 className="text-txt-primary text-xl font-semibold uppercase">
              DANH SÁCH CHƯƠNG
            </h2>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link to={`/manga/chapter/create/${manga.id}`}>
              <button className="to-btn-primary flex min-w-40 cursor-pointer items-center justify-center gap-1 rounded-xl bg-gradient-to-b from-[#DD94FF] px-4 py-3 text-sm font-semibold text-black">
                <Plus className="h-5 w-5" />
                Thêm chương
              </button>
            </Link>
          </div>

          {/* Container danh sách */}
          <div className="flex max-h-[304px] flex-col gap-2 overflow-y-scroll rounded-lg md:max-h-[400px] lg:max-h-[492px]">
            {chapters.map((chapter) => (
              <Link
                to={`/manga/chapter/${id}?chapterNumber=${chapter.chapterNumber}`}
                key={chapter.id}
                className="bg-bgc-layer2 border-bd-default hover:bg-bgc-layer2/80 flex cursor-pointer flex-row items-center justify-between gap-4 rounded-xl border p-3 transition-colors"
              >
                {/* Layout cho mobile và desktop */}
                <div className="flex w-full items-center justify-between sm:justify-start sm:gap-4">
                  {/* Phần bên trái - thumbnail và thông tin */}
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <img
                      src={chapter.thumbnail}
                      alt={chapter.title}
                      className="h-16 w-32 flex-shrink-0 rounded-lg object-cover"
                    />

                    {/* Thông tin chapter */}
                    <div className="flex flex-col gap-1.5">
                      {/* Tiêu đề */}
                      <h3 className="text-txt-primary text-lg leading-7 font-medium">
                        {chapter.title}
                      </h3>

                      <div className="flex items-center gap-3 lg:gap-5">
                        <div
                          className={`inline-flex items-center justify-center gap-2.5 rounded-[32px] ${statuses[chapter?.status || 0]?.bg} px-2 py-1 backdrop-blur-[3.40px]`}
                        >
                          <div
                            className={`${statuses[chapter?.status || 0]?.text} justify-center text-xs leading-none font-medium`}
                          >
                            {statuses[chapter?.status || 0]?.label}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ngày xuất bản - hiển thị bên phải trên desktop */}
                <div className="items-center gap-4 sm:flex">
                  <Link
                    to={`/manga/chapter/edit/${id}?chapterNumber=${chapter.chapterNumber}`}
                  >
                    <Edit className="text-txt-secondary hover:text-txt-focus mr-2 h-6 w-6" />
                  </Link>
                  <Menu className="text-txt-secondary mr-2 h-6 w-6" />
                </div>
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              className="to-btn-primary flex min-w-40 cursor-pointer items-center justify-center gap-1 rounded-xl bg-gradient-to-b from-[#DD94FF] px-4 py-3 text-sm font-semibold text-black"
              onClick={() => {
                submit(null, {
                  method: "POST",
                });
              }}
            >
              Nộp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
