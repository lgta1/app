import { useEffect, useRef, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import {
  Link,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useParams,
  useSearchParams,
} from "react-router";
import { ArrowLeft, BookOpen, FileText, Upload, X } from "lucide-react";

import { updateChapter } from "@/mutations/chapter.mutation";
import { getChapterByMangaIdAndNumber } from "@/queries/chapter.query";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/manga.chapter.edit.$mangaId";

import { ChapterDetail } from "~/components/chapter-detail";
import type { UserType } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors.helper";
import { useFileOperations } from "~/hooks/use-file-operations";
import {
  compressMultipleImages,
  formatFileSize,
  validateImageFile,
} from "~/utils/image-compression.utils";

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
  const chapterNumber = url.searchParams.get("chapterNumber");
  const mangaId = params.mangaId;
  const user = await getUserInfoFromSession(request);
  if (!mangaId) {
    throw new BusinessError("Không tìm thấy manga ID");
  }

  if (!chapterNumber) {
    throw new BusinessError("Thiếu số chương để chỉnh sửa");
  }

  const chapter = await getChapterByMangaIdAndNumber(
    mangaId,
    parseInt(chapterNumber),
    user as UserType,
  );
  if (!chapter) {
    throw new BusinessError("Không tìm thấy chương");
  }

  return { chapter };
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const formData = await request.formData();
    const mangaId = params.mangaId;
    const url = new URL(request.url);
    const chapterNumber = url.searchParams.get("chapterNumber");

    if (!mangaId) {
      throw new BusinessError("Không tìm thấy manga ID");
    }

    if (!chapterNumber) {
      throw new BusinessError("Thiếu số chương để chỉnh sửa");
    }

    const title = formData.get("title") as string;
    const contentUrls = JSON.parse(formData.get("contentUrls") as string);

    if (!title || !contentUrls || contentUrls.length === 0) {
      throw new BusinessError("Vui lòng điền đầy đủ thông tin");
    }

    await updateChapter(request, mangaId, parseInt(chapterNumber), {
      title: title.trim(),
      contentUrls,
    });

    return redirect(`/manga/uploaded/${mangaId}`);
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
  const { mangaId } = useParams();
  const [searchParams] = useSearchParams();
  const { chapter } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [title, setTitle] = useState("");
  const [contents, setContents] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress>({
    isCompressing: false,
    current: 0,
    total: 0,
  });
  const actionData = useActionData<typeof action>();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { uploadMultipleFiles } = useFileOperations();

  // Initialize form data when editing
  useEffect(() => {
    setTitle(chapter.title);

    // Convert existing content URLs to preview images
    const existingImages: PreviewImage[] = chapter.contentUrls.map((url, index) => ({
      url,
      id: `existing-${index}`,
      isExisting: true,
    }));
    setPreviewImages(existingImages);
  }, [chapter]);

  const handlePagesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);

    // Validate files first
    try {
      newFiles.forEach((file) => validateImageFile(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "File không hợp lệ");
      event.target.value = "";
      return;
    }

    // Set compression progress
    setCompressionProgress({
      isCompressing: true,
      current: 0,
      total: newFiles.length,
    });

    try {
      toast.loading("Đang nén và chuyển đổi ảnh sang WebP...", { id: "compression" });

      // Compress images with progress callback
      const compressionResults = await compressMultipleImages(
        newFiles,
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
        `Đã nén ${newFiles.length} ảnh thành công! Tiết kiệm ${formatFileSize(totalOriginalSize - totalCompressedSize)} (${Math.round(totalSavings)}%)`,
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

    // Reset input value to allow selecting the same files again
    event.target.value = "";
  };

  const removePreviewImage = (id: string) => {
    setPreviewImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove && imageToRemove.file) {
        URL.revokeObjectURL(imageToRemove.url);
        // Also remove from contents array
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

    if (!mangaId) {
      toast.error("Không tìm thấy manga ID");
      return;
    }

    if (compressionProgress.isCompressing) {
      toast.error("Đang nén ảnh, vui lòng chờ...");
      return;
    }

    setIsSubmitting(true);

    try {
      let contentUrls = previewImages.map((img) => img.url);

      // Only upload content files if there are new files
      const filesToUpload: Array<{
        file: File;
        options: {
          prefixPath: string;
        };
      }> = [];

      // Upload new content pages
      contents.forEach((file) => {
        filesToUpload.push({
          file,
          options: {
            prefixPath: "manga-images",
          },
        });
      });

      if (filesToUpload.length > 0) {
        const uploadResults = await uploadMultipleFiles(filesToUpload);

        // Update content URLs with new uploaded files
        const newContentUrls = [
          ...previewImages.filter((img) => img.isExisting).map((img) => img.url),
        ];
        const newUploadedUrls = uploadResults.map((result) => result.url);
        contentUrls = [...newContentUrls, ...newUploadedUrls];
      }

      // Submit form with updated URLs
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("contentUrls", JSON.stringify(contentUrls));

      const chapterNumber = searchParams.get("chapterNumber");
      const submitUrl = chapterNumber ? `?chapterNumber=${chapterNumber}` : "";

      fetcher.submit(formData, { method: "POST", action: submitUrl });
    } catch (error) {
      toast.error("Có lỗi xảy ra khi upload file");
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
    if (!title.trim() || previewImages.length === 0) {
      toast.error("Vui lòng điền đầy đủ thông tin trước khi xem trước");
      return;
    }

    if (compressionProgress.isCompressing) {
      toast.error("Đang nén ảnh, vui lòng chờ...");
      return;
    }

    setIsPreviewMode(true);
  };

  const handleBackToEdit = () => {
    setIsPreviewMode(false);
  };

  // Create preview data for ChapterDetail component
  const previewChapterData = {
    id: "preview",
    title: title || "Tiêu đề chương",
    chapterNumber: chapter.chapterNumber,
    contentUrls: previewImages.map((img) => img.url),
    mangaId: mangaId || "",
    viewNumber: 0,
    likeNumber: 0,
    commentNumber: 0,
    status: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    breadcrumb: "Preview > Manga > " + (title || "Chương " + chapter.chapterNumber),
    hasPrevious: false,
    hasNext: false,
  };

  // If in preview mode, show ChapterDetail component
  if (isPreviewMode) {
    return (
      <div className="mx-auto flex w-full max-w-[951px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-0">
        <Toaster position="bottom-right" />
        <ChapterDetail chapter={previewChapterData} />

        {/* Back to Edit Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleBackToEdit}
            className="hover:bg-lav-500/5 border-lav-500 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-6 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)] transition-colors"
          >
            <ArrowLeft className="text-txt-focus h-5 w-5" />
            <span className="text-txt-focus text-center text-sm font-semibold">
              Trở về
            </span>
          </button>
        </div>
      </div>
    );
  }

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

          {/* Hidden input for mangaId */}
          <input type="hidden" name="mangaId" value={mangaId || ""} />

          {/* Title Section */}
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-1.5">
              <BookOpen className="text-txt-secondary h-4 w-4" />
              <span className="text-txt-primary text-base font-semibold">Tiêu đề</span>
            </div>

            <div className="w-full lg:w-[680px]">
              <input
                type="text"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Viết hoa ký tự đầu tiên mỗi từ"
                required
                className="bg-bgc-layer2 border-bd-default text-txt-secondary placeholder:text-txt-secondary focus:border-lav-500 w-full rounded-xl border px-3 py-2.5 text-base font-medium focus:outline-none"
                maxLength={100}
              />
            </div>

            <div className="text-txt-secondary mr-2 text-base font-medium lg:absolute lg:top-2.5 lg:right-0">
              {title.length}/100
            </div>
          </div>

          {/* Upload Chapter Section */}
          <div className="flex min-h-[288px] flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-0">
            <div className="flex items-center gap-1.5">
              <FileText className="text-txt-secondary h-4 w-4" />
              <span className="text-txt-primary text-base font-semibold">
                Tải truyện lên
              </span>
            </div>

            <div className="relative flex w-full flex-col items-start justify-center gap-2 lg:w-[680px]">
              <div className="bg-bgc-layer2 border-bd-default relative flex h-full min-h-[240px] w-full flex-1 items-center justify-center rounded-xl border border-dashed px-3 py-2.5 lg:items-start lg:justify-start">
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
                      : `Click để ${previewImages.length > 0 ? "thêm ảnh mới" : "tải ảnh lên"}`}
                  </span>
                </div>

                {/* Upload Button and Text - Desktop only: Absolutely positioned in center */}
                <div className="absolute top-[72px] left-[277px] hidden w-32 flex-col items-center justify-center gap-3 lg:flex">
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
                      : `Click để ${previewImages.length > 0 ? "thêm ảnh mới" : "tải ảnh lên"}`}
                  </span>
                </div>
              </div>

              <p className="text-txt-secondary text-sm leading-tight font-medium">
                Ảnh mới sẽ được tự động nén và chuyển đổi sang định dạng WebP để tối ưu
                hóa tải trang.
              </p>
              <p className="text-txt-secondary text-sm leading-tight font-medium">
                Kích thước ảnh lớn nhất 2000 x 8000 pixel. Tác phẩm được ghép từ các ảnh
                ngắn sẽ tải nhanh hơn.
              </p>

              {/* Preview Images - Below text */}
              {previewImages.length > 0 && (
                <div className="mt-4 w-full">
                  <div className="flex flex-wrap gap-4">
                    {previewImages.map((image) => (
                      <div key={image.id} className="group relative">
                        <div className="bg-bgc-layer1 border-bd-default h-32 w-32 overflow-hidden rounded-lg border">
                          <img
                            src={image.url}
                            alt="Preview"
                            className="h-full w-full object-cover object-top"
                          />
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removePreviewImage(image.id)}
                          className="absolute -top-2 -right-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-gray-600 bg-gray-800 transition-colors hover:bg-gray-700"
                        >
                          <X className="text-txt-primary h-4 w-4" />
                        </button>

                        {/* File info */}
                        <div className="text-txt-primary absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-xs">
                          {image.file ? (
                            <div>
                              <div>{formatFileSize(image.file.size)}</div>
                              {image.originalSize &&
                                image.compressedSize &&
                                image.originalSize !== image.compressedSize && (
                                  <div className="text-lav-300">
                                    -{Math.round(image.compressionRatio || 0)}%
                                  </div>
                                )}
                            </div>
                          ) : (
                            <div>Hiện tại</div>
                          )}
                        </div>

                        {/* Format indicator */}
                        {image.isExisting ? (
                          <div className="bg-lav-400 absolute top-1 left-1 rounded px-1 py-0.5 text-xs text-white">
                            Gốc
                          </div>
                        ) : (
                          <div className="bg-lav-500 absolute top-1 left-1 rounded px-1 py-0.5 text-xs text-white">
                            WebP
                          </div>
                        )}
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
          to={`/manga/uploaded/${mangaId}`}
          className="hover:bg-lav-500/5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)] transition-colors sm:w-28"
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
            <span className="text-txt-focus text-center text-sm font-semibold">
              Xem trước
            </span>
          </button>

          <button
            type="button"
            onClick={handleExternalSubmit}
            disabled={!title.trim() || previewImages.length === 0 || isLoading}
            className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#D373FF] hover:to-[#C962F9] disabled:cursor-not-allowed disabled:opacity-50 sm:w-52"
          >
            <span className="text-center text-sm font-semibold text-black">
              {compressionProgress.isCompressing
                ? "Đang nén ảnh..."
                : isLoading
                  ? "Đang xử lý..."
                  : "Cập nhật"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
