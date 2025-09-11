import { useState } from "react";
import { Toaster } from "react-hot-toast";
import type { ActionFunctionArgs } from "react-router-dom";
import { useActionData, useFetcher, useNavigation } from "react-router-dom";
import { FileText, Image, Star, Upload, User, X } from "lucide-react";

import { createWaifu } from "@/mutations/waifu.mutation";
import { requireAdminOrModLogin } from "@/services/auth.server";

import { ButtonGroupForm } from "~/components/button-group-form";
import { BusinessError } from "~/helpers/errors.helper";
import { useFileOperations } from "~/hooks/use-file-operations";

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminOrModLogin(request);

  try {
    const formData = await request.formData();

    const waifuData = {
      name: formData.get("name") as string,
      image: formData.get("imageUrl") as string,
      description: (formData.get("description") as string) || undefined,
      stars: parseInt(formData.get("stars") as string),
      expBuff: parseInt(formData.get("expBuff") as string) || 0,
      goldBuff: parseInt(formData.get("goldBuff") as string) || 0,
    };

    const result = await createWaifu(request, waifuData);

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

export default function AdminCreateWaifu() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stars, setStars] = useState(1);
  const [expBuff, setExpBuff] = useState(0);
  const [goldBuff, setGoldBuff] = useState(0);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const fetcher = useFetcher<typeof action>();
  const isSubmitting =
    navigation.state === "submitting" || fetcher.state === "submitting";
  const { uploadFileWithFetcher } = useFileOperations();

  const handleStarClick = (starValue: number) => {
    setStars(starValue);
  };

  const handleImageSelect = (file: File) => {
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setSelectedImageFile(null);
    setImagePreview("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedImageFile) {
      return;
    }

    setIsUploading(true);

    // Upload ảnh trước
    uploadFileWithFetcher(selectedImageFile, {
      prefixPath: "waifu-images",
      onSuccess: (data) => {
        // Sau khi upload thành công, submit form với URL
        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);
        formData.append("stars", stars.toString());
        formData.append("expBuff", expBuff.toString());
        formData.append("goldBuff", goldBuff.toString());
        formData.append("imageUrl", data.url);

        setIsUploading(false);
        fetcher.submit(formData, { method: "post" });
      },
      onError: (error) => {
        console.error("Upload error:", error);
        setIsUploading(false);
      },
    });
  };

  // Sử dụng data từ fetcher nếu có, nếu không thì dùng actionData
  const responseData = fetcher.data || actionData;

  return (
    <div className="mx-auto flex w-full max-w-[1020px] flex-col items-center justify-center gap-6 p-4 md:p-6 lg:p-8">
      <Toaster position="bottom-right" />

      <div className="text-txt-primary w-full text-center text-2xl leading-10 font-semibold uppercase md:text-4xl">
        Thêm waifu mới
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

            {/* Tên */}
            <div className="relative inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <User className="text-txt-secondary absolute top-[1.33px] left-[0.67px] h-3 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Tên
                </div>
              </div>
              <div className="inline-flex w-full max-w-[680px] flex-col items-start justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default inline-flex w-full items-center justify-start gap-2.5 rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <input
                    type="text"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Viết hoa ký tự đầu tiên mỗi từ"
                    className="text-txt-primary placeholder-txt-secondary w-full bg-transparent text-base leading-normal font-medium focus:outline-none"
                    maxLength={100}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Số sao */}
            <div className="relative inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <Star className="text-txt-secondary absolute top-[0.67px] left-[2px] h-3.5 w-3" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Số sao
                </div>
              </div>
              <div className="inline-flex w-full max-w-[680px] flex-col items-start justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default inline-flex h-11 w-full items-center justify-start gap-2.5 rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <div className="flex items-center justify-start">
                    {[1, 2, 3, 4, 5].map((starValue) => (
                      <button
                        key={starValue}
                        type="button"
                        onClick={() => handleStarClick(starValue)}
                        className="h-5 w-5 focus:outline-none"
                      >
                        <Star
                          className={`h-5 w-5 ${
                            starValue <= stars
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-txt-secondary"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mô tả */}
            <div className="relative inline-flex w-full items-start justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <FileText className="text-txt-secondary absolute top-[0.67px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Mô tả
                </div>
              </div>
              <div className="inline-flex h-52 w-full max-w-[680px] flex-col items-start justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default inline-flex w-full flex-1 items-start justify-start gap-2.5 rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <textarea
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Viết mô tả tại đây..."
                    className="text-txt-primary placeholder-txt-secondary h-full w-full resize-none bg-transparent text-base leading-normal font-medium focus:outline-none"
                    maxLength={250}
                  />
                </div>
              </div>
            </div>

            {/* Ảnh Card */}
            <div className="inline-flex w-full items-start justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <Image className="text-txt-secondary absolute top-[1.33px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Ảnh Card
                </div>
              </div>
              <div className="flex w-full max-w-[680px] items-center justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default relative h-44 w-30 overflow-hidden rounded-lg outline outline-offset-[-1px]">
                  {imagePreview ? (
                    <>
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 hover:bg-red-600 focus:outline-none"
                      >
                        <X className="h-4 w-4" strokeWidth={4} color="white" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-400 px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)]">
                        <Upload className="h-5 w-5 text-black" />
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageSelect(file);
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

            {/* EXP Buff */}
            <div className="inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <Star className="text-txt-secondary absolute top-[1.33px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Buff EXP (%)
                </div>
              </div>
              <div className="flex w-full max-w-[680px] items-center justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default w-full rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <input
                    type="number"
                    name="expBuff"
                    value={expBuff}
                    onChange={(e) => setExpBuff(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                    max="100"
                    className="text-txt-primary placeholder-txt-secondary w-full bg-transparent text-base leading-normal font-medium focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Gold Buff */}
            <div className="inline-flex w-full items-center justify-between">
              <div className="flex items-center justify-start gap-1.5">
                <div className="relative h-4 w-4 overflow-hidden">
                  <Star className="text-txt-secondary absolute top-[1.33px] left-[0.67px] h-3.5 w-3.5" />
                </div>
                <div className="text-txt-primary text-base leading-normal font-semibold">
                  Buff Gold (%)
                </div>
              </div>
              <div className="flex w-full max-w-[680px] items-center justify-start md:w-[680px]">
                <div className="bg-bgc-layer2 outline-bd-default w-full rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                  <input
                    type="number"
                    name="goldBuff"
                    value={goldBuff}
                    onChange={(e) => setGoldBuff(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                    max="100"
                    className="text-txt-primary placeholder-txt-secondary w-full bg-transparent text-base leading-normal font-medium focus:outline-none"
                  />
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
          disabled={!selectedImageFile}
          onCancel={() => window.history.back()}
          className="pt-4"
        />
      </form>
    </div>
  );
}
