import { useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  type ClientActionFunctionArgs,
  Link,
  useFetcher,
  useRevalidator,
  useSubmit,
} from "react-router";
import {
  CheckCircle,
  Edit,
  Menu,
  Plus,
  XCircle,
  Upload,
  Loader2,
  Info,
  Trash2,
  Sparkles,
} from "lucide-react";

import { useFileOperations } from "~/hooks/use-file-operations"; // giống chapter.create
import { MangaDetail } from "~/components/manga-detail";
import DownloadChaptersDialog from "~/components/download-chapters-dialog";
import {
  compressMultipleImages,
  generatePosterVariants,
  getImageSegmentMeta,
  splitLongImages,
} from "~/utils/image-compression.utils";
import type { PosterVariantsPayload } from "~/utils/poster-variants.utils";
import { deletePublicFiles } from "~/utils/minio.utils";
import { collectPosterVariantPaths, parsePosterVariantsPayload } from "~/.server/utils/poster-variants.server";
import { selectWatermarkIndexes } from "~/utils/watermark-selection.utils";

import { getChaptersByMangaId } from "@/queries/chapter.query";
import { getMangaByIdAndOwner } from "@/queries/manga.query";

import type { Route } from "./+types/truyen-hentai.preview.$id";

import {
  approveManga,
  deleteManga,
  rejectManga,
  submitMangaToReview,
  updateManga,
} from "~/.server/mutations/manga.mutation";
import { requireLogin } from "~/.server/services/auth.server";
import { MANGA_STATUS, MANGA_USER_STATUS } from "~/constants/manga";
import { MangaModel } from "~/database/models/manga.model";
import { BusinessError } from "~/helpers/errors.helper";
import { toastWarning } from "~/helpers/toast.helper";
import { isAdmin, isDichGia, canBulkDownloadChapters } from "~/helpers/user.helper";
import { toSlug } from "~/utils/slug.utils";
import { formatDate, formatTime } from "~/utils/date.utils";
import { buildGenreDisplayMap } from "~/.server/utils/genre-display-map";

/* =================== LOADER / ACTION / META =================== */

export async function loader({ params, request }: Route.LoaderArgs) {
  const { id } = params;
  const user = await requireLogin(request);
  const isAdminUser = isAdmin(user.role);
  const isDichGiaUser = isDichGia(user.role);
  const userRole = user.role;

  const manga = await getMangaByIdAndOwner(id, user.id, isAdminUser);
  if (!manga) throw new BusinessError("Không tìm thấy truyện");

  const chaptersRaw = await getChaptersByMangaId(manga.id, user);
  const chapters = (Array.isArray(chaptersRaw) ? chaptersRaw : []).map((c: any) => ({
    ...c,
    id: String(c?.id ?? c?._id ?? ""),
  }));

  const isOwner = String(manga.ownerId) === String(user.id);

  const genreDisplayMap = await buildGenreDisplayMap(manga.genres as string[]);

  return { manga, chapters, isAdminUser, isOwner, isDichGiaUser, userRole, genreDisplayMap };
}

