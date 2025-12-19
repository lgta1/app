import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

const LOCAL_STORAGE_KEY = "adult_content_confirmed";

const AGE_COOKIE_NAME = "age_verified";

function hasAgeVerifiedCookie(): boolean {
  try {
    return /(?:^|;\s*)age_verified=1(?:;|$)/.test(document.cookie);
  } catch {
    return false;
  }
}

function setAgeVerifiedCookie(days = 365) {
  try {
    const maxAge = Math.max(1, Math.floor(days)) * 24 * 60 * 60;
    document.cookie = `${AGE_COOKIE_NAME}=1; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
}

interface DialogWarningAdultContentProps {
  enabled?: boolean;
  disabled?: boolean;
  /** If true, render as OPEN on the first paint (SSR-friendly). */
  defaultOpen?: boolean;
  onConfirmed?: () => void;
}

export default function DialogWarningAdultContent({
  enabled = true,
  disabled = false,
  defaultOpen = false,
  onConfirmed,
}: DialogWarningAdultContentProps) {
  // Disabled = do not render and do not run hooks.
  if (!enabled || disabled) return null;

  // SSR-friendly: allow server to render the overlay OPEN.
  const [isOpen, setIsOpen] = useState<boolean>(() => Boolean(defaultOpen));

  useEffect(() => {
    try {
      const confirmedByCookie = hasAgeVerifiedCookie();
      const confirmedByStorage = localStorage.getItem(LOCAL_STORAGE_KEY) === "true";
      const confirmed = confirmedByCookie || confirmedByStorage;
      setIsOpen(!confirmed);
    } catch {
      // If storage access fails, keep whatever SSR decided.
    }
  }, []);

  const handleExit = () => {
    window.close();
  };

  const handleContinue = () => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, "true");
    } catch {}
    setAgeVerifiedCookie(365);
    setIsOpen(false);
    onConfirmed?.();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Dialog.Content className="bg-bgc-layer1 border-bd-default flex w-[461px] max-w-full flex-col items-center justify-center gap-4 rounded-2xl border p-4 focus:outline-none">
            <div className="flex flex-col items-center justify-start gap-4 self-stretch">
              <Dialog.Title className="text-txt-primary self-stretch text-center font-sans text-[30px] leading-[36px] font-semibold">
                Cảnh báo nội dung 18+
              </Dialog.Title>
              <div className="h-px w-[370px] bg-gradient-to-r from-transparent via-white to-transparent" />
            </div>

            <Dialog.Description className="flex flex-col items-start justify-start gap-1 self-stretch">
              <div className="text-txt-secondary self-stretch text-center font-sans text-base leading-normal font-medium">
                Trang web này có thể chứa nội dung không phù hợp với người dưới 18 tuổi.
              </div>
              <div className="text-txt-secondary self-stretch text-center font-sans text-base leading-normal font-medium">
                Bằng việc tiếp tục truy cập, bạn xác nhận rằng bạn đã đủ 18 tuổi trở lên
                và chấp nhận xem nội dung này.
              </div>
            </Dialog.Description>

            <div className="flex items-center justify-start gap-4 self-stretch">
              <button
                onClick={handleExit}
                className="border-lav-500 hover:bg-bgc-layer-semi-purple flex h-11 flex-1 items-center justify-center gap-2.5 rounded-xl border-2 px-4 py-3 shadow-[0px_4px_8.9px_0px_rgba(146,53,190,0.25)] transition-colors"
              >
                <span className="text-txt-focus text-center font-sans text-sm leading-tight font-semibold">
                  Thoát
                </span>
              </button>
              <button
                onClick={handleContinue}
                className="flex h-11 flex-1 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.9px_0px_rgba(196,69,255,0.25)] transition-opacity hover:opacity-90"
              >
                <span className="text-center font-sans text-sm leading-tight font-semibold text-black">
                  Tiếp tục
                </span>
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
