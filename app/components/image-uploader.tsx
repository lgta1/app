import { Upload, X } from "lucide-react";

interface ImageUploaderProps {
  /**
   * Callback khi người dùng chọn file
   */
  onFileSelect: (file: File) => void;

  /**
   * Callback khi người dùng xóa ảnh
   */
  onClear: () => void;

  /**
   * URL preview của ảnh (có thể là file local hoặc URL từ server)
   */
  preview?: string;

  /**
   * Text hiển thị trên nút upload
   */
  uploadText?: string;

  /**
   * Có bắt buộc chọn file không
   */
  required?: boolean;

  /**
   * Accept types cho input file
   */
  accept?: string;

  /**
   * Name attribute cho input file
   */
  name?: string;

  /**
   * Class name tùy chỉnh cho container
   */
  className?: string;

  /**
   * Tỷ lệ khung hình (aspect ratio)
   */
  aspectRatio?: "square" | "poster" | "auto";
}

export function ImageUploader({
  onFileSelect,
  onClear,
  preview,
  uploadText = "Tải ảnh lên",
  required = false,
  accept = "image/*",
  name,
  className = "",
  aspectRatio = "auto",
}: ImageUploaderProps) {
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case "square":
        return "aspect-square";
      case "poster":
        return "aspect-[3/4]";
      default:
        return "h-full";
    }
  };

  return (
    <div
      className={`border-bd-default bg-bgc-layer2 relative flex w-full items-center justify-center rounded-xl border ${getAspectRatioClass()} ${className}`}
    >
      {preview ? (
        <>
          <img
            src={preview}
            alt="Preview"
            className="h-full w-full rounded-xl object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute -top-2 -right-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-gray-600 bg-gray-800 transition-colors hover:bg-gray-700"
          >
            <X className="text-txt-primary h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <label
            htmlFor="image-upload"
            className="flex w-36 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] py-3 shadow-lg transition-opacity hover:opacity-90"
          >
            <Upload className="ml-1 h-5 w-5 text-black" />
            <span className="mr-1 line-clamp-1 font-sans text-sm font-semibold text-black">
              {uploadText}
            </span>
          </label>

          <input
            id="image-upload"
            type="file"
            name={name}
            accept={accept}
            onChange={handleFileUpload}
            className="hidden"
            required={required}
          />
        </>
      )}
    </div>
  );
}
