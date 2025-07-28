import { useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import {
  type ActionFunctionArgs,
  type ClientActionFunctionArgs,
  Link,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { useLoaderData, useSearchParams, useSubmit } from "react-router-dom";
import { Search, Trash2, Upload } from "lucide-react";

import { deleteManga } from "@/mutations/manga.mutation";
import {
  getAllMangaAdmin,
  getTotalMangaCountAdmin,
  searchMangaWithPagination,
} from "@/queries/manga.query";
import { requireAdminOrModLogin } from "@/services/auth.server";

import { Dropdown } from "~/components/dropdown";
import { Pagination } from "~/components/pagination";
import { MANGA_STATUS } from "~/constants/manga";
import type { MangaType } from "~/database/models/manga.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Quản lý truyện | Admin" },
    { name: "description", content: "Trang quản lý truyện của hệ thống" },
  ];
};

interface LoaderData {
  mangas: MangaType[];
  currentPage: number;
  totalPages: number;
  searchTerm: string;
  statusFilter: number | undefined;
}

export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const searchTerm = url.searchParams.get("search") || "";
  const statusParam = url.searchParams.get("status");
  const statusFilter = statusParam ? parseInt(statusParam) : undefined;
  const limit = 10;

  let mangas: MangaType[];
  let totalMangas: number;

  if (searchTerm) {
    [mangas, totalMangas] = await Promise.all([
      searchMangaWithPagination(searchTerm, page, limit, statusFilter),
      getTotalMangaCountAdmin({ searchTerm, status: statusFilter }),
    ]);
  } else {
    [mangas, totalMangas] = await Promise.all([
      getAllMangaAdmin(page, limit, statusFilter),
      getTotalMangaCountAdmin({ status: statusFilter }),
    ]);
  }

  const totalPages = Math.ceil(totalMangas / limit);

  return {
    mangas,
    currentPage: page,
    totalPages,
    searchTerm,
    statusFilter,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminOrModLogin(request);

  const formData = await request.formData();
  const action = formData.get("action");
  const mangaId = formData.get("mangaId");

  if (action === "delete" && typeof mangaId === "string") {
    try {
      await deleteManga(request, mangaId);
      return { success: true, message: "Xóa truyện thành công" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Có lỗi xảy ra khi xóa truyện",
      };
    }
  }

  return { success: false, message: "Hành động không hợp lệ" };
}

export async function clientAction({ serverAction }: ClientActionFunctionArgs) {
  const data = await serverAction<{ success: boolean; message: string }>();
  if (data.success) {
    toast.success(data.message);
  } else {
    toast.error(data.message);
  }
}

interface ActionButtonsProps {
  manga: MangaType;
  onDeleteClick: (e: React.MouseEvent<HTMLButtonElement>, manga: MangaType) => void;
}

function ActionButtons({ manga, onDeleteClick }: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-start gap-3">
      <button
        className="flex cursor-pointer items-center justify-start gap-1 hover:opacity-70"
        onClick={(e) => onDeleteClick(e, manga)}
      >
        <div className="relative h-5 w-5 overflow-hidden">
          <Trash2 className="text-txt-secondary h-5 w-5" />
        </div>
      </button>
    </div>
  );
}

const getStatusText = (status: number) => {
  switch (status) {
    case MANGA_STATUS.PENDING:
      return "Chờ duyệt";
    case MANGA_STATUS.APPROVED:
      return "Đã duyệt";
    case MANGA_STATUS.REJECTED:
      return "Từ chối";
    default:
      return "Không xác định";
  }
};

const getStatusColor = (status: number) => {
  switch (status) {
    case MANGA_STATUS.PENDING:
      return "text-[#FFE133]";
    case MANGA_STATUS.APPROVED:
      return "text-[#25EBAC]";
    case MANGA_STATUS.REJECTED:
      return "text-[#FF555D]";
    default:
      return "text-txt-secondary";
  }
};

