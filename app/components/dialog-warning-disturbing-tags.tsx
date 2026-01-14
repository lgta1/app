import * as Dialog from "@radix-ui/react-dialog";

interface DisturbingTagsWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: string[];
}

export function DisturbingTagsWarningDialog({
  open,
  onOpenChange,
  tags,
}: DisturbingTagsWarningDialogProps) {
  if (!tags?.length) return null;

  const tagList = tags.join(", ");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="bg-bgc-layer1 border-bd-default fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 focus:outline-none">
          <Dialog.Title className="text-txt-primary text-center font-sans text-2xl font-semibold">
            Cảnh báo nội dung
          </Dialog.Title>

          <Dialog.Description className="text-txt-secondary mt-3 text-center font-sans text-base font-medium leading-relaxed">
            <span>Truyện có gắn các tag </span>
            <span className="text-txt-primary font-semibold">{tagList}</span>
            <span>
              {" "}
              thuộc nhóm các tag nội dung có thể gây{" "}
            </span>
            <span className="text-[17px] font-bold uppercase text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.85)]">
              ÁM ẢNH, KINH TỞM, BUỒN NÔN.
            </span>
            <span> </span>
            <span className="text-[17px] font-bold uppercase text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.85)]">
              CÂN NHẮC TRƯỚC KHI XEM !
            </span>
          </Dialog.Description>

          <div className="mt-5 flex justify-center">
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-6 font-sans text-sm font-semibold text-black shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-opacity hover:opacity-90"
              >
                Đã hiểu
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
