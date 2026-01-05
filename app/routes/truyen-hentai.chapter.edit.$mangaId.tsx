import { useEffect, useRef, useState } from "react"; 
import { toast, Toaster } from "react-hot-toast";
import {
  Link,
  Outlet,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
} from "react-router";
import { ArrowLeft, BookOpen, FileText, Upload, X } from "lucide-react";

import { updateChapter } from "@/mutations/chapter.mutation";
import { getChapterByMangaIdAndNumber } from "@/queries/chapter.query";
import { requireLogin } from "@/services/auth.server";

import type { Route } from "./+types/truyen-hentai.chapter.edit.$mangaId";

import { ChapterDetail } from "~/components/chapter-detail";
import type { UserType } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors.helper";
import { useFileOperations } from "~/hooks/use-file-operations";
import {
  compressMultipleImages,
  formatFileSize,
  validateImageFile,
} from "~/utils/image-compression.utils";
import { resolveMangaHandle } from "~/database/helpers/manga-slug.helper";

interface PreviewImage {
  file?: File;
  url: string;
  id: string;
  isExisting?: boolean;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
}

interface CompressionProgress {
  isCompressing: boolean;
  current: number;
  total: number;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url);
  // This route has a nested canonical route:
  //   /truyen-hentai/chapter/edit/:mangaId/:chapterId
  // In React Router nested matching, the parent loader may run as well.
  // We must NOT run legacy redirect logic for the canonical URL.
  const parts = url.pathname.split("/").filter(Boolean);
  const isCanonicalPath =
    parts[0] === "truyen-hentai" &&
    parts[1] === "chapter" &&
    parts[2] === "edit" &&
    parts.length >= 5;
  if (isCanonicalPath) {
    return null;
  }

  const chapterNumber = url.searchParams.get("chapterNumber");
  const handle = params.mangaId;
  const user = (await requireLogin(request)) as UserType;
  if (!handle) {
    throw new BusinessError("Không tìm thấy manga ID");
  }

  const target = await resolveMangaHandle(handle);
  if (!target) {
    throw new BusinessError("Không tìm thấy truyện");
  }
  const mangaObjectId = String((target as any).id ?? (target as any)._id ?? "");
  const canonicalHandle = target.slug || mangaObjectId;

  // Legacy admin URL: /truyen-hentai/chapter/edit/:mangaId?chapterNumber=N
  // Canonical admin URL: /truyen-hentai/chapter/edit/:mangaId/:chapterId
  if (!chapterNumber) {
    return redirect(`/truyen-hentai/preview/${canonicalHandle}`, { status: 302 });
  }

  const chapter = await getChapterByMangaIdAndNumber(
    mangaObjectId,
    parseInt(chapterNumber),
    user as UserType,
  );
  if (!chapter) {
    return redirect(`/truyen-hentai/preview/${canonicalHandle}`, { status: 302 });
  }

  const chapterId = String((chapter as any).id ?? (chapter as any)._id ?? "").trim();
  if (!chapterId) {
    return redirect(`/truyen-hentai/preview/${canonicalHandle}`, { status: 302 });
  }

  url.searchParams.delete("chapterNumber");
  const rest = url.searchParams.toString();
  const targetUrl = `/truyen-hentai/chapter/edit/${encodeURIComponent(canonicalHandle)}/${encodeURIComponent(chapterId)}`;
  return redirect(rest ? `${targetUrl}?${rest}` : targetUrl, { status: 302 });
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const formData = await request.formData();
    const handle = params.mangaId;
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const isCanonicalPath =
      parts[0] === "truyen-hentai" &&
      parts[1] === "chapter" &&
      parts[2] === "edit" &&
      parts.length >= 5;
    const chapterIdFromPath = isCanonicalPath
      ? decodeURIComponent(String(parts[4] ?? "")).trim()
      : "";
    const chapterNumber = url.searchParams.get("chapterNumber");

    if (!handle) {
      throw new BusinessError("Không tìm thấy manga ID");
    }

    // Canonical URL uses chapterId path param, legacy URL uses ?chapterNumber=N
    if (!chapterNumber && !chapterIdFromPath) {
      throw new BusinessError("Thiếu số chương để chỉnh sửa");
    }

    const target = await resolveMangaHandle(handle);
    if (!target) {
      throw new BusinessError("Không tìm thấy truyện");
    }
    const mangaId = String((target as any).id ?? (target as any)._id ?? "");

    // If this action is hit on the canonical route, resolve chapterNumber via chapterId.
    let effectiveChapterNumber = chapterNumber ? parseInt(chapterNumber) : NaN;
    if (!Number.isFinite(effectiveChapterNumber) && chapterIdFromPath) {
      const { ChapterModel } = await import("~/database/models/chapter.model");
      const chapter = await ChapterModel.findOne({ _id: chapterIdFromPath, mangaId })
        .select({ chapterNumber: 1 })
        .lean();
      effectiveChapterNumber = Number((chapter as any)?.chapterNumber);
    }
    if (!Number.isFinite(effectiveChapterNumber) || effectiveChapterNumber < 1) {
      throw new BusinessError("Không tìm thấy chương");
    }

    const title = (formData.get("title") as string) ?? "";
    const contentUrls = JSON.parse(formData.get("contentUrls") as string);
    // Allow blank title; server will auto-name as "Chap N" based on chapterNumber
    if (!contentUrls || contentUrls.length === 0) {
      throw new BusinessError("Vui lòng tải lên ít nhất một ảnh");
    }

    await updateChapter(request, mangaId, effectiveChapterNumber, {
      title: title.trim(),
      contentUrls,
    });

    // Sau khi cập nhật chương, điều hướng về trang preview của manga
    const nextHandle = target.slug || mangaId;
    return redirect(`/truyen-hentai/preview/${nextHandle}`);
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

