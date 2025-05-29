import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { useLoaderData, useSearchParams, useSubmit } from "react-router-dom";
import { Check, ChevronDown, Clock } from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "Quản lý Report | Admin" },
    { name: "description", content: "Trang quản lý báo cáo của hệ thống" },
  ];
};

// Mock data types
interface ReportType {
  id: string;
  reporterName: string;
  reportType: "truyện" | "bình luận";
  targetName: string;
  content: string;
  timestamp: string;
  date: string;
}

interface LoaderData {
  reports: ReportType[];
  selectedTypes: ("truyện" | "bình luận")[];
  sortBy: string;
}

// Mock data
const mockReports: ReportType[] = [
  {
    id: "1",
    reporterName: "Nguyễn Văn A",
    reportType: "truyện",
    targetName: "Đã Chăm Rồi Thì Hãy Chịu Trách Nhiệm Đi!",
    content:
      "Tôi báo cáo truyện này vì nó chứa quá nhiều quảng cáo trá hình cho các sản phẩm không liên quan. Các quảng cáo được chèn vào một cách vụng về, làm gián đoạn mạch truyện và gây khó chịu cho người đọc. Truyện đã trở thành một công cụ quảng cáo hơn là một tác phẩm giải trí.",
    timestamp: "12:30",
    date: "23/04/2025",
  },
  {
    id: "2",
    reporterName: "Nguyễn Văn A",
    reportType: "bình luận",
    targetName: "Trần Thị B",
    content:
      "Tôi báo cáo truyện này vì nó chứa quá nhiều quảng cáo trá hình cho các sản phẩm không liên quan. Các quảng cáo được chèn vào một cách vụng về, làm gián đoạn mạch truyện và gây khó chịu cho người đọc. Truyện đã trở thành một công cụ quảng cáo hơn là một tác phẩm giải trí.",
    timestamp: "12:30",
    date: "23/04/2025",
  },
  {
    id: "3",
    reporterName: "Lê Thị C",
    reportType: "truyện",
    targetName: "Tình Yêu Không Có Lỗi, Lỗi Ở Bạn Thích Tôi",
    content:
      "Truyện này có nội dung không phù hợp với độ tuổi, chứa nhiều cảnh bạo lực và tình dục quá mức. Tôi nghĩ nó cần được kiểm duyệt kỹ hơn trước khi đăng tải.",
    timestamp: "14:15",
    date: "23/04/2025",
  },
  {
    id: "4",
    reporterName: "Phạm Văn D",
    reportType: "bình luận",
    targetName: "Hoàng Thị E",
    content:
      "Người dùng này liên tục spam bình luận không liên quan đến nội dung truyện, gây ảnh hưởng đến trải nghiệm đọc của người khác.",
    timestamp: "09:45",
    date: "22/04/2025",
  },
  {
    id: "5",
    reporterName: "Trần Văn F",
    reportType: "truyện",
    targetName: "Ma Thổi Đèn Phần 9",
    content:
      "Truyện này vi phạm bản quyền, được copy nguyên văn từ tác phẩm gốc mà không có sự cho phép của tác giả.",
    timestamp: "16:30",
    date: "22/04/2025",
  },
];

