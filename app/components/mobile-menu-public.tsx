import { useEffect, useState } from "react";
// Use native anchors here to ensure browser navigation works even if React
// unmounts the popover before a client-side router handler runs (fixes iOS timing issue).
import * as Popover from "@radix-ui/react-popover";
import { Menu, X } from "lucide-react";

interface MobileMenuProps {
  className?: string;
}

// Simpler, more robust approach: use react-router `Link` inside `Popover.Close`.
// This mirrors the backup behavior and avoids fragile manual pending-nav logic which
// can introduce click ordering/race issues on mobile (touch events + popover close).
export function MobileMenuPublic({ className = "" }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined" || !isOpen) {
      return;
    }

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;

    body.style.overflow = "hidden";
    body.style.touchAction = "none";

    return () => {
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
    };
  }, [isOpen]);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          className={className}
          aria-label={isOpen ? "Đóng menu" : "Mở menu"}
          data-mobile-menu-trigger="true"
        >
          {isOpen ? <X className="text-txt-primary h-7 w-7" /> : <Menu className="text-txt-primary h-7 w-7" />}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="bg-bgc-layer1 z-50 mt-3 w-[calc(100vw-30px)] max-w-[320px] rounded-2xl border border-white/10 px-4 py-4 text-left shadow-xl mr-[15px]"
          side="bottom"
          align="end"
          sideOffset={8}
          onOpenAutoFocus={(event: Event) => event.preventDefault()}
          onPointerDownOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-mobile-menu-trigger]") || target?.closest("[data-mobile-menu-item]") ) {
              return;
            }
            event.preventDefault();
          }}
          onInteractOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-mobile-menu-trigger]") || target?.closest("[data-mobile-menu-item]") ) {
              return;
            }
            event.preventDefault();
          }}
        >
          <div className="flex flex-col gap-2">
            <Popover.Close asChild>
              <a href="/random" data-mobile-menu-item="true" className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#C084FC] px-3 py-2 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(123,97,255,0.35)] transition hover:opacity-95">
                <span>Random</span>
              </a>
            </Popover.Close>
            <Popover.Close asChild>
              <a href="/search/advanced" data-mobile-menu-item="true" className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-txt-primary transition hover:bg-bgc-layer2">
                <span>Tìm kiếm nâng cao</span>
              </a>
            </Popover.Close>

            <Popover.Close asChild>
              <a
                href="/login?redirect=%2Fuser%2Fblacklist-tags"
                data-mobile-menu-item="true"
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-txt-primary transition hover:bg-bgc-layer2"
              >
                <span>Lọc thể loại không thích</span>
              </a>
            </Popover.Close>
            <Popover.Close asChild>
              <a href="/login" data-mobile-menu-item="true" className="flex w-full items-center justify-between rounded-xl border border-lav-500 px-3 py-2 text-sm font-semibold text-txt-focus transition hover:bg-bgc-layer2">
                <span>Đăng nhập</span>
              </a>
            </Popover.Close>

            <Popover.Close asChild>
              <a href="/register" data-mobile-menu-item="true" className="flex w-full items-center justify-between rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-3 py-2 text-sm font-semibold text-black">
                <span>Đăng ký</span>
              </a>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
