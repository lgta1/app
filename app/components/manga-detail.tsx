import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { Copy, Eye, Heart, Star, StarOff } from "lucide-react";

import { MANGA_USER_STATUS } from "~/constants/manga";
import type { ChapterType } from "~/database/models/chapter.model";
import type { MangaType } from "~/database/models/manga.model";
import { formatDate, formatTime } from "~/utils/date.utils";
import { toSlug } from "~/utils/slug.utils"; // dùng để tạo slug

interface MangaDetailProps {
  manga: MangaType;
  chapters: ChapterType[];
}

/* ===================== BEGIN <feature> CHIP_STYLES_SURFACE_BLEND ===================== */
/**
 * Mục tiêu: chip hoà vào nền (dark surface) thay vì tách khối đen.
 * - surfaceBlend: dùng cho "Người đăng" (ưu tiên nhẹ, không át CTA)
 * - brandTint: tím trong suốt cho "Tác giả" (nhấn nhận diện)
 * - outlineSubtle: viền mờ cho "Thể loại" (secondary)
 * Tất cả đều có border subtle + hover tăng mờ/sáng rất nhẹ để hợp theme.
 */
const chipBase =
  "inline-flex items-center gap-1.5 rounded-full h-8 px-3 text-sm whitespace-nowrap max-w-[180px] truncate select-none transition-colors transition-shadow";

const chipVariants = {
  /** Hoà nền: bề mặt tối + border subtle + text trắng 90% */
  surfaceBlend:
    `${chipBase} bg-white/5 border border-white/8 text-white/90 ` +
    `hover:bg-white/8 hover:border-white/12 ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/35`,

  /** Tím trong suốt: tạo điểm nhấn nhẹ cho "Tác giả" */
  brandTint:
    `${chipBase} bg-[rgba(211,115,255,.10)] border border-[rgba(211,115,255,.22)] text-[#EBD7FF] ` +
    `hover:bg-[rgba(211,115,255,.14)] hover:border-[rgba(211,115,255,.28)] ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/45`,

  /** Viền mờ: dành cho "Thể loại", không chiếm nổi bật */
  outlineSubtle:
    `${chipBase} border border-white/10 text-[#EBD7FF]/90 hover:border-[#D373FF]/35 hover:bg-white/[.04] ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D373FF]/30`,
};
/* ====================== END <feature> CHIP_STYLES_SURFACE_BLEND ====================== */

