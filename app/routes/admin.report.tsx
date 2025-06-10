import toast, { Toaster } from "react-hot-toast";
import {
  type ActionFunctionArgs,
  type ClientActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  useNavigate,
} from "react-router";
import { useLoaderData, useSearchParams, useSubmit } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";

import { deleteReport } from "@/mutations/report.mutation";
import { getReports } from "@/queries/report.query";
import { requireAdminOrModLogin } from "@/services/auth.server";

import { Pagination } from "~/components/pagination";
import { ReportCard } from "~/components/report.card";
import { REPORT_TYPE } from "~/constants/report";
import type { ReportType } from "~/database/models/report.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Quản lý Report | Admin" },
    { name: "description", content: "Trang quản lý báo cáo của hệ thống" },
  ];
};

// Interface cho dữ liệu loader
interface LoaderData {
  reports: ReportType[];
  selectedTypes: string[];
  sortBy: string;
  total: number;
  page: number;
  totalPages: number;
}

const LIMIT_PER_PAGE = 10;

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const url = new URL(request.url);
  const sortBy = url.searchParams.get("sort") || "newest";
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  // Get selected types from query params
  const reportTypes = url.searchParams.getAll("reportType");
  const selectedTypes: string[] =
    reportTypes.length > 0
      ? reportTypes.filter(
          (type): type is string =>
            type === REPORT_TYPE.MANGA || type === REPORT_TYPE.COMMENT,
        )
      : [REPORT_TYPE.MANGA, REPORT_TYPE.COMMENT]; // Default to show both if no selection

  try {
    const result = await getReports({
      reportTypes: selectedTypes,
      sortBy,
      page,
      limit: LIMIT_PER_PAGE,
    });

    return Response.json({
      reports: result.reports,
      selectedTypes,
      sortBy,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Error loading reports:", error);
    return Response.json({
      reports: [],
      selectedTypes,
      sortBy,
      total: 0,
      page: 1,
      totalPages: 1,
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminOrModLogin(request);

  const formData = await request.formData();
  const action = formData.get("action");
  const reportId = formData.get("reportId");

  if (action === "delete" && typeof reportId === "string") {
    try {
      const success = await deleteReport(reportId);
      if (success) {
        return { success: true, message: "Xóa báo cáo thành công" };
      } else {
        return { success: false, message: "Không thể xóa báo cáo" };
      }
    } catch (error) {
      console.error("Error deleting report:", error);
      return { success: false, message: "Có lỗi xảy ra khi xóa báo cáo" };
    }
  }

  return { success: false, message: "Hành động không hợp lệ" };
}

export async function clientAction({ serverAction }: ClientActionFunctionArgs) {
  const actionData = await serverAction<{ success: boolean; message: string }>();
  if (actionData.success) {
    toast.success(actionData.message);
  } else {
    toast.error(actionData.message);
  }
}

interface CheckboxOptionProps {
  checked: boolean;
  children: React.ReactNode;
  onClick: () => void;
}

function CheckboxOption({ checked, children, onClick }: CheckboxOptionProps) {
  return (
    <div
      className="text-txt-primary flex cursor-pointer items-center gap-2"
      onClick={onClick}
    >
      <div className="relative h-5 w-4 overflow-hidden">
        <div className="bg-lav-500 absolute top-[1px] left-0 h-4 w-4 overflow-hidden rounded">
          <div className="h-4 w-4 overflow-hidden">
            {checked && <Check className="text-txt-primary h-5 w-4" />}
          </div>
        </div>
      </div>
      <div className="font-sans text-base leading-normal font-semibold">{children}</div>
    </div>
  );
}

export default function AdminReport() {
  const { reports, selectedTypes, total, page, totalPages } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigate = useNavigate();

  const handleTypeToggle = (type: string) => {
    const params = new URLSearchParams(searchParams);

    // Remove all existing reportType params
    params.delete("reportType");
    // Reset to page 1 when filtering
    params.delete("page");

    // Calculate new selected types
    let newSelectedTypes: string[];
    if (selectedTypes.includes(type)) {
      // If currently selected, remove it
      newSelectedTypes = selectedTypes.filter((t) => t !== type);
    } else {
      // If not selected, add it
      newSelectedTypes = [...selectedTypes, type];
    }

    // Add new reportType params
    newSelectedTypes.forEach((reportType) => {
      params.append("reportType", reportType);
    });

    submit(params, { method: "get" });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    submit(params, { method: "get" });
  };

  const handleDeleteClick = (reportId: string) => {
    const confirmed = window.confirm("Bạn có chắc chắn muốn xóa báo cáo này?");
    if (!confirmed) return;

    const formData = new FormData();
    formData.append("action", "delete");
    formData.append("reportId", reportId);
    submit(formData, { method: "post" });
  };

  const handleViewClick = (mangaId: string) => {
    navigate(`/admin/manga/${mangaId}`);
  };

  return (
    <div className="container mx-auto my-8 w-full max-w-[1220px] px-4 lg:px-0">
      <Toaster position="bottom-right" />

      {/* Title */}
      <div className="text-txt-primary mb-6 w-full text-center font-sans text-4xl leading-10 font-semibold">
        Quản lý Report
      </div>

      {/* Stats */}
      <div className="text-txt-secondary mb-4 text-center font-sans text-sm font-medium">
        Tổng số báo cáo: {total} | Trang {page} / {totalPages}
      </div>

      {/* Main Container */}
      <div className="flex w-full flex-col items-start gap-6">
        {/* Header Controls */}
        <div className="flex w-full flex-col items-start justify-between gap-6 self-stretch md:flex-row md:items-center">
          {/* Checkbox Options */}
          <div className="flex items-start gap-6">
            <CheckboxOption
              checked={selectedTypes.includes(REPORT_TYPE.MANGA)}
              onClick={() => handleTypeToggle(REPORT_TYPE.MANGA)}
            >
              Report Truyện
            </CheckboxOption>
            <CheckboxOption
              checked={selectedTypes.includes(REPORT_TYPE.COMMENT)}
              onClick={() => handleTypeToggle(REPORT_TYPE.COMMENT)}
            >
              Report Bình luận
            </CheckboxOption>
          </div>

          {/* Sort Dropdown */}
          <div className="border-bd-default bg-bgc-layer2 flex h-10 w-full items-center justify-between rounded-xl border px-3 py-2.5 md:w-72">
            <div className="text-txt-secondary font-sans text-sm leading-tight font-medium">
              Sắp xếp theo: Mới nhất
            </div>
            <div className="relative h-5 w-5 overflow-hidden">
              <ChevronDown className="text-txt-secondary absolute top-[3px] left-[9px] h-4 w-3 origin-top-left" />
            </div>
          </div>
        </div>

        {/* Reports List */}
        <div className="flex flex-col items-start gap-4 self-stretch">
          {reports.length > 0 ? (
            reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onDeleteClick={handleDeleteClick}
                onViewClick={handleViewClick}
              />
            ))
          ) : (
            <div className="flex w-full items-center justify-center py-12">
              <div className="text-txt-secondary font-sans text-lg font-medium">
                Không có báo cáo nào phù hợp với bộ lọc đã chọn
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center self-stretch">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
