import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string) => void;
  trigger?: React.ReactNode;
}

export default function ReportDialog({
  isOpen,
  onClose,
  onSubmit,
  trigger,
}: ReportDialogProps) {
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim());
      setContent("");
      onClose();
    }
  };

  const handleClose = () => {
    setContent("");
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}

      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/50" />

        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
          <div className="bg-bgc-layer1 border-bd-default flex max-h-[90vh] w-[320px] flex-col gap-6 overflow-hidden rounded-2xl border p-4 sm:w-[400px] sm:gap-10 sm:p-6 md:w-[500px]">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="flex flex-col gap-2 sm:gap-3">
                <Dialog.Title className="text-txt-primary text-center font-sans text-xl leading-loose font-semibold sm:text-2xl">
                  Nội dung báo cáo
                </Dialog.Title>

                <div className="flex h-32 flex-col gap-1.5 sm:h-44">
                  <label className="text-txt-primary font-sans text-sm leading-normal font-semibold sm:text-base">
                    Nội dung
                  </label>

                  <div className="flex flex-1 flex-col">
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Nhập nội dung báo cáo tại đây..."
                      className="bg-bgc-layer2 border-bd-default text-txt-primary placeholder:text-txt-secondary focus:border-lav-500 focus:ring-lav-500 flex-1 resize-none rounded-xl border px-3 py-2.5 font-sans text-sm leading-normal font-medium transition-colors outline-none focus:ring-1 sm:text-base"
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleClose}
                className="border-lav-500 hover:bg-lav-500/10 flex flex-1 items-center justify-center gap-2.5 rounded-xl border px-4 py-3 shadow-[0px_4px_8.9px_0px_rgba(146,53,190,0.25)] transition-colors"
              >
                <span className="text-txt-focus text-center font-sans text-sm leading-tight font-semibold">
                  Đóng
                </span>
              </button>

              <button
                onClick={handleSubmit}
                disabled={!content.trim()}
                className="flex flex-1 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-all hover:from-[#E1A3FF] hover:to-[#DC85FF] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="text-center font-sans text-sm leading-tight font-semibold text-black">
                  Gửi
                </span>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
