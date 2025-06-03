import { useState } from "react";
import { Toaster } from "react-hot-toast";
import type { ActionFunctionArgs } from "react-router";
import { useActionData, useFetcher, useLoaderData, useNavigation } from "react-router";
import {
  Calendar,
  ChevronDown,
  FileText,
  Image,
  Tag,
  Upload,
  User,
  X,
} from "lucide-react";

import { createBanner } from "@/mutations/banner.mutation";
import { getAllWaifus } from "@/queries/waifu.query";
import { requireAdminOrModLogin } from "@/services/auth.server";

import { ButtonGroupForm } from "~/components/button-group-form";
import { BusinessError } from "~/helpers/errors";
import { useFileOperations } from "~/hooks/use-file-operations";

export async function loader() {
  try {
    const waifus = await getAllWaifus();
    return { waifus };
  } catch (error) {
    console.error("Error loading waifus:", error);
    return { waifus: [] };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminOrModLogin(request);

  try {
    const formData = await request.formData();

    const waifuIds = [
      formData.get("waifu5Star1"),
      formData.get("waifu5Star2"),
      formData.get("waifu4Star1"),
      formData.get("waifu4Star2"),
      formData.get("waifu4Star3"),
    ].filter(Boolean) as string[];

    const bannerData = {
      title: formData.get("title") as string,
      startDate: new Date(formData.get("startDate") as string),
      endDate: new Date(formData.get("endDate") as string),
      imageUrl: formData.get("bannerImageUrl") as string,
      mobileImageUrl: formData.get("bannerMobileImageUrl") as string,
      waifuIds,
      isRateUp: formData.get("isRateUp") === "true",
    };

    const result = await createBanner(request, bannerData);

    return {
      success: true,
      message: result.message,
    };
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

export default function AdminCreateBanner() {
  const { waifus } = useLoaderData<typeof loader>();
  const [title, setTitle] = useState("");
  const [isRateUp, setIsRateUp] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedBannerFile, setSelectedBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [selectedMobileBannerFile, setSelectedMobileBannerFile] = useState<File | null>(
    null,
  );
  const [mobileBannerPreview, setMobileBannerPreview] = useState("");
  const [waifu5Star1, setWaifu5Star1] = useState("");
  const [waifu5Star2, setWaifu5Star2] = useState("");
  const [waifu4Star1, setWaifu4Star1] = useState("");
  const [waifu4Star2, setWaifu4Star2] = useState("");
  const [waifu4Star3, setWaifu4Star3] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const fetcher = useFetcher<typeof action>();
  const isSubmitting =
    navigation.state === "submitting" || fetcher.state === "submitting";
  const { uploadMultipleFiles } = useFileOperations();

  // Lọc waifu theo số sao
  const fiveStarWaifus = waifus.filter((waifu) => waifu.stars === 5);
  const fourStarWaifus = waifus.filter((waifu) => waifu.stars === 4);

  const handleBannerImageSelect = (file: File) => {
    setSelectedBannerFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setBannerPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleMobileBannerImageSelect = (file: File) => {
    setSelectedMobileBannerFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setMobileBannerPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearBannerImage = () => {
    setSelectedBannerFile(null);
    setBannerPreview("");
  };

  const clearMobileBannerImage = () => {
    setSelectedMobileBannerFile(null);
    setMobileBannerPreview("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedBannerFile || !selectedMobileBannerFile) {
      return;
    }

    setIsUploading(true);

    try {
      const [bannerData, mobileBannerData] = await uploadMultipleFiles([
        {
          file: selectedBannerFile,
          options: { bucket: "banner-images", category: "banner" },
        },
        {
          file: selectedMobileBannerFile,
          options: { bucket: "banner-images", category: "mobile-banner" },
        },
      ]);

      const formData = new FormData();
      formData.append("title", title);
      formData.append("isRateUp", isRateUp.toString());
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);
      formData.append("bannerImageUrl", (bannerData as any).url);
      formData.append("bannerMobileImageUrl", (mobileBannerData as any).url);
      formData.append("waifu5Star1", waifu5Star1);
      formData.append("waifu5Star2", waifu5Star2);
      formData.append("waifu4Star1", waifu4Star1);
      formData.append("waifu4Star2", waifu4Star2);
      formData.append("waifu4Star3", waifu4Star3);

      setIsUploading(false);
      fetcher.submit(formData, { method: "post" });
    } catch (error) {
      console.error("Upload error:", error);
      setIsUploading(false);
    }
  };

  // Sử dụng data từ fetcher nếu có, nếu không thì dùng actionData
  const responseData = fetcher.data || actionData;

  return (
    <div className="mx-auto flex w-full max-w-[1020px] flex-col items-center justify-center gap-6 p-4 md:p-6 lg:p-8">
      <Toaster />

      <div className="text-txt-primary w-full text-center text-2xl leading-10 font-semibold uppercase md:text-4xl">
        Thêm banner mới
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="bg-bgc-layer1 outline-bd-default mx-auto w-full max-w-[951px] rounded-xl p-6 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] outline outline-offset-[-1px]">
          <div className="inline-flex w-full flex-col items-start justify-start gap-6">
            {/* Error/Success Message */}
            {responseData?.error && (
              <div className="w-full rounded bg-red-500/10 p-3 text-sm font-medium text-red-500">
                {responseData.error.message}
              </div>
            )}

            {responseData?.success && (
              <div className="w-full rounded bg-green-500/10 p-3 text-sm font-medium text-green-500">
                {responseData.message}
              </div>
            )}

            {/* Tiêu đề */}
            <div className="relative inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <FileText className="text-txt-secondary absolute top-[0.67px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Tiêu đề*
                </div>
              </div>
              <div className="inline-flex w-full max-w-[680px] flex-col items-start justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default inline-flex w-full items-center justify-start gap-2.5 rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <input
                    type="text"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nhập tiêu đề banner"
                    className="text-txt-primary placeholder-txt-secondary w-full bg-transparent text-base leading-normal font-medium focus:outline-none"
                    maxLength={100}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Loại banner */}
            <div className="relative inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <Tag className="text-txt-secondary absolute top-[0.67px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Loại banner*
                </div>
              </div>
              <div className="inline-flex w-full max-w-[680px] flex-col items-start justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default inline-flex w-full items-center justify-start gap-2.5 rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <label className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="bannerType"
                      checked={!isRateUp}
                      onChange={() => setIsRateUp(false)}
                      className="accent-lav-500 text-lav-500 focus:ring-lav-500 checked:bg-lav-500 checked:border-lav-500 h-4 w-4"
                    />
                    <span className="text-txt-primary text-base leading-normal font-medium">
                      Banner thường
                    </span>
                  </label>
                  <label className="ml-6 flex items-center gap-3">
                    <input
                      type="radio"
                      name="bannerType"
                      checked={isRateUp}
                      onChange={() => setIsRateUp(true)}
                      className="accent-lav-500 text-lav-500 focus:ring-lav-500 checked:bg-lav-500 checked:border-lav-500 h-4 w-4"
                    />
                    <span className="text-txt-primary text-base leading-normal font-medium">
                      Banner rate up
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Thời gian */}
            <div className="relative inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <Calendar className="text-txt-secondary absolute top-[0.67px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Thời gian*
                </div>
              </div>
              <div className="inline-flex w-full max-w-[680px] flex-col items-start justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default inline-flex w-full items-center justify-start gap-2.5 rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <input
                    type="date"
                    name="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-txt-secondary w-full bg-transparent text-base leading-normal font-medium focus:outline-none"
                    required
                  />
                  <span className="text-txt-secondary">-</span>
                  <input
                    type="date"
                    name="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-txt-secondary w-full bg-transparent text-base leading-normal font-medium focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Ảnh banner */}
            <div className="inline-flex w-full items-start justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <Image className="text-txt-secondary absolute top-[1.33px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Ảnh banner*
                </div>
              </div>
              <div className="flex w-full max-w-[680px] items-center justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default relative h-24 w-44 overflow-hidden rounded-lg outline outline-offset-[-1px]">
                  {bannerPreview ? (
                    <>
                      <img
                        src={bannerPreview}
                        alt="Banner Preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearBannerImage}
                        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 focus:outline-none"
                      >
                        <X className="h-4 w-4" strokeWidth={4} color="white" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="absolute top-1/2 left-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-400 px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)]">
                        <Upload className="h-5 w-5 text-black" />
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleBannerImageSelect(file);
                          }
                        }}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        required
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Ảnh banner (mobile) */}
            <div className="inline-flex w-full items-start justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <Image className="text-txt-secondary absolute top-[1.33px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Ảnh banner (mobile)*
                </div>
              </div>
              <div className="flex w-full max-w-[680px] items-center justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default relative h-24 w-44 overflow-hidden rounded-lg outline outline-offset-[-1px]">
                  {mobileBannerPreview ? (
                    <>
                      <img
                        src={mobileBannerPreview}
                        alt="Mobile Banner Preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearMobileBannerImage}
                        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 focus:outline-none"
                      >
                        <X className="h-4 w-4" strokeWidth={4} color="white" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="absolute top-1/2 left-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-400 px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)]">
                        <Upload className="h-5 w-5 text-black" />
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleMobileBannerImageSelect(file);
                          }
                        }}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        required
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Tên Waifu 5 sao (1) */}
            <div className="relative inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <User className="text-txt-secondary absolute top-[0.67px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Tên Waifu 5 sao (1)*
                </div>
              </div>
              <div className="relative inline-flex w-full max-w-[680px] flex-col items-start justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default inline-flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <select
                    name="waifu5Star1"
                    value={waifu5Star1}
                    onChange={(e) => setWaifu5Star1(e.target.value)}
                    className="text-txt-secondary w-full appearance-none bg-transparent text-base leading-normal font-medium focus:outline-none"
                    required
                  >
                    <option value="">Chọn waifu...</option>
                    {fiveStarWaifus.map((waifu) => (
                      <option key={waifu.id} value={waifu.id} className="bg-bgc-layer2">
                        {waifu.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="text-txt-secondary pointer-events-none h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Tên Waifu 5 sao (2) */}
            <div className="relative inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <User className="text-txt-secondary absolute top-[0.67px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Tên Waifu 5 sao (2)*
                </div>
              </div>
              <div className="relative inline-flex w-full max-w-[680px] flex-col items-start justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default inline-flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <select
                    name="waifu5Star2"
                    value={waifu5Star2}
                    onChange={(e) => setWaifu5Star2(e.target.value)}
                    className="text-txt-secondary w-full appearance-none bg-transparent text-base leading-normal font-medium focus:outline-none"
                    required
                  >
                    <option value="">Chọn waifu...</option>
                    {fiveStarWaifus.map((waifu) => (
                      <option key={waifu.id} value={waifu.id} className="bg-bgc-layer2">
                        {waifu.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="text-txt-secondary pointer-events-none h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Tên Waifu 4 sao (1) */}
            <div className="relative inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <User className="text-txt-secondary absolute top-[0.67px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Tên Waifu 4 sao (1)*
                </div>
              </div>
              <div className="relative inline-flex w-full max-w-[680px] flex-col items-start justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default inline-flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <select
                    name="waifu4Star1"
                    value={waifu4Star1}
                    onChange={(e) => setWaifu4Star1(e.target.value)}
                    className="text-txt-secondary w-full appearance-none bg-transparent text-base leading-normal font-medium focus:outline-none"
                    required
                  >
                    <option value="">Chọn waifu...</option>
                    {fourStarWaifus.map((waifu) => (
                      <option key={waifu.id} value={waifu.id} className="bg-bgc-layer2">
                        {waifu.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="text-txt-secondary pointer-events-none h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Tên Waifu 4 sao (2) */}
            <div className="relative inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <User className="text-txt-secondary absolute top-[0.67px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Tên Waifu 4 sao (2)*
                </div>
              </div>
              <div className="relative inline-flex w-full max-w-[680px] flex-col items-start justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default inline-flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <select
                    name="waifu4Star2"
                    value={waifu4Star2}
                    onChange={(e) => setWaifu4Star2(e.target.value)}
                    className="text-txt-secondary w-full appearance-none bg-transparent text-base leading-normal font-medium focus:outline-none"
                    required
                  >
                    <option value="">Chọn waifu...</option>
                    {fourStarWaifus.map((waifu) => (
                      <option key={waifu.id} value={waifu.id} className="bg-bgc-layer2">
                        {waifu.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="text-txt-secondary pointer-events-none h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Tên Waifu 4 sao (3) */}
            <div className="relative inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <User className="text-txt-secondary absolute top-[0.67px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Tên Waifu 4 sao (3)*
                </div>
              </div>
              <div className="relative inline-flex w-full max-w-[680px] flex-col items-start justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default inline-flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <select
                    name="waifu4Star3"
                    value={waifu4Star3}
                    onChange={(e) => setWaifu4Star3(e.target.value)}
                    className="text-txt-secondary w-full appearance-none bg-transparent text-base leading-normal font-medium focus:outline-none"
                    required
                  >
                    <option value="">Chọn waifu...</option>
                    {fourStarWaifus.map((waifu) => (
                      <option key={waifu.id} value={waifu.id} className="bg-bgc-layer2">
                        {waifu.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="text-txt-secondary pointer-events-none h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <ButtonGroupForm
          submitText={
            isUploading ? "Đang tải ảnh lên..." : isSubmitting ? "Đang tạo..." : "Lưu"
          }
          cancelText="Hủy"
          isSubmitting={isSubmitting || isUploading}
          disabled={!selectedBannerFile || !selectedMobileBannerFile || !title.trim()}
          onCancel={() => window.history.back()}
          className="pt-4"
        />
      </form>
    </div>
  );
}
