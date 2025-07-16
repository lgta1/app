import { useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import {
  type ActionFunctionArgs,
  type ClientActionFunctionArgs,
  type MetaFunction,
} from "react-router";
import { Form, useActionData, useNavigation } from "react-router-dom";
import { Download, Upload } from "lucide-react";
import XLSX from "xlsx";

import { uploadMangaRevenues } from "@/mutations/manga-revenue.mutation";
import { requireAdminOrModLogin } from "@/services/auth.server";

import { Dropdown } from "~/components/dropdown";

export const meta: MetaFunction = () => {
  return [
    { title: "Tải lên doanh thu Manga | Admin" },
    { name: "description", content: "Trang tải lên dữ liệu doanh thu của truyện" },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminOrModLogin(request);

  const formData = await request.formData();
  const period = formData.get("period") as "daily" | "weekly" | "monthly";
  const file = formData.get("file") as File;

  if (!period || !["daily", "weekly", "monthly"].includes(period as string)) {
    return { success: false, error: "Vui lòng chọn kỳ báo cáo hợp lệ" };
  }

  if (!file) {
    return { success: false, error: "Vui lòng chọn file Excel để tải lên" };
  }

  // Đọc file Excel
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  // Lấy sheet đầu tiên
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Chuyển đổi sheet thành JSON
  const data = XLSX.utils.sheet_to_json(sheet);

  // Validate data
  if (!data || data.length === 0) {
    return { success: false, error: "File Excel không có dữ liệu" };
  }

  // Kiểm tra định dạng dữ liệu
  const isValidData = data.every(
    (row: any) => row.mangaId && typeof row.revenue === "number",
  );

  if (!isValidData) {
    return {
      success: false,
      error:
        "Định dạng dữ liệu không hợp lệ. File Excel phải có các cột: mangaId, revenue",
    };
  }

  // Chuyển đổi dữ liệu
  const revenueData = data.map((row: any) => ({
    mangaId: String(row.mangaId),
    revenue: Number(row.revenue),
  }));

  // Upload dữ liệu
  const result = await uploadMangaRevenues(period, revenueData);

  return {
    success: true,
    message: `Đã xóa ${result.deletedCount} dữ liệu cũ và thêm ${result.insertedCount} dữ liệu mới`,
    data: result,
  };
}

export async function clientAction({ serverAction }: ClientActionFunctionArgs) {
  const result = await serverAction<{
    success: boolean;
    message?: string;
    error?: string;
  }>();

  if (result.success) {
    toast.success(result.message || "Tải lên dữ liệu thành công!");
  } else {
    toast.error(result.error || "Có lỗi xảy ra khi tải lên dữ liệu!");
  }

  return result;
}

export default function AdminMangaUploadRevenue() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const isUploading = navigation.state === "submitting";

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handlePeriodChange = (value: any) => {
    setPeriod(value as "daily" | "weekly" | "monthly");
  };

  // Period options for Dropdown
  const periodOptions = [
    { value: "daily", label: "Ngày" },
    { value: "weekly", label: "Tuần" },
    { value: "monthly", label: "Tháng" },
  ];

  // Hàm tạo mẫu Excel
  const generateExcelTemplate = () => {
    // Tạo URL để download template
    const template = [
      { mangaId: "manga_id_1", revenue: 1000 },
      { mangaId: "manga_id_2", revenue: 2000 },
    ];

    const header = Object.keys(template[0]).join(",");
    const rows = template.map((obj) => Object.values(obj).join(",")).join("\n");
    const csv = `${header}\n${rows}`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    // Tạo link để download
    const a = document.createElement("a");
    a.href = url;
    a.download = "manga-revenue-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto my-8 w-full max-w-[1141px] gap-4 px-4 lg:px-0">
      <Toaster position="bottom-right" />
      <div className="text-txt-primary justify-center text-center text-2xl leading-loose font-semibold">
        Tải lên doanh thu Manga
      </div>

      {/* Hướng dẫn sử dụng */}
      <div className="bg-bgc-layer1 border-bd-default mt-4 flex flex-col items-start justify-start gap-6 self-stretch rounded-xl border p-6 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
        <div className="w-full">
          <h2 className="text-txt-primary mb-4 text-xl font-semibold">
            Hướng dẫn sử dụng
          </h2>
          <div className="text-txt-secondary space-y-2">
            <p>
              1. Tải mẫu file Excel hoặc chuẩn bị file Excel với các cột: mangaId, revenue
            </p>
            <p>
              2. Điền dữ liệu revenue cho từng manga (mangaId là ID của manga, revenue là
              doanh thu)
            </p>
            <p>3. Chọn kỳ báo cáo (Ngày, Tuần, Tháng)</p>
            <p>4. Upload file Excel</p>
            <p className="font-medium text-red-500">
              Lưu ý: Khi upload, hệ thống sẽ xóa toàn bộ dữ liệu cũ theo kỳ báo cáo đã
              chọn và thêm dữ liệu mới!
            </p>
          </div>

          <button
            type="button"
            onClick={generateExcelTemplate}
            className="bg-bgc-layer2 border-bd-default text-txt-primary hover:bg-bgc-layer2/80 mt-4 flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2"
          >
            <Download className="h-5 w-5" />
            <span>Tải mẫu Excel</span>
          </button>
        </div>
      </div>

      {/* Form Upload */}
      <div className="bg-bgc-layer1 border-bd-default mt-4 flex flex-col items-start justify-start gap-6 self-stretch rounded-xl border p-6 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
        <Form method="post" encType="multipart/form-data" className="w-full">
          <div className="space-y-6">
            {/* Period Select */}
            <div>
              <label
                htmlFor="period"
                className="text-txt-primary mb-2 block text-sm font-medium"
              >
                Kỳ báo cáo
              </label>
              <Dropdown
                options={periodOptions}
                value={period}
                onSelect={handlePeriodChange}
                placeholder="Chọn kỳ báo cáo"
                className="w-full"
              />
              <input type="hidden" name="period" value={period} />
            </div>

            {/* File Input */}
            <div>
              <label
                htmlFor="file"
                className="text-txt-primary mb-2 block text-sm font-medium"
              >
                File Excel (csv)
              </label>
              <div className="border-bd-default flex flex-col items-center justify-center rounded-lg border border-dashed p-6">
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  required
                />
                <div className="text-center">
                  {selectedFile ? (
                    <div className="space-y-2">
                      <p className="text-txt-primary">{selectedFile.name}</p>
                      <p className="text-txt-secondary text-sm">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <p className="text-txt-secondary">Chưa chọn file nào</p>
                  )}
                  <button
                    type="button"
                    onClick={() => document.getElementById("file")?.click()}
                    className="bg-bgc-layer2 border-bd-default text-txt-primary hover:bg-bgc-layer2/80 mx-auto mt-4 flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2"
                  >
                    <Upload className="h-5 w-5" />
                    <span>Chọn file</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {actionData && !actionData.success && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-500">
                {actionData.error}
              </div>
            )}

            {/* Success Message */}
            {actionData && actionData.success && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-500">
                {actionData.message}
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="bg-btn-primary hover:bg-btn-primary/80 w-full cursor-pointer rounded-lg px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? "Đang tải lên..." : "Tải lên doanh thu"}
              </button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
