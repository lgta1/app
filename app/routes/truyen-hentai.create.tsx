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
  Clock,
} from "lucide-react";

import { createManga } from "@/mutations/manga.mutation";
import { MangaModel } from "~/database/models/manga.model";
import { getAllGenres } from "@/queries/genres.query";
import { requireLogin } from "@/services/auth.server";
import { isAdmin } from "~/helpers/user.helper";

// ✅ GIỮ LẠI AuthorSelect
import AuthorSelect, { type AuthorLite } from "../components/author-select";
import DoujinshiSelect from "../components/doujinshi-select";
import TranslatorSelect from "../components/translator-select";
import CharacterSelect from "../components/character-select";

import { Dropdown } from "~/components/dropdown";
import { ImageUploader } from "~/components/image-uploader";
import { GenreGridPicker } from "~/components/genre-grid-picker";
import { MANGA_CONTENT_TYPE, MANGA_USER_STATUS } from "~/constants/manga";
import type { GenresType } from "~/database/models/genres.model";
import { UserModel } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors.helper";
import { useFileOperations } from "~/hooks/use-file-operations";
import { normalizePosterImage } from "~/utils/image-compression.utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Đăng Truyện - WW" },
    { name: "description", content: "Đăng truyện mới lên VinaHentai!" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const userInfo = await requireLogin(request);
  const genres = await getAllGenres();
  return { genres, isAdmin: isAdmin(userInfo.role) };
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const userInfo = await requireLogin(request);
    const isCosplay = formData.get("isCosplay") === "1";

    // BEGIN <feature> MANGACREATE_DESCRIPTION_FALLBACK
    // Cho phép mô tả trống: fallback "..." để downstream luôn có chuỗi an toàn
    const rawDescription = formData.get("description");
    const safeDescription =
      typeof rawDescription === "string" && rawDescription.trim()
        ? rawDescription
        : "...";
    // END <feature> MANGACREATE_DESCRIPTION_FALLBACK

    const mangaData = {
      title: formData.get("title") as string,
      description: safeDescription, // <- dùng fallback
      alternateTitle: formData.get("alternateTitle") as string || "",
      author: formData.get("author") as string, // giữ contract cũ: chuỗi tên
      authorNames: JSON.parse((formData.get("authorNames") as string) || "[]"),
      authorSlugs: JSON.parse((formData.get("authorSlugs") as string) || "[]"),
      keywords: formData.get("keywords") as string,
      userStatus: Number(formData.get("userStatus")),
      poster: formData.get("posterUrl") as string,
      genres: JSON.parse(formData.get("genres") as string),
      contentType: isCosplay ? MANGA_CONTENT_TYPE.COSPLAY : MANGA_CONTENT_TYPE.MANGA,
      // Optional denormalized relations
      doujinshiNames: JSON.parse((formData.get("doujinshiNames") as string) || "[]"),
      doujinshiSlugs: JSON.parse((formData.get("doujinshiSlugs") as string) || "[]"),
      translatorNames: JSON.parse((formData.get("translatorNames") as string) || "[]"),
      translatorSlugs: JSON.parse((formData.get("translatorSlugs") as string) || "[]"),
      characterNames: JSON.parse((formData.get("characterNames") as string) || "[]"),
      characterSlugs: JSON.parse((formData.get("characterSlugs") as string) || "[]"),
      translationTeam: userInfo.name,
      ownerId: userInfo.id,
      // authorIds: JSON.parse((formData.get("authorIds") as string) || "[]"), // tương lai dùng
    };

    const manga = await createManga(request, mangaData);

    // Admin override updatedAt (backfill support without schema change)
    const overrideUpdatedAt = formData.get("overrideUpdatedAt");
    if (isAdmin(userInfo.role) && typeof overrideUpdatedAt === "string" && overrideUpdatedAt.trim()) {
      const d = new Date(overrideUpdatedAt.trim());
      if (!isNaN(d.getTime())) {
        // Manual update without triggering timestamps
        await MangaModel.findByIdAndUpdate(manga._id, { updatedAt: d }, { timestamps: false });
      }
    }

    await UserModel.findByIdAndUpdate(userInfo.id, {
      $inc: { mangasCount: 1 },
    });

  // 👇 Sau khi tạo truyện lần đầu: điều hướng tới trang cảm ơn/success
  // Nút "Tiếp tục" trên đó sẽ dẫn tới /truyen-hentai/manage thay vì trang tạo chapter.
  const nextHandle = manga.slug || manga._id?.toString();
  return redirect(`/truyen-hentai/uploaded/${nextHandle}`);
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
  { value: MANGA_USER_STATUS.ON_GOING, label: "Đang tiến hành" },
  { value: MANGA_USER_STATUS.COMPLETED, label: "Đã hoàn thành" },
];

