import { useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import {
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
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

import { createManga } from "@/mutations/manga.mutation";
import { getAllGenres } from "@/queries/genres.query";
import { requireLogin } from "@/services/auth.server";

import { Dropdown } from "~/components/dropdown";
import { ImageUploader } from "~/components/image-uploader";
import { GENRE_CATEGORY } from "~/constants/genres";
import { MANGA_STATUS } from "~/constants/manga";
import type { GenresType } from "~/database/models/genres.model";
import { BusinessError } from "~/helpers/errors.helper";
import { useFileOperations } from "~/hooks/use-file-operations";

export const meta: MetaFunction = () => {
  return [
    { title: "Đăng Truyện - WW" },
    { name: "description", content: "Đăng truyện mới lên WW!" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireLogin(request);
  const genres = await getAllGenres();
  return { genres };
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const userInfo = await requireLogin(request);

    const mangaData = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      author: formData.get("author") as string,
      keywords: formData.get("keywords") as string,
      status: Number(formData.get("status")),
      poster: formData.get("posterUrl") as string,
      genres: JSON.parse(formData.get("genres") as string),
      translationTeam: userInfo.name,
      ownerId: userInfo.id,
    };

    const manga = await createManga(request, mangaData);

    return redirect(`/manga/chapter/create/${manga._id.toString()}`);
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
  { value: MANGA_STATUS.PENDING, label: "Đang cập nhật" },
  { value: MANGA_STATUS.WAITING, label: "Chờ duyệt" },
];

interface FormData {
  title: string;
  description: string;
  author: string;
  keywords: string;
  status: number;
  genres: string[];
  poster: File | null;
}

export default function CreateStory() {
  const { genres } = useLoaderData<typeof loader>();

  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    author: "",
    keywords: "",
    status: MANGA_STATUS.PENDING,
    genres: [],
    poster: null,
  });

  const [posterPreview, setPosterPreview] = useState("");
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
    setFormData((prev) => ({ ...prev, status }));
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

    if (!formData.poster) {
      return;
    }

    setIsUploading(true);

    try {
      const [posterData] = await uploadMultipleFiles([
        {
          file: formData.poster,
          options: { bucket: "story-images", category: "poster" },
        },
      ]);

      if (!posterData?.url) {
        toast.error("Lỗi khi tải ảnh lên, vui lòng thử lại");
        return;
      }

      const submitFormData = new FormData();
      submitFormData.append("title", formData.title);
      submitFormData.append("description", formData.description);
      submitFormData.append("author", formData.author);
      submitFormData.append("keywords", formData.keywords);
      submitFormData.append("status", formData.status.toString());
      submitFormData.append("posterUrl", posterData.url);
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
        Đăng truyện
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
            <div className="flex w-full flex-col items-start gap-9 sm:w-[680px] sm:flex-row">
              {/* Upload area */}
              <div className="h-64 w-44">
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
              <div className="flex h-64 flex-col justify-center gap-4">
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
                value={formData.status}
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
            disabled={
              isSubmitting || isUploading || !formData.poster || !formData.title.trim()
            }
            className="w-full rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 font-sans text-sm font-semibold text-black shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-52"
          >
            {isUploading
              ? "Đang tải ảnh lên..."
              : isSubmitting
                ? "Đang tạo..."
                : "Tiếp tục"}
          </button>
        </div>
      </form>
    </div>
  );
}