export function MangaDetail({ manga, chapters }: MangaDetailProps) {
  const {
    id,
    code,
    title,
    poster,
    author,
    genres,
    viewNumber,
    description,
    updatedAt,
    followNumber,
    translationTeam,
    userStatus,
    ownerId,
  } = manga;
  // === Hiển thị mô tả: chỉ render khi khác "..." và không rỗng ===
  const safeDesc = typeof description === "string" ? description.trim() : "";
  const shouldShowDesc = !!(safeDesc && safeDesc !== "...");


  const [isFollowing, setIsFollowing] = useState(false);
  const [followCount, setFollowCount] = useState(followNumber || 0);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);

  const [isLiked, setIsLiked] = useState(false);
  const [isLoadingLike, setIsLoadingLike] = useState(false);

  const [hasRated, setHasRated] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingAverage, setRatingAverage] = useState(manga.ratingAverage || 0);
  const [ratingCount, setRatingCount] = useState(manga.ratingCount || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isLoadingRating, setIsLoadingRating] = useState(false);

  // Lấy chương mới nhất để dùng cho "Đọc Chap mới"
  const latestChapterNumber =
    chapters && chapters.length
      ? Math.max(...chapters.map((c) => Number(c.chapterNumber) || 0))
      : 1;

  const getStatusText = (status: number) => {
    switch (status) {
      case MANGA_USER_STATUS.ON_GOING:
        return "Đang ra";
      case MANGA_USER_STATUS.COMPLETED:
        return "Đã hoàn thành";
      default:
        return "Đang ra";
    }
  };

  const handleCopyCode = async () => {
    if (code) {
      try {
        await navigator.clipboard.writeText(code.toString());
        toast.success("Đã copy mã truyện!");
      } catch (error) {
        console.error("Error copying to clipboard:", error);
        toast.error("Không thể copy mã truyện");
      }
    }
  };

  useEffect(() => {
    const checkFollowStatus = async () => {
      try {
        const response = await fetch(`/api/manga-follow?mangaId=${id}`);
        const data = await response.json();
        if (response.ok) setIsFollowing(data.isFollowing);
      } catch (error) {
        console.error("Error checking follow status:", error);
      }
    };

    const checkLikeStatus = async () => {
      try {
        const response = await fetch(`/api/manga-like?mangaId=${id}`);
        const data = await response.json();
        if (response.ok) setIsLiked(data.isLiked);
      } catch (error) {
        console.error("Error checking like status:", error);
      }
    };

    const checkRatingStatus = async () => {
      try {
        const response = await fetch(`/api/manga-rating?mangaId=${id}`);
        const data = await response.json();
        if (response.ok) {
          setHasRated(data.hasRated);
          setUserRating(data.userRating);
          setRatingAverage(data.ratingAverage);
          setRatingCount(data.ratingCount);
        }
      } catch (error) {
        console.error("Error checking rating status:", error);
      }
    };

    checkFollowStatus();
    checkLikeStatus();
    checkRatingStatus();
  }, [id]);

  const handleFollowToggle = async () => {
    if (isLoadingFollow) return;
    setIsLoadingFollow(true);

    const formData = new FormData();
    formData.append("intent", isFollowing ? "unfollow" : "follow");
    formData.append("mangaId", id);

    try {
      const response = await fetch("/api/manga-follow", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setIsFollowing(data.isFollowing);
        setFollowCount((prev) => prev + (data.isFollowing ? 1 : -1));
        toast.success(data.message);
      } else {
        toast.error(data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast.error("Có lỗi xảy ra khi xử lý yêu cầu");
    } finally {
      setIsLoadingFollow(false);
    }
  };

  const handleLikeToggle = async () => {
    if (isLoadingLike) return;
    setIsLoadingLike(true);

    const formData = new FormData();
    formData.append("intent", isLiked ? "unlike" : "like");
    formData.append("mangaId", id);

    try {
      const response = await fetch("/api/manga-like", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setIsLiked(data.isLiked);
        toast.success(data.message);
      } else {
        toast.error(data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Có lỗi xảy ra khi xử lý yêu cầu");
    } finally {
      setIsLoadingLike(false);
    }
  };

  const handleRating = async (rating: number) => {
    if (hasRated || isLoadingRating) return;
    const confirmed = window.confirm(
      `Bạn có chắc muốn đánh giá ${rating} sao cho manga này? Bạn sẽ không thể thay đổi sau khi đánh giá.`,
    );
    if (!confirmed) return;

    setIsLoadingRating(true);

    const formData = new FormData();
    formData.append("mangaId", id);
    formData.append("rating", rating.toString());

    try {
      const response = await fetch("/api/manga-rating", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setHasRated(true);
        setUserRating(rating);
        setRatingAverage(data.ratingAverage);
        setRatingCount(data.ratingCount);
        toast.success(data.message);
      } else {
        toast.error(data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      console.error("Error rating manga:", error);
      toast.error("Có lỗi xảy ra khi đánh giá");
    } finally {
      setIsLoadingRating(false);
    }
  };

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
              <div className="flex items-center">
                {[...Array(5)].map((_, index) => {
                  const starValue = index + 1;
                  const isActive = hasRated
                    ? starValue <= (userRating || 0)
                    : hoverRating
                      ? starValue <= hoverRating
                      : starValue <= Math.floor(ratingAverage);

                  return (
                    <Star
                      key={index}
                      className={`h-6 w-6 transition-colors ${
                        hasRated ? "cursor-not-allowed" : "cursor-pointer hover:scale-110"
                      } ${
                        isActive
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-transparent text-gray-300"
                      }`}
                      onClick={() => !hasRated && handleRating(starValue)}
                      onMouseEnter={() => !hasRated && setHoverRating(starValue)}
                      onMouseLeave={() => !hasRated && setHoverRating(0)}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-txt-primary text-base font-medium">
                  {ratingAverage > 0 ? ratingAverage.toFixed(1) : "0.0"}
                </span>
                <div className="bg-txt-primary h-1 w-1 rounded-full" />
                <span className="text-txt-primary text-base font-medium">
                  {ratingCount} đánh giá
                </span>
              </div>
            </div>
          </div>

          <div className="border-bd-default h-0 border-t" />

          {/* Thông tin chi tiết */}
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div className="text-txt-secondary w-28 text-base font-medium">Code:</div>
            <div className="flex items-center gap-2">
              <span className="text-txt-primary text-base font-medium">
                {code || "Chưa có"}
              </span>
              {code && (
                <button
                  onClick={handleCopyCode}
                  className="hover:bg-bgc-layer2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
                  title="Copy mã truyện"
                >
                  <Copy className="text-txt-secondary h-4 w-4" />
                </button>
              )}
            </div>

            <div className="text-txt-secondary w-28 text-base font-medium">
              Tình trạng:
            </div>
            <div className="text-txt-primary text-base font-medium">
              {getStatusText(userStatus)}
            </div>

            <div className="text-txt-secondary w-28 text-base font-medium">
              Người đăng:
            </div>
            {/* BEGIN <feature> UPLOADER_CHIP_SURFACE_BLEND_NO_STRETCH */}
            <Link
              to={`/profile/${ownerId}`}
              className={`${chipVariants.surfaceBlend} w-fit justify-self-start`}
              title={translationTeam}
            >
              <span className="capitalize">{String(translationTeam || "")}</span>
            </Link>
            {/* END <feature> UPLOADER_CHIP_SURFACE_BLEND_NO_STRETCH */}

            <div className="text-txt-secondary w-28 text-base font-medium">Tác giả/Dịch giả:</div>
            {/* BEGIN <feature> AUTHORS_CHIP_BRAND_TINT_NO_STRETCH */}
            <div className="flex flex-wrap gap-2 justify-self-start">
              {String(author || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((name) => {
                  const slug = toSlug(name);
                  return (
                    <Link
                      key={slug}
                      to={`/authors/${slug}`}
                      className={chipVariants.brandTint + " w-fit"}
                      title={name}
                    >
                      <span className="capitalize">{name}</span>
                    </Link>
                  );
                })}
            </div>
            {/* END <feature> AUTHORS_CHIP_BRAND_TINT_NO_STRETCH */}

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
            {/* BEGIN <feature> GENRES_CHIP_OUTLINE_SUBTLE_NO_STRETCH */}
            <div className="flex flex-wrap gap-2 justify-self-start">
              {Array.isArray(genres) && genres.length > 0
                ? genres.map((g, idx) => {
                    const label = String(g);
                    const slug = toSlug(label);
                    return (
                      <Link
                        key={`${slug}-${idx}`}
                        to={`/genres/${slug}`}
                        prefetch="intent"
                        className={chipVariants.outlineSubtle + " w-fit"}
                        title={label}
                      >
                        <span className="capitalize">{label}</span>
                      </Link>
                    );
                  })
                : null}
            </div>
            {/* END <feature> GENRES_CHIP_OUTLINE_SUBTLE_NO_STRETCH */}

            <div className="text-txt-secondary w-28 text-base font-medium">Lượt xem:</div>
            <div className="text-txt-primary text-base font-medium">
              {viewNumber?.toLocaleString()}
            </div>

            <div className="text-txt-secondary w-28 text-base font-medium">
              Lượt theo dõi:
            </div>
            <div className="text-txt-primary text-base font-medium">
              {followCount?.toLocaleString()}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <button
              onClick={handleLikeToggle}
              disabled={isLoadingLike}
              className={`border-lav-500 text-txt-focus hover:bg-lav-500/10 flex min-w-32 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-3 shadow-[0px_4px_8.9px_0px_rgba(146,53,190,0.25)] transition-colors ${isLoadingLike ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <Heart
                className={`h-5 w-5 ${isLiked ? "fill-txt-focus text-txt-focus" : ""}`}
              />
              <span className="text-sm font-semibold">
                {isLiked ? "Đã thích" : "Yêu thích"}
              </span>
            </button>

            <button
              onClick={handleFollowToggle}
              disabled={isLoadingFollow}
              className={`border-lav-500 text-txt-focus hover:bg-lav-500/10 flex min-w-32 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-3 shadow-[0px_4px_8.9px_0px_rgba(146,53,190,0.25)] transition-colors ${isLoadingFollow ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {isFollowing ? (
                <StarOff className="h-5 w-5" />
              ) : (
                <Star className="h-5 w-5" />
              )}
              <span className="text-sm font-semibold">
                {isFollowing ? "Bỏ theo dõi" : "Theo dõi"}
              </span>
            </button>

            <Link
              to={`/manga/chapter/${id}?chapterNumber=1`}
              className="border-lav-500 text-txt-focus hover:bg-lav-500/10 flex min-w-32 cursor-pointer justify-center rounded-xl border px-4 py-3 transition-colors"
            >
              <span className="text-sm font-medium">Đọc từ đầu</span>
            </Link>

            {/* luôn trỏ tới chương mới nhất */}
            <Link
              to={`/manga/chapter/${id}?chapterNumber=${latestChapterNumber}`}
              className="flex min-w-32 cursor-pointer justify-center rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 text-black shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-transform hover:scale-105"
            >
              <span className="text-sm font-semibold">Đọc Chap mới</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Phần nội dung */}
      {shouldShowDesc && (
        <div className="mt-8 flex flex-col gap-6">
          <div className="border-bd-default flex items-center gap-3 border-b pb-3">
            <div className="relative h-[15px] w-[15px]">
              <img
                src="/images/icons/multi-star.svg"
                alt=""
                className="absolute top-0 left-[4.62px] h-4"
              />
            </div>
          </div>

          <div className="text-txt-primary text-base leading-normal font-medium">
            {safeDesc.split("\n").map((paragraph, index) => (
              <p key={index} className={index > 0 ? "mt-4" : ""}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Danh sách chapter */}
      <div className="mt-8 flex flex-col gap-6">
        <div className="border-bd-default flex items-center gap-3 border-b pb-3">
          <div className="relative h-[15px] w-[15px]">
            <img
              src="/images/icons/multi-star.svg"
              alt=""
              className="absolute top-0 left-[4.62px] h-4"
            />
          </div>
          <h2 className="text-txt-primary text-xl font-semibold uppercase">
            DANH SÁCH CHƯƠNG
          </h2>
        </div>

        <div className="flex max-h-[304px] flex-col gap-2 overflow-y-auto rounded-lg md:max-h-[400px] lg:max-h-[492px]">
          {chapters.map((chapter) => (
            <Link
              to={`/manga/chapter/${id}?chapterNumber=${chapter.chapterNumber}`}
              key={chapter.id}
              className="bg-bgc-layer1 border-bd-default flex items-center justify-between rounded-xl border px-4 py-2 transition-colors hover:bg-white/5"
            >
              <span className="text-txt-primary text-base font-medium">
                Chương {chapter.chapterNumber}
              </span>
              <div className="flex items-center gap-6">
                <span className="text-txt-secondary flex items-center gap-1 text-sm">
                  <Eye className="h-4 w-4" />
                  {chapter.viewNumber?.toLocaleString() ?? 0}
                </span>
                <span className="text-txt-secondary text-sm">
                  {formatDate(chapter.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MangaDetail;
