import { NavLink } from "react-router";
import { Eye, Heart, MessageCircle, Star } from "lucide-react";

import type { ChapterType } from "~/database/models/chapter.model";
import type { MangaType } from "~/database/models/manga.model";
import { formatDate, formatTime } from "~/utils/date.utils";

interface MangaDetailProps {
  manga: MangaType;
  chapters: ChapterType[];
}

export function MangaDetail({ manga, chapters }: MangaDetailProps) {
  const {
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
  const reviewCount = 8;

  return (
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
                  <Star key={index} className="h-6 w-6 fill-yellow-400 text-yellow-400" />
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
            <div className="text-txt-focus text-base font-medium">{translationTeam}</div>

            <div className="text-txt-secondary w-28 text-base font-medium">Tác giả:</div>
            <div className="text-txt-primary text-base font-medium">{author}</div>

            <div className="text-txt-secondary w-28 text-base font-medium">Cập nhật:</div>
            <div className="flex items-start gap-2">
              <div className="text-txt-primary text-base font-medium">
                {formatTime(updatedAt)}
              </div>
              <div className="text-txt-primary text-base font-medium">
                {formatDate(updatedAt)}
              </div>
            </div>

            <div className="text-txt-secondary w-28 text-base font-medium">Thể loại:</div>
            <div className="text-txt-focus text-base font-medium">
              {genres.join(", ")}
            </div>

            <div className="text-txt-secondary w-28 text-base font-medium">Lượt xem:</div>
            <div className="text-txt-primary text-base font-medium">
              {viewNumber.toLocaleString()}
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
            {/* Nút Yêu thích */}
            <button className="border-lav-500 text-txt-focus hover:bg-lav-500/10 hidden min-w-32 items-center gap-1.5 rounded-xl border px-4 py-3 shadow-[0px_4px_8.9px_0px_rgba(146,53,190,0.25)] transition-colors md:flex">
              <Heart className="h-5 w-5" />
              <span className="text-sm font-semibold">Yêu thích</span>
            </button>

            {/* Nút Đọc từ đầu */}
            <button className="border-lav-500 text-txt-focus hover:bg-lav-500/10 min-w-32 rounded-xl border px-4 py-3 transition-colors">
              <span className="text-sm font-medium">Đọc từ đầu</span>
            </button>

            {/* Nút Đọc Chap mới */}
            <button className="min-w-32 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 text-black shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-transform hover:scale-105">
              <span className="text-sm font-semibold">Đọc Chap mới</span>
            </button>
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
      <div className="mt-8 flex flex-col gap-6">
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

        {/* Container danh sách */}
        <div className="flex max-h-[304px] flex-col gap-2 overflow-y-scroll rounded-lg md:max-h-[400px] lg:max-h-[492px]">
          {chapters.map((chapter) => (
            <NavLink
              to={`/manga/chapter/${chapter.id}`}
              key={chapter.id}
              className="bg-bgc-layer2 border-bd-default hover:bg-bgc-layer2/80 flex cursor-pointer flex-col items-start gap-4 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between"
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
                      {/* Views */}
                      <div className="flex items-center gap-1 rounded-[32px] backdrop-blur-[3.40px] lg:gap-1.5">
                        <Eye className="text-txt-secondary h-4 w-4 lg:h-6 lg:w-6" />
                        <span className="text-txt-secondary w-8 text-sm font-medium lg:w-10 lg:text-base">
                          {chapter.viewNumber.toLocaleString()}
                        </span>
                      </div>

                      {/* Likes */}
                      <div className="flex items-center gap-1 rounded-[32px] backdrop-blur-[3.40px] lg:gap-1.5">
                        <Heart className="text-txt-secondary h-4 w-4 lg:h-6 lg:w-6" />
                        <span className="text-txt-secondary w-8 text-sm font-medium lg:w-10 lg:text-base">
                          {chapter.likeNumber.toLocaleString()}
                        </span>
                      </div>

                      {/* Comments */}
                      <div className="flex items-center gap-1 rounded-[32px] backdrop-blur-[3.40px] lg:gap-1.5">
                        <MessageCircle className="text-txt-secondary h-4 w-4 lg:h-6 lg:w-6" />
                        <span className="text-txt-secondary w-8 text-sm font-medium lg:w-10 lg:text-base">
                          {chapter.commentNumber.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ngày xuất bản - hiển thị bên phải trên desktop */}
              <div className="hidden items-center gap-4 sm:flex">
                <span className="text-txt-secondary text-sm font-medium lg:text-base">
                  {formatDate(chapter.updatedAt)}
                </span>
              </div>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}