export default function AdminManga() {
  const {
    mangas,
    currentPage,
    totalPages,
    searchTerm: initialSearchTerm,
    statusFilter,
  } = useLoaderData<LoaderData>();

  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);

  // Status options for dropdown
  const statusOptions = [
    { value: "", label: "Tất cả trạng thái" },
    { value: MANGA_STATUS.PENDING, label: "Chờ duyệt" },
    { value: MANGA_STATUS.APPROVED, label: "Đã duyệt" },
    { value: MANGA_STATUS.REJECTED, label: "Từ chối" },
  ];

  const handleDeleteClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    manga: MangaType,
  ) => {
    e.preventDefault();
    if (confirm(`Bạn có chắc chắn muốn xóa truyện "${manga.title}"?`)) {
      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("mangaId", manga.id);
      submit(formData, { method: "post" });
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    const params = new URLSearchParams(searchParams);
    if (value.trim()) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    params.delete("page");
    submit(params, { method: "get" });
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    submit(params, { method: "get" });
  };

  const handleStatusChange = (value: string | number) => {
    const params = new URLSearchParams(searchParams);
    if (value === "" || value === undefined) {
      params.delete("status");
    } else {
      params.set("status", value.toString());
    }
    params.delete("page");
    submit(params, { method: "get" });
  };

  return (
    <div className="container mx-auto my-8 w-full max-w-[1141px] gap-4 px-4 lg:px-0">
      <Toaster position="bottom-right" />
      {/* Header with Title */}
      <div className="text-txt-primary justify-center text-center text-2xl leading-loose font-semibold">
        Quản lý truyện
      </div>

      {/* Upload Button */}
      <div className="flex justify-end">
        <Link to="/admin/manga/upload-revenue">
          <button className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#C466FF] to-[#924DBF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)]">
            <Upload className="h-5 w-5 text-black" />
            <div className="text-center font-sans text-sm leading-tight font-semibold text-black">
              Upload doanh thu
            </div>
          </button>
        </Link>
      </div>

      {/* Main Content */}
      <div className="bg-bgc-layer1 border-bd-default mt-4 flex min-h-[596px] flex-col items-start justify-start gap-6 self-stretch rounded-xl border p-6 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
        {/* Search and Sort Controls */}
        <div className="flex flex-col items-start justify-between gap-4 self-stretch md:flex-row md:gap-0">
          <div className="bg-bgc-layer2 border-bd-default flex w-full items-center justify-start gap-2 rounded-xl border px-3 py-2 md:w-80">
            <Search className="text-txt-primary h-5 w-5" />
            <input
              type="text"
              placeholder="Tìm truyện"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="text-txt-secondary placeholder:text-txt-secondary focus:text-txt-primary flex-1 bg-transparent font-sans text-sm leading-tight font-semibold focus:outline-none"
            />
          </div>
          <Dropdown
            options={statusOptions}
            value={statusFilter ?? ""}
            onSelect={handleStatusChange}
            className="w-full md:w-60"
            placeholder="Chọn trạng thái"
          />
        </div>

        {/* Table */}
        <div className="flex flex-col items-start justify-start self-stretch">
          {/* Table Header */}
          <div className="bg-bgc-layer2 hidden items-center justify-start self-stretch rounded-xl lg:flex">
            <div className="flex min-w-12 items-center justify-center gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                STT
              </div>
            </div>
            <div className="flex flex-1 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Tên truyện
              </div>
            </div>
            <div className="flex flex-1 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Người đăng
              </div>
            </div>
            <div className="flex flex-1 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Thể loại
              </div>
            </div>
            <div className="flex min-w-32 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Số chương
              </div>
            </div>
            <div className="flex min-w-28 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Trạng thái
              </div>
            </div>
            <div className="flex min-w-20 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Tác vụ
              </div>
            </div>
          </div>

          {/* Table Rows */}
          {mangas.map((manga, index) => {
            const globalIndex = (currentPage - 1) * 7 + index + 1;

            return (
              <Link
                key={manga.id}
                to={`/manga/preview/${manga.id}`}
                className="border-bd-default flex flex-col items-start justify-start gap-2 self-stretch border-b p-2 lg:flex-row lg:items-center lg:gap-0 lg:p-0"
              >
                {/* Mobile Layout */}
                <div className="w-full space-y-2 lg:hidden">
                  <div className="flex items-center justify-between">
                    <div className="text-txt-primary font-sans text-sm font-semibold">
                      #{globalIndex}
                    </div>
                    <div
                      className={`font-sans text-sm font-semibold ${getStatusColor(manga.status)}`}
                    >
                      {getStatusText(manga.status)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <img
                      className="h-9 w-9 rounded-sm object-cover"
                      src={manga.poster || "https://placehold.co/37x36"}
                      alt={manga.title}
                    />
                    <div className="space-y-1">
                      <div className="text-txt-primary font-sans text-sm font-semibold">
                        {manga.title}
                      </div>
                      <div className="text-txt-secondary font-sans text-xs font-medium">
                        {manga.translationTeam}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-txt-focus font-sans text-xs font-semibold">
                      {manga.genres.join(", ")}
                    </div>
                    <div className="text-txt-primary font-sans text-sm font-semibold">
                      {manga.chapters} chương
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <ActionButtons
                      manga={manga}
                      onDeleteClick={(e) => handleDeleteClick(e, manga)}
                    />
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden min-w-12 items-center justify-center gap-2.5 p-3 lg:flex">
                  <div className="text-txt-primary font-sans text-sm leading-tight font-semibold">
                    {globalIndex}
                  </div>
                </div>
                <div className="hidden flex-1 items-center justify-start gap-2.5 p-3 lg:flex">
                  <img
                    className="h-9 w-9 rounded-sm object-cover"
                    src={manga.poster || "https://placehold.co/37x36"}
                    alt={manga.title}
                  />
                  <div className="text-txt-primary flex-1 font-sans text-sm leading-tight font-semibold">
                    {manga.title}
                  </div>
                </div>
                <div className="hidden flex-1 items-center justify-start gap-2.5 p-3 lg:flex">
                  <div className="text-txt-primary font-sans text-sm leading-tight font-semibold">
                    {manga.translationTeam}
                  </div>
                </div>
                <div className="hidden flex-1 items-center justify-start gap-2.5 p-3 lg:flex">
                  <div className="text-txt-focus font-sans text-sm leading-tight font-semibold">
                    {manga.genres.join(", ")}
                  </div>
                </div>
                <div className="hidden min-w-32 items-center justify-start gap-2.5 p-3 lg:flex">
                  <div className="text-txt-primary font-sans text-sm leading-tight font-semibold">
                    {manga.chapters}
                  </div>
                </div>
                <div className="hidden min-w-28 items-center justify-start gap-2.5 p-3 lg:flex">
                  <div
                    className={`font-sans text-sm leading-tight font-semibold ${getStatusColor(manga.status)}`}
                  >
                    {getStatusText(manga.status)}
                  </div>
                </div>
                <div className="hidden min-w-20 items-center justify-start gap-2.5 p-3 lg:flex">
                  <ActionButtons
                    manga={manga}
                    onDeleteClick={(e) => handleDeleteClick(e, manga)}
                  />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col items-center justify-center gap-2.5 self-stretch">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
