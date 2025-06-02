import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { NavLink, useFetcher, useLoaderData } from "react-router";
import { Edit, Save, X } from "lucide-react";

import { PityModel } from "~/database/models/pity.model";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const pitySettings = await PityModel.find({}).sort({ level: 1 });
    return Response.json({ success: true, data: pitySettings });
  } catch (error) {
    console.error("Error fetching pity settings:", error);
    return Response.json(
      { success: false, error: "Không thể lấy dữ liệu pity settings" },
      { status: 500 },
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const pitySetting = {
      id: formData.get("id") as string,
      level: Number(formData.get("level")),
      label: formData.get("label") as string,
      star1: Number(formData.get("star1")),
      star2: Number(formData.get("star2")),
      star3: Number(formData.get("star3")),
      star4: Number(formData.get("star4")),
      star5: Number(formData.get("star5")),
      total: Number(formData.get("total")) || 100,
    };

    // Validate total should equal sum of all stars
    const calculatedTotal =
      pitySetting.star1 +
      pitySetting.star2 +
      pitySetting.star3 +
      pitySetting.star4 +
      pitySetting.star5;
    const tolerance = 0.01; // Allow small floating point differences

    if (Math.abs(calculatedTotal - 100) > tolerance) {
      return Response.json(
        {
          success: false,
          error: `Tổng phần trăm phải bằng 100. Hiện tại: ${calculatedTotal.toFixed(3)}%`,
        },
        { status: 400 },
      );
    }

    const updatedPity = await PityModel.findByIdAndUpdate(
      pitySetting.id,
      {
        star1: pitySetting.star1,
        star2: pitySetting.star2,
        star3: pitySetting.star3,
        star4: pitySetting.star4,
        star5: pitySetting.star5,
        total: 100, // Always set to 100
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!updatedPity) {
      return Response.json(
        { success: false, error: "Không tìm thấy pity setting để cập nhật" },
        { status: 404 },
      );
    }

    return Response.json({ success: true, data: updatedPity });
  } catch (error) {
    console.error("Error updating pity setting:", error);
    return Response.json(
      { success: false, error: "Không thể cập nhật pity setting" },
      { status: 500 },
    );
  }
}

type PityData = {
  _id: string;
  level: number;
  label: string;
  star1: number;
  star2: number;
  star3: number;
  star4: number;
  star5: number;
  total: number;
  isActive: boolean;
};

export default function AdminWaifuPity() {
  const loaderData = useLoaderData<{
    success: boolean;
    data: PityData[];
    error?: string;
  }>();
  const fetcher = useFetcher();
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<PityData>>({});

  const tabs = [
    { key: "banner" as const, label: "Quản lý banner" },
    { key: "index" as const, label: "Quản lý waifu" },
    { key: "pity" as const, label: "Cài đặt" },
  ];

  const pityData = loaderData?.success ? loaderData.data : [];

  const handleEdit = (row: PityData) => {
    setEditingRow(row._id);
    setEditData({
      star1: row.star1,
      star2: row.star2,
      star3: row.star3,
      star4: row.star4,
      star5: row.star5,
    });
  };

  const handleSave = (id: string) => {
    const formData = new FormData();
    formData.append("id", id);
    formData.append("star1", editData.star1?.toString() || "0");
    formData.append("star2", editData.star2?.toString() || "0");
    formData.append("star3", editData.star3?.toString() || "0");
    formData.append("star4", editData.star4?.toString() || "0");
    formData.append("star5", editData.star5?.toString() || "0");

    fetcher.submit(formData, { method: "post" });

    setEditingRow(null);
    setEditData({});
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditData({});
  };

  const handleInputChange = (field: keyof PityData, value: string) => {
    setEditData((prev) => ({
      ...prev,
      [field]: parseFloat(value) || 0,
    }));
  };

  const calculateTotal = () => {
    return (
      (editData.star1 || 0) +
      (editData.star2 || 0) +
      (editData.star3 || 0) +
      (editData.star4 || 0) +
      (editData.star5 || 0)
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-[968px] flex-col items-center justify-center gap-6 p-4 md:p-6 lg:p-8">
      {/* Tab Selection and Title */}
      <div className="flex w-full flex-col items-center justify-start gap-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {tabs.map((tab) => (
            <NavLink
              to={`/admin/waifu/${tab.key}`}
              key={tab.key}
              className={({ isActive }) =>
                isActive
                  ? "bg-btn-primary text-txt-primary rounded-[32px]"
                  : "bg-bgc-layer-semi-neutral text-txt-primary rounded-[32px]"
              }
            >
              <button className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 transition-colors">
                <div className="font-sans text-base leading-normal font-medium">
                  {tab.label}
                </div>
              </button>
            </NavLink>
          ))}
        </div>
        <div className="text-txt-primary w-full text-center font-sans text-2xl leading-10 font-semibold uppercase md:text-4xl">
          Cài đặt thông số pity
        </div>

        {/* Pity Table - Updated to match Figma design */}
        <div className="border-bd-default w-full max-w-[839px] overflow-hidden rounded-lg border">
          {/* Header */}
          <div className="bg-bgc-layer2 border-bd-default flex border-b">
            <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
              <div className="text-base leading-normal font-medium">%</div>
            </div>
            <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
              <div className="text-base leading-normal font-medium">1 sao</div>
            </div>
            <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
              <div className="text-base leading-normal font-medium">2 sao</div>
            </div>
            <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
              <div className="text-base leading-normal font-medium">3 sao</div>
            </div>
            <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
              <div className="text-base leading-normal font-medium">4 sao</div>
            </div>
            <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
              <div className="text-base leading-normal font-medium">5 sao</div>
            </div>
            <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
              <div className="text-base leading-normal font-medium">Tổng</div>
            </div>
            <div className="flex flex-1 items-center justify-center gap-2.5 px-3 py-2">
              <div className="text-base leading-normal font-medium">Tác vụ</div>
            </div>
          </div>

          {/* Rows */}
          {pityData.map((row) => (
            <div key={row._id} className="border-bd-default flex border-b">
              <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
                <div className="text-txt-secondary text-base leading-normal font-medium">
                  {row.label}
                </div>
              </div>

              {/* Star 1 */}
              <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
                {editingRow === row._id ? (
                  <input
                    type="number"
                    step="0.001"
                    value={editData.star1 || 0}
                    onChange={(e) => handleInputChange("star1", e.target.value)}
                    className="text-txt-secondary border-bd-default focus:border-txt-focus w-full rounded border bg-transparent px-2 py-1 text-base font-medium focus:outline-none"
                  />
                ) : (
                  <div className="text-txt-secondary text-base leading-normal font-medium">
                    {row.star1}
                  </div>
                )}
              </div>

              {/* Star 2 */}
              <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
                {editingRow === row._id ? (
                  <input
                    type="number"
                    step="0.001"
                    value={editData.star2 || 0}
                    onChange={(e) => handleInputChange("star2", e.target.value)}
                    className="text-txt-secondary border-bd-default focus:border-txt-focus w-full rounded border bg-transparent px-2 py-1 text-base font-medium focus:outline-none"
                  />
                ) : (
                  <div className="text-txt-secondary text-base leading-normal font-medium">
                    {row.star2}
                  </div>
                )}
              </div>

              {/* Star 3 */}
              <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
                {editingRow === row._id ? (
                  <input
                    type="number"
                    step="0.001"
                    value={editData.star3 || 0}
                    onChange={(e) => handleInputChange("star3", e.target.value)}
                    className="text-txt-secondary border-bd-default focus:border-txt-focus w-full rounded border bg-transparent px-2 py-1 text-base font-medium focus:outline-none"
                  />
                ) : (
                  <div className="text-txt-secondary text-base leading-normal font-medium">
                    {row.star3}
                  </div>
                )}
              </div>

              {/* Star 4 */}
              <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
                {editingRow === row._id ? (
                  <input
                    type="number"
                    step="0.001"
                    value={editData.star4 || 0}
                    onChange={(e) => handleInputChange("star4", e.target.value)}
                    className="text-txt-secondary border-bd-default focus:border-txt-focus w-full rounded border bg-transparent px-2 py-1 text-base font-medium focus:outline-none"
                  />
                ) : (
                  <div className="text-txt-secondary text-base leading-normal font-medium">
                    {row.star4}
                  </div>
                )}
              </div>

              {/* Star 5 */}
              <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
                {editingRow === row._id ? (
                  <input
                    type="number"
                    step="0.001"
                    value={editData.star5 || 0}
                    onChange={(e) => handleInputChange("star5", e.target.value)}
                    className="text-txt-secondary border-bd-default focus:border-txt-focus w-full rounded border bg-transparent px-2 py-1 text-base font-medium focus:outline-none"
                  />
                ) : (
                  <div className="text-txt-secondary text-base leading-normal font-medium">
                    {row.star5}
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="border-bd-default flex flex-1 items-center gap-2.5 border-r px-3 py-2">
                <div
                  className={`text-base leading-normal font-medium ${
                    editingRow === row._id
                      ? Math.abs(calculateTotal() - 100) > 0.01
                        ? "text-error-error"
                        : "text-success-success"
                      : "text-txt-secondary"
                  }`}
                >
                  {editingRow === row._id ? calculateTotal().toFixed(3) : row.total}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-1 items-center justify-center gap-2.5 px-3 py-2">
                {editingRow === row._id ? (
                  <>
                    <button
                      onClick={() => handleSave(row._id)}
                      disabled={Math.abs(calculateTotal() - 100) > 0.01}
                      className="text-success-success hover:text-success-success/80 cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={20} />
                    </button>
                    <button
                      onClick={handleCancel}
                      className="text-error-error hover:text-error-error/80 cursor-pointer transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleEdit(row)}
                    className="text-success-success hover:text-success-success/80 h-5 w-5 cursor-pointer transition-colors"
                  >
                    <Edit size={20} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Status Messages */}
        {fetcher.data?.error && (
          <div className="bg-error-error/10 border-error-error w-full max-w-[839px] rounded-lg border p-4">
            <p className="text-error-error text-sm font-medium">{fetcher.data.error}</p>
          </div>
        )}

        {fetcher.data?.success && (
          <div className="bg-success-success/10 border-success-success w-full max-w-[839px] rounded-lg border p-4">
            <p className="text-success-success text-sm font-medium">
              Cập nhật thành công!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
