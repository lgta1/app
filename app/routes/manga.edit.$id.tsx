import { useState } from "react";
import { Toaster } from "react-hot-toast";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import {
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import {
  Book,
  Check,
  FileText,
  Image as ImageIcon,
  Settings,
  Tag,
  User,
} from "lucide-react";

import { updateManga } from "@/mutations/manga.mutation";
import { getAllGenres } from "@/queries/genres.query";
import { getMangaByIdAndOwner } from "@/queries/manga.query";
import { requireLogin } from "@/services/auth.server";

import { Dropdown } from "~/components/dropdown";
import { ImageUploader } from "~/components/image-uploader";
import { GENRE_CATEGORY } from "~/constants/genres";
import { MANGA_USER_STATUS } from "~/constants/manga";
import type { GenresType } from "~/database/models/genres.model";
import type { MangaType } from "~/database/models/manga.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";
import { useFileOperations } from "~/hooks/use-file-operations";

export const meta: MetaFunction = () => {
  return [
    { title: "Chỉnh sửa Truyện - WW" },
    { name: "description", content: "Chỉnh sửa truyện trên WW!" },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userInfo = await requireLogin(request);
  const genres = await getAllGenres();
  const manga = await getMangaByIdAndOwner(
    params.id || "",
    userInfo.id,
    isAdmin(userInfo.role),
  );

  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  return { genres, manga };
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const userInfo = await requireLogin(request);
    const formData = await request.formData();

    const url = new URL(request.url);
    const newParam = url.searchParams.get("new");

    const mangaData: Partial<MangaType> = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      author: formData.get("author") as string,
      keywords: formData.get("keywords") as string,
      userStatus: Number(formData.get("userStatus")),
      genres: JSON.parse(formData.get("genres") as string),
      translationTeam: userInfo.name,
    };

    // Chỉ update poster nếu có upload ảnh mới
    const posterUrl = formData.get("posterUrl");
    if (posterUrl) {
      mangaData.poster = posterUrl as string;
    }

    await updateManga(request, params.id || "", mangaData);

    if (newParam === "true") {
      return redirect(`/manga/chapter/create/${params.id}`);
    }

    return redirect(`/manga/preview/${params.id}`);
  } catch (error) {
    if (error instanceof BusinessError) {
      return {
        success: false,
        error: { message: error.message },
      };
    }
    return {
      success: false,
      error: { message: "Có lỗi xảy ra, vui lòng thử lại" },
    };
  }
}

const STATUS_OPTIONS = [
  { value: MANGA_USER_STATUS.ON_GOING, label: "Đang ra" },
  { value: MANGA_USER_STATUS.COMPLETED, label: "Đã hoàn thành" },
];

interface FormData {
  title: string;
  description: string;
  author: string;
  keywords: string;
  userStatus: number;
  genres: string[];
  poster: File | null;
}