export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData> {
  const url = new URL(request.url);
  const sortBy = url.searchParams.get("sort") || "newest";

  // Get selected types from query params
  const reportTypes = url.searchParams.getAll("reportType");
  const selectedTypes: ("truyện" | "bình luận")[] =
    reportTypes.length > 0
      ? reportTypes.filter(
          (type): type is "truyện" | "bình luận" =>
            type === "truyện" || type === "bình luận",
        )
      : ["truyện", "bình luận"]; // Default to show both if no selection

  // Filter reports based on selected types
  const filteredReports = mockReports.filter((report) =>
    selectedTypes.includes(report.reportType),
  );

  return {
    reports: filteredReports,
    selectedTypes,
    sortBy,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const reportId = formData.get("reportId");

  if (action === "delete" && typeof reportId === "string") {
    // Handle delete logic here
    return { success: true, message: "Xóa báo cáo thành công" };
  }

  if (action === "view" && typeof reportId === "string") {
    // Handle view logic here
    return { success: true, message: "Xem báo cáo thành công" };
  }

  return { success: false, message: "Hành động không hợp lệ" };
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

interface ReportCardProps {
  report: ReportType;
  onDeleteClick: (reportId: string) => void;
  onViewClick: (reportId: string) => void;
}

function ReportCard({ report, onDeleteClick, onViewClick }: ReportCardProps) {
  const reportTypeColor =
    report.reportType === "truyện" ? "text-[#25EBAC]" : "text-[#FFE133]";

  return (
    <div className="border-bd-default bg-bgc-layer2 relative flex flex-col gap-4 self-stretch rounded-xl border p-6">
      {/* Timestamp */}
      <div className="inline-flex items-center gap-2">
        <div className="relative h-4 w-4 overflow-hidden">
          <div className="absolute top-[0.67px] left-[0.67px] h-3.5 w-3.5">
            <Clock className="text-txt-secondary h-3.5 w-3.5" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
            {report.timestamp}
          </div>
          <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
            {report.date}
          </div>
        </div>
      </div>

      {/* Main Info - Responsive Layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-20">
        <div className="flex flex-col gap-4 md:flex-row md:gap-8 lg:gap-20">
          <div className="inline-flex w-full flex-col gap-0.5 md:w-24">
            <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
              Người báo cáo
            </div>
            <div className="text-txt-primary font-sans text-base leading-normal font-semibold">
              {report.reporterName}
            </div>
          </div>

          <div className="inline-flex w-full flex-col gap-0.5 md:w-24">
            <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
              Loại báo cáo
            </div>
            <div
              className={`font-sans text-base leading-normal font-semibold ${reportTypeColor}`}
            >
              {report.reportType === "truyện" ? "Truyện" : "Bình luận"}
            </div>
          </div>
        </div>

        <div className="inline-flex flex-col gap-0.5">
          <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
            Đối tượng báo cáo
          </div>
          <div className="text-txt-primary font-sans text-base leading-normal font-semibold">
            {report.targetName}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-0.5 self-stretch">
        <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
          Nội dung
        </div>
        <div className="text-txt-primary font-sans text-base leading-normal font-semibold">
          {report.content}
        </div>
      </div>

      {/* Action Buttons - Responsive Position */}
      <div className="flex items-center gap-2 self-end lg:absolute lg:top-4 lg:right-6">
        <button
          onClick={() => onDeleteClick(report.id)}
          className="flex items-center justify-center gap-2.5 rounded-xl border border-[#E03F46] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)]"
        >
          <div className="text-center font-sans text-sm leading-tight font-semibold text-[#E03F46]">
            Xóa
          </div>
        </button>

        <button
          onClick={() => onViewClick(report.id)}
          className="flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)]"
        >
          <div className="text-center font-sans text-sm leading-tight font-semibold text-black">
            Xem
          </div>
        </button>
      </div>
    </div>
  );
}

export default function AdminReport() {
  const { reports, selectedTypes } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const submit = useSubmit();

  const handleTypeToggle = (type: "truyện" | "bình luận") => {
    const params = new URLSearchParams(searchParams);

    // Remove all existing reportType params
    params.delete("reportType");

    // Calculate new selected types
    let newSelectedTypes: ("truyện" | "bình luận")[];
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

  const handleDeleteClick = (reportId: string) => {
    const formData = new FormData();
    formData.append("action", "delete");
    formData.append("reportId", reportId);
    submit(formData, { method: "post" });
  };

  const handleViewClick = (reportId: string) => {
    const formData = new FormData();
    formData.append("action", "view");
    formData.append("reportId", reportId);
    submit(formData, { method: "post" });
  };

  return (
    <div className="container mx-auto my-8 w-full max-w-[1220px] px-4 lg:px-0">
      {/* Title */}
      <div className="text-txt-primary mb-6 w-full text-center font-sans text-4xl leading-10 font-semibold">
        Quản lý Report
      </div>

      {/* Main Container */}
      <div className="flex w-full flex-col items-start gap-6">
        {/* Header Controls */}
        <div className="flex w-full flex-col items-start justify-between gap-6 self-stretch md:flex-row md:items-center">
          {/* Checkbox Options */}
          <div className="flex items-start gap-6">
            <CheckboxOption
              checked={selectedTypes.includes("truyện")}
              onClick={() => handleTypeToggle("truyện")}
            >
              Report Truyện
            </CheckboxOption>
            <CheckboxOption
              checked={selectedTypes.includes("bình luận")}
              onClick={() => handleTypeToggle("bình luận")}
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
      </div>
    </div>
  );
}
