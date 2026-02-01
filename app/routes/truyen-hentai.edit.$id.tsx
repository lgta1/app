// Full clean implementation of edit route (loader, action, meta, component)
import { useMemo, useRef, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router-dom";
import { redirect, useActionData, useLoaderData, useNavigation } from "react-router-dom";
import { Book, Check, FileText, Image as ImageIcon, Settings, Tag, User, Clock } from "lucide-react";

import { updateManga } from "@/mutations/manga.mutation";
import { MangaModel } from "~/database/models/manga.model";
import { getAllGenres } from "@/queries/genres.query";
import { getMangaByIdAndOwner } from "@/queries/manga.query";
import { requireLogin } from "@/services/auth.server";

import AuthorSelect, { type AuthorLite } from "../components/author-select";
import DoujinshiSelect from "../components/doujinshi-select";
import TranslatorSelect from "../components/translator-select";
import CharacterSelect from "../components/character-select";
import { ImageUploader } from "~/components/image-uploader";
import { MANGA_CONTENT_TYPE, MANGA_USER_STATUS } from "~/constants/manga";
import type { GenresType } from "~/database/models/genres.model";
import { deletePublicFiles } from "~/utils/minio.utils";
import { collectPosterVariantPaths, parsePosterVariantsPayload } from "~/.server/utils/poster-variants.server";
import type { MangaType } from "~/database/models/manga.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";
import { useFileOperations } from "~/hooks/use-file-operations";
import { resolveMangaHandle } from "~/database/helpers/manga-slug.helper";
import { generatePosterVariants, type PosterVariantsResult } from "~/utils/image-compression.utils";
import type { PosterVariantsPayload } from "~/utils/poster-variants.utils";
import { toSlug } from "~/utils/slug.utils";
import {
  ANTI_VANILLA_TAGS,
  normalizeGenreSlug,
  VANILLA_GENRE_SLUG,
} from "~/constants/vanilla-anti-tags";

export const meta: MetaFunction = () => {
  return [
    { title: "Chỉnh sửa Truyện - WW" },
    { name: "description", content: "Chỉnh sửa truyện trên WW!" },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userInfo = await requireLogin(request);
  const genres = await getAllGenres();
  const manga = await getMangaByIdAndOwner(params.id || "", userInfo.id, isAdmin(userInfo.role));

  if (!manga) {
    throw new BusinessError("Không tìm thấy truyện");
  }

  return { genres, manga, isAdmin: isAdmin(userInfo.role) };
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const userInfo = await requireLogin(request);
    const formData = await request.formData();
    const isCosplay = formData.get("isCosplay") === "1";

    const parseJsonArray = (value: FormDataEntryValue | null): string[] => {
      try {
        const raw = JSON.parse((value as string) || "[]");
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    };

    const url = new URL(request.url);
    const newParam = url.searchParams.get("new");
    const handle = params.id;

    if (!handle) {
      throw new BusinessError("Không tìm thấy truyện");
    }

    const target = await resolveMangaHandle(handle);
    if (!target) {
      throw new BusinessError("Không tìm thấy truyện");
    }
    const mangaId = String((target as any).id ?? (target as any)._id ?? "");
    const existingManga = await MangaModel.findById(mangaId).lean();
    const nextHandle = target.slug || mangaId;

    // Normalize + validate genres payload (avoid generic errors when payload is malformed)
    let parsedGenres: string[] = [];
    try {
      const raw = JSON.parse((formData.get("genres") as string) || "[]");
      parsedGenres = Array.isArray(raw) ? raw : [];
    } catch {
      throw new BusinessError("Dữ liệu thể loại không hợp lệ");
    }
    parsedGenres = parsedGenres
      .map((g: any) => {
        if (typeof g === "string") return normalizeGenreSlug(g);
        if (g && typeof g === "object") {
          return normalizeGenreSlug((g as any).slug ?? (g as any).value ?? (g as any).id ?? "");
        }
        return "";
      })
      .filter(Boolean);

    // Guard: vanilla can't coexist with any anti-vanilla tag
    if (
      parsedGenres.includes(VANILLA_GENRE_SLUG) &&
      parsedGenres.some((g) => ANTI_VANILLA_TAGS.has(g))
    ) {
      throw new BusinessError("Có thể loại trái ngược với vanilla đã được chọn");
    }

    const mangaData: Partial<MangaType> = {
      title: (formData.get("title") as string) || "",
      alternateTitle: (formData.get("alternateTitle") as string) || "",
      description: (formData.get("description") as string) || "",
      author: (formData.get("author") as string) || "",
      authorNames: parseJsonArray(formData.get("authorNames")),
      authorSlugs: parseJsonArray(formData.get("authorSlugs")),
      keywords: (formData.get("keywords") as string) || "",
      userStatus: Number(formData.get("userStatus") || MANGA_USER_STATUS.ON_GOING),
      genres: parsedGenres,
      contentType: isCosplay ? MANGA_CONTENT_TYPE.COSPLAY : MANGA_CONTENT_TYPE.MANGA,
      // Optional denormalized relation arrays (name + slug)
      doujinshiNames: parseJsonArray(formData.get("doujinshiNames")),
      doujinshiSlugs: parseJsonArray(formData.get("doujinshiSlugs")),
      translatorNames: parseJsonArray(formData.get("translatorNames")),
      translatorSlugs: parseJsonArray(formData.get("translatorSlugs")),
      characterNames: parseJsonArray(formData.get("characterNames")),
      characterSlugs: parseJsonArray(formData.get("characterSlugs")),
    };

    const posterVariants = parsePosterVariantsPayload(formData.get("posterVariantsJson"));
    const posterUrl = formData.get("posterUrl");
    if (posterVariants?.w625?.url) mangaData.poster = posterVariants.w625.url;
    else if (posterUrl) mangaData.poster = posterUrl as string;
    if (posterVariants) mangaData.posterVariants = posterVariants as any;

    await updateManga(request, mangaId, mangaData);

    if (posterVariants && existingManga) {
      const oldPaths = collectPosterVariantPaths((existingManga as any).posterVariants, (existingManga as any).poster);
      const newPaths = collectPosterVariantPaths(posterVariants, posterVariants.w625?.url || (posterUrl as string));
      const toDelete = oldPaths.filter((p) => !newPaths.includes(p));
      if (toDelete.length) {
        try {
          await deletePublicFiles(toDelete);
        } catch (error) {
          console.warn("[edit] delete old poster variants failed", error);
        }
      }
    }
    const overrideUpdatedAt = formData.get("overrideUpdatedAt");
    if (isAdmin(userInfo.role) && typeof overrideUpdatedAt === "string" && overrideUpdatedAt.trim()) {
      try {
        const d = new Date(overrideUpdatedAt.trim());
        if (!isNaN(d.getTime())) {
          await MangaModel.findByIdAndUpdate(mangaId, { updatedAt: d }, { timestamps: false });
        }
      } catch (e) {
        // Best-effort only: truyện đã cập nhật thành công, không nên báo lỗi cho user.
        console.error("overrideUpdatedAt failed", e);
      }
    }

    if (newParam === "true") return redirect(`/truyen-hentai/chapter/create/${nextHandle}`);
    return redirect(`/truyen-hentai/preview/${nextHandle}`);
  } catch (error) {
    if (error instanceof BusinessError) {
      return { success: false, error: { message: error.message } };
    }
    return { success: false, error: { message: "Có lỗi xảy ra, vui lòng thử lại" } };
  }
}

type FormDataShape = {
  title: string;
  description: string;
  author: string;
  keywords: string;
  userStatus: number;
  genres: string[];
  poster: File | null;
  alternateTitle?: string;
};

const FIXED_SCHEDULE_ISO = "2025-10-15T08:08:00+07:00";

export default function EditStory() {
  const { genres, manga, isAdmin } = useLoaderData<typeof loader>();
  // Khởi tạo tác giả ban đầu:
  // - Ưu tiên dữ liệu denormalized (authorNames/authorSlugs) để giữ đúng slug (kể cả CJK + collision -2)
  // - Fallback từ manga.author (chuỗi) và slugify hỗ trợ Unicode
  const initialAuthorList: AuthorLite[] = Array.isArray((manga as any)?.authorNames)
    ? ((manga as any).authorNames as any[])
        .map((name: any, idx: number) => {
          const cleanName = String(name || "").trim();
          if (!cleanName) return null;
          const slug = String(((manga as any)?.authorSlugs?.[idx] ?? "") || toSlug(cleanName));
          return { id: slug || String(idx + 1), name: cleanName, slug, avatarUrl: null };
        })
        .filter(Boolean) as AuthorLite[]
    : String((manga as any)?.author || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name, idx) => {
          const slug = toSlug(String(name));
          return { id: slug || String(idx + 1), name: String(name), slug, avatarUrl: null };
        });

  const [formData, setFormData] = useState<FormDataShape>({
    title: manga.title,
    description: manga.description || "",
    author: manga.author || "",
    keywords: manga.keywords || "",
    userStatus: (manga as any).userStatus ?? MANGA_USER_STATUS.ON_GOING,
    genres: (Array.isArray((manga as any).genres) ? (manga as any).genres : [])
      .map((g: any) => {
        if (typeof g === "string") return normalizeGenreSlug(g);
        if (g && typeof g === "object") {
          return normalizeGenreSlug((g as any).slug ?? (g as any).value ?? (g as any).id ?? "");
        }
        return "";
      })
      .filter(Boolean),
    poster: null,
    alternateTitle: (manga as any).alternateTitle || "",
  });

  const [selectedAuthors, setSelectedAuthors] = useState<AuthorLite[]>(initialAuthorList);
  const [authorOrderIds, setAuthorOrderIds] = useState<string[]>(initialAuthorList.map((a) => a.id));
  // New entity states (prefill from existing manga arrays if present)
  const [selectedDoujinshi, setSelectedDoujinshi] = useState<AuthorLite[]>(() => (manga.doujinshiNames || []).map((name: string, i: number) => ({ id: String(i), name, slug: (manga.doujinshiSlugs || [])[i] || name, avatarUrl: null })));
  const [selectedTranslators, setSelectedTranslators] = useState<AuthorLite[]>(() => (manga.translatorNames || []).map((name: string, i: number) => ({ id: String(i), name, slug: (manga.translatorSlugs || [])[i] || name, avatarUrl: null })));
  const [selectedCharacters, setSelectedCharacters] = useState<AuthorLite[]>(() => (manga.characterNames || []).map((name: string, i: number) => ({ id: String(i), name, slug: (manga.characterSlugs || [])[i] || name, avatarUrl: null })));

  const [posterPreview, setPosterPreview] = useState(manga.poster || "");
  const [posterUrl, setPosterUrl] = useState("");
  const [posterVariantsJson, setPosterVariantsJson] = useState("");
  const [posterVariants, setPosterVariants] = useState<PosterVariantsResult | null>(null);
  const [posterDragOver, setPosterDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [useFixedSchedule, setUseFixedSchedule] = useState(false);
  const [isCosplay, setIsCosplay] = useState((manga as any)?.contentType === MANGA_CONTENT_TYPE.COSPLAY);

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { uploadMultipleFiles } = useFileOperations();

  const formRef = useRef<HTMLFormElement>(null);

  const handleGenreToggle = (genreSlug: string) => {
    const slug = normalizeGenreSlug(genreSlug);
    setFormData((prev: FormDataShape) => {
      const current = Array.isArray(prev.genres)
        ? prev.genres.map(normalizeGenreSlug).filter(Boolean)
        : [];
      const isRemoving = current.includes(slug);

      if (isRemoving) {
        return { ...prev, genres: current.filter((g) => g !== slug) };
      }

      const hasVanilla = current.includes(VANILLA_GENRE_SLUG);
      const hasAnti = current.some((g) => ANTI_VANILLA_TAGS.has(g));

      // Block adding vanilla when anti-vanilla already exists
      if (slug === VANILLA_GENRE_SLUG && hasAnti) {
        toast.error("Có thể loại trái ngược với vanilla đã được chọn");
        return prev;
      }

      // Block adding any anti-vanilla tag when vanilla already exists
      if (hasVanilla && ANTI_VANILLA_TAGS.has(slug)) {
        toast.error("truyện đã có vanilla, không được phép thêm thể loại trái ngược");
        return prev;
      }

      return { ...prev, genres: [...current, slug] };
    });
  };

  const handleInputChange = (field: keyof FormDataShape, value: string) => {
    setFormData((prev: FormDataShape) => ({ ...prev, [field]: value }));
  };

  const handleStatusSelect = (status: number) => {
    setFormData((prev: FormDataShape) => ({ ...prev, userStatus: status }));
  };

  const handleFileSelect = async (file: File) => {
    try {
      const variants = await generatePosterVariants(file);
      setPosterVariants(variants);
      setFormData((prev: FormDataShape) => ({ ...prev, poster: variants.w625.file }));
      setPosterPreview(URL.createObjectURL(variants.w625.file));
    } catch (error) {
      console.error("Normalize poster error", error);
      toast.error("Không thể xử lý ảnh bìa, vui lòng thử lại");
    }
  };

  const clearPosterImage = () => {
    setFormData((prev: FormDataShape) => ({ ...prev, poster: null }));
    setPosterPreview("");
    setPosterUrl("");
    setPosterVariants(null);
    setPosterVariantsJson("");
  };

  const ensureDescriptionNotRequired = () => {
    const el = formRef.current?.querySelector<HTMLTextAreaElement>('textarea[name="description"]');
    if (el) el.removeAttribute("required");
  };

  const handleContinueClick = async () => {
    if (!formData.title.trim()) {
      toast.error("Vui lòng nhập tên truyện");
      return;
    }
    if (!posterPreview && !formData.poster) {
      toast.error("Vui lòng chọn ảnh bìa");
      return;
    }
    // Tác giả không còn bắt buộc

    setIsUploading(true);
    try {
      let posterVariantUrl: string | undefined;
      if (posterVariants?.w625?.file) {
        const uploadEntries: Array<{ key: "w220" | "w400" | "w625"; width: number; height: number; file: File }> = [];
        const uploads: Array<{ file: File; options: { prefixPath: string } }> = [];
        const push = (key: "w220" | "w400" | "w625", variant: { file: File; width: number; height: number }) => {
          uploadEntries.push({ key, width: variant.width, height: variant.height, file: variant.file });
          uploads.push({ file: variant.file, options: { prefixPath: "story-images" } });
        };

        push("w625", posterVariants.w625);
        if (posterVariants.w400) push("w400", posterVariants.w400);
        if (posterVariants.w220) push("w220", posterVariants.w220);

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

        posterVariantUrl = payload.w625?.url || payload.w400?.url || payload.w220?.url;
        if (posterVariantUrl) {
          const payloadJson = JSON.stringify(payload);
          setPosterVariantsJson(payloadJson);
          const hiddenVariants = formRef.current?.querySelector<HTMLInputElement>('input[name="posterVariantsJson"]');
          if (hiddenVariants) hiddenVariants.value = payloadJson;
        }
      }

      if (posterVariantUrl) setPosterUrl(posterVariantUrl);
      else if (posterPreview && !posterUrl) {
        const hidden = formRef.current?.querySelector<HTMLInputElement>('input[name="posterUrl"]');
        if (hidden) hidden.value = posterPreview;
      }

      setIsUploading(false);
      ensureDescriptionNotRequired();
      formRef.current?.requestSubmit();
    } catch (error) {
      console.error("Upload error:", error);
      setIsUploading(false);
      toast.error("Lỗi khi tải ảnh lên");
    }
  };

  const [genreQuery, setGenreQuery] = useState("");
  const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const foldVN = (s: string) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]+/g, "")
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
      const aa = foldVN(a.name);
      const bb = foldVN(b.name);
      if (aa < bb) return -1;
      if (aa > bb) return 1;
      return 0;
    });
  }, [genres]);

  const tokens = useMemo(() => foldVN(genreQuery).split(/[\s,]+/).filter(Boolean), [genreQuery]);

  const filtered = useMemo<GenresType[]>(() => {
    if (!tokens.length) return sortedGenres;
    const onlySingleLetters = tokens.every((t: string) => /^[a-z]$/.test(t));
    if (onlySingleLetters) {
      const L = new Set(tokens.map((t: string) => t.toUpperCase()));
      return sortedGenres.filter((g: GenresType) => L.has((foldVN(g.name)[0] || "#").toUpperCase()));
    }
    return sortedGenres.filter((g: GenresType) => {
      const hay = `${foldVN(g.name)} ${(g.slug || "").toLowerCase()}`;
      return tokens.some((t: string) => hay.includes(t));
    });
  }, [sortedGenres, tokens]);

  const groupedGenres = useMemo(() => {
    const map: Record<string, GenresType[]> = {};
    for (const g of filtered) {
      const first = (foldVN(g.name)[0] || "#").toUpperCase();
      const key = AZ.includes(first) ? first : "#";
      (map[key] ||= []).push(g);
    }
    const out: Array<[string, GenresType[]]> = [];
    if (map["#"]?.length) out.push(["#", map["#"]]);
    for (const L of AZ) if (map[L]?.length) out.push([L, map[L]]);
    return out;
  }, [filtered]);

  const responseData = useActionData<typeof action>();

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

  return (
    <div className="mx-auto flex w-full max-w-[1212px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-0">
      <Toaster position="bottom-right" />

      <h1 className="text-txt-primary font-sans text-2xl leading-9 font-semibold sm:text-3xl" style={{ textShadow: "0px 0px 4px rgba(182, 25, 255, 0.59)" }}>
        Chỉnh sửa truyện
      </h1>

      <form
        ref={formRef}
        method="post"
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          if (!posterUrl && formData.poster) {
            e.preventDefault();
            handleContinueClick();
          }
        }}
      >
        <input type="hidden" name="isCosplay" value={isCosplay ? "1" : "0"} />
        <div className="bg-bgc-layer1 border-bd-default flex flex-col gap-6 rounded-xl border p-4 shadow-lg sm:p-6">
          {responseData?.error && (
            <div className="w-full rounded bg-red-500/10 p-3 text-sm font-medium text-red-500">{responseData.error.message}</div>
          )}

          <div className="flex flex-col gap-6 md:flex-row">
            <div className="md:w-2/5 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <ImageIcon className="text-txt-secondary mt-0.5 h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Ảnh bìa</label>
                </div>
                <div className="flex w-full flex-row items-start gap-4">
                  <div className="min-h-64 min-w-44">
                    <div onDrop={onPosterDrop} onDragOver={onPosterDragOver} onDragLeave={onPosterDragLeave} className={["rounded-xl transition", posterDragOver ? "ring-2 ring-lav-500 ring-offset-0" : ""].join(" ")} aria-label="Kéo ảnh vào vùng này hoặc bấm để chọn" title="Kéo ảnh vào đây hoặc bấm để chọn">
                      <ImageUploader onFileSelect={handleFileSelect} onClear={clearPosterImage} preview={posterPreview} uploadText="Tải ảnh lên (kéo-thả được)" required aspectRatio="poster" />
                    </div>
                  </div>
                  <div className="flex h-64 flex-col justify-center gap-4 p-4">
                    <p className="text-txt-secondary font-sans text-base font-medium">1. Ảnh có tỷ lệ 3:4</p>
                    <p className="text-txt-secondary font-sans text-base font-medium">2. Ảnh có kích thước dưới 1MB</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {/* Authors */}
                <div className="flex flex-col gap-4">
                  <div className="flex min-w-fit items-center gap-1.5">
                    <User className="text-txt-secondary h-4 w-4" />
                    <label className="text-txt-primary font-sans text-base font-semibold">Tác giả</label>
                  </div>
                  <div>
                    <AuthorSelect placeholder="Thêm tác giả…" initialAuthors={initialAuthorList} pinCreateOnTop onChange={(authors: AuthorLite[], orderIds: string[]) => {
                      setSelectedAuthors(authors);
                      setAuthorOrderIds(orderIds);
                      const names = authors.map((a) => a.name).join(", ");
                      setFormData((prev) => ({ ...prev, author: names }));
                    }} />
                    <div className="mt-2 text-xs text-gray-500">Sẽ lưu: <span className="font-medium">{formData.author || "—"}</span></div>
                  </div>
                </div>
                {/* Doujinshi */}
                <div className="flex flex-col gap-4">
                  <div className="flex min-w-fit items-center gap-1.5">
                    <Tag className="text-txt-secondary h-4 w-4" />
                    <label className="text-txt-primary font-sans text-base font-semibold">Doujinshi</label>
                  </div>
                  <div>
                    <DoujinshiSelect initial={selectedDoujinshi} onChange={(items: AuthorLite[]) => setSelectedDoujinshi(items)} />
                    <div className="mt-2 text-xs text-gray-500">Tùy chọn</div>
                  </div>
                </div>
                {/* Translators */}
                <div className="flex flex-col gap-4">
                  <div className="flex min-w-fit items-center gap-1.5">
                    <User className="text-txt-secondary h-4 w-4" />
                    <label className="text-txt-primary font-sans text-base font-semibold">Dịch giả</label>
                  </div>
                  <div>
                    <TranslatorSelect initial={selectedTranslators} onChange={(items: AuthorLite[]) => setSelectedTranslators(items)} />
                    <div className="mt-2 text-xs text-gray-500">Tùy chọn</div>
                  </div>
                </div>
                {/* Characters */}
                <div className="flex flex-col gap-4">
                  <div className="flex min-w-fit items-center gap-1.5">
                    <User className="text-txt-secondary h-4 w-4" />
                    <label className="text-txt-primary font-sans text-base font-semibold">Nhân vật</label>
                  </div>
                  <div>
                    <CharacterSelect initial={selectedCharacters} onChange={(items: AuthorLite[]) => setSelectedCharacters(items)} />
                    <div className="mt-2 text-xs text-gray-500">Tùy chọn</div>
                  </div>
                </div>
              </div>

              {isAdmin ? (
                <div className="rounded-xl border border-dashed border-lav-500/40 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 accent-fuchsia-500"
                      checked={isCosplay}
                      onChange={(e) => setIsCosplay(e.target.checked)}
                    />
                    <div>
                      <p className="text-txt-primary text-sm font-semibold uppercase">Album ảnh cosplay thật</p>
                      <p className="text-txt-secondary mt-1 text-xs">
                        Khi bật, truyện này sẽ lọt vào kho "Ảnh Cosplay" trên trang chủ và không xuất hiện trong danh sách manga thông thường.
                      </p>
                    </div>
                  </label>
                </div>
              ) : null}

              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <Settings className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Trạng thái / One-shot</label>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="userStatusRadio" checked={formData.userStatus === MANGA_USER_STATUS.ON_GOING} onChange={() => handleStatusSelect(MANGA_USER_STATUS.ON_GOING)} className="h-4 w-4 cursor-pointer" />
                    <span className="text-txt-primary text-sm font-medium">Đang tiến hành</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="userStatusRadio" checked={formData.userStatus === MANGA_USER_STATUS.COMPLETED} onChange={() => handleStatusSelect(MANGA_USER_STATUS.COMPLETED)} className="h-4 w-4 cursor-pointer" />
                    <span className="text-txt-primary text-sm font-medium">Đã hoàn thành</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="oneshotCheckbox" checked={formData.genres.includes("oneshot")} onChange={() => handleGenreToggle("oneshot")} className="h-4 w-4 cursor-pointer" />
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
                    <p className="text-xs text-txt-secondary">Tick để lưu truyện với thời điểm cố định, bỏ tick để giữ thời gian cập nhật hiện tại.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="md:w-3/5 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <Book className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Tên truyện</label>
                </div>
                <div>
                  <input type="text" name="title" value={formData.title} onChange={(e) => handleInputChange("title", e.target.value)} placeholder="Viết hoa ký tự đầu tiên mỗi từ" className="bg-bgc-layer2 border-bd-default text-txt-secondary focus:border-lav-500 focus:text-txt-primary w-full rounded-xl border px-3 py-2.5 font-sans text-base font-medium focus:outline-none" required />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-txt-secondary text-sm font-medium">Tên khác (không bắt buộc)</label>
                <input type="text" name="alternateTitle" value={(formData as any).alternateTitle || ""} onChange={(e) => handleInputChange("alternateTitle", e.target.value)} placeholder="Tên khác (ví dụ: bản ENG, tên rút gọn...)" className="bg-bgc-layer2 border-bd-default text-txt-secondary w-full rounded-lg border px-3 py-2 text-sm font-sans font-medium focus:outline-none" />
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <Tag className="text-txt-secondary mt-0.5 h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Thể loại</label>
                </div>
                <div className="flex w-full flex-col gap-3">
                  <div className="text-txt-secondary text-xs">Gõ <b>a,b,c…</b> để lọc theo chữ đầu; gõ <b> nhiều từ khóa cùng lúc</b> để tìm nhanh hơn.</div>

                  <label className="relative w-full max-w-[360px]">
                    <input value={genreQuery} onChange={(e) => setGenreQuery(e.target.value)} placeholder="Có thể nhập nhiều từ khóa cùng lúc để tìm, vd: manhwa color series ..." className="w-full rounded-md border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                  </label>

                  <div className="max-h-[360px] overflow-y-auto rounded-lg border border-white/10 p-3 pr-1 [scrollbar-color:rgba(255,255,255,0.3)_transparent] [scrollbar-width:thin]">
                    <div className="space-y-4">
                      {groupedGenres.map(([letter, items]) => (
                        <div key={letter}>
                          <div className="mb-2 flex items-center gap-2">
                            <div className="text-sm font-bold text-txt-focus">{letter}</div>
                            <div className="h-px flex-1 bg-bd-default/60" />
                          </div>

                          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                            {items.map((genre) => {
                              const checked = formData.genres.includes(genre.slug);
                              return (
                                <label key={genre.slug} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 select-none hover:bg-white/5">
                                  <div className="relative">
                                    <input type="checkbox" checked={checked} onChange={() => handleGenreToggle(genre.slug)} className="bg-bgc-layer2 border-bd-default checked:bg-lav-500 checked:border-lav-500 h-4 w-4 cursor-pointer appearance-none rounded border" />
                                    {checked && (
                                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                        <Check className="text-txt-primary h-3 w-3" />
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-txt-primary line-clamp-1 font-sans text-xs font-medium"><span className="font-bold">{genre.name.slice(0, 1)}</span>{genre.name.slice(1)}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {groupedGenres.length === 0 && <div className="text-sm text-txt-secondary">Không có thể loại phù hợp.</div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex min-w-fit items-center gap-1.5">
                  <FileText className="text-txt-secondary mt-0.5 h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base font-semibold">Giới thiệu</label>
                </div>
                <div>
                  <textarea name="description" value={formData.description} onChange={(e) => handleInputChange("description", e.target.value)} placeholder="Nhập nội dung giới thiệu (có cũng được, không có cũng được)" rows={8} className="bg-bgc-layer2 border-bd-default text-txt-secondary focus:border-lav-500 focus:text-txt-primary w-full resize-none rounded-xl border px-3 py-2.5 font-sans text-base font-medium focus:outline-none" />
                </div>
              </div>
            </div>
          </div>

          <input type="hidden" name="keywords" value={formData.keywords} />
          <input type="hidden" name="userStatus" value={formData.userStatus} />
          <input type="hidden" name="genres" value={JSON.stringify(formData.genres)} />
          <input type="hidden" name="posterUrl" value={posterUrl} />
          <input type="hidden" name="posterVariantsJson" value={posterVariantsJson} />
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

        <div className="flex justify-end">
          <button type="button" onClick={handleContinueClick} disabled={isSubmitting || isUploading || !formData.title.trim()} className="w-full rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 font-sans text-sm font-semibold text-black shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-52">
            {isUploading ? "Đang tải ảnh lên..." : isSubmitting ? "Đang lưu..." : "Lưu lại"}
          </button>
        </div>
      </form>
    </div>
  );
}