export default function EditStory() {
  const [searchParams] = useSearchParams();
  const newParam = searchParams.get("new");

  const { genres, manga } = useLoaderData<typeof loader>();

  const [formData, setFormData] = useState<FormData>({
    title: manga.title,
    description: manga.description,
    author: manga.author,
    keywords: manga.keywords || "",
    userStatus: manga.status,
    genres: manga.genres,
    poster: null,
  });

  const [posterPreview, setPosterPreview] = useState(manga.poster);
  const [isUploading, setIsUploading] = useState(false);

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const fetcher = useFetcher<typeof action>();
  const isSubmitting =
    navigation.state === "submitting" || fetcher.state === "submitting";
  const { uploadMultipleFiles } = useFileOperations();

  // Phân loại genres theo category
  const popularGenres = genres.filter(
    (genre: GenresType) => genre.category === GENRE_CATEGORY.MOST_VIEWED,
  );

  const otherGenres = genres.filter(
    (genre: GenresType) => genre.category === GENRE_CATEGORY.OTHER,
  );

  const hardcoreGenres = genres.filter(
    (genre: GenresType) => genre.category === GENRE_CATEGORY.HARDCORE,
  );

  const handleGenreToggle = (genreSlug: string) => {
    setFormData((prev) => ({
      ...prev,
      genres: prev.genres.includes(genreSlug)
        ? prev.genres.filter((g) => g !== genreSlug)
        : [...prev.genres, genreSlug],
    }));
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStatusSelect = (status: number) => {
    setFormData((prev) => ({ ...prev, userStatus: status }));
  };

  const handleFileSelect = (file: File) => {
    setFormData((prev) => ({ ...prev, poster: file }));
    const reader = new FileReader();
    reader.onload = (event) => {
      setPosterPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearPosterImage = () => {
    setFormData((prev) => ({ ...prev, poster: null }));
    setPosterPreview("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    let posterData = null;
    try {
      if (formData.poster) {
        [posterData] = await uploadMultipleFiles([
          {
            file: formData.poster,
            options: { bucket: "story-images", category: "poster" },
          },
        ]);
      }

      setIsUploading(true);

      const submitFormData = new FormData();
      submitFormData.append("title", formData.title);
      submitFormData.append("description", formData.description);
      submitFormData.append("author", formData.author);
      submitFormData.append("keywords", formData.keywords);
      submitFormData.append("userStatus", formData.userStatus.toString());
      submitFormData.append("posterUrl", posterData?.url || "");
      submitFormData.append("genres", JSON.stringify(formData.genres));

      setIsUploading(false);
      fetcher.submit(submitFormData, { method: "post" });
    } catch (error) {
      console.error("Upload error:", error);
      setIsUploading(false);
    }
  };

  const renderGenreSection = (
    title: string,
    genreList: GenresType[],
    titleColor: string = "text-txt-focus",
  ) => {
    if (genreList.length === 0) return null;

    return (
      <div className="flex flex-col gap-4">
        <h3 className={`${titleColor} font-sans text-base font-semibold`}>{title}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {genreList.map((genre: GenresType) => (
            <div key={genre.slug} className="flex items-center gap-2 py-1">
              <label className="flex cursor-pointer items-center gap-2">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.genres.includes(genre.slug)}
                    onChange={() => handleGenreToggle(genre.slug)}
                    className="bg-bgc-layer2 border-bd-default checked:bg-lav-500 checked:border-lav-500 h-4 w-4 cursor-pointer appearance-none rounded border"
                  />
                  {formData.genres.includes(genre.slug) && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <Check className="text-txt-primary h-3 w-3" />
                    </div>
                  )}
                </div>
                <span className="text-txt-primary font-sans text-xs font-medium">
                  {genre.name}
                </span>
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Sử dụng data từ fetcher nếu có, nếu không thì dùng actionData
  const responseData = fetcher.data || actionData;

  return (
    <div className="mx-auto flex w-full max-w-[950px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-0">
      <Toaster position="bottom-right" />

      {/* Header */}
      <h1
        className="text-txt-primary font-sans text-2xl leading-9 font-semibold sm:text-3xl"
        style={{ textShadow: "0px 0px 4px rgba(182, 25, 255, 0.59)" }}
      >
        Chỉnh sửa truyện
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Main Form */}
        <div className="bg-bgc-layer1 border-bd-default flex flex-col gap-6 rounded-xl border p-4 shadow-lg sm:p-6">
          {/* Error/Success Message */}
          {responseData?.error && (
            <div className="w-full rounded bg-red-500/10 p-3 text-sm font-medium text-red-500">
              {responseData.error.message}
            </div>
          )}

          {/* Tên truyện */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-fit items-center gap-1.5">
              <Book className="text-txt-secondary h-4 w-4" />
              <label className="text-txt-primary font-sans text-base font-semibold">
                Tên truyện
              </label>
            </div>
            <div className="w-full sm:w-[680px]">
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Viết hoa ký tự đầu tiên mỗi từ"
                className="bg-bgc-layer2 border-bd-default text-txt-secondary focus:border-lav-500 focus:text-txt-primary w-full rounded-xl border px-3 py-2.5 font-sans text-base font-medium focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Thể loại */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <div className="flex min-w-fit items-center gap-1.5 sm:items-start">
              <Tag className="text-txt-secondary mt-0.5 h-4 w-4" />
              <label className="text-txt-primary font-sans text-base font-semibold">
                Thể loại
              </label>
            </div>
            <div className="flex w-full flex-col gap-5 sm:w-[680px]">
              {/* Đọc nhiều nhất */}
              {renderGenreSection("Đọc nhiều nhất", popularGenres)}

              {/* Thể loại khác */}
              {renderGenreSection("Thể loại khác", otherGenres)}

              {/* Hardcore */}
              {renderGenreSection("Hardcore", hardcoreGenres, "text-error-error")}
            </div>
          </div>

          {/* Giới thiệu */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <div className="flex min-w-fit items-center gap-1.5 sm:items-start">
              <FileText className="text-txt-secondary mt-0.5 h-4 w-4" />
              <label className="text-txt-primary font-sans text-base font-semibold">
                Giới thiệu
              </label>
            </div>
            <div className="w-full sm:w-[680px]">
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Nhập nội dung giới thiệu"
                rows={8}
                className="bg-bgc-layer2 border-bd-default text-txt-secondary focus:border-lav-500 focus:text-txt-primary w-full resize-none rounded-xl border px-3 py-2.5 font-sans text-base font-medium focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Ảnh bìa */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <div className="flex min-w-fit items-center gap-1.5 sm:items-start">
              <ImageIcon className="text-txt-secondary mt-0.5 h-4 w-4" />
              <label className="text-txt-primary font-sans text-base font-semibold">
                Ảnh bìa
              </label>
            </div>
            <div className="flex w-full flex-row items-start gap-4 sm:w-[680px] sm:gap-9">
              {/* Upload area */}
              <div className="min-h-64 min-w-44">
                <ImageUploader
                  onFileSelect={handleFileSelect}
                  onClear={clearPosterImage}
                  preview={posterPreview}
                  uploadText="Tải ảnh lên"
                  required
                  aspectRatio="poster"
                />
              </div>

              {/* Upload info */}
              <div className="flex h-64 flex-col justify-center gap-4 p-4">
                <p className="text-txt-secondary font-sans text-base font-medium">
                  1. Ảnh có tỷ lệ 3:4
                </p>
                <p className="text-txt-secondary font-sans text-base font-medium">
                  2. Ảnh có kích thước dưới 1MB
                </p>
              </div>
            </div>
          </div>

          {/* Từ khóa */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-fit items-center gap-1.5">
              <Book className="text-txt-secondary h-4 w-4" />
              <label className="text-txt-primary font-sans text-base font-semibold">
                Từ khóa
              </label>
            </div>
            <div className="w-full sm:w-[680px]">
              <input
                type="text"
                value={formData.keywords}
                onChange={(e) => handleInputChange("keywords", e.target.value)}
                placeholder="Mỗi từ khóa cách nhau bằng dấu phẩy"
                className="bg-bgc-layer2 border-bd-default text-txt-secondary focus:border-lav-500 focus:text-txt-primary w-full rounded-xl border px-3 py-2.5 font-sans text-base font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Tác giả */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-fit items-center gap-1.5">
              <User className="text-txt-secondary h-4 w-4" />
              <label className="text-txt-primary font-sans text-base font-semibold">
                Tác giả
              </label>
            </div>
            <div className="w-full sm:w-[680px]">
              <input
                type="text"
                value={formData.author}
                onChange={(e) => handleInputChange("author", e.target.value)}
                placeholder="Viết hoa ký tự đầu tiên mỗi từ"
                className="bg-bgc-layer2 border-bd-default text-txt-secondary focus:border-lav-500 focus:text-txt-primary w-full rounded-xl border px-3 py-2.5 font-sans text-base font-medium focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Trạng thái */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-fit items-center gap-1.5">
              <Settings className="text-txt-secondary h-4 w-4" />
              <label className="text-txt-primary font-sans text-base font-semibold">
                Trạng thái
              </label>
            </div>
            <div className="w-full sm:w-[680px]">
              <Dropdown
                options={STATUS_OPTIONS}
                value={formData.userStatus}
                placeholder="Chọn trạng thái"
                onSelect={handleStatusSelect}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || isUploading || !formData.title.trim()}
            className="w-full rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 font-sans text-sm font-semibold text-black shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-52"
          >
            {isUploading
              ? "Đang tải ảnh lên..."
              : isSubmitting
                ? "Đang lưu..."
                : newParam === "true"
                  ? "Tiếp tục"
                  : "Lưu lại"}
          </button>
        </div>
      </form>
    </div>
  );
}
