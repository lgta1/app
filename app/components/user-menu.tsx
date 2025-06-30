import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, CircleUserRound, Menu, X } from "lucide-react";

import { NotificationBell } from "./notification-bell";
import { UserDropdownMenu } from "./user-dropdown-menu";

import type { UserType } from "~/database/models/user.model";
import { getTitleImgPath } from "~/helpers/user.helper";

interface UserMenuProps {
  user: UserType;
  isAdmin?: boolean;
  isMobile?: boolean;
}

export function UserMenu({ user, isAdmin = false, isMobile = false }: UserMenuProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="flex items-center gap-4">
        <NotificationBell />

        <Popover.Root open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
          <Popover.Trigger asChild>
            <button>
              {isUserMenuOpen ? (
                <X className="text-txt-primary h-7 w-7" />
              ) : (
                <Menu className="text-txt-primary h-7 w-7" />
              )}
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              className="bg-bgc-layer1 border-bd-default animate-slideDownAndFade z-50 mt-1 w-screen overflow-hidden"
              sideOffset={8}
              align="end"
            >
              <UserDropdownMenu />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-start gap-4">
      <NotificationBell />

      <Popover.Root open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
        <Popover.Trigger asChild>
          <div className="flex cursor-pointer items-center gap-2">
            <CircleUserRound className="h-7 w-7" />
            <div className="flex items-center gap-2">
              <span className="text-txt-primary text-base font-medium">{user?.name}</span>
              {!isAdmin && (
                <img src={getTitleImgPath(user)} alt="Title" className="h-6 w-28" />
              )}
              <ChevronDown className="text-txt-primary h-4 w-4" />
            </div>
          </div>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="bg-bgc-layer1 border-bd-default animate-slideDownAndFade z-50 mt-3 w-40 overflow-hidden rounded-lg border"
            sideOffset={8}
            align="end"
          >
            <UserDropdownMenu />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