export default function EditChapter() {
  const params = useParams();

  // When visiting the canonical URL (/truyen-hentai/chapter/edit/:mangaId/:chapterId)
  // this route is a parent layout. Render the nested route instead.
  if ((params as any)?.chapterId) {
    return <Outlet />;
  }

  return <EditChapterView />;
}

export function EditChapterView() {
  const params = useParams();
  const routeHandle = params.mangaId;
  const navigate = useNavigate();
  const { chapter, mangaHandle } = useLoaderData() as any;
  const canonicalHandle = mangaHandle || routeHandle;
  const fetcher = useFetcher() as any;
  const [title, setTitle] = useState("");
  const [contents, setContents] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress>({
    isCompressing: false,
    current: 0,
    total: 0,
  });
  const actionData = useActionData() as any;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { uploadMultipleFiles } = useFileOperations();

  // Dropzone highlight
  const [dragOver, setDragOver] = useState(false);

  // Card drag-sort states
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // === helper: move item in array ===
  const move = <T,>(arr: T[], from: number, to: number) => {
    const a = arr.slice();
    const [it] = a.splice(from, 1);
    a.splice(to, 0, it);
    return a;
  };

  // Initialize form data when editing
  useEffect(() => {
    setTitle(String((chapter as any)?.title ?? ""));

    // Legacy compatibility:
    // - Preferred: chapter.contentUrls: string[]
    // - Legacy: chapter.pages: Array<{ url?: string }>
    const urls: string[] = Array.isArray((chapter as any)?.contentUrls)
      ? (chapter as any).contentUrls
      : Array.isArray((chapter as any)?.pages)
        ? (chapter as any).pages
            .map((p: any) => String(p?.url ?? "").trim())
            .filter(Boolean)
        : [];

    // Convert existing URLs to preview images (giữ thứ tự chương hiện tại)
    const existingImages: PreviewImage[] = urls.map((url, index) => ({
      url,
      id: `existing-${index}`,
      isExisting: true,
    }));
    setPreviewImages(existingImages);

    // Reset danh sách file mới
    setContents([]);
  }, [chapter]);

  // ---- unified add files (input change & drag-drop)
  const addFiles = async (filesLike: FileList | File[], source: "input" | "drop" = "input") => {
    let list = Array.from(filesLike);
    if (list.length === 0) return;

    // Heuristic: Chrome đôi khi đảo thứ tự khi kéo-thả nhiều file
    if (source === "drop" && list.length >= 2) {
      const first = list[0];
      const last = list[list.length - 1];
      const looksReversedByName =
        first.name.localeCompare(last.name, undefined, { numeric: true, sensitivity: "base" }) > 0;
      const looksReversedByTime = first.lastModified > last.lastModified;
      if (looksReversedByName && looksReversedByTime) {
        list = list.reverse();
      }
    }

    // Validate files first
    try {
      list.forEach((file) => validateImageFile(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "File không hợp lệ");
      return;
    }

    // Set compression progress
    setCompressionProgress({
      isCompressing: true,
      current: 0,
      total: list.length,
    });

    try {
      toast.loading("Đang nén và chuyển đổi ảnh sang WebP...", { id: "compression" });

      // Compress images with progress callback
      const compressionResults = await compressMultipleImages(
        list,
        (current, total) => {
          setCompressionProgress({
            isCompressing: true,
            current,
            total,
          });
        },
      );

      // Update files and preview images
      const compressedFiles = compressionResults.map((result) => result.compressedFile);

      // Append vào contents (chỉ chứa file mới)
      setContents((prev) => [...prev, ...compressedFiles]);

      // Create preview images with compression info
      const newPreviewImages: PreviewImage[] = compressionResults.map((result, index) => {
        const url = URL.createObjectURL(result.compressedFile);
        return {
          file: result.compressedFile,
          url,
          id: `${Date.now()}-${index}`,
          isExisting: false,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          compressionRatio: result.compressionRatio,
        };
      });

      // Thêm vào sau danh sách đang có (giữ thứ tự)
      setPreviewImages((prev) => [...prev, ...newPreviewImages]);

      // Calculate total savings
      const totalOriginalSize = compressionResults.reduce(
        (acc, curr) => acc + curr.originalSize,
        0,
      );
      const totalCompressedSize = compressionResults.reduce(
        (acc, curr) => acc + curr.compressedSize,
        0,
      );
      const totalSavings =
        ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100;

      toast.success(
        `Đã nén ${list.length} ảnh thành công! Tiết kiệm ${formatFileSize(totalOriginalSize - totalCompressedSize)} (${Math.round(totalSavings)}%)`,
        { id: "compression" },
      );
    } catch (error) {
      console.error("Error compressing images:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra khi nén ảnh. Vui lòng thử lại.",
        { id: "compression" },
      );
    } finally {
      setCompressionProgress({
        isCompressing: false,
        current: 0,
        total: 0,
      });
    }
  };

  // File input change -> addFiles("input")
  const handlePagesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await addFiles(files, "input");
    // Reset input to allow re-select same files
    event.target.value = "";
  };

  const removePreviewImage = (id: string) => {
    setPreviewImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove && imageToRemove.file) {
        // ảnh mới: thu hồi objectURL và bỏ khỏi contents
        URL.revokeObjectURL(imageToRemove.url);
        setContents((prevContents) =>
          prevContents.filter((file) => file !== imageToRemove.file),
        );
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const triggerFileInput = () => {
    if (compressionProgress.isCompressing) {
      toast.error("Đang nén ảnh, vui lòng chờ...");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim() || previewImages.length === 0) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (!canonicalHandle) {
      toast.error("Không tìm thấy manga ID");
      return;
    }

    if (compressionProgress.isCompressing) {
      toast.error("Đang nén ảnh, vui lòng chờ...");
      return;
    }

    setIsSubmitting(true);

    const selectWatermarkIndexes = (total: number, ratio: number) => {
      const count = Math.floor(total / ratio);
      if (count <= 0) return new Set<number>();
      const indexes = Array.from({ length: total }, (_, i) => i);
      for (let i = indexes.length - 1; i > 0; i--) {
        const randArray = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 0xffffffff);
        const j = randArray % (i + 1);
        [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
      }
      return new Set(indexes.slice(0, count));
    };

    const watermarkIndexes = selectWatermarkIndexes(contents.length, 5);

    try {
      // Upload CHỈ các ảnh mới (contents)
      const filesToUpload = contents.map((file, idx) => ({
        file,
        options: { prefixPath: "manga-images" as const, watermark: watermarkIndexes.has(idx) },
      }));

      let fileToUrl = new Map<File, string>();
      if (filesToUpload.length > 0) {
        const uploadResults = await uploadMultipleFiles(filesToUpload);
        // Map theo đúng thứ tự input -> output
        uploadResults.forEach((res, idx) => {
          const file = filesToUpload[idx].file;
          fileToUrl.set(file, res.url);
        });
      }

      // Duyệt theo previewImages (thứ tự UI) để dựng contentUrls
      const contentUrls = previewImages.map((img) => {
        if (img.isExisting) return img.url;
        if (img.file) {
          const url = fileToUrl.get(img.file);
          if (!url) {
            // Trường hợp hiếm: có ảnh mới nhưng không tìm thấy URL upload
            throw new Error("Thiếu URL upload cho một ảnh mới");
          }
          return url;
        }
        // Fallback cho chắc
        return img.url;
      });

      // Submit form với URLs đúng thứ tự
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("contentUrls", JSON.stringify(contentUrls));

      fetcher.submit(formData, { method: "POST" });
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi upload/ghép dữ liệu");
      setIsSubmitting(false);
    }
  };

  const handleExternalSubmit = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  // Update loading state based on fetcher
  const isLoading =
    isSubmitting || fetcher.state === "submitting" || compressionProgress.isCompressing;

  // Sử dụng data từ fetcher nếu có, nếu không thì dùng actionData
  const responseData = fetcher.data || actionData;

  const handlePreview = () => {
    // Chuyển tới trang xem trước (trang đọc chapter) với chapterNumber hiện tại
    if (!canonicalHandle) return;
    const slug = String((chapter as any)?.slug || "").trim();
    if (slug) {
      navigate(`/truyen-hentai/${canonicalHandle}/${encodeURIComponent(slug)}`);
      return;
    }
    navigate(`/truyen-hentai/${canonicalHandle}`);
  };

  // Drag & Drop for dropzone (thêm ảnh)
  const onDropZoneDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (compressionProgress.isCompressing) {
      toast.error("Đang nén ảnh, vui lòng chờ...");
      return;
    }
    const { files } = e.dataTransfer;
    if (files && files.length > 0) {
      await addFiles(files, "drop");
    }
  };
  const onDropZoneDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };
  const onDropZoneDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  };

  // Drag-sort handlers for thumbnails (đổi vị trí)
  const onCardDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (compressionProgress.isCompressing) {
      e.preventDefault();
      toast.error("Đang nén ảnh, vui lòng chờ...");
      return;
    }
    setDraggingIndex(index);
    setOverIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const onCardDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault(); // allow drop
    if (overIndex !== index) setOverIndex(index);
  };

  const onCardDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    const from =
      draggingIndex !== null ? draggingIndex : parseInt(e.dataTransfer.getData("text/plain"), 10);
    const to = index;
    if (isNaN(from) || from === to) {
      setDraggingIndex(null);
      setOverIndex(null);
      return;
    }

    setPreviewImages((prev) => {
      const reordered = move(prev, from, to);

      // Đồng bộ contents theo previewImages (chỉ ảnh mới)
      const newContents = reordered
        .filter((p) => !p.isExisting && p.file)
        .map((p) => p.file!) as File[];
      setContents(newContents);

      return reordered;
    });

    setDraggingIndex(null);
    setOverIndex(null);
  };

  const onCardDragEnd = () => {
    setDraggingIndex(null);
    setOverIndex(null);
  };

  // Preview chế độ nội tuyến đã được tách ra trang riêng; không còn render trong trang edit

  return (
    <div className="mx-auto flex w-full max-w-[951px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-0">
      <Toaster position="bottom-right" />
      {/* Header */}
      <div className="flex flex-col gap-6">
        <h1 className="text-txt-primary text-left font-sans text-2xl leading-9 font-semibold [text-shadow:_0px_0px_4px_rgb(182_25_255_/_0.59)] sm:text-3xl">
          Chỉnh sửa chương
        </h1>

        {/* Main Form Container */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="bg-bgc-layer1 border-bd-default flex flex-col gap-6 rounded-xl border p-4 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] sm:p-6"
        >
          {/* Error/Success Message */}
          {responseData?.error && (
            <div className="w-full rounded bg-red-500/10 p-3 text-sm font-medium text-red-500">
              {responseData.error.message}
            </div>
          )}

          {/* Compression Progress */}
          {compressionProgress.isCompressing && (
            <div className="bg-lav-500/10 w-full rounded p-3">
              <div className="text-lav-500 flex items-center justify-between text-sm font-medium">
                <span>
                  Đang nén ảnh {compressionProgress.current}/{compressionProgress.total}
                  ...
                </span>
                <span>
                  {Math.round(
                    (compressionProgress.current / compressionProgress.total) * 100,
                  )}
                  %
                </span>
              </div>
              <div className="bg-lav-500/20 mt-2 h-2 rounded-full">
                <div
                  className="bg-lav-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(compressionProgress.current / compressionProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Hidden input for manga handle to keep downstream logic aware of canonical route */}
          <input type="hidden" name="mangaId" value={canonicalHandle || ""} />

          {/* Title Section */}
          <div className="flex flex-col gap-2">
            <label htmlFor="chapter-edit-title" className="flex items-center gap-1.5 text-txt-primary text-base font-semibold">
              <BookOpen className="text-txt-secondary h-4 w-4" />
              <span>Tiêu đề</span>
            </label>

            <div className="flex flex-col gap-2">
              <input
                id="chapter-edit-title"
                type="text"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Viết hoa ký tự đầu tiên mỗi từ"
                required
                className="bg-bgc-layer2 border-bd-default text-txt-secondary placeholder:text-txt-secondary focus:border-lav-500 w-full rounded-xl border px-3 py-2.5 text-base font-medium focus:outline-none"
                maxLength={100}
              />
              <div className="text-txt-secondary text-right text-sm font-medium">
                {title.length}/100
              </div>
            </div>
          </div>

          {/* Upload Chapter Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <FileText className="text-txt-secondary h-4 w-4" />
              <span className="text-txt-primary text-base font-semibold">
                Tải truyện lên
              </span>
            </div>

            <div className="relative flex w-full flex-col items-center justify-center gap-2">
              <div
                className={[
                  "bg-bgc-layer2 border-bd-default relative flex h-full min-h-[240px] w-full flex-1 items-center justify-center rounded-xl border border-dashed px-3 py-2.5",
                  dragOver ? "ring-2 ring-lav-500 ring-offset-0 border-lav-500/60" : "",
                ].join(" ")}
                onDrop={onDropZoneDrop}
                onDragOver={onDropZoneDragOver}
                onDragLeave={onDropZoneDragLeave}
                aria-label="Khu vực kéo-thả ảnh"
              >
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  name="pages"
                  multiple
                  required={previewImages.length === 0}
                  accept="image/*"
                  onChange={handlePagesChange}
                  className="sr-only"
                  disabled={compressionProgress.isCompressing}
                />

                {/* Upload Button and Text - Mobile: centered, Desktop: absolutely positioned */}
                <div className="flex flex-col items-center gap-3 lg:hidden">
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    disabled={compressionProgress.isCompressing}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#D373FF] hover:to-[#C962F9] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-5 w-5 text-black" />
                    <span className="text-center text-sm font-semibold text-black">
                      {compressionProgress.isCompressing
                        ? "Đang nén..."
                        : previewImages.length > 0
                          ? "Thêm ảnh"
                          : "Tải ảnh lên"}
                    </span>
                  </button>
                  <span className="text-txt-primary text-center text-sm font-medium">
                    {compressionProgress.isCompressing
                      ? "Đang xử lý ảnh..."
                      : `Click hoặc kéo-thả ảnh vào vùng này`}
                  </span>
                </div>

                {/* Upload Button and Text - Desktop only: Absolutely positioned in center */}
                <div className="absolute inset-0 hidden flex-col items-center justify-center gap-3 lg:flex">
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    disabled={compressionProgress.isCompressing}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#D373FF] hover:to-[#C962F9] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-5 w-5 text-black" />
                    <span className="text-center text-sm font-semibold text-black">
                      {compressionProgress.isCompressing
                        ? "Đang nén..."
                        : previewImages.length > 0
                          ? "Thêm ảnh"
                          : "Tải ảnh lên"}
                    </span>
                  </button>
                  <span className="text-txt-primary text-center text-sm font-medium">
                    {compressionProgress.isCompressing
                      ? "Đang xử lý ảnh..."
                      : `Click chọn ảnh hoặc kéo-thả ảnh vào vùng này`}
                  </span>
                </div>
              </div>

              <p className="text-txt-secondary text-center text-sm leading-tight font-medium">
                Ảnh mới sẽ được tự động nén và chuyển đổi sang định dạng WebP để tối ưu
                hóa tải trang.
              </p>
              <p className="text-txt-secondary text-center text-sm leading-tight font-medium">
                Kích thước ảnh lớn nhất 2000 x 8000 pixel. Tác phẩm được ghép từ các ảnh
                ngắn sẽ tải nhanh hơn.
              </p>

              {/* Preview Images - Below text */}
              {previewImages.length > 0 && (
                <div className="mt-4 w-full">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {previewImages.map((image, idx) => (
                      <div
                        key={image.id}
                        className={[
                          "group relative select-none", // prevent text select while dragging
                          overIndex === idx ? "outline outline-2 outline-lav-500 rounded-lg" : "",
                          draggingIndex === idx ? "opacity-70" : "",
                        ].join(" ")}
                        draggable
                        onDragStart={(e) => onCardDragStart(e, idx)}
                        onDragOver={(e) => onCardDragOver(e, idx)}
                        onDrop={(e) => onCardDrop(e, idx)}
                        onDragEnd={onCardDragEnd}
                      >
                        <div className="bg-bgc-layer1 border-bd-default aspect-[2/3] w-full overflow-hidden rounded-lg border">
                          <img
                            src={image.url}
                            alt={image.file?.name || "Preview"}
                            className="h-full w-full object-cover object-top pointer-events-none"
                          />
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removePreviewImage(image.id)}
                          className="absolute -top-2 -right-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-gray-600 bg-gray-800 transition-colors hover:bg-gray-700"
                          aria-label="Xoá ảnh này"
                          title="Xoá ảnh này"
                        >
                          <X className="text-txt-primary h-4 w-4" />
                        </button>

                        {/* Badges: format + size (xếp dọc, góc trái trên) */}
                        <div className="absolute top-1 left-1 flex flex-col items-start gap-1">
                          <div className={image.isExisting ? "bg-lav-400 rounded px-1 py-0.5 text-xs text-white" : "bg-lav-500 rounded px-1 py-0.5 text-xs text-white"}>
                            {image.isExisting ? "Gốc" : "WebP"}
                          </div>
                          <div className="rounded bg-black/70 px-1 py-0.5 text-[11px] leading-none text-white">
                            {image.file
                              ? formatFileSize(image.file.size)
                              : "Hiện tại"}
                            {image.file &&
                              image.originalSize &&
                              image.compressedSize &&
                              image.originalSize !== image.compressedSize && (
                                <span className="ml-1 text-lav-300">
                                  -{Math.round(image.compressionRatio || 0)}%
                                </span>
                              )}
                          </div>
                        </div>

                        {/* position + filename under thumbnail */}
                        <div className="mt-1 w-full">
                          <div className="text-txt-primary text-xs font-semibold">
                            #{idx + 1}
                          </div>
                          <div
                            className="text-txt-secondary text-[11px] leading-tight truncate"
                            title={image.file?.name || image.url}
                          >
                            {image.file?.name || image.url.split("/").pop()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <Link
          to={`/truyen-hentai/preview/${canonicalHandle}`}
          className="hover:bg-lav-500/5 inline-flex cursor-pointer items-center gap-1.5 self-start rounded-xl px-3 py-2 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)] transition-colors"
        >
          <ArrowLeft className="text-txt-focus h-5 w-5" />
          <span className="text-txt-focus text-center text-sm font-semibold">Trở về</span>
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handlePreview}
            disabled={compressionProgress.isCompressing}
            className="border-lav-500 hover:bg-lav-500/5 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-52"
          >
            <span className="text-txt-focus text-center text-sm font-semibold whitespace-nowrap">
              Xem trước
            </span>
          </button>

          <button
            type="button"
            onClick={handleExternalSubmit}
            disabled={!title.trim() || previewImages.length === 0 || isLoading}
            className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#D373FF] hover:to-[#C962F9] disabled:cursor-not-allowed disabled:opacity-50 sm:w-52"
          >
            {compressionProgress.isCompressing || isLoading ? (
              <span className="text-center text-sm font-semibold text-black whitespace-normal">
                {compressionProgress.isCompressing
                  ? "Đang nén ảnh..."
                  : isLoading
                    ? "Đang xử lý..."
                    : "Cập nhật"}
              </span>
            ) : (
              <span className="text-center text-sm font-semibold text-black whitespace-nowrap">
                Cập nhật
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
