import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import type { UserType } from "~/database/models/user.model";

interface DeleteMemberDialogProps {
  member: UserType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteMemberDialog({
  member,
  open,
  onOpenChange,
  onConfirm,
}: DeleteMemberDialogProps) {
  if (!member) return null;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 w-[500px] translate-x-[-50%] translate-y-[-50%] duration-200">
          <div className="bg-bgc-layer1 outline-bd-default inline-flex w-[500px] flex-col items-start justify-start gap-10 rounded-2xl p-6 outline outline-offset-[-1px]">
            <div className="flex flex-col items-center justify-center gap-6 self-stretch">
              <div className="relative h-14 w-14 overflow-hidden">
                <div className="absolute top-0 left-0 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF555D]">
                  <X className="text-bgc-layer1 h-7 w-7" strokeWidth={4} />
                </div>
              </div>
              <div className="flex flex-col items-start justify-start gap-3 self-stretch">
                <div className="text-txt-primary justify-start self-stretch text-center text-2xl leading-loose font-semibold">
                  Xóa thành viên?
                </div>
                <div className="justify-start self-stretch text-center">
                  <span className="text-txt-secondary text-base leading-normal font-medium">
                    Hành động này sẽ{" "}
                  </span>
                  <span className="text-txt-primary text-base leading-normal font-medium">
                    không thể hoàn tác
                  </span>
                  <span className="text-txt-secondary text-base leading-normal font-medium">
                    . Bạn có muốn tiếp tục?
                  </span>
                </div>
              </div>
            </div>
            <div className="inline-flex items-start justify-start gap-3 self-stretch">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="outline-lav-500 hover:bg-lav-500/5 flex flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-xl px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)] outline outline-offset-[-1px] transition-colors"
                >
                  <div className="text-txt-focus justify-center text-center text-sm leading-tight font-semibold">
                    Đóng
                  </div>
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-400 px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-fuchsia-400 hover:to-fuchsia-500"
              >
                <div className="justify-center text-center text-sm leading-tight font-semibold text-black">
                  Xóa thành viên
                </div>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
