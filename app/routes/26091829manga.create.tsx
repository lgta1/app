// app/routes/manga.create.tsx
import { useMemo, useRef, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router-dom";
import { redirect, useActionData, useLoaderData, useNavigation } from "react-router-dom";
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

// ✅ GIỮ LẠI AuthorSelect
import AuthorSelect, { type AuthorLite } from "../components/author-select";

import { Dropdown } from "~/components/dropdown";
import { ImageUploader } from "~/components/image-uploader";
import { MANGA_USER_STATUS } from "~/constants/manga";
import type { GenresType } from "~/database/models/genres.model";
import { UserModel } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors.helper";
import { useFileOperations } from "~/hooks/use-file-operations";

export const meta: MetaFunction = () => {
  return [
    { title: "Đăng Truyện - WW" },
    { name: "description", content: "Đăng truyện mới lên VinaHentai!" },
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
      author: formData.get("author") as string, // giữ contract cũ: chuỗi tên
      keywords: formData.get("keywords") as string,
      userStatus: Number(formData.get("userStatus")),
      poster: formData.get("posterUrl") as string,
      genres: JSON.parse(formData.get("genres") as string),
      translationTeam: userInfo.name,
      ownerId: userInfo.id,
      // authorIds: JSON.parse((formData.get("authorIds") as string) || "[]"), // tương lai dùng
    };

    const manga = await createManga(request, mangaData);

    await UserModel.findByIdAndUpdate(userInfo.id, {
      $inc: { mangasCount: 1 },
    });

    // 👇 BẮT BUỘC trả redirect để SPA điều hướng ngay
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
  { value: MANGA_USER_STATUS.ON_GOING, label: "Đang ra" },
  { value: MANGA_USER_STATUS.COMPLETED, label: "Đã hoàn thành" },
];

interface FormDataShape {
  title: string;
  description: string;
  author: string; // chuỗi tên ghép từ AuthorSelect
  keywords: string;
  userStatus: number;
  genres: string[];
  poster: File | null;
}

export default function CreateStory() {
  const { genres } = useLoaderData<typeof loader>();

  const [formData, setFormData] = useState<FormDataShape>({
    title: "",
    description: "",
    author: "", // sẽ được set từ AuthorSelect
    keywords: "",
    userStatus: MANGA_USER_STATUS.ON_GOING,
    genres: [],
    poster: null,
  });

  // dữ liệu từ AuthorSelect
  const [selectedAuthors, setSelectedAuthors] = useState<AuthorLite[]>([]);
  const [authorOrderIds, setAuthorOrderIds] = useState<string[]>([]);

  const [posterPreview, setPosterPreview] = useState("");
  const [posterUrl, setPosterUrl] = useState(""); // URL sau upload
  const [isUploading, setIsUploading] = useState(false);

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { uploadMultipleFiles } = useFileOperations();

  const formRef = useRef<HTMLFormElement>(null);

  const handleGenreToggle = (genreSlug: string) => {
    setFormData((prev) => ({
      ...prev,
      genres: prev.genres.includes(genreSlug)
        ? prev.genres.filter((g) => g !== genreSlug)
        : [...prev.genres, genreSlug],
    }));
  };

  const handleInputChange = (field: keyof FormDataShape, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ❗️Sửa đúng key userStatus (bản cũ từng set nhầm "status")
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
    setPosterUrl("");
  };

  const handleContinueClick = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (!formData.poster) {
      toast.error("Vui lòng chọn ảnh bìa");
      return;
    }
    if (!formData.author.trim()) {
      toast.error("Vui lòng chọn/nhập tác giả");
      return;
    }

    setIsUploading(true);
    try {
      const [posterData] = await uploadMultipleFiles([
        {
          file: formData.poster,
          options: { prefixPath: "story-images" },
        },
      ]);

      if (!posterData?.url) {
        toast.error("Lỗi khi tải ảnh lên, vui lòng thử lại");
        setIsUploading(false);
        return;
      }

      setPosterUrl(posterData.url);
      setIsUploading(false);

      // Native submit để Router điều hướng theo redirect từ action
      formRef.current?.requestSubmit();
    } catch (error) {
      console.error("Upload error:", error);
      setIsUploading(false);
      toast.error("Lỗi khi tải ảnh lên");
    }
  };

  // BEGIN <feature> GENRES_CREATE_ALL_AZ_SCROLL
  /**
   * Thay thế phân nhóm cũ bằng danh sách phẳng, sort A–Z (fold dấu),
   * hiển thị toàn bộ trong khung cuộn dọc. Không đổi payload submit.
   */
  const fold = (s: string) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();

  const sortedGenres: GenresType[] = useMemo(() => {
    const list = Array.isArray(genres) ? genres.slice() : [];
    const uniq = new Map<string, GenresType>();
    for (const g of list) {
      if (!g?.slug || !g?.name) continue;
      if (!uniq.has(g.slug)) uniq.set(g.slug, g);
    }
    return Array.from(uniq.values()).sort((a, b) => {
      const aa = fold(a.name);
      const bb = fold(b.name);
      if (aa < bb) return -1;
      if (aa > bb) return 1;
      return 0;
    });
  }, [genres]);
  // END <feature> GENRES_CREATE_ALL_AZ_SCROLL

  // actionData sẽ có lỗi (nếu có) sau navigation submit
  const responseData = actionData;

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

      {/* Native form POST để nhận redirect -> điều hướng ngay */}
      <form
        ref={formRef}
        method="post"
        action="/manga/create"
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          // Trường hợp Enter sớm: nếu chưa có posterUrl => chặn và chạy flow upload
          if (!posterUrl) {
            e.preventDefault();
            handleContinueClick();
          }
        }}
      >
        <div className="bg-bgc-layer1 border-bd-default flex flex-col gap-6 rounded-xl border p-4 shadow-lg sm:p-6">
          {/* Error */}
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
                name="title"
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

            {/* BEGIN <feature> GENRES_CREATE_ALL_AZ_SCROLL */}
            <div className="flex w-full flex-col gap-3 sm:w-[680px]">
              <div className="text-txt-secondary text-xs">
                Sắp xếp A–Z. Tích để chọn nhiều thể loại.
              </div>

              <div className="max-h-[360px] overflow-y-auto rounded-lg border border-white/10 p-3 pr-1 [scrollbar-color:rgba(255,255,255,0.3)_transparent] [scrollbar-width:thin]">
                <div className="grid [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))] gap-2">
                  {sortedGenres.map((genre) => {
                    const checked = formData.genres.includes(genre.slug);
                    return (
                      <label
                        key={genre.slug}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 select-none hover:bg-white/5"
                      >
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleGenreToggle(genre.slug)}
                            className="bg-bgc-layer2 border-bd-default checked:bg-lav-500 checked:border-lav-500 h-4 w-4 cursor-pointer appearance-none rounded border"
                          />
                          {checked && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                              <Check className="text-txt-primary h-3 w-3" />
                            </div>
                          )}
                        </div>
                        <span className="text-txt-primary line-clamp-1 font-sans text-xs font-medium">
                          {genre.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* END <feature> GENRES_CREATE_ALL_AZ_SCROLL */}
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
                name="description"
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
                name="keywords"
                value={formData.keywords}
                onChange={(e) => handleInputChange("keywords", e.target.value)}
                placeholder="Mỗi từ khóa cách nhau bằng dấu phẩy"
                className="bg-bgc-layer2 border-bd-default text-txt-secondary focus:border-lav-500 focus:text-txt-primary w-full rounded-xl border px-3 py-2.5 font-sans text-base font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Tác giả — dùng AuthorSelect (giữ contract cũ: author là chuỗi) */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-fit items-center gap-1.5">
              <User className="text-txt-secondary h-4 w-4" />
              <label className="text-txt-primary font-sans text-base font-semibold">
                Tác giả
              </label>
            </div>
            <div className="w-full sm:w-[680px]">
              <AuthorSelect
                placeholder="Thêm tác giả…"
                initialAuthors={[]}
                pinCreateOnTop
                onChange={(authors: AuthorLite[], orderIds: string[]) => {
                  setSelectedAuthors(authors);
                  setAuthorOrderIds(orderIds);
                  const names = authors.map((a) => a.name).join(", ");
                  setFormData((prev) => ({ ...prev, author: names }));
                }}
              />
              <div className="mt-2 text-xs text-gray-500">
                Sẽ lưu: <span className="font-medium">{formData.author || "—"}</span>
              </div>
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

          {/* Hidden inputs: giữ y hệt payload cũ cho action */}
          <input type="hidden" name="userStatus" value={formData.userStatus} />
          <input type="hidden" name="genres" value={JSON.stringify(formData.genres)} />
          <input type="hidden" name="posterUrl" value={posterUrl} />
          {/* Gửi kèm để tương lai back-end xài; hiện tại back-end có thể bỏ qua */}
          <input type="hidden" name="author" value={formData.author} />
          <input type="hidden" name="authorIds" value={JSON.stringify(authorOrderIds)} />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleContinueClick}
            disabled={isSubmitting || isUploading || !formData.title.trim()}
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
