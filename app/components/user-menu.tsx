import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Menu, X, User as UserIcon } from "lucide-react";

import { NotificationBell } from "./notification-bell";
import { UserDropdownMenu } from "./user-dropdown-menu";

import type { UserType } from "~/database/models/user.model";
import { getAvatarPath, getTitleImgPath } from "~/helpers/user.helper";

interface UserMenuProps {
  user: UserType;
  isAdmin?: boolean;
  isMobile?: boolean;
  autoPrefetchNotifications?: boolean;
}

export function UserMenu({ user, isAdmin = false, isMobile = false, autoPrefetchNotifications = false }: UserMenuProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobile || typeof document === "undefined" || !isUserMenuOpen) {
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
  }, [isMobile, isUserMenuOpen]);

  if (isMobile) {
    return (
      <div className="flex items-center gap-4">
        <NotificationBell autoPrefetch={autoPrefetchNotifications} />

        <Popover.Root open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
          <Popover.Trigger asChild>
            <button data-user-menu-trigger="true">
              {isUserMenuOpen ? (
                <X className="text-txt-primary h-7 w-7" />
              ) : (
                <Menu className="text-txt-primary h-7 w-7" />
              )}
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              className="bg-bgc-layer1 border-white/10 animate-slideDownAndFade z-50 mr-[-16px] mt-3 inline-flex max-w-[calc(100vw-12px)] rounded-2xl border p-0 text-left shadow-xl overflow-hidden"
              sideOffset={8}
              align="end"
              style={{ width: "min(calc(100vw - 12px), 340px)" }}
              onOpenAutoFocus={(event: Event) => event.preventDefault()}
              onPointerDownOutside={(event) => {
                const target = event.target as HTMLElement | null;
                if (target?.closest("[data-user-menu-trigger]") || target?.closest("[data-user-menu-item]") ) {
                  return;
                }
                event.preventDefault();
              }}
              onInteractOutside={(event) => {
                const target = event.target as HTMLElement | null;
                if (target?.closest("[data-user-menu-trigger]") || target?.closest("[data-user-menu-item]") ) {
                  return;
                }
                event.preventDefault();
              }}
            >
              <UserDropdownMenu setIsUserMenuOpen={setIsUserMenuOpen} isMobile={true} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    );
  }

  // ✅ Avatar: dùng icon lucide khi chưa upload hoặc khi ảnh lỗi
  const avatarUrl = getAvatarPath(user);
  const [avatarError, setAvatarError] = useState(false);
  const showIcon = !avatarUrl || avatarError;

  return (
    <div className="flex items-center justify-start gap-4">
      <NotificationBell autoPrefetch={autoPrefetchNotifications} />

      <Popover.Root open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
        <Popover.Trigger asChild>
          <div className="flex cursor-pointer items-center gap-2">
            {/* Khung avatar 28x28, tròn, không méo; icon fallback nằm giữa */}
            <div className="h-7 w-7 shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-[#121826]">
              {showIcon ? (
                <UserIcon className="h-5 w-5 text-txt-primary" />
              ) : (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  loading="lazy"
                  decoding="async"
                  className="block h-full w-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              )}
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-txt-primary text-base font-medium">{user?.name}</span>

              {/* ✅ Badge/title: cao ≈ 90% hàng header, ngang theo tỉ lệ gốc */}
              {!isAdmin && (
                <img
                  src={getTitleImgPath(user)}
                  alt="Title"
                  loading="lazy"
                  decoding="async"
                  className="block w-auto object-contain shrink-0"
                  style={{
                    height: "90%",
                    maxHeight: "50px",
                    maxWidth: "7.5rem",
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              {/* Hamburger icon (purple) as menu trigger indicator */}
              <Menu className="h-5 w-5 shrink-0 text-[#D373FF]" />
            </div>
          </div>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="bg-bgc-layer1 border-bd-default animate-slideDownAndFade z-50 mt-3 w-72 min-w-[18rem] overflow-hidden rounded-lg border"
            sideOffset={8}
            align="end"
          >
            <UserDropdownMenu setIsUserMenuOpen={setIsUserMenuOpen} isMobile={false} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