const FIXED_SCHEDULE_ISO = "2025-10-15T08:08:00+07:00";

interface FormDataShape {
  title: string;
  description: string;
  author: string; // chuỗi tên ghép từ AuthorSelect
  keywords: string;
  userStatus: number;
  genres: string[];
  poster: File | null;
  alternateTitle?: string;
}

export default function CreateStory() {
  const { genres, isAdmin } = useLoaderData<typeof loader>();

  const [formData, setFormData] = useState<FormDataShape>({
    title: "",
    description: "",
    author: "", // sẽ được set từ AuthorSelect
    keywords: "",
    userStatus: MANGA_USER_STATUS.ON_GOING,
    genres: [],
    poster: null,
    alternateTitle: "",
  });

  // dữ liệu từ AuthorSelect
  const [selectedAuthors, setSelectedAuthors] = useState<AuthorLite[]>([]);
  const [authorOrderIds, setAuthorOrderIds] = useState<string[]>([]);
  // New entity selections
  const [selectedDoujinshi, setSelectedDoujinshi] = useState<AuthorLite[]>([]);
  const [selectedTranslators, setSelectedTranslators] = useState<AuthorLite[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<AuthorLite[]>([]);
  const [useFixedSchedule, setUseFixedSchedule] = useState(false);

  const [posterPreview, setPosterPreview] = useState("");
  const [posterUrl, setPosterUrl] = useState(""); // URL sau upload
  const [isUploading, setIsUploading] = useState(false);
  const [isCosplay, setIsCosplay] = useState(false);

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { uploadMultipleFiles } = useFileOperations();

  const formRef = useRef<HTMLFormElement>(null);

  const handleGenreToggle = (genreSlug: string) => {
    setFormData((prev: FormDataShape) => ({
      ...prev,
      genres: prev.genres.includes(genreSlug)
        ? prev.genres.filter((g: string) => g !== genreSlug)
        : [...prev.genres, genreSlug],
    }));
  };

  const handleInputChange = (field: keyof FormDataShape, value: string) => {
    setFormData((prev: FormDataShape) => ({ ...prev, [field]: value }));
  };

  // ❗️Sửa đúng key userStatus (bản cũ từng set nhầm "status")
  const handleStatusSelect = (status: number) => {
    setFormData((prev: FormDataShape) => ({ ...prev, userStatus: status }));
  };

  const handleFileSelect = async (file: File) => {
    try {
      const normalized = await normalizePosterImage(file);
      setFormData((prev: FormDataShape) => ({ ...prev, poster: normalized.file }));
      setPosterPreview(URL.createObjectURL(normalized.file));
    } catch (error) {
      console.error("Normalize poster error", error);
      toast.error("Không thể xử lý ảnh bìa, vui lòng thử lại");
    }
  };

  const clearPosterImage = () => {
    setFormData((prev: FormDataShape) => ({ ...prev, poster: null }));
    setPosterPreview("");
    setPosterUrl("");
  };

  // BEGIN <feature> MANGACREATE_DESCRIPTION_OPTIONAL
  /**
   * BỎ BẮT BUỘC mô tả: chỉ yêu cầu Title, Poster.
   * Đồng thời, trước khi submit native, loại bỏ thuộc tính required trên textarea nếu có.
   */
  const ensureDescriptionNotRequired = () => {
    const el = formRef.current?.querySelector<HTMLTextAreaElement>('textarea[name="description"]');
    if (el) {
      el.removeAttribute("required");
    }
  };
  // END <feature> MANGACREATE_DESCRIPTION_OPTIONAL

  const handleContinueClick = async () => {
    // BEGIN <feature> MANGACREATE_DESCRIPTION_OPTIONAL
    if (!formData.title.trim()) {
      toast.error("Vui lòng nhập tên truyện");
      return;
    }
    // (mô tả được phép trống)
    // END <feature> MANGACREATE_DESCRIPTION_OPTIONAL

    if (!formData.poster) {
      toast.error("Vui lòng chọn ảnh bìa");
      return;
    }
    // Tác giả KHÔNG bắt buộc nữa

    // BEGIN <feature> MANGACREATE_SET_SKIP_FLAG_SESSION
    /**
     * Đặt cờ one-shot vào sessionStorage để trang create chapter biết cần bỏ nén/convert
     * Điều kiện: genres có chứa 'manhwa' hoặc 'manhua'
     * Không đổi server redirect; cờ sẽ tự clear sau khi đọc ở trang chapter.
     */
    try {
      const isSkip = formData.genres.some((g: string) =>
        ["manhwa", "manhua"].includes(String(g).toLowerCase())
      );
      if (typeof window !== "undefined") {
        sessionStorage.setItem("skipCompressionNext", isSkip ? "1" : "0");
      }
    } catch {
      // ignore storage errors (Safari private mode, etc.)
    }
    // END <feature> MANGACREATE_SET_SKIP_FLAG_SESSION

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

      // Loại bỏ required ở textarea (nếu còn) rồi submit native để nhận redirect
      // BEGIN <feature> MANGACREATE_DESCRIPTION_OPTIONAL
      ensureDescriptionNotRequired();
      // END <feature> MANGACREATE_DESCRIPTION_OPTIONAL

      // Native submit để Router điều hướng theo redirect từ action
      formRef.current?.requestSubmit();
    } catch (error) {
      console.error("Upload error:", error);
      setIsUploading(false);
      toast.error("Lỗi khi tải ảnh lên");
    }
  };

  // BEGIN <feature> GENRES_CREATE_ALL_AZ_SCROLL
  // Thể loại dùng chung UI với /search/advanced (A–Z + search + grid)
  // END <feature> GENRES_CREATE_ALL_AZ_SCROLL

  // actionData sẽ có lỗi (nếu có) sau navigation submit
  const responseData = actionData;

  // BEGIN <feature> MANGACREATE_POSTER_DND_HEADER
  // Kéo-thả cho ảnh bìa (không đổi tên field, không đổi flow upload)
  const [posterDragOver, setPosterDragOver] = useState(false);
  const onPosterDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setPosterDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const f = files[0];
      handleFileSelect(f);
    }
  };
  const onPosterDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!posterDragOver) setPosterDragOver(true);
  };
  const onPosterDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setPosterDragOver(false);
  };
  // END <feature> MANGACREATE_POSTER_DND_HEADER

  return (
  // expanded max width 1.5x (950 -> 1425) then reduced 15% per request -> 1212
  <div className="mx-auto flex w-full max-w-[1212px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-0">
      <Toaster position="bottom-right" />

      {/* Header row: Title (left) + Top-right Continue button */}
      <div className="flex items-center justify-between gap-3">
        <h1
          className="text-txt-primary font-sans text-2xl leading-9 font-semibold sm:text-3xl"
          style={{ textShadow: "0px 0px 4px rgba(182, 25, 255, 0.59)" }}
        >
          Đăng truyện
        </h1>

        <button
          type="button"
          onClick={handleContinueClick}
          disabled={isSubmitting || isUploading || !formData.title.trim()}
          aria-label="Tiếp tục tạo truyện"
          className="rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-2.5 font-sans text-sm font-semibold text-black shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-52"
        >
          {isUploading
            ? "Đang tải ảnh lên..."
            : isSubmitting
              ? "Đang tạo..."
              : "Tiếp tục"}
        </button>
      </div>

      {/* Native form POST để nhận redirect -> điều hướng ngay */}
      <form
        ref={formRef}
        method="post"
        action="/truyen-hentai/create"
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          // Trường hợp Enter sớm: nếu chưa có posterUrl => chặn và chạy flow upload
          if (!posterUrl) {
            e.preventDefault();
            handleContinueClick();
          }
        }}
      >
          <input type="hidden" name="isCosplay" value={isCosplay ? "1" : "0"} />
          {isAdmin ? (
            <div className="bg-bgc-layer1 border-bd-default rounded-xl border p-4 shadow-lg">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-fuchsia-500"
                  checked={isCosplay}
                  onChange={(e) => setIsCosplay(e.target.checked)}
                />
                <div>
                  <p className="text-txt-primary text-sm font-semibold uppercase">Đánh dấu album ảnh cosplay thật</p>
                  <p className="text-txt-secondary mt-1 text-xs">
                    Chỉ admin có thể bật tuỳ chọn này. Truyện sẽ tách khỏi kho manga và hiển thị ở mục "Ảnh Cosplay" trên trang chủ.
                  </p>
                </div>
              </label>
            </div>
          ) : null}
        <div className="bg-bgc-layer1 border-bd-default flex flex-col gap-6 rounded-xl border p-4 shadow-lg sm:p-6">
          {/* Error */}
          {responseData?.error && (
            <div className="w-full rounded bg-red-500/10 p-3 text-sm font-medium text-red-500">
              {responseData.error.message}
            </div>
          )}

          {/* Two-column layout: left = 40% (poster, author, status), right = 60% (title, genres, description) */}
          <div className="flex flex-col gap-6 md:flex-row">
            {/* Left column */}
            <div className="md:w-2/5 flex flex-col gap-6">
              {/* Ảnh bìa */}
              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <ImageIcon className="text-txt-secondary mt-0.5 h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Ảnh bìa</label>
                </div>
                <div className="flex w-full flex-row items-start gap-4">
                  <div className="min-h-64 min-w-44">
                    <div
                      onDrop={onPosterDrop}
                      onDragOver={onPosterDragOver}
                      onDragLeave={onPosterDragLeave}
                      className={[
                        "rounded-xl transition",
                        posterDragOver ? "ring-2 ring-lav-500 ring-offset-0" : "",
                      ].join(" ")}
                      aria-label="Kéo ảnh vào vùng này hoặc bấm để chọn"
                      title="Kéo ảnh vào đây hoặc bấm để chọn"
                    >
                      <ImageUploader
                        onFileSelect={handleFileSelect}
                        onClear={clearPosterImage}
                        preview={posterPreview}
                        uploadText="Tải ảnh lên (kéo-thả được)"
                        required
                        aspectRatio="poster"
                      />
                    </div>
                  </div>
                  <div className="flex h-64 flex-col justify-center gap-4 p-4">
                    <p className="text-txt-secondary font-sans text-base font-medium">1. Ảnh có tỷ lệ 3:4</p>
                    <p className="text-txt-secondary font-sans text-base font-medium">2. Ảnh có kích thước dưới 1MB</p>
                  </div>
                </div>
              </div>

              {/* Tác giả */}
              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <User className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Tác giả</label>
                </div>
                <div>
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
                </div>
              </div>

              {/* Doujinshi */}
              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <Tag className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Doujinshi</label>
                </div>
                <div>
                  <DoujinshiSelect
                    initial={[]}
                    onChange={(items: AuthorLite[], orderIds: string[]) => {
                      setSelectedDoujinshi(items);
                    }}
                  />
                </div>
              </div>

              {/* Dịch giả (Translator) */}
              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <User className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Dịch giả</label>
                </div>
                <div>
                  <TranslatorSelect
                    initial={[]}
                    onChange={(items: AuthorLite[], orderIds: string[]) => {
                      setSelectedTranslators(items);
                    }}
                  />
                </div>
              </div>

              {/* Nhân vật (Characters) */}
              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <User className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Nhân vật</label>
                </div>
                <div>
                  <CharacterSelect
                    initial={[]}
                    onChange={(items: AuthorLite[], orderIds: string[]) => {
                      setSelectedCharacters(items);
                    }}
                  />
                </div>
              </div>

              {/* Trạng thái (radio-like) + One-shot checkbox (tied to genres) */}
              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <Settings className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Trạng thái / One-shot</label>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="userStatusRadio"
                      checked={formData.userStatus === MANGA_USER_STATUS.ON_GOING}
                      onChange={() => handleStatusSelect(MANGA_USER_STATUS.ON_GOING)}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className="text-txt-primary text-sm font-medium">Đang tiến hành</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="userStatusRadio"
                      checked={formData.userStatus === MANGA_USER_STATUS.COMPLETED}
                      onChange={() => handleStatusSelect(MANGA_USER_STATUS.COMPLETED)}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className="text-txt-primary text-sm font-medium">Đã hoàn thành</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="oneshotCheckbox"
                      checked={formData.genres.includes("oneshot")}
                      onChange={() => handleGenreToggle("oneshot")}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className="text-txt-primary text-sm font-medium">One-shot (thể loại)</span>
                  </label>
                </div>
              </div>
              {isAdmin && (
                <div className="flex flex-col gap-4">
                  <div className="flex min-w-fit items-center gap-1.5">
                    <Clock className="text-txt-secondary h-4 w-4" />
                    <label className="text-txt-primary font-sans text-base font-semibold">Lên lịch đăng (Admin)</label>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer"
                        checked={useFixedSchedule}
                        onChange={(event) => setUseFixedSchedule(event.target.checked)}
                      />
                      <span className="text-sm font-medium text-txt-primary">
                        Đặt thời gian cập nhật là 15/10/2025 lúc 08:08 (GMT+7)
                      </span>
                    </label>
                    <input type="hidden" name="overrideUpdatedAt" value={useFixedSchedule ? FIXED_SCHEDULE_ISO : ""} />
                    <p className="text-xs text-txt-secondary">
                      Nếu tick, truyện sẽ được lưu như đăng vào thời điểm cố định ở trên. Bỏ tick để dùng thời gian hiện tại.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="md:w-3/5 flex flex-col gap-6">
              {/* Tên truyện */}
              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <Book className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Tên truyện</label>
                </div>
                <div>
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

                {/* Tên khác (không bắt buộc, nhỏ hơn) */}
                <div className="flex flex-col gap-2">
                  <label className="text-txt-secondary text-sm font-medium">Tên khác (không bắt buộc)</label>
                  <input
                    type="text"
                    name="alternateTitle"
                    value={(formData as any).alternateTitle || ""}
                    onChange={(e) => handleInputChange("alternateTitle", e.target.value)}
                    placeholder="Tên khác (ví dụ: bản ENG, tên rút gọn...)"
                    className="bg-bgc-layer2 border-bd-default text-txt-secondary w-full rounded-lg border px-3 py-2 text-sm font-sans font-medium focus:outline-none"
                  />
                </div>

              {/* Thể loại */}
              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <Tag className="text-txt-secondary mt-0.5 h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Thể loại</label>
                </div>
                <GenreGridPicker
                  genres={genres as GenresType[]}
                  selectedSlugs={formData.genres}
                  onToggle={handleGenreToggle}
                  showLetterNav={false}
                  helperText={
                    <>
                      Gõ <b>a,b,c…</b> để lọc theo chữ đầu; gõ <b>nhiều từ khóa cùng lúc</b> để tìm nhanh hơn.
                    </>
                  }
                />
              </div>

              {/* Giới thiệu */}
              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <FileText className="text-txt-secondary mt-0.5 h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Giới thiệu</label>
                </div>
                <div>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Nhập nội dung giới thiệu"
                    rows={8}
                    className="bg-bgc-layer2 border-bd-default text-txt-secondary focus:border-lav-500 focus:text-txt-primary w-full resize-none rounded-xl border px-3 py-2.5 font-sans text-base font-medium focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Hidden inputs: giữ y hệt payload cũ cho action */}
          <input type="hidden" name="keywords" value="" />
          <input type="hidden" name="userStatus" value={formData.userStatus} />
          <input type="hidden" name="genres" value={JSON.stringify(formData.genres)} />
          <input type="hidden" name="posterUrl" value={posterUrl} />
          {/* Gửi kèm để tương lai back-end xài; hiện tại back-end có thể bỏ qua */}
          <input type="hidden" name="author" value={formData.author} />
          <input type="hidden" name="authorNames" value={JSON.stringify(selectedAuthors.map((a) => a.name))} />
          <input type="hidden" name="authorSlugs" value={JSON.stringify(selectedAuthors.map((a) => a.slug))} />
          <input type="hidden" name="authorIds" value={JSON.stringify(authorOrderIds)} />
          {/* Hidden new relation arrays */}
          <input type="hidden" name="doujinshiNames" value={JSON.stringify(selectedDoujinshi.map((i) => i.name))} />
          <input type="hidden" name="doujinshiSlugs" value={JSON.stringify(selectedDoujinshi.map((i) => i.slug))} />
          <input type="hidden" name="translatorNames" value={JSON.stringify(selectedTranslators.map((i) => i.name))} />
          <input type="hidden" name="translatorSlugs" value={JSON.stringify(selectedTranslators.map((i) => i.slug))} />
          <input type="hidden" name="characterNames" value={JSON.stringify(selectedCharacters.map((i) => i.name))} />
          <input type="hidden" name="characterSlugs" value={JSON.stringify(selectedCharacters.map((i) => i.slug))} />
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