export async function action({ request, params }: Route.ActionArgs) {
  try {
    const { id } = params;
    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;

    const shiftPublished = async (amount: number, unit: "minute" | "hour" | "day" | "month") => {
      const { user, mangaId } = await ensureEditableManga(request, id);
      if (!isAdmin(user.role)) {
        throw new BusinessError("Chỉ admin mới có quyền cập nhật thời gian đăng");
      }

      const maxByUnit: Record<typeof unit, number> = {
        minute: 60 * 24 * 365 * 5,
        hour: 24 * 365 * 5,
        day: 365 * 10,
        month: 600,
      };

      const max = maxByUnit[unit];
      if (!Number.isFinite(amount) || amount <= 0 || amount > max) {
        const label = unit === "minute" ? "phút" : unit === "hour" ? "giờ" : unit === "day" ? "ngày" : "tháng";
        throw new BusinessError(`Số ${label} không hợp lệ (1–${max})`);
      }

      const shifted = new Date();
      switch (unit) {
        case "minute":
          shifted.setTime(shifted.getTime() - amount * 60_000);
          break;
        case "hour":
          shifted.setTime(shifted.getTime() - amount * 3_600_000);
          break;
        case "day":
          shifted.setTime(shifted.getTime() - amount * 86_400_000);
          break;
        case "month":
          shifted.setMonth(shifted.getMonth() - amount);
          break;
      }

      await MangaModel.findByIdAndUpdate(
        mangaId,
        { $set: { createdAt: shifted, updatedAt: shifted } },
        { timestamps: false },
      );

      const unitLabel = unit === "minute" ? "phút" : unit === "hour" ? "giờ" : unit === "day" ? "ngày" : "tháng";
      return {
        success: true,
        message: `Đã cập nhật thời gian đăng: lùi ${amount} ${unitLabel}`,
        createdAt: shifted.toISOString(),
        updatedAt: shifted.toISOString(),
      };
    };

    let result;
    switch (actionType) {
      case "approve":
        result = await approveManga(request, id);
        break;
      case "reject":
        result = await rejectManga(request, id);
        break;
      case "updatePoster": {
        const posterUrl = formData.get("posterUrl");
        if (typeof posterUrl !== "string" || !posterUrl.trim()) {
          throw new BusinessError("Vui lòng tải lên ảnh bìa hợp lệ");
        }
        const { mangaId } = await ensureEditableManga(request, id);
        const posterVariants = parsePosterVariantsPayload(formData.get("posterVariantsJson"));
        const existing = await MangaModel.findById(mangaId).lean();
        const nextPosterUrl = posterVariants?.w575?.url || posterUrl.trim();
        await MangaModel.updateOne(
          { _id: mangaId },
          { $set: { poster: nextPosterUrl, posterVariants: posterVariants || undefined } },
          { timestamps: false },
        );

        if (posterVariants && existing) {
          const oldPaths = collectPosterVariantPaths((existing as any).posterVariants, (existing as any).poster);
          const newPaths = collectPosterVariantPaths(posterVariants, nextPosterUrl);
          const toDelete = oldPaths.filter((p) => !newPaths.includes(p));
          if (toDelete.length) {
            try {
              await deletePublicFiles(toDelete);
            } catch (error) {
              console.warn("[preview] delete old poster variants failed", error);
            }
          }
        }

        result = { success: true, poster: nextPosterUrl, message: "Đã cập nhật ảnh bìa" };
        break;
      }
      case "updateUserStatus": {
        const statusRaw = Number(formData.get("userStatus"));
        const allowed = [MANGA_USER_STATUS.ON_GOING, MANGA_USER_STATUS.COMPLETED];
        if (!allowed.includes(statusRaw)) {
          throw new BusinessError("Trạng thái không hợp lệ");
        }
        const { mangaId } = await ensureEditableManga(request, id);
        await updateManga(request, mangaId, { userStatus: statusRaw });
        result = { success: true, userStatus: statusRaw, message: "Đã cập nhật trạng thái" };
        break;
      }
      case "addOneshotGenre": {
        const { mangaId } = await ensureEditableManga(request, id);
        await MangaModel.findByIdAndUpdate(
          mangaId,
          { $addToSet: { genres: "oneshot" } },
          { timestamps: false },
        );
        result = { success: true, added: true, message: "Đã chọn Oneshot (thêm thể loại oneshot)" };
        break;
      }
      case "deleteManga": {
        const { mangaId } = await ensureEditableManga(request, id);
        const deleted = await deleteManga(request, mangaId);
        result = { ...deleted, actionType: "deleteManga" };
        break;
      }
      case "shiftPublished": {
        const unitRaw = String(formData.get("unit") ?? "month").toLowerCase();
        const amountRaw = Number(formData.get("amount"));
        const amount = Number.isFinite(amountRaw) ? Math.trunc(amountRaw) : 0;
        const unit =
          unitRaw === "minute" || unitRaw === "hour" || unitRaw === "day" || unitRaw === "month"
            ? (unitRaw as "minute" | "hour" | "day" | "month")
            : "month";
        result = await shiftPublished(amount, unit);
        break;
      }
      // Backward-compat: old UI posts months only
      case "shiftPublishedMonths": {
        const monthsRaw = Number(formData.get("months"));
        const months = Number.isFinite(monthsRaw) ? Math.trunc(monthsRaw) : 0;
        result = await shiftPublished(months, "month");
        break;
      }
      case "submit":
      default:
        result = await submitMangaToReview(request, id);
        break;
    }
    return Response.json(result);
  } catch (error) {
    if (error instanceof BusinessError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

const ensureEditableManga = async (request: Request, handle?: string) => {
  if (!handle) {
    throw new BusinessError("Thiếu thông tin truyện");
  }
  const user = await requireLogin(request);
  const isAdminUser = isAdmin(user.role);
  const manga = await getMangaByIdAndOwner(handle, user.id, isAdminUser);
  if (!manga) {
    throw new BusinessError("Bạn không có quyền chỉnh sửa truyện này");
  }
  const mangaId = String((manga as any).id ?? (manga as any)._id ?? "");
  if (!mangaId) {
    throw new BusinessError("Không tìm thấy truyện để cập nhật");
  }
  return { user, manga, mangaId };
};

export const clientAction = async ({ serverAction }: ClientActionFunctionArgs) => {
  const result = await serverAction<{ success: boolean; message?: string; error?: string }>();
  if (result.success) toast.success(result.message || "Nộp truyện thành công!");
  else toast.error(result.error || "Có lỗi xảy ra khi nộp truyện!");
  return result;
};

export function meta({ data }: Route.MetaArgs) {
  if (!data?.manga) {
    return [
      { title: "Không tìm thấy truyện | VinaHentai" },
      { name: "description", content: "Trang truyện không tồn tại" },
    ];
  }
  return [
    { title: `${data.manga.title} | VinaHentai` },
    { name: "description", content: data.manga.description || `Preview ${data.manga.title} tại VinaHentai` },
  ];
}

/* =================== CONSTANTS / HELPERS =================== */

// Trạng thái chương không còn hiển thị tại trang Preview theo yêu cầu

// lọc file ảnh
const isImage = (f: File) =>
  /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(f.name);

// sort tự nhiên (2 < 10)
const nat = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

const NORMALIZED_CHAPTER_KEYWORDS: Record<string, string> = {
  chuong: "Chương",
  chapter: "Chapter",
  chap: "Chap",
};

const normalizeChapterTitle = (rawTitle?: string): string | null => {
  const trimmed = String(rawTitle || "").trim();
  if (!trimmed) return null;

  const oneshotCandidate = trimmed.toLowerCase().replace(/[-\s]+/g, "_");
  if (/^(?:\d+_)?oneshot(?:_\d+)?$/.test(oneshotCandidate)) {
    return "Oneshot";
  }

  const withoutPrefix = trimmed.replace(/^\s*\d+(?:[_\-\s]+)?/, "");
  const match = withoutPrefix.match(/^([a-zA-Z]+)[^\d]*(\d+)/);
  if (!match) return null;

  const [, keywordRaw, chapterNumber] = match;
  const normalizedKeyword = NORMALIZED_CHAPTER_KEYWORDS[keywordRaw.toLowerCase()];
  if (!normalizedKeyword) return null;

  const asNumber = Number(chapterNumber);
  const normalizedNumber = Number.isNaN(asNumber) ? chapterNumber : String(asNumber);

  return `${normalizedKeyword} ${normalizedNumber}`;
};

/* =================== COMPONENT =================== */

export default function Index({ loaderData }: Route.ComponentProps) {
  const { manga, chapters, isAdminUser, isOwner, isDichGiaUser, userRole, genreDisplayMap } = loaderData;
  const { uploadMultipleFiles } = useFileOperations();
  const mangaHandle = manga.slug || manga.id;

  const folderInputRef = useRef<HTMLInputElement>(null);
  const MAX_PER_CHAPTER = 300;

  const {
    id,
    title,
    poster: initialPoster,
    author,
    genres,
    viewNumber,
    description,
    updatedAt,
    followNumber,
    translationTeam,
    ownerId,
    status,
  } = manga;

  // Link "Thêm chương" có skipCompression theo genres
  const isSkipCompression =
    Array.isArray(genres) && genres.some((g: string) => ["manhwa", "manhua"].includes(String(g).toLowerCase()));

  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkApplyCompression, setBulkApplyCompression] = useState<boolean>(() => !isSkipCompression);
  const [bulkForceWatermarkAll, setBulkForceWatermarkAll] = useState(false);
  const [chapProgress, setChapProgress] = useState<{ done: number; total: number; current: string }>({
    done: 0,
    total: 0,
    current: "",
  });

  // Local editable chapters state so we can update titles inline without full reload
  const [localChapters, setLocalChapters] = useState(chapters || []);
  const [isNormalizingTitles, setIsNormalizingTitles] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  // Reorder (drag & drop) state
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [dragChapters, setDragChapters] = useState<any[]>(() => {
    const asc = Array.isArray(chapters)
      ? [...chapters].sort((a: any, b: any) => (Number(a.chapterNumber) || 0) - (Number(b.chapterNumber) || 0))
      : [];
    return asc;
  });
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const dragSrcIndexRef = useRef<number | null>(null);

  const revalidator = useRevalidator();
  const submit = useSubmit();
  const posterUpdateFetcher = useFetcher<typeof action>();
  const statusUpdateFetcher = useFetcher<typeof action>();
  const shiftPublishedFetcher = useFetcher<typeof action>();
  const deleteMangaFetcher = useFetcher<typeof action>();
  const pendingPosterUrlRef = useRef<string | null>(null);
  const pendingPosterVariantsRef = useRef<PosterVariantsPayload | null>(null);
  const pendingStatusRef = useRef<number | null>(null);
  const posterUpdateInFlightRef = useRef(false);
  const statusUpdateInFlightRef = useRef(false);

  const [shiftAmount, setShiftAmount] = useState<string>("");
  const [shiftUnit, setShiftUnit] = useState<"minute" | "hour" | "day" | "month">("month");
  const [isShiftingPublished, setIsShiftingPublished] = useState(false);
  const isDeletingManga = deleteMangaFetcher.state !== "idle";
  const createChapterHref = `/truyen-hentai/chapter/create/${mangaHandle}${isSkipCompression ? "?skipCompression=1" : ""}`;
  const canBulk = canBulkDownloadChapters(userRole, isOwner);
  const hasAtLeastOneChapter = Array.isArray(chapters) && chapters.length >= 1;
  const canAddSingleChapter = status === MANGA_STATUS.APPROVED || !hasAtLeastOneChapter;
  const showChapterSize = isAdminUser;
  const hasOneshotGenre =
    Array.isArray(genres) && genres.some((g: unknown) => String(g).toLowerCase() === "oneshot");
  const costPerChapter = useMemo(() => {
    const list = Array.isArray(genres) ? genres : [];
    const isOneshot = list
      .map((item: any) => toSlug(String(item)))
      .map((slug: string) => slug.toLowerCase())
      .includes("oneshot");
    return isOneshot ? 3 : 1;
  }, [genres]);

  // Keep local chapters in sync with loader data (supports redirect/revalidate without requiring F5)
  useEffect(() => {
    if (!Array.isArray(chapters)) return;
    if (isBulkRunning) return;
    if (isReorderMode) return;
    if (editingChapterId) return;

    setLocalChapters(chapters);
    const asc = [...chapters].sort((a: any, b: any) => (Number(a.chapterNumber) || 0) - (Number(b.chapterNumber) || 0));
    setDragChapters(asc);
  }, [chapters, isBulkRunning, isReorderMode, editingChapterId]);
  const [hasOneshotQuick, setHasOneshotQuick] = useState<boolean>(hasOneshotGenre);

  const initialUserStatus = (manga as any)?.userStatus ?? MANGA_USER_STATUS.ON_GOING;
  const [posterUrl, setPosterUrl] = useState<string>(initialPoster || "");
  const [isPosterUpdating, setIsPosterUpdating] = useState(false);
  const [posterVariantsState, setPosterVariantsState] = useState<PosterVariantsPayload | null>((manga as any)?.posterVariants || null);
  const [userStatusQuick, setUserStatusQuick] = useState<number>(initialUserStatus);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const oneshotGenreList = useMemo(() => {
    const original = Array.isArray(genres) ? genres : [];
    if (hasOneshotQuick) {
      const lower = new Set(original.map((g) => String(g).toLowerCase()));
      if (!lower.has("oneshot")) return [...original, "oneshot"];
    }
    return original;
  }, [genres, hasOneshotQuick]);
  const displayManga = useMemo(
    () => ({ ...manga, poster: posterUrl, posterVariants: posterVariantsState || (manga as any)?.posterVariants, userStatus: userStatusQuick, genres: oneshotGenreList }),
    [manga, posterUrl, posterVariantsState, userStatusQuick, oneshotGenreList],
  );
  const canQuickEdit = isAdminUser || isOwner;

  const statusSelectValue = hasOneshotQuick ? "oneshot" : String(userStatusQuick);
  const statusSelectOptions: Array<{ value: string; label: string; disabled?: boolean }> = [
    { value: String(MANGA_USER_STATUS.ON_GOING), label: "Đang tiến hành", disabled: false },
    { value: String(MANGA_USER_STATUS.COMPLETED), label: "Đã hoàn thành", disabled: false },
    { value: "oneshot", label: "Oneshot", disabled: false },
  ];

  const formatChapterSize = (bytes?: number) => {
    if (typeof bytes !== "number" || bytes <= 0) return "—";
    const mb = bytes / (1024 * 1024);
    const value = mb >= 10 ? mb.toFixed(1) : mb.toFixed(2);
    return `${value} MB`;
  };

  // Rating removed

  const handlePosterQuickUpdate = async (file: File) => {
    if (!canQuickEdit || isPosterUpdating) return;
    setIsPosterUpdating(true);
    try {
      const variants = await generatePosterVariants(file);
      const uploadEntries: Array<{ key: "w200" | "w360" | "w575"; width: number; height: number; file: File }> = [];
      const uploads: Array<{ file: File; options: { prefixPath: string } }> = [];
      const push = (key: "w200" | "w360" | "w575", variant: { file: File; width: number; height: number }) => {
        uploadEntries.push({ key, width: variant.width, height: variant.height, file: variant.file });
        uploads.push({ file: variant.file, options: { prefixPath: "story-images" } });
      };

      push("w575", variants.w575);
      if (variants.w360) push("w360", variants.w360);
      if (variants.w200) push("w200", variants.w200);

      const results = await uploadMultipleFiles(uploads);
      const payload: PosterVariantsPayload = {};

      uploadEntries.forEach((entry, idx) => {
        const result: any = results[idx];
        if (!result?.url) return;
        (payload as any)[entry.key] = {
          url: String(result.url),
          width: entry.width,
          height: entry.height,
          fullPath: result.fullPath,
          bytes: typeof result.size === "number" ? result.size : undefined,
        };
      });

      const remoteUrl = payload.w575?.url || payload.w360?.url || payload.w200?.url;
      if (!remoteUrl) {
        throw new Error("Không thể tải ảnh lên");
      }
      const formData = new FormData();
      formData.append("actionType", "updatePoster");
      formData.append("posterUrl", remoteUrl);
      formData.append("posterVariantsJson", JSON.stringify(payload));
      pendingPosterUrlRef.current = remoteUrl;
      pendingPosterVariantsRef.current = payload;
      posterUpdateInFlightRef.current = true;
      posterUpdateFetcher.submit(formData, {
        method: "POST",
        action: `/truyen-hentai/preview/${mangaHandle}`,
        encType: "multipart/form-data",
      });
    } catch (error) {
      console.error("[preview] update poster", error);
      toast.error(error instanceof Error ? error.message : "Cập nhật ảnh bìa thất bại");
      pendingPosterUrlRef.current = null;
      posterUpdateInFlightRef.current = false;
      setIsPosterUpdating(false);
    }
  };

  const handleStatusQuickUpdate = (nextStatus: number) => {
    if (!canQuickEdit || isStatusUpdating || nextStatus === userStatusQuick) return;
    setIsStatusUpdating(true);
    try {
      const formData = new FormData();
      formData.append("actionType", "updateUserStatus");
      formData.append("userStatus", String(nextStatus));
      pendingStatusRef.current = nextStatus;
      statusUpdateInFlightRef.current = true;
      statusUpdateFetcher.submit(formData, {
        method: "POST",
        action: `/truyen-hentai/preview/${mangaHandle}`,
      });
    } catch (error) {
      console.error("[preview] update status", error);
      toast.error(error instanceof Error ? error.message : "Cập nhật trạng thái thất bại");
      pendingStatusRef.current = null;
      statusUpdateInFlightRef.current = false;
      setIsStatusUpdating(false);
    }
  };

  const handleStatusSelectChange = (value: string) => {
    if (value === "oneshot") {
      if (!canQuickEdit) return;
      if (hasOneshotQuick) {
        toast.success("Truyện đang là Oneshot");
        return;
      }
      if (isStatusUpdating) return;
      setIsStatusUpdating(true);
      try {
        const formData = new FormData();
        formData.append("actionType", "addOneshotGenre");
        statusUpdateInFlightRef.current = true;
        statusUpdateFetcher.submit(formData, {
          method: "POST",
          action: `/truyen-hentai/preview/${mangaHandle}`,
        });
      } catch (error) {
        console.error("[preview] add oneshot genre", error);
        toast.error(error instanceof Error ? error.message : "Cập nhật Oneshot thất bại");
        statusUpdateInFlightRef.current = false;
        setIsStatusUpdating(false);
      }
      return;
    }
    const next = Number(value);
    if (Number.isNaN(next)) return;
    handleStatusQuickUpdate(next);
  };

  useEffect(() => {
    if (!posterUpdateInFlightRef.current) return;
    if (posterUpdateFetcher.state !== "idle") return;

    const data = posterUpdateFetcher.data as
      | { success?: boolean; error?: string; message?: string; poster?: string }
      | undefined;

    if (data?.success) {
      const nextPoster = data.poster || pendingPosterUrlRef.current;
      if (nextPoster) {
        setPosterUrl(nextPoster);
      }
      if (pendingPosterVariantsRef.current) {
        setPosterVariantsState(pendingPosterVariantsRef.current);
      }
      toast.success(data.message || "Đã cập nhật ảnh bìa");
    } else {
      const errorMessage = data?.error || "Cập nhật ảnh bìa thất bại";
      console.error("[preview] update poster", errorMessage);
      toast.error(errorMessage);
    }

    pendingPosterUrlRef.current = null;
    pendingPosterVariantsRef.current = null;
    posterUpdateInFlightRef.current = false;
    setIsPosterUpdating(false);
  }, [posterUpdateFetcher.state, posterUpdateFetcher.data]);

  useEffect(() => {
    if (!statusUpdateInFlightRef.current) return;
    if (statusUpdateFetcher.state !== "idle") return;

    const data = statusUpdateFetcher.data as
      | { success?: boolean; error?: string; message?: string; userStatus?: number; added?: boolean }
      | undefined;

    if (data?.success) {
      if (data.added) {
        setHasOneshotQuick(true);
      } else {
        const nextStatus = typeof data.userStatus === "number" ? data.userStatus : pendingStatusRef.current;
        if (typeof nextStatus === "number") {
          setUserStatusQuick(nextStatus);
        }
      }
      toast.success(data.message || "Đã cập nhật trạng thái truyện");
    } else {
      const errorMessage = data?.error || "Cập nhật trạng thái thất bại";
      console.error("[preview] update status", errorMessage);
      toast.error(errorMessage);
    }

    pendingStatusRef.current = null;
    statusUpdateInFlightRef.current = false;
    setIsStatusUpdating(false);
  }, [statusUpdateFetcher.state, statusUpdateFetcher.data]);

  useEffect(() => {
    if (!isShiftingPublished) return;
    if (shiftPublishedFetcher.state !== "idle") return;

    const data = shiftPublishedFetcher.data as
      | { success?: boolean; error?: string; message?: string }
      | undefined;
    if (data?.success) {
      toast.success(data.message || "Đã cập nhật thời gian đăng");
      // Revalidate loader to refresh timestamps without full page reload
      revalidator.revalidate();
    } else {
      toast.error(data?.error || "Cập nhật thời gian đăng thất bại");
    }
    setIsShiftingPublished(false);
  }, [isShiftingPublished, shiftPublishedFetcher.state, shiftPublishedFetcher.data, revalidator]);

  useEffect(() => {
    if (deleteMangaFetcher.state !== "idle") return;

    const data = deleteMangaFetcher.data as
      | { success?: boolean; error?: string; message?: string; actionType?: string }
      | undefined;

    if (data?.actionType !== "deleteManga") return;

    if (data?.success) {
      toast.success(data.message || "Đã xóa truyện");
      window.location.href = "/admin/manga";
    } else if (data?.error) {
      toast.error(data.error || "Xóa truyện thất bại");
    }
  }, [deleteMangaFetcher.state, deleteMangaFetcher.data]);

  const submitShiftPublished = () => {
    if (!isAdminUser || isShiftingPublished) return;
    const n = Number(shiftAmount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Vui lòng nhập số lượng hợp lệ");
      return;
    }
    setIsShiftingPublished(true);
    const formData = new FormData();
    formData.append("actionType", "shiftPublished");
    formData.append("unit", shiftUnit);
    formData.append("amount", String(Math.trunc(n)));
    shiftPublishedFetcher.submit(formData, { method: "POST", action: `/truyen-hentai/preview/${mangaHandle}` });
  };

  const handleDeleteManga = () => {
    if (!isAdminUser || isDeletingManga) return;
    const ok = window.confirm(
      `Xóa truyện "${manga.title}"?
 Sẽ xóa toàn bộ chương + ảnh (R2) + dữ liệu liên quan.
 Không thể hoàn tác.`,
    );
    if (!ok) return;

    const formData = new FormData();
    formData.append("actionType", "deleteManga");
    deleteMangaFetcher.submit(formData, { method: "POST", action: `/truyen-hentai/preview/${mangaHandle}` });
  };

  /* ============== BULK UPLOAD HANDLERS ============== */

  const pickFolder = () => folderInputRef.current?.click();

  async function handleFolderPicked(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const rawList = e.target.files;
      if (!rawList || rawList.length === 0) {
        console.warn("[bulk] No files selected");
        return;
      }

      const files = Array.from(rawList).filter(isImage);
      if (files.length === 0) {
        toast.error("Không tìm thấy ảnh trong thư mục đã chọn.");
        e.target.value = "";
        return;
      }

      // split path an toàn cho "/" và "\" (Windows)
      const splitPath = (p: string) => String(p).split(/[\\/]+/).filter(Boolean);

      // có subfolder không? (>=3 segments: root/sub/file)
      const hasSubfolders = files.some((ff) => {
        const p = (ff as any).webkitRelativePath || ff.name;
        return splitPath(p).length >= 3;
      });

      // group: nếu có subfolder -> lấy parts[1]; nếu không -> parts[0]
      const groups: Record<string, File[]> = {};
      for (const f of files) {
        const rp = (f as any).webkitRelativePath || f.name;
        const parts = splitPath(rp);
        const chapter = hasSubfolders ? (parts.length >= 2 ? parts[1] : parts[0]) : parts[0];
        if (!chapter) {
          console.warn("[bulk] Skip file with bad path:", rp);
          continue;
        }
        (groups[chapter] ||= []).push(f);
      }

      const chapterNames = Object.keys(groups).sort(nat);
      if (chapterNames.length === 0) {
        toast.error("Không gom được chapter nào từ thư mục đã chọn.");
        e.target.value = "";
        return;
      }

      setIsBulkRunning(true);
      setChapProgress({ done: 0, total: chapterNames.length, current: "" });

      let okCount = 0;
      let skipCount = 0;
      const totalChaps = chapterNames.length;

      // 1 toast “đang chạy” được update liên tục
      const loadingId = toast.loading(`Đang tải… 0/${totalChaps}`);

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

      for (const chap of chapterNames) {
        setChapProgress((p) => ({ ...p, current: chap }));
        toast.loading(`Đang tải… ${okCount}/${totalChaps} • ${chap}`, { id: loadingId });

        // sort ảnh trong 1 chap
        const list = groups[chap].sort((a, b) => nat(a.name, b.name));

        if (list.length > MAX_PER_CHAPTER) {
          toast.error(
            `Chương "${chap}" có ${list.length} ảnh > ${MAX_PER_CHAPTER}. Vẫn gửi lên để server kiểm tra (có thể bị BAN).`
          );
          // KHÔNG continue; để server thực thi rule & BAN
        }

        const splitList = await splitLongImages(list, { maxHeight: 3000 });

        // Optional compression cho bulk (per chapter) nếu đã tick
        let effectiveList = splitList;
        if (bulkApplyCompression) {
          try {
            const compressToastId = toast.loading(`Nén ảnh 0/${splitList.length} • ${chap}`);
            const compressed = await compressMultipleImages(splitList, (current, total) => {
              toast.loading(`Nén ảnh ${current}/${total} • ${chap}`, { id: compressToastId });
            });
            toast.dismiss(compressToastId);
            toast.success(`Đã nén ${compressed.length} ảnh • ${chap}`);
            effectiveList = compressed.map((r) => r.compressedFile);
          } catch (err) {
            toast.error(`Nén ảnh lỗi ở chương "${chap}" → dùng ảnh gốc`);
            effectiveList = splitList;
          }
        }
        // upload 1 lần cho cả chapter (sau nén nếu có)
        let results: Array<{ url?: string; path?: string; location?: string; key?: string }>;
        try {
          const selection = bulkForceWatermarkAll ? null : buildWatermarkSelection(effectiveList);

          let watermarkOrder = 0;
          const filesToUpload = effectiveList.map((f, idx) => {
            const meta = getImageSegmentMeta(f);
            const groupId = meta.groupId || `${f.name}-${idx}`;
            const groupIndex = selection?.groupIndexById.get(groupId) ?? idx;
            const shouldWatermark =
              bulkForceWatermarkAll || (!meta.noWatermark && Boolean(selection?.watermarkIndexes.has(groupIndex)));
            if (!shouldWatermark) {
              return { file: f, options: { prefixPath: "manga-images" } };
            }

            watermarkOrder += 1;
            const watermarkVariant = watermarkOrder % 2 === 1 ? (1 as const) : (2 as const);

            return {
              file: f,
              options: { prefixPath: "manga-images", watermark: true, watermarkVariant },
            };
          });
          results = await uploadMultipleFiles(filesToUpload);
        } catch (err: any) {
          console.error("[bulk] Upload failed at", chap, err);
          toast.dismiss(loadingId);
          toast.error(`Upload lỗi ở chapter "${chap}". Dừng bulk.`);
          setIsBulkRunning(false);
          setChapProgress({ done: 0, total: 0, current: "" });
          e.target.value = "";
          return;
        }

        // rút URL
        const uploads = (results || [])
          .map((r: any) => r?.url || r?.location || r?.path || r?.key)
          .filter((u: unknown): u is string => typeof u === "string" && u.length > 0);

        if (uploads.length !== effectiveList.length) {
          console.error("[bulk] Missing URLs after upload", { chap, got: uploads.length, expect: effectiveList.length });
          toast.dismiss(loadingId);
          toast.error(`Thiếu URL sau upload ở "${chap}". Dừng bulk.`);
          setIsBulkRunning(false);
          setChapProgress({ done: 0, total: 0, current: "" });
          e.target.value = "";
          return;
        }

        // gọi API headless tạo chapter
        try {
          const body = { entries: [{ chapter: chap, urls: uploads }] };
          const resp = await fetch(`/truyen-hentai/${mangaHandle}/bulk-upload-urls`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "fetch" },
            credentials: "include",
            body: JSON.stringify(body),
          });

          const txt = await resp.text();
          let data: any = {};
          try {
            data = JSON.parse(txt);
          } catch {
            /* ignore non-JSON */
          }

          if (!resp.ok) {
            console.error("[bulk] API error", resp.status, txt);
            toast.dismiss(loadingId);
            toast.error(data?.error || `Bulk upload lỗi chapter "${chap}" (HTTP ${resp.status})`);
            setIsBulkRunning(false);
            setChapProgress({ done: 0, total: 0, current: "" });
            e.target.value = "";
            return;
          }

          okCount += 1;
          setChapProgress((p) => ({ ...p, done: p.done + 1 }));
          toast.loading(`Đang tải… ${okCount}/${totalChaps}`, { id: loadingId });
          toast.success(`Đã tạo chương: ${chap}`);
        } catch (err: any) {
          console.error("[bulk] create chapter request failed", chap, err);
          toast.dismiss(loadingId);
          toast.error(err?.message || `Bulk upload lỗi chapter "${chap}"`);
          setIsBulkRunning(false);
          setChapProgress({ done: 0, total: 0, current: "" });
          e.target.value = "";
          return;
        }
      }

      toast.dismiss(loadingId);
      toast.success(`✅ Hoàn tất: ${okCount}/${totalChaps} chương thành công, bỏ qua ${skipCount}`);
      // Refresh chapters list immediately without requiring F5
      revalidator.revalidate();
      setIsBulkRunning(false);
      setChapProgress({ done: 0, total: 0, current: "" });
      e.target.value = "";
    } catch (err) {
      console.error("[bulk] Uncaught error in handleFolderPicked:", err);
      toast.error("Bulk upload lỗi bất ngờ. Xem console để biết chi tiết.");
      setIsBulkRunning(false);
      setChapProgress({ done: 0, total: 0, current: "" });
      e.target.value = "";
    }
  }

  const handleNormalizeChapterTitles = async () => {
    if (isNormalizingTitles) return;
    if (!Array.isArray(localChapters) || localChapters.length === 0) {
      toast.error("Chưa có chương để quy chuẩn");
      return;
    }

    const candidates = localChapters
      .map((chapter: any) => {
        const newTitle = normalizeChapterTitle(chapter?.title);
        return newTitle && newTitle !== chapter?.title ? { chapter, newTitle } : null;
      })
      .filter(Boolean) as Array<{ chapter: any; newTitle: string }>;

    if (candidates.length === 0) {
      toast("Không có chương nào cần quy chuẩn");
      return;
    }

    setIsNormalizingTitles(true);
    const toastId = toast.loading(`Đang quy chuẩn 0/${candidates.length}`);

    try {
      const updatedMap = new Map<string, string>();
      let successCount = 0;

      for (const { chapter, newTitle } of candidates) {
        const chapterId = String(chapter.id);
        try {
          const res = await fetch(`/api/chapter/update-title`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chapterId, title: newTitle, mangaId: manga.id }),
          });
          const data = await res.json();
          if (res.ok && data?.success) {
            successCount += 1;
            updatedMap.set(chapterId, newTitle);
            toast.loading(`Đang quy chuẩn ${successCount}/${candidates.length}`, { id: toastId });
          } else {
            toast.error(data?.error || `Không thể cập nhật "${chapter.title}"`);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Không thể cập nhật chương";
          toast.error(`${chapter.title || "Chương"}: ${message}`);
        }
      }

      if (successCount > 0) {
        setLocalChapters((prev: any[]) =>
          prev.map((chapter: any) => {
            const updatedTitle = updatedMap.get(String(chapter.id));
            return updatedTitle ? { ...chapter, title: updatedTitle } : chapter;
          }),
        );
        setDragChapters((prev: any[]) => {
          if (!Array.isArray(prev) || prev.length === 0) return prev;
          return prev.map((chapter: any) => {
            const updatedTitle = updatedMap.get(String(chapter.id));
            return updatedTitle ? { ...chapter, title: updatedTitle } : chapter;
          });
        });
        toast.success(`Đã quy chuẩn ${successCount}/${candidates.length} chương`);
      } else {
        toast.error("Không thể quy chuẩn chương nào");
      }
    } finally {
      toast.dismiss(toastId);
      setIsNormalizingTitles(false);
    }
  };

  /* =================== UI =================== */

  return (
    <div className="container-page mx-auto px-4 py-6">
      <Toaster position="bottom-right" />
      <div className="w-full">
        {/* Khu vực nút quản lý riêng (admin giữ nguyên) */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {isAdminUser && (
            <>
              <Link to={`/truyen-hentai/edit/${mangaHandle}`}>
                <button className="border-lav-500 text-txt-focus hover:bg-lav-500/10 flex min-w-32 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 shadow-[0px_4px_8.9px_0px_rgba(146,53,190,0.25)] transition-colors">
                  <Edit className="h-5 w-5" />
                  <span className="text-sm font-semibold">Sửa thông tin chung</span>
                </button>
              </Link>
              {status !== MANGA_STATUS.APPROVED && (
                <button
                  className="flex min-w-32 cursor-pointer items-center justify-center gap-2 rounded-xl border border-green-500 px-4 py-3 text-green-400 shadow-[0px_4px_8.9px_0px_rgba(34,197,94,0.25)] transition-colors hover:bg-green-500/10"
                  onClick={() => {
                    const formData = new FormData();
                    formData.append("actionType", "approve");
                    submit(formData, { method: "POST" });
                  }}
                >
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-semibold">Duyệt</span>
                </button>
              )}
              <button
                className="flex min-w-32 cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-500 px-4 py-3 text-red-400 shadow-[0px_4px_8.9px_0px_rgba(239,68,68,0.25)] transition-colors hover:bg-red-500/10"
                onClick={() => {
                  const formData = new FormData();
                  formData.append("actionType", "reject");
                  submit(formData, { method: "POST" });
                }}
              >
                <XCircle className="h-5 w-5" />
                <span className="text-sm font-semibold">Từ chối</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteManga}
                disabled={isDeletingManga}
                className="flex min-w-32 cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-600 px-4 py-3 text-red-300 shadow-[0px_4px_8.9px_0px_rgba(239,68,68,0.25)] transition-colors hover:bg-red-600/10 disabled:cursor-not-allowed disabled:opacity-60"
                title="Xóa truyện (kèm ảnh và dữ liệu liên quan)"
              >
                <Trash2 className="h-5 w-5" />
                <span className="text-sm font-semibold">Xóa truyện</span>
              </button>
            </>
          )}
        </div>

        {canQuickEdit && (
          <div className="mb-6 flex flex-col gap-4 rounded-xl border border-bd-default bg-bgc-layer1 p-4 shadow md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-txt-primary">Tình trạng truyện</p>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={statusSelectValue}
                  onChange={(e) => handleStatusSelectChange(e.target.value)}
                  disabled={isStatusUpdating}
                  className="bg-bgc-layer2 border-bd-default text-txt-primary focus:border-lav-500 focus:ring-2 focus:ring-primary/40 rounded-lg border px-3 py-2 text-sm font-semibold outline-none"
                >
                  {statusSelectOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {isStatusUpdating ? <Loader2 className="h-4 w-4 animate-spin text-[#DD94FF]" /> : null}
                {hasOneshotGenre ? (
                  <span className="text-xs font-medium text-txt-secondary">Oneshot hiển thị theo thể loại</span>
                ) : null}
              </div>
            </div>

            {(isAdminUser || isOwner || isDichGiaUser) ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-txt-primary">Tải truyện</p>
                <DownloadChaptersDialog
                  mangaId={String(manga.id)}
                  mangaTitle={String(manga.title || "")}
                  mangaSlug={String(manga.slug || manga.id)}
                  chapters={chapters as any}
                  isFreeDownload={true}
                  costPerChapter={costPerChapter}
                  className="mt-0"
                />
              </div>
            ) : null}

            {isAdminUser ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-txt-primary">Lùi thời gian đăng</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={shiftUnit}
                    onChange={(e) => setShiftUnit(e.target.value as any)}
                    disabled={isShiftingPublished}
                    className="rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary outline-none focus:ring-2 focus:ring-primary/40"
                    aria-label="Đơn vị thời gian"
                  >
                    <option value="minute">Phút</option>
                    <option value="hour">Giờ</option>
                    <option value="day">Ngày</option>
                    <option value="month">Tháng</option>
                  </select>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={shiftUnit === "month" ? 600 : shiftUnit === "day" ? 3650 : shiftUnit === "hour" ? 43800 : 2628000}
                    placeholder={shiftUnit === "month" ? "Ví dụ: 24" : shiftUnit === "day" ? "Ví dụ: 5" : shiftUnit === "hour" ? "Ví dụ: 5" : "Ví dụ: 30"}
                    value={shiftAmount}
                    onChange={(e) => setShiftAmount(e.target.value)}
                    className="w-28 rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm text-txt-primary outline-none focus:ring-2 focus:ring-primary/40"
                  />

                  <button
                    type="button"
                    onClick={submitShiftPublished}
                    disabled={isShiftingPublished}
                    className="rounded-lg border border-bd-default bg-bgc-layer2 px-4 py-2 text-sm font-semibold text-txt-primary hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isShiftingPublished ? "Đang cập nhật…" : "Cập nhật"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {!isAdminUser ? (
          <div className="mb-6">
            <Link to={`/truyen-hentai/edit/${mangaHandle}`}>
              <button className="border-lav-500 text-txt-focus hover:bg-lav-500/10 flex min-w-32 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 shadow-[0px_4px_8.9px_0px_rgba(146,53,190,0.25)] transition-colors">
                <Edit className="h-5 w-5" />
                <span className="text-sm font-semibold">Sửa thông tin chung</span>
              </button>
            </Link>
          </div>
        ) : null}

        {/* Preview hiển thị giống trang công khai (ẩn nút hành động đọc / follow) */}
        <MangaDetail
          manga={displayManga as any}
          chapters={chapters as any}
          hideActions
          hideChaptersList
          posterDropEnabled={canQuickEdit}
          onPosterDrop={handlePosterQuickUpdate}
          posterDropUploading={isPosterUpdating}
          posterDropHint="Ảnh mới được lưu ngay khi thả"
          genreDisplayMap={genreDisplayMap}
        />

        {/* Khu vực quản lý chương: tạo chương & bulk + chỉnh sửa danh sách */}
        <div className="mt-10 flex flex-col gap-4">
          {/* Header: Chương đã đăng + actions */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-txt-primary text-lg font-semibold">Chương đã đăng</h2>
            {/* Reorder toggle */}
            {(isAdminUser || isOwner) && localChapters.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  if (isBulkRunning) return;
                  setIsReorderMode((v) => !v);
                  // Reset drag list when entering mode
                  if (!isReorderMode) {
                    const asc = [...localChapters].sort(
                      (a: any, b: any) => (Number(a.chapterNumber) || 0) - (Number(b.chapterNumber) || 0),
                    );
                    setDragChapters(asc);
                  }
                }}
                className="flex min-w-32 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs font-semibold text-txt-secondary hover:border-[#DD94FF] hover:text-[#DD94FF]"
              >
                {isReorderMode ? "Thoát sắp xếp" : "Sắp xếp chương"}
              </button>
            )}
            {isAdminUser && (
              <button
                type="button"
                onClick={handleNormalizeChapterTitles}
                disabled={isNormalizingTitles || localChapters.length === 0}
                className="flex min-w-32 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#DD94FF]/60 px-4 py-3 text-xs font-semibold text-[#DD94FF] transition-colors hover:border-[#F3BCFF] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isNormalizingTitles ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang quy chuẩn…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Quy chuẩn</span>
                  </>
                )}
              </button>
            )}
            {canAddSingleChapter ? (
              <Link to={createChapterHref}>
                <button className="to-btn-primary flex min-w-40 cursor-pointer items-center justify-center gap-1 rounded-xl bg-gradient-to-b from-[#DD94FF] px-4 py-3 text-sm font-semibold text-black">
                  <Plus className="h-5 w-5" />
                  Thêm chương
                </button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  disabled
                  className="to-btn-primary flex min-w-40 items-center justify-center gap-1 rounded-xl bg-gradient-to-b from-[#DD94FF] px-4 py-3 text-sm font-semibold text-black opacity-50 cursor-not-allowed"
                  title="Truyện chưa duyệt chỉ được đăng tối đa 1 chương"
                >
                  <Plus className="h-5 w-5" />
                  Thêm chương
                </button>
                <span className="text-xs text-txt-secondary">Cần được duyệt để đăng thêm chương</span>
              </div>
            )}
            {/* Bulk upload hidden input */}
            {canBulk && (
              <input
              ref={folderInputRef}
              type="file"
              className="hidden"
              multiple
              // @ts-expect-error non-standard
              webkitdirectory=""
              onChange={handleFolderPicked}
              accept="image/*"
              />
            )}

            <div className="flex items-center gap-2">
              {(isAdminUser || isDichGiaUser) ? (
                <button
                  onClick={pickFolder}
                  disabled={isBulkRunning || !canBulk}
                  className="to-btn-primary flex min-w-40 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#DD94FF] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    canBulk
                      ? "Cần uploap duy nhất 1 thư mục/folder mẹ : bên trong cần chứa các folder con, mỗi folder con là một chương, bên trong chứa ảnh truyện"
                      : "Chỉ admin hoặc chủ truyện (dịch giả) mới có quyền tải hàng loạt"
                  }
                >
                  {isBulkRunning ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>
                        Đang tải… {chapProgress.done}/{chapProgress.total}
                        {chapProgress.current ? ` • ${chapProgress.current}` : ""}
                      </span>
                    </>
                  ) : canBulk ? (
                    <>
                      <Upload className="h-5 w-5" />
                      <span>Upload hàng loạt</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span>Không đủ quyền tải bulk</span>
                    </>
                  )}
                </button>
              ) : null}
              {canBulk && (
                <label className="flex items-center gap-2 rounded-xl bg-bgc-layer2 px-3 py-2 text-xs font-medium text-txt-primary">
                  <input
                    type="checkbox"
                    className="accent-[#D373FF]"
                    disabled={isBulkRunning}
                    checked={bulkApplyCompression}
                    onChange={(e) => setBulkApplyCompression(e.target.checked)}
                  />
                  Nén ảnh bulk
                </label>
              )}
              {canBulk && isAdminUser && (
                <label className="flex items-center gap-2 rounded-xl bg-bgc-layer2 px-3 py-2 text-xs font-medium text-txt-primary">
                  <input
                    type="checkbox"
                    className="accent-[#D373FF]"
                    disabled={isBulkRunning}
                    checked={bulkForceWatermarkAll}
                    onChange={(e) => setBulkForceWatermarkAll(e.target.checked)}
                  />
                  Gắn dải watermark mọi ảnh
                </label>
              )}

              {/* Tooltip hướng dẫn khi hover */}
              {canBulk && (
                <div className="relative group">
                  <Info className="h-5 w-5 text-gray-400 group-hover:text-gray-200 cursor-pointer" />
                  <div className="pointer-events-none absolute right-0 top-7 z-10 hidden w-[320px] rounded-lg border border-white/10 bg-black/90 p-3 text-sm text-gray-200 shadow-lg group-hover:block">
                    <div className="mb-1 font-semibold text-white">Hướng dẫn tải hàng loạt</div>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>
                        Cần uploap <b>duy nhất 1 thư mục/folder mẹ :</b>bên trong cần <b>chứa các folder con,</b> mỗi folder con là một chương, <b>bên trong chứa ảnh truyện</b>.
                      </li>
                      <li>
                        Ảnh trong 1 chương sẽ được sắp theo <i>số từ bé-lớn</i> (tên ảnh bắt buộc là số).
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Danh sách theo cột STT và Tên chương */}
          {/* Normal view OR reorder mode */}
          {isReorderMode ? (
            <div className="flex max-h-[420px] flex-col overflow-y-auto rounded-lg border border-[#DD94FF]/40">
              <div className="sticky top-0 z-[1] grid grid-cols-[56px_1fr_56px] items-center gap-3 border-b border-[#DD94FF]/40 bg-[#DD94FF]/10 px-4 py-2 text-xs font-semibold text-[#DD94FF]">
                <div>STT</div>
                <div>Kéo để đổi vị trí (1 = cũ nhất)</div>
                <div className="text-right">Drag</div>
              </div>
              <div className="flex flex-col divide-y divide-white/10">
                {dragChapters.map((chapter: any, idx: number) => (
                  <div
                    key={chapter.id}
                    draggable
                    onDragStart={(e) => {
                      dragSrcIndexRef.current = idx;
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = dragSrcIndexRef.current;
                      if (from == null || from === idx) return;
                      setDragChapters((prev) => {
                        const copy = [...prev];
                        const [moved] = copy.splice(from, 1);
                        copy.splice(idx, 0, moved);
                        return copy;
                      });
                      dragSrcIndexRef.current = null;
                    }}
                    className="grid grid-cols-[56px_1fr_56px] items-center gap-3 px-4 py-2 bg-bgc-layer2 cursor-move select-none"
                  >
                    <div className="text-xs text-txt-secondary">{idx + 1}</div>
                    <div className="truncate text-sm text-txt-primary">{chapter.title}</div>
                    <div className="flex justify-end">
                      <Menu className="h-4 w-4 text-[#DD94FF]" />
                    </div>
                  </div>
                ))}
                {dragChapters.length === 0 && (
                  <div className="text-txt-secondary px-4 py-6 text-sm">Chưa có chương nào.</div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-[#DD94FF]/40 bg-[#DD94FF]/5 px-4 py-3">
                <button
                  disabled={isSavingOrder}
                  onClick={() => {
                    setIsReorderMode(false);
                  }}
                  className="rounded-md border border-white/20 px-4 py-2 text-xs font-semibold text-txt-secondary hover:text-white disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  disabled={isSavingOrder}
                  onClick={async () => {
                    if (isSavingOrder) return;
                    setIsSavingOrder(true);
                    try {
                      const orderedIds = dragChapters.map((c: any) => c.id);
                      const r = await fetch(`/api/chapters/reorder`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mangaId: manga.id, orderedChapterIds: orderedIds }),
                      });
                      const data = await r.json();
                      if (r.ok && data?.success) {
                        // Optimistic update: assign new chapterNumber ascending then update localChapters
                        const updated = dragChapters.map((c: any, i: number) => ({ ...c, chapterNumber: i + 1 }));
                        setLocalChapters(updated);
                        toast.success("Đã lưu thứ tự chương");
                        setIsReorderMode(false);
                      } else {
                        toast.error(data?.error || "Lưu thứ tự thất bại");
                      }
                    } catch (e: any) {
                      console.error("Reorder error", e);
                      toast.error(e?.message || "Lưu thứ tự thất bại");
                    } finally {
                      setIsSavingOrder(false);
                    }
                  }}
                  className="to-btn-primary flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#DD94FF] px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
                >
                  {isSavingOrder ? "Đang lưu…" : "Lưu sắp xếp"}
                </button>
              </div>
            </div>
          ) : (
            (() => {
              const sorted = Array.isArray(localChapters)
                ? [...localChapters].sort((a: any, b: any) => {
                    const aN = Number(a?.chapterNumber) || 0;
                    const bN = Number(b?.chapterNumber) || 0;
                    return bN - aN;
                  })
                : [];
              const headerGridClass = showChapterSize
                ? "bg-bgc-layer1/60 sticky top-0 z-[1] grid grid-cols-[64px_1fr_120px_96px] items-center gap-3 border-b border-white/10 px-4 py-2 text-xs font-semibold text-txt-secondary"
                : "bg-bgc-layer1/60 sticky top-0 z-[1] grid grid-cols-[64px_1fr_96px] items-center gap-3 border-b border-white/10 px-4 py-2 text-xs font-semibold text-txt-secondary";
              const rowGridClass = showChapterSize
                ? "grid grid-cols-[64px_1fr_120px_96px] items-center gap-3 px-4 py-2 bg-bgc-layer2"
                : "grid grid-cols-[64px_1fr_96px] items-center gap-3 px-4 py-2 bg-bgc-layer2";
              return (
                <div className="flex max-h-[304px] flex-col overflow-y-auto rounded-lg border border-white/10 md:max-h-[400px] lg:max-h-[492px]">
                  <div className={headerGridClass}>
                    <div>STT</div>
                    <div>Tên chương</div>
                    {showChapterSize && <div className="text-right pr-2">Dung lượng</div>}
                    <div className="text-right pr-2">Hành động</div>
                  </div>
                  <div className="flex flex-col divide-y divide-white/10">
                    {sorted.map((chapter: any, idx: number) => (
                      <div key={chapter.id} className={rowGridClass}>
                        <div className="text-txt-secondary text-sm">{sorted.length - idx}</div>
                        <div className="text-txt-primary">
                          {editingChapterId === chapter.id ? (
                            <input
                              autoFocus
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={async () => {
                                const newTitle = String(editingTitle || "").trim();
                                setEditingChapterId(null);
                                if (!newTitle || newTitle === chapter.title) return;
                                try {
                                  const r = await fetch(`/api/chapter/update-title`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ chapterId: chapter.id, title: newTitle, mangaId: manga.id }),
                                  });
                                  const data = await r.json();
                                  if (r.ok && data?.success) {
                                    toast.success("✅ Cập nhật tên chương thành công");
                                    setLocalChapters((prev) => prev.map((c: any) => (c.id === chapter.id ? { ...c, title: newTitle } : c)));
                                  } else {
                                    toast.error(data?.error || "Cập nhật thất bại");
                                  }
                                } catch (err: any) {
                                  console.error("Update title failed", err);
                                  toast.error(err?.message || "Cập nhật thất bại");
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  (e.target as HTMLInputElement).blur();
                                }
                                if (e.key === "Escape") {
                                  setEditingChapterId(null);
                                }
                              }}
                              className="w-full rounded-md border bg-black/10 px-2 py-1 text-sm font-medium text-txt-primary"
                            />
                          ) : (
                            <button
                              className="group text-left w-full"
                              onClick={(e) => {
                                e.preventDefault();
                                if (isAdminUser || isOwner || isDichGiaUser) {
                                  setEditingChapterId(chapter.id);
                                  setEditingTitle(String(chapter.title || ""));
                                }
                              }}
                              title="Sửa tên chương"
                            >
                              <span className="text-sm font-medium">{chapter.title}</span>
                            </button>
                          )}
                        </div>
                        {showChapterSize && (
                          <div className="text-right text-sm text-txt-secondary pr-2">
                            {formatChapterSize(chapter.contentBytes)}
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/truyen-hentai/chapter/edit/${encodeURIComponent(String(mangaHandle ?? ""))}/${encodeURIComponent(String(chapter?.id ?? chapter?._id ?? ""))}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-txt-secondary hover:text-txt-focus"
                            title="Chỉnh sửa"
                            aria-label="Chỉnh sửa"
                          >
                            <Edit className="h-5 w-5" />
                          </Link>

                          {(isAdminUser || isOwner || isDichGiaUser) && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                const createdAtRaw = (chapter as any)?.createdAt;
                                const createdAt = createdAtRaw instanceof Date ? createdAtRaw : new Date(createdAtRaw);
                                const createdTs = createdAt.getTime();
                                const ageMs = Date.now() - createdTs;
                                const THREE_DAYS_MS = 72 * 60 * 60 * 1000;

                                if (!isAdminUser) {
                                  if (!Number.isFinite(createdTs)) {
                                    toast.error("Không xác định được thời gian tạo chương để xoá");
                                    return;
                                  }
                                  if (ageMs > THREE_DAYS_MS) {
                                    toast.error("Đã quá 72h từ khi tạo chương. Chỉ admin mới có thể xoá.");
                                    return;
                                  }
                                }

                                const ok = window.confirm(`Xóa chương "${chapter.title}"? Hành động không thể hoàn tác.`);
                                if (!ok) return;
                                const r = await fetch(`/api/chapter?mangaId=${manga.id}&chapterId=${chapter.id}`, { method: "DELETE" });
                                const data = await r.json();
                                if (r.ok && data?.success) {
                                  toast.success(data.message || "Đã xóa chương");
                                  location.reload();
                                } else {
                                  toast.error(data?.error || "Xóa chương thất bại");
                                }
                              }}
                              className="text-rose-400 hover:text-rose-300"
                              title="Xóa chương"
                              aria-label="Xóa chương"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {sorted.length === 0 && (
                      <div className="text-txt-secondary px-4 py-6 text-sm">Chưa có chương nào.</div>
                    )}
                  </div>
                </div>
              );
            })()
          )}

        </div>
      </div>
    </div>
  );
}
