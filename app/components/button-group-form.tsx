interface ButtonGroupProps {
  onCancel?: () => void;
  onSubmit?: () => void;
  cancelText?: string;
  submitText?: string;
  isSubmitting?: boolean;
  disabled?: boolean;
  submitType?: "button" | "submit";
  className?: string;
}

export function ButtonGroupForm({
  onCancel,
  onSubmit,
  cancelText = "Hủy",
  submitText = "Lưu",
  isSubmitting = false,
  disabled = false,
  submitType = "submit",
  className = "",
}: ButtonGroupProps) {
  return (
    <div className={`flex items-center justify-end gap-3 ${className}`}>
      {/* Cancel Button */}
      <button
        type="button"
        onClick={onCancel}
        className="outline-lav-500 hover:bg-lav-500/5 flex min-w-32 items-center justify-center gap-2.5 rounded-xl px-6 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)] outline outline-offset-[-1px] transition-colors"
      >
        <span className="text-lav-500 text-center text-sm leading-tight font-semibold">
          {cancelText}
        </span>
      </button>

      {/* Submit Button */}
      <button
        type={submitType}
        onClick={onSubmit}
        disabled={disabled || isSubmitting}
        className="flex min-w-32 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-400 px-6 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-fuchsia-400 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="text-center text-sm leading-tight font-semibold text-black">
          {isSubmitting ? "Đang xử lý..." : submitText}
        </span>
      </button>
    </div>
  );
}
