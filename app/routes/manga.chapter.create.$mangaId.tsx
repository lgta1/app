import { useRef, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import { Link, redirect, useActionData, useFetcher, useParams } from "react-router";
import { ArrowLeft, BookOpen, FileText, Upload, X } from "lucide-react";

import { createChapter } from "@/mutations/chapter.mutation";

import type { Route } from "./+types/manga.chapter.create.$mangaId";

import { ChapterDetail } from "~/components/chapter-detail";
import { BusinessError } from "~/helpers/errors.helper";
import { useFileOperations } from "~/hooks/use-file-operations";

interface PreviewImage {
  file: File;
  url: string;
  id: string;
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const formData = await request.formData();
    const mangaId = params.mangaId;

    if (!mangaId) {
      throw new BusinessError("Không tìm thấy manga ID");
    }

    const title = formData.get("title") as string;
    const contentUrls = JSON.parse(formData.get("contentUrls") as string);

    if (!title || !contentUrls || contentUrls.length === 0) {
      throw new BusinessError("Vui lòng điền đầy đủ thông tin");
    }

    await createChapter(request, {
      title: title.trim(),
      contentUrls,
      mangaId,
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

export default function CreateChapter() {
  const { mangaId } = useParams();
  const fetcher = useFetcher<typeof action>();
  const [title, setTitle] = useState("");
  const [contents, setContents] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const actionData = useActionData<typeof action>();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { uploadMultipleFiles } = useFileOperations();

  const handlePagesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setContents((prev) => [...prev, ...newFiles]);

      // Create preview images
      const newPreviewImages: PreviewImage[] = [];
      newFiles.forEach((file, index) => {
        const url = URL.createObjectURL(file);
        newPreviewImages.push({
          file,
          url,
          id: `${Date.now()}-${index}`,
        });
      });

      setPreviewImages((prev) => [...prev, ...newPreviewImages]);
    }

    // Reset input value to allow selecting the same files again
    event.target.value = "";
  };

  const removePreviewImage = (id: string) => {
    setPreviewImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url);
        // Also remove from contents array
        setContents((prevContents) =>
          prevContents.filter((file) => file !== imageToRemove.file),
        );
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(0)) + sizes[i];
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim() || contents.length === 0) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (!mangaId) {
      toast.error("Không tìm thấy manga ID");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare files for upload - only content pages
      const filesToUpload = contents.map((file) => ({
        file,
        options: {
          bucket: "manga-images",
          category: "pages",
        },
      }));

      // Upload all files
      const uploadResults = await uploadMultipleFiles(filesToUpload);

      // Get content URLs
      const contentUrls = uploadResults.map((result) => result.url);

      // Create chapter using fetcher
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("contentUrls", JSON.stringify(contentUrls));

      fetcher.submit(formData, { method: "POST" });
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
  const isLoading = isSubmitting || fetcher.state === "submitting";

  // Sử dụng data từ fetcher nếu có, nếu không thì dùng actionData
  const responseData = fetcher.data || actionData;

  const handlePreview = () => {
    if (!title.trim() || contents.length === 0) {
      toast.error("Vui lòng điền đầy đủ thông tin trước khi xem trước");
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
    chapterNumber: 1,
    contentUrls: previewImages.map((img) => img.url),
    mangaId: mangaId || "",
    viewNumber: 0,
    likeNumber: 0,
    commentNumber: 0,
    status: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    breadcrumb: "Preview > Manga > " + (title || "Chương mới"),
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
          Đăng chương mới
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
                  required={contents.length === 0}
                  accept="image/*"
                  onChange={handlePagesChange}
                  className="sr-only"
                />

                {/* Upload Button and Text - Mobile: centered, Desktop: absolutely positioned */}
                <div className="flex flex-col items-center gap-3 lg:hidden">
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#D373FF] hover:to-[#C962F9]"
                  >
                    <Upload className="h-5 w-5 text-black" />
                    <span className="text-center text-sm font-semibold text-black">
                      {previewImages.length > 0 ? "Thêm ảnh" : "Tải ảnh lên"}
                    </span>
                  </button>
                  <span className="text-txt-primary text-center text-sm font-medium">
                    Click để {previewImages.length > 0 ? "thêm ảnh mới" : "tải ảnh lên"}
                  </span>
                </div>

                {/* Upload Button and Text - Desktop only: Absolutely positioned in center */}
                <div className="absolute top-[72px] left-[277px] hidden w-32 flex-col items-center justify-center gap-3 lg:flex">
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#D373FF] hover:to-[#C962F9]"
                  >
                    <Upload className="h-5 w-5 text-black" />
                    <span className="text-center text-sm font-semibold text-black">
                      {previewImages.length > 0 ? "Thêm ảnh" : "Tải ảnh lên"}
                    </span>
                  </button>
                  <span className="text-txt-primary text-center text-sm font-medium">
                    Click để {previewImages.length > 0 ? "thêm ảnh mới" : "tải ảnh lên"}
                  </span>
                </div>
              </div>

              <p className="text-txt-secondary text-sm leading-tight font-medium">
                Kích thước ảnh lớn nhất 2000 x 8000 pixel, văn bản không vượt quá 10MB.
              </p>
              <p className="text-txt-secondary text-sm leading-tight font-medium">
                Tác phẩm uược ghép từ các ảnh ngắn sẽ tải nhanh hơn và đẹp hơn là ghép từ
                nhiều ảnh dài
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

                        {/* File size */}
                        <div className="text-txt-primary absolute bottom-1 left-1 rounded bg-black/70 px-2 py-1 text-xs">
                          {formatFileSize(image.file.size)}
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
          to={`/manga/edit/${mangaId}?new=true`}
          className="hover:bg-lav-500/5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)] transition-colors sm:w-28"
        >
          <ArrowLeft className="text-txt-focus h-5 w-5" />
          <span className="text-txt-focus text-center text-sm font-semibold">Trở về</span>
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handlePreview}
            className="border-lav-500 hover:bg-lav-500/5 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)] transition-colors sm:w-52"
          >
            <span className="text-txt-focus text-center text-sm font-semibold">
              Xem trước
            </span>
          </button>

          <button
            type="button"
            onClick={handleExternalSubmit}
            disabled={!title.trim() || contents.length === 0 || isLoading}
            className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#D373FF] hover:to-[#C962F9] disabled:cursor-not-allowed disabled:opacity-50 sm:w-52"
          >
            <span className="text-center text-sm font-semibold text-black">
              {isLoading ? "Đang xử lý..." : "Gửi duyệt"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
