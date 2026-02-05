import { useRef, useState, useMemo, useEffect } from "react"; 
import { toast, Toaster } from "react-hot-toast";
import { Link, redirect, useActionData, useFetcher, useParams, useLoaderData } from "react-router";
import { ArrowLeft, BookOpen, FileText, Upload, X } from "lucide-react";

import { createChapter } from "@/mutations/chapter.mutation";

import type { Route } from "./+types/manga.chapter.create.$mangaId";

import { ChapterDetail } from "~/components/chapter-detail";
import { BusinessError } from "~/helpers/errors.helper";
import { useFileOperations } from "~/hooks/use-file-operations";
import {
  compressMultipleImages,
  formatFileSize,
  getImageSegmentMeta,
  mergeImagesVertically,
  splitLongImages,
  validateImageFile,
} from "~/utils/image-compression.utils";
import { selectWatermarkIndexes } from "~/utils/watermark-selection.utils";

// BEGIN <feature> CHAPTER_LOADER_IMPORTS_PERMISSION>
import { getMangaByIdAndOwner } from "@/queries/manga.query";
import { requireLogin } from "~/.server/services/auth.server";
import { resolveMangaHandle } from "~/database/helpers/manga-slug.helper";
import { isAdmin } from "~/helpers/user.helper";
// END <feature> CHAPTER_LOADER_IMPORTS_PERMISSION>

interface PreviewImage {
  file: File;
  url: string;
  id: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
}

interface CompressionProgress {
  isCompressing: boolean;
  current: number;
  total: number;
}

// BEGIN <feature> CHAPTER_CREATE_LOADER_FETCH_GENRES>
export async function loader({ params, request }: Route.LoaderArgs) {
  const { mangaId } = params;
  const user = await requireLogin(request);
  const isAdminUser = isAdmin(user.role);

  if (!mangaId) {
    throw new BusinessError("Không tìm thấy manga ID");
  }

  const manga = await getMangaByIdAndOwner(mangaId, user.id, isAdminUser);
  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  // Block creating additional chapters for unapproved manga (non-admin)
  if (!isAdminUser && manga.status !== 1 /* MANGA_STATUS.APPROVED */ && (manga.chapters || 0) >= 1) {
    throw new BusinessError("Truyện chưa duyệt chỉ được đăng tối đa 1 chương. Vui lòng chờ duyệt.");
  }

  // Trả tối thiểu để giảm bề mặt dữ liệu
  return {
    manga: {
      id: manga.id,
      status: manga.status,
      chapters: manga.chapters,
      genres: Array.isArray(manga.genres) ? manga.genres : [],
    },
    isAdminUser,
  };
}
// END <feature> CHAPTER_CREATE_LOADER_FETCH_GENRES>

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const formData = await request.formData();
    const mangaHandle = params.mangaId;

    if (!mangaHandle) {
      throw new BusinessError("Không tìm thấy manga ID");
    }

    const target = await resolveMangaHandle(mangaHandle);
    if (!target) {
      throw new BusinessError("Không tìm thấy truyện");
    }
    const mangaId = String((target as any).id ?? (target as any)._id ?? "");

    const title = formData.get("title") as string | null;
    const contentUrls = JSON.parse(formData.get("contentUrls") as string);

    if (!contentUrls || contentUrls.length === 0) {
      throw new BusinessError("Vui lòng tải lên ít nhất một ảnh");
    }

  await createChapter(request, {
      // Allow blank: server will normalize to "Chap N" after numbering if empty
      title: (title ?? "").trim(),
      contentUrls,
      mangaId,
    });

  // Sau khi tạo chương, điều hướng về trang preview của manga
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

