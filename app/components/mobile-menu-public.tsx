import { useState } from "react";
import { Link } from "react-router";
import * as Popover from "@radix-ui/react-popover";
import { Menu, X } from "lucide-react";

interface MobileMenuProps {
  className?: string;
}

export function MobileMenuPublic({ className = "" }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button className={className}>
          {isOpen ? (
            <X className="text-txt-primary h-7 w-7" />
          ) : (
            <Menu className="text-txt-primary h-7 w-7" />
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="bg-bgc-layer1 z-50 mt-3 w-screen p-4 px-9"
          side="bottom"
          align="center"
          sideOffset={0}
        >
          <div className="mx-auto flex max-w-sm flex-row gap-3">
            <Popover.Close asChild>
              <Link
                to="/login"
                className="border-lav-500 flex flex-1 items-center justify-center rounded-xl border-1 px-3 py-2"
              >
                <span className="text-lav-500 text-sm font-semibold">Đăng nhập</span>
              </Link>
            </Popover.Close>

            <Popover.Close asChild>
              <Link
                to="/register"
                className="flex flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-3 py-2"
              >
                <span className="text-sm font-semibold text-black">Đăng ký</span>
              </Link>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
