import { useEffect, useState } from "react";
import { isMobile } from "react-device-detect";
import * as Dialog from "@radix-ui/react-dialog";
import { RotateCw } from "lucide-react";

/** Bật/tắt cảnh báo xoay ngang — để tắt hoàn toàn đặt = false */
const ENABLE_ROTATION_WARNING = false;

export function DeviceRotationWarningDialog() {
  // TẮT HOÀN TOÀN: không render, không chạy hook, không add listener => nhẹ, an toàn
  if (!ENABLE_ROTATION_WARNING) return null;

  const [isOpen, setIsOpen] = useState(false);

  const [hasShownWarning, setHasShownWarning] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hasShownRotationWarning") === "true";
    }
    return false;
  });

  useEffect(() => {
    const checkOrientation = () => {
      if (isMobile && !hasShownWarning) {
        if (window.innerHeight > window.innerWidth) {
          setIsOpen(true);
        } else {
          setIsOpen(false);
        }
      } else {
        setIsOpen(false);
      }
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, [hasShownWarning]);

  const handleRotated = () => {
    setIsOpen(false);
    localStorage.setItem("hasShownRotationWarning", "true");
    setHasShownWarning(true);
  };

  const handleContinuePortrait = () => {
    setIsOpen(false);
    localStorage.setItem("hasShownRotationWarning", "true");
    setHasShownWarning(true);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 max-h-[90vh] w-[90vw] max-w-[400px] translate-x-[-50%] translate-y-[-50%] overflow-y-auto duration-200">
          <div className="bg-bgc-layer1 outline-bd-default inline-flex w-full flex-col items-center justify-center gap-6 rounded-2xl p-6 outline outline-offset-[-1px]">
            <div className="flex items-center justify-center">
              <RotateCw
                className="text-txt-focus h-16 w-16 animate-spin"
                style={{ animationDuration: "2s" }}
              />
            </div>
            <div className="flex w-full flex-col items-center justify-center gap-4">
              <div className="text-txt-primary w-full text-center text-xl leading-9 font-semibold">
                Xoay ngang thiết bị
              </div>
              <div className="text-txt-secondary w-full text-center text-base leading-normal font-medium">
                Xoay ngang thiết bị để có trải nghiệm tốt hơn
              </div>
            </div>
            <div className="flex w-full flex-col items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleRotated}
                className="flex w-full flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-400 px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-fuchsia-400 hover:to-fuchsia-500"
              >
                <div className="justify-center text-center text-sm leading-tight font-semibold text-black">
                  Đã xoay rồi
                </div>
              </button>
              <button
                type="button"
                onClick={handleContinuePortrait}
                className="outline-lav-500 hover:bg-lav-500/5 flex w-full flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-xl px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)] outline outline-offset-[-1px] transition-colors"
              >
                <div className="text-txt-focus justify-center text-center text-sm leading-tight font-semibold">
                  Tiếp tục ở chế độ dọc
                </div>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
