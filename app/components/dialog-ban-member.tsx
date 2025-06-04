import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";

import type { UserType } from "~/database/models/user.model";

interface BanMemberDialogProps {
  member: UserType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (days: number, message: string) => void;
}

export function BanMemberDialog({
  member,
  open,
  onOpenChange,
  onConfirm,
}: BanMemberDialogProps) {
  const [days, setDays] = useState("");
  const [message, setMessage] = useState("");

  if (!member) return null;

  const handleConfirm = () => {
    const daysNumber = parseInt(days, 10);
    if (daysNumber > 0 && message.trim()) {
      onConfirm(daysNumber, message.trim());
      onOpenChange(false);
      setDays("");
      setMessage("");
    }
  };

  const handleClose = () => {
    setDays("");
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 w-[500px] translate-x-[-50%] translate-y-[-50%] duration-200">
          <div className="bg-bgc-layer1 outline-bd-default inline-flex w-[500px] flex-col items-start justify-start gap-10 rounded-2xl p-6 outline outline-offset-[-1px]">
            <div className="flex flex-col items-center justify-center gap-6 self-stretch">
              <div className="inline-flex h-14 w-14 items-center justify-start gap-3">
                <div className="relative h-14 w-14 overflow-hidden">
                  <AlertTriangle className="h-14 w-14 text-[#FFC107]" strokeWidth={2} />
                </div>
              </div>
              <div className="flex flex-col items-start justify-start gap-3 self-stretch">
                <div className="text-txt-primary justify-start self-stretch text-center text-2xl leading-loose font-semibold">
                  Vô hiệu hóa tài khoản
                </div>
                <div className="justify-start self-stretch text-center">
                  <span className="text-txt-secondary text-base leading-normal font-medium">
                    Vô hiệu hóa{" "}
                    <span className="text-txt-primary font-semibold">{member.name}</span>
                  </span>
                </div>
                <div className="flex flex-col items-start justify-start gap-1.5 self-stretch">
                  <div className="inline-flex items-center justify-start gap-1.5">
                    <div className="text-txt-primary justify-center text-base leading-normal font-semibold">
                      Số ngày vô hiệu hóa<span className="text-red-500">*</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start justify-start self-stretch">
                    <div className="bg-bgc-layer2 outline-bd-default inline-flex items-center justify-start gap-2.5 self-stretch rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                      <input
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                        placeholder="VD: 7 ngày"
                        className="text-txt-primary placeholder-txt-secondary flex-1 bg-transparent text-base leading-normal font-medium focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex h-44 flex-col items-start justify-start gap-1.5 self-stretch">
                  <div className="text-txt-primary justify-center text-base leading-normal font-semibold">
                    Nội dung thông báo<span className="text-red-500">*</span>
                  </div>
                  <div className="flex flex-1 flex-col items-start justify-start self-stretch">
                    <div className="bg-bgc-layer2 outline-bd-default inline-flex flex-1 items-start justify-start gap-2.5 self-stretch rounded-xl px-3 py-2.5 outline outline-offset-[-1px]">
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="VD: Bạn đã nhận được 500 dấm ngọc vì đạt top 10 doanh thu tuần."
                        className="text-txt-primary placeholder-txt-secondary h-full flex-1 resize-none bg-transparent text-base leading-normal font-medium focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="inline-flex items-start justify-start gap-3 self-stretch">
              <Dialog.Close asChild>
                <button
                  type="button"
                  onClick={handleClose}
                  className="outline-lav-500 hover:bg-lav-500/5 flex flex-1 items-center justify-center gap-2.5 rounded-xl px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)] outline outline-offset-[-1px] transition-colors"
                >
                  <div className="text-lav-500 justify-center text-center text-sm leading-tight font-semibold">
                    Đóng
                  </div>
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!days || !message.trim() || parseInt(days, 10) <= 0}
                className="flex flex-1 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-400 px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-fuchsia-400 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="justify-center text-center text-sm leading-tight font-semibold text-black">
                  Gửi
                </div>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