export default function CreateChapter() {
  const { mangaId } = useParams();
  const fetcher = useFetcher<typeof action>();
  const [title, setTitle] = useState("");
  const [contents, setContents] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; active: boolean }>({ current: 0, total: 0, active: false });
  const [isCancellingUpload, setIsCancellingUpload] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress>({
    isCompressing: false,
    current: 0,
    total: 0,
  });
  const [folderSupported, setFolderSupported] = useState(false);
  const [mergeTailEnabled, setMergeTailEnabled] = useState(false);
  const [mergeTailCount, setMergeTailCount] = useState(5);
  const [watermarkStyle, setWatermarkStyle] = useState<"glow" | "stroke">("glow");

  // Dropzone highlight
  const [dragOver, setDragOver] = useState(false);

  // Card drag-sort states
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const actionData = useActionData<typeof action>();
  const responseData = fetcher.data || actionData;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingServerSubmitRef = useRef(false);
  const uploadSessionRef = useRef<ReturnType<typeof uploadMultipleFilesCancelable> | null>(null);
  const { uploadMultipleFilesCancelable } = useFileOperations();

  // (1) Natural-sort collator (memo hoá)
  const collator = useMemo(
    () => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }),
    []
  );
  // (2) Feature-detect webkitdirectory để ẩn nút nếu không hỗ trợ
  useEffect(() => {
    if (typeof document === "undefined") return;
    const input = document.createElement("input");
    setFolderSupported("webkitdirectory" in (input as any));
  }, []);

  // === helper: move item in array ===
  const move = <T,>(arr: T[], from: number, to: number) => {
    const a = arr.slice();
    const [it] = a.splice(from, 1);
    a.splice(to, 0, it);
    return a;
  };

  const cleanupUploadedFiles = async (fullPaths: string[]) => {
    if (!fullPaths.length) return;
    const chunkSize = 100;
    for (let i = 0; i < fullPaths.length; i += chunkSize) {
      const chunk = fullPaths.slice(i, i + chunkSize);
      const formData = new FormData();
      formData.append("fullPaths", JSON.stringify(chunk));
      const response = await fetch("/api/files/delete", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Không thể xóa file đã tải lên");
      }
    }
  };

  const handleCancelUpload = () => {
    if (!uploadSessionRef.current) {
      return;
    }
    setIsCancellingUpload(true);
    uploadSessionRef.current.cancel();
  };

  // BEGIN <feature> CHAPTER_CREATE_USE_GENRES_FROM_LOADER>
  const { manga, isAdminUser } = useLoaderData<typeof loader>();
  const genres: string[] = Array.isArray(manga?.genres) ? (manga.genres as string[]) : [];
  const skipCompression = genres.some((g) =>
    ["manhwa", "manhua"].includes(String(g).toLowerCase()),
  );
  // END <feature> CHAPTER_CREATE_USE_GENRES_FROM_LOADER>

  // unified add files (used by input change & drag-drop)
  const addFiles = async (filesLike: FileList | File[]) => {
    const list = Array.from(filesLike);
    if (list.length === 0) return;

    // Validate first
    try {
      list.forEach((file) => validateImageFile(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "File không hợp lệ");
      return;
    }

    const splitList = await splitLongImages(list, { maxHeight: 3000 });

    // BEGIN <feature> CHAPTER_SKIP_COMPRESSION_ADD_FILES>
    if (skipCompression) {
      // KHÔNG nén + KHÔNG đổi WebP: dùng file gốc
      const now = Date.now();
      const newPreviewImages: PreviewImage[] = splitList.map((file, index) => ({
        file,
        url: URL.createObjectURL(file),
        id: `${now}-${index}`,
        originalSize: file.size,
      }));
      setContents((prev) => [...prev, ...splitList]);
      setPreviewImages((prev) => [...prev, ...newPreviewImages]);
      const totalSize = splitList.reduce((a, f) => a + f.size, 0);
      toast.success(
        `Đã thêm ${splitList.length} ảnh (KHÔNG nén, KHÔNG đổi WebP) • Tổng ~${formatFileSize(
          totalSize,
        )}`,
      );
      return;
    }
    // END <feature> CHAPTER_SKIP_COMPRESSION_ADD_FILES>

    // Progress start
    setCompressionProgress({
      isCompressing: true,
      current: 0,
      total: splitList.length,
    });

    try {
      toast.loading("Đang tối ưu dung lượng ảnh", { id: "compression" });

      const compressionResults = await compressMultipleImages(splitList, (current, total) => {
        setCompressionProgress({
          isCompressing: true,
          current,
          total,
        });
      });

      const compressedFiles = compressionResults.map((r) => r.compressedFile);
      setContents((prev) => [...prev, ...compressedFiles]);

      const now = Date.now();
      const newPreviewImages: PreviewImage[] = compressionResults.map((result, index) => {
        const url = URL.createObjectURL(result.compressedFile);
        return {
          file: result.compressedFile,
          url,
          id: `${now}-${index}`,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          compressionRatio: result.compressionRatio,
        };
      });

      setPreviewImages((prev) => [...prev, ...newPreviewImages]);

      if (isAdminUser) {
        const totalOriginalSize = compressionResults.reduce((acc, curr) => acc + curr.originalSize, 0);
        const totalCompressedSize = compressionResults.reduce((acc, curr) => acc + curr.compressedSize, 0);
        const totalSavings = ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100;
        toast.success(
          `Đã tối ưu ${splitList.length} ảnh thành công! Tiết kiệm ${formatFileSize(
            totalOriginalSize - totalCompressedSize,
          )} (${Math.round(totalSavings)}%)`,
          { id: "compression" },
        );
      } else {
        toast.success(`Đã tối ưu ${splitList.length} ảnh thành công!`, { id: "compression" });
      }
    } catch (error) {
      console.error("Error compressing images:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra. Vui lòng thử lại.",
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

  // keep original handler but route to addFiles
  const handlePagesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await addFiles(files);
    // Reset to allow re-select same files
    event.target.value = "";
  };

  const removePreviewImage = (id: string) => {
    setPreviewImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url);
        // Also remove from contents array
        setContents((prevContents) => prevContents.filter((file) => file !== imageToRemove.file));
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

  // ====== BEGIN <feature> FOLDER_PICKER_SUPPORT_REFS> ======
  const folderInputRef = useRef<HTMLInputElement>(null);

  const IMAGE_EXT = ["jpg","jpeg","png","webp","gif","bmp","tiff","tif"];
  const isImageName = (name: string) =>
    IMAGE_EXT.includes(name.split(".").pop()?.toLowerCase() || "");

  // (3) Helper loại file ẩn/rác + path utils
  const pathOf = (f: File) => (f as any).webkitRelativePath || f.name;
  const nameOf = (p: string) => p.split("/").pop() || p;
  const isHiddenFile = (f: File) => nameOf(pathOf(f)).startsWith(".");

  // (4) Giới hạn & ngưỡng hiển thị toast sắp xếp
  const MAX_FILES = 1200;
  const TOAST_SORT_THRESHOLD = 300;

  const handleFolderPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const all = Array.from(e.target.files || []);
    if (!all.length) return;

    // (3) Lọc ảnh + bỏ file ẩn
    let onlyImages = all
      .filter((f) => (f.type && f.type.startsWith("image/")) || isImageName(f.name))
      .filter((f) => !isHiddenFile(f));

    if (onlyImages.length === 0) {
      toast.error("Không tìm thấy ảnh trong thư mục đã chọn");
      e.target.value = "";
      return;
    }

    // (4) Giới hạn số lượng lớn + confirm
    if (onlyImages.length > MAX_FILES) {
      const ok = confirm(`Thư mục có ${onlyImages.length} ảnh. Chỉ lấy ${MAX_FILES} ảnh đầu, OK?`);
     if (!ok) { e.target.value = ""; return; }
      onlyImages = onlyImages.slice(0, MAX_FILES);
    }

    // (6) Toast khi nhiều ảnh để UX mượt hơn
    const needSortToast = onlyImages.length > TOAST_SORT_THRESHOLD;
    if (needSortToast) toast.loading(`Đang sắp xếp ${onlyImages.length} ảnh...`, { id: "folder-sort" });

    // (5) Sort ổn định theo thư mục -> tên (dùng collator memo)
    const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
    onlyImages.sort((a, b) => {
      const pa = pathOf(a), pb = pathOf(b);
      const da = dirOf(pa), db = dirOf(pb);
      const byDir = collator.compare(da, db);
      if (byDir !== 0) return byDir;
      const byName = collator.compare(nameOf(pa), nameOf(pb));
      if (byName !== 0) return byName;
      return (a.lastModified || 0) - (b.lastModified || 0);
    });

    if (needSortToast) toast.dismiss("folder-sort");

    await addFiles(onlyImages);

    // Cho phép chọn lại cùng thư mục
    e.target.value = "";
  };


  const triggerFolderInput = () => {
    if (compressionProgress.isCompressing) {
      toast.error("Đang nén ảnh, vui lòng chờ...");
      return;
    }
    folderInputRef.current?.click();
  };
  // ====== END <feature> FOLDER_PICKER_SUPPORT_REFS> ======

  const buildWatermarkSelection = (files: File[]) => {
    const groupIndexById = new Map<string, number>();
    let groupCount = 0;
    files.forEach((file, idx) => {
      const meta = getImageSegmentMeta(file);
      const groupId = meta.groupId || `${file.name}-${idx}`;
      if (!groupIndexById.has(groupId)) {
        groupIndexById.set(groupId, groupCount);
        groupCount += 1;
      }
    });

    return {
      groupIndexById,
      watermarkIndexes: selectWatermarkIndexes(groupCount),
    };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (contents.length === 0) {
      toast.error("Vui lòng tải lên ít nhất một ảnh trước khi xem trước");
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

    let uploadContents = contents;
    if (isAdminUser && mergeTailEnabled) {
      const safeCount = Math.max(2, Math.min(mergeTailCount, contents.length));
      if (safeCount >= 2 && contents.length >= safeCount) {
        try {
          const tail = contents.slice(-safeCount);
          const head = contents.slice(0, Math.max(0, contents.length - safeCount));
          const tailMime = tail[tail.length - 1]?.type || "image/webp";
          const tailExt =
            tailMime === "image/png"
              ? "png"
              : tailMime === "image/jpeg" || tailMime === "image/jpg"
                ? "jpg"
                : tailMime === "image/webp"
                  ? "webp"
                  : "webp";
          const merged = await mergeImagesVertically(tail, {
            outputName: `merged-tail-${Date.now()}.${tailExt}`,
            outputMime: tailMime,
          });
          uploadContents = [...head, merged];
        } catch (mergeError) {
          const message =
            mergeError instanceof Error
              ? mergeError.message
              : "Không thể ghép ảnh cuối. Vui lòng thử lại hoặc tắt tùy chọn.";
          toast.error(message);
          setIsSubmitting(false);
          return;
        }
      }
    }

    const { groupIndexById, watermarkIndexes } = buildWatermarkSelection(uploadContents);

    // Prepare files for upload - only content pages
    let watermarkOrder = 0;
    const filesToUpload = uploadContents.map((file, idx) => {
      const meta = getImageSegmentMeta(file);
      const groupId = meta.groupId || `${file.name}-${idx}`;
      const groupIndex = groupIndexById.get(groupId) ?? idx;
      const shouldWatermark = !meta.noWatermark && watermarkIndexes.has(groupIndex);
      if (!shouldWatermark) {
        return { file, options: { prefixPath: "manga-images" } };
      }

      watermarkOrder += 1;
      const watermarkVariant = watermarkOrder % 2 === 1 ? (1 as const) : (2 as const);

      return {
        file,
        options: {
          prefixPath: "manga-images",
          watermark: true,
          watermarkVariant,
          watermarkStyle,
        },
      };
    });

    setUploadProgress({ current: 0, total: filesToUpload.length, active: true });

    const uploadSession = uploadMultipleFilesCancelable(filesToUpload, (done, total) => {
      setUploadProgress({ current: done, total, active: true });
    });
    uploadSessionRef.current = uploadSession;

    try {
      const uploadResults = await uploadSession.promise;
      uploadSessionRef.current = null;

      // Get content URLs
      const contentUrls = uploadResults.map((result) => result.url);

      // Create chapter using fetcher
      const formData = new FormData();
  // Send raw trimmed title (can be empty). Server mutation will auto-fill.
  formData.append("title", (title ?? "").trim());
      formData.append("contentUrls", JSON.stringify(contentUrls));

      setUploadProgress({ current: uploadResults.length, total: uploadResults.length, active: false });
      setIsCancellingUpload(false);

      pendingServerSubmitRef.current = true;
      fetcher.submit(formData, { method: "POST" });
    } catch (error) {
      const uploaded = uploadSessionRef.current?.getUploadedResults() || [];
      uploadSessionRef.current = null;

      const uploadedPaths = uploaded.map((item) => item.fullPath).filter(Boolean);
      if (uploadedPaths.length) {
        try {
          await cleanupUploadedFiles(uploadedPaths);
        } catch (cleanupError) {
          console.error("cleanupUploadedFiles failed", cleanupError);
          toast.error("Không thể xóa các ảnh đã tải lên. Vui lòng kiểm tra lại sau.");
        }
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        toast.success("Đã hủy tải lên");
      } else {
        const message =
          error instanceof Error ? error.message : "Có lỗi xảy ra khi upload file";
        toast.error(message);
      }

      setIsSubmitting(false);
      setUploadProgress({ current: 0, total: 0, active: false });
      setIsCancellingUpload(false);
      pendingServerSubmitRef.current = false;
    } finally {
      uploadSessionRef.current = null;
    }
  };

  const handleExternalSubmit = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  // Update loading state based on fetcher
  const isLoading =
    isSubmitting || fetcher.state === "submitting" || compressionProgress.isCompressing || uploadProgress.active;

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    if (!pendingServerSubmitRef.current) return;

    pendingServerSubmitRef.current = false;
    setIsSubmitting(false);
    setUploadProgress({ current: 0, total: 0, active: false });
  }, [fetcher.state]);

  useEffect(() => {
    if (!responseData?.error?.message) return;
    toast.error(responseData.error.message);
  }, [responseData?.error?.message]);

  const handlePreview = () => {
    if (contents.length === 0) {
      toast.error("Vui lòng tải lên ít nhất một ảnh");
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

  // Drag & Drop for dropzone
  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (compressionProgress.isCompressing) {
      toast.error("Đang nén ảnh, vui lòng chờ...");
      return;
    }
    const { files } = e.dataTransfer;
    if (files && files.length > 0) {
      await addFiles(files);
    }
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  };

  // Drag-sort handlers for cards
  const onCardDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
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

    // Reorder previewImages
    setPreviewImages((prev) => {
      const reordered = move(prev, from, to);
      // Keep contents in the same order
      setContents(reordered.map((p) => p.file));
      return reordered;
    });

    setDraggingIndex(null);
    setOverIndex(null);
  };

  const onCardDragEnd = () => {
    setDraggingIndex(null);
    setOverIndex(null);
  };

  const previewGroupIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let next = 0;
    previewImages.forEach((img) => {
      if (!img.file) return;
      const meta = getImageSegmentMeta(img.file);
      const groupId = meta.groupId || `file-${img.id}`;
      if (!map.has(groupId)) {
        map.set(groupId, next);
        next += 1;
      }
    });
    return map;
  }, [previewImages]);

  const getPreviewIndexLabel = (image: PreviewImage, fallbackIndex: number) => {
    if (!image.file) return String(fallbackIndex + 1);
    const meta = getImageSegmentMeta(image.file);
    const groupId = meta.groupId || `file-${image.id}`;
    const groupIndex = previewGroupIndexMap.get(groupId);
    const base = (typeof groupIndex === "number" ? groupIndex : fallbackIndex) + 1;
    if (meta.segmentCount && meta.segmentCount > 1) {
      return `${base}.${(meta.segmentIndex ?? 0) + 1}`;
    }
    return String(base);
  };
 // (7) Cleanup URL preview khi unmount (bảo hiểm rò rỉ)
 const latestPreviewsRef = useRef<PreviewImage[]>([]);
 useEffect(() => {
   latestPreviewsRef.current = previewImages;
 }, [previewImages]);
 useEffect(() => {
   return () => {
     try {
       latestPreviewsRef.current.forEach((img) => URL.revokeObjectURL(img.url));
     } catch {}
   };
 }, []);

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
    breadcrumb: "Preview > Manga > " + (title || "Chương mới"),
    breadcrumbItems: [
      { label: "Trang chủ", href: "/" },
      { label: "Preview", href: mangaId ? `/truyen-hentai/${mangaId}` : undefined },
      { label: title || "Chương mới" },
    ],
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

          {/* Compression Progress */}
          {compressionProgress.isCompressing && (
            <div className="bg-lav-500/10 w-full rounded p-3">
              <div className="text-lav-500 flex items-center justify-between text-sm font-medium">
                <span>
                  Đang tối ưu ảnh {compressionProgress.current}/{compressionProgress.total}
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
          <div className="flex flex-col gap-2">
            <label htmlFor="chapter-create-title" className="flex items-center gap-1.5 text-txt-primary text-base font-semibold">
              <BookOpen className="text-txt-secondary h-4 w-4" />
              <span>Tiêu đề</span>
            </label>

            <div className="flex flex-col gap-2">
              <input
                id="chapter-create-title"
                type="text"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tên chương, nếu bỏ trống, hệ thống sẽ tự đánh số"
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
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                aria-label="Khu vực kéo-thả ảnh"
              >
                {/* Hidden file input (files) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  name="pages"
                  multiple
                  required={contents.length === 0}
                  accept="image/*"
                  onChange={handlePagesChange}
                  className="sr-only"
                  disabled={compressionProgress.isCompressing}
                />

                {/* BEGIN <feature> FOLDER_PICKER_INPUT_HIDDEN> */}
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFolderPick}
                  className="sr-only"
                  // Cho phép chọn cả thư mục (non-standard)
                  // @ts-expect-error - non-standard attribute for Chrome/Edge/Safari
                  webkitdirectory=""
                />
                {/* END <feature> FOLDER_PICKER_INPUT_HIDDEN> */}

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

                  {/* BEGIN <feature> FOLDER_PICKER_BUTTON_MOBILE> */}
                  {folderSupported && (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={triggerFolderInput}
                        disabled={compressionProgress.isCompressing}
                        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#D373FF] hover:to-[#C962F9] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Upload className="h-5 w-5 text-black" />
                        <span className="text-center text-sm font-semibold text-black">Chọn thư mục</span>
                      </button>
                    </div>
                  )}
                  {/* END <feature> FOLDER_PICKER_BUTTON_MOBILE> */}

                  <span className="text-txt-primary text-center text-sm font-medium">
                    {compressionProgress.isCompressing
                      ? "Đang xử lý ảnh..."
                      : "Click hoặc kéo-thả ảnh vào vùng này"}
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

                  {/* BEGIN <feature> FOLDER_PICKER_BUTTON_DESKTOP> */}
                  {folderSupported && (
                    <div className="mt-2 flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={triggerFolderInput}
                        disabled={compressionProgress.isCompressing}
                        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#D373FF] hover:to-[#C962F9] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Upload className="h-5 w-5 text-black" />
                        <span className="text-center text-sm font-semibold text-black">Chọn thư mục</span>
                      </button>
                    </div>
                  )}
                  {/* END <feature> FOLDER_PICKER_BUTTON_DESKTOP> */}

                  <span className="text-txt-primary text-center text-sm font-medium">
                    {compressionProgress.isCompressing
                      ? "Đang xử lý ảnh..."
                      : "Hoặc kéo-thả ảnh vào vùng này"}
                  </span>
                </div>
              </div>

              {/* BEGIN <feature> CHAPTER_CREATE_COPY_BY_SKIP_FLAG> */}
              <p className="text-txt-secondary text-center text-sm leading-tight font-medium">
                {skipCompression
                  ? "Ảnh sẽ được giữ nguyên định dạng/kích thước (KHÔNG nén, KHÔNG chuyển đổi) để đảm bảo chất lượng tốt nhất cho Manhwa/Manhua."
                  : "Ảnh sẽ được tự động tối ưu hóa để tăng tốc độ tải và trải nghiệm đọc."}
              </p>
              {/* END <feature> CHAPTER_CREATE_COPY_BY_SKIP_FLAG> */}

              {/* BEGIN <feature> FOLDER_PICKER_HELP_TEXT> */}
              <p className="text-txt-secondary text-center text-sm leading-tight font-medium">
                Ngoài việc chọn một hoặc nhiều ảnh, bạn có thể <b>chọn cả thư mục</b>; hệ thống sẽ tự tìm và thêm toàn bộ ảnh trong thư mục đó.
              </p>
              {/* END <feature> FOLDER_PICKER_HELP_TEXT> */}

              <p className="text-txt-secondary text-center text-sm leading-tight font-medium">
                Truyện ghép từ các ảnh ngắn sẽ tải nhanh hơn. Ảnh giữ nguyên thứ tự khi upload; có thể kéo-thả để đổi thứ tự hiển thị.
              </p>

              <div className="bg-bgc-layer2 border-bd-default mt-2 flex w-full flex-col gap-3 rounded-xl border px-3 py-3">
                <div className="text-txt-primary text-sm font-semibold">Chọn kiểu watermark</div>
                <label className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="watermarkStyle"
                    value="glow"
                    checked={watermarkStyle === "glow"}
                    onChange={() => setWatermarkStyle("glow")}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="flex flex-col">
                    <span className="text-txt-primary text-sm font-semibold">Glow tím hồng (mặc định)</span>
                    <span className="text-txt-secondary text-xs">
                      Phù hợp truyện có màu, truyện 3D. Chữ có hiệu ứng glow tím-hồng.
                    </span>
                  </div>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="watermarkStyle"
                    value="stroke"
                    checked={watermarkStyle === "stroke"}
                    onChange={() => setWatermarkStyle("stroke")}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="flex flex-col">
                    <span className="text-txt-primary text-sm font-semibold">Stroke đen/trắng (không glow)</span>
                    <span className="text-txt-secondary text-xs">
                      Phù hợp truyện không màu, trắng đen. Chỉ viền stroke theo màu nền (đen khi chữ trắng, trắng khi chữ đen).
                    </span>
                  </div>
                </label>
              </div>

              {isAdminUser && (
                <div className="bg-bgc-layer2 border-bd-default mt-2 flex w-full flex-col items-center gap-2 rounded-xl border px-3 py-2.5">
                  <label className="text-txt-primary flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={mergeTailEnabled}
                      onChange={(e) => setMergeTailEnabled(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span>Ghép ảnh cuối thành 1 ảnh khi upload</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-txt-secondary text-sm">Số ảnh ghép:</span>
                    <input
                      type="number"
                      min={2}
                      max={50}
                      value={mergeTailCount}
                      onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10);
                        if (Number.isNaN(next)) return;
                        setMergeTailCount(Math.max(2, Math.min(50, next)));
                      }}
                      disabled={!mergeTailEnabled}
                      className="bg-bgc-layer1 border-bd-default text-txt-primary w-20 rounded-lg border px-2 py-1 text-center text-sm font-semibold disabled:opacity-50"
                    />
                  </div>

                  <p className="text-txt-secondary text-center text-xs leading-tight">
                    Chỉ admin: sau khi nén và watermark, hệ thống sẽ ghép N ảnh cuối thành 1 ảnh trước khi upload.
                  </p>
                </div>
              )}

              {/* Preview Images - Below text */}
              {previewImages.length > 0 && (
                <div className="mt-4 w-full">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {previewImages.map((image, idx) => (
                      <div
                        key={image.id}
                        className={[
                          "group relative select-none",
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
                            alt={image.file.name || "Preview"}
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

                        {/* BEGIN <feature> CHAPTER_CREATE_DYNAMIC_BADGE_FORMAT> */}
                        <div className="absolute top-1 left-1 flex flex-col items-start gap-1">
                          <div className="bg-lav-500 rounded px-1 py-0.5 text-xs text-white">
                            {(image.file.type?.split("/")[1] ||
                              image.file.name.split(".").pop() ||
                              "IMG"
                            ).toUpperCase()}
                          </div>
                          <div className="rounded bg-black/70 px-1 py-0.5 text-[11px] leading-none text-white">
                            {formatFileSize(image.file.size)}
                            {isAdminUser &&
                              image.originalSize &&
                              image.compressedSize &&
                              image.originalSize !== image.compressedSize && (
                                <span className="ml-1 text-lav-300">
                                  -{Math.round(image.compressionRatio || 0)}%
                                </span>
                              )}
                          </div>
                        </div>
                        {/* END <feature> CHAPTER_CREATE_DYNAMIC_BADGE_FORMAT> */}

                        {/* position + filename under thumbnail */}
                        <div className="mt-1 w-full">
                          <div className="text-txt-primary text-xs font-semibold">
                            #{getPreviewIndexLabel(image, idx)}
                          </div>
                          <div
                            className="text-txt-secondary text-[11px] leading-tight truncate"
                            title={image.file.name}
                          >
                            {image.file.name}
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

      {uploadProgress.active && (
        <div className="bg-fuchsia-500/10 border-bd-default flex w-full flex-col gap-3 rounded-xl border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-fuchsia-400 text-sm font-medium">
              Đang tải lên {uploadProgress.current}/{uploadProgress.total} ảnh...
            </div>
            <div className="flex items-center gap-3">
              <span className="text-fuchsia-400 text-sm font-semibold">
                {uploadProgress.total > 0
                  ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
                  : 0}%
              </span>
              <button
                type="button"
                onClick={handleCancelUpload}
                disabled={isCancellingUpload}
                className="border-fuchsia-300 text-fuchsia-100 hover:bg-fuchsia-500/15 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancellingUpload ? "Đang hủy..." : "Hủy tải lên"}
              </button>
            </div>
          </div>
          <div className="bg-fuchsia-500/20 h-2 rounded-full">
            <div
              className="bg-fuchsia-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <Link
          to={`/truyen-hentai/preview/${mangaId}`}
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
            <span className="text-txt-focus text-center text-sm font-semibold">
              Xem trước
            </span>
          </button>

          <button
            type="button"
            onClick={handleExternalSubmit}
            disabled={contents.length === 0 || isLoading}
            className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#D373FF] hover:to-[#C962F9] disabled:cursor-not-allowed disabled:opacity-50 sm:w-52"
          >
            {compressionProgress.isCompressing || uploadProgress.active || isLoading ? (
              <span className="text-center text-sm font-semibold text-black whitespace-normal">
                {compressionProgress.isCompressing
                  ? "Đang tối ưu dung lượng ảnh..."
                  : uploadProgress.active
                    ? `Đang tải... ${uploadProgress.current}/${uploadProgress.total}`
                    : isLoading
                      ? "Đang xử lý..."
                      : "Tạo chương"}
              </span>
            ) : (
              <span className="text-center text-sm font-semibold text-black whitespace-nowrap">
                Tạo chương
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
