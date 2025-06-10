import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Bell, ChevronDown, CircleUserRound, Menu, X } from "lucide-react";

import { UserDropdownMenu } from "./user-dropdown-menu";

import type { UserType } from "~/database/models/user.model";
import { getTitleImgPath } from "~/helpers/user.helper";

interface UserMenuProps {
  user: UserType;
  notificationCount?: number;
  isAdmin?: boolean;
  isMobile?: boolean;
}

export function UserMenu({
  user,
  notificationCount = 0,
  isAdmin = false,
  isMobile = false,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
  };

  if (isMobile) {
    return (
      <div className="flex items-center gap-4">
        <div className="relative">
          <Bell className="text-txt-primary h-6 w-6" />
          {notificationCount > 0 && (
            <div className="text-txt-primary absolute top-[-5px] right-[-5px] rounded-lg bg-[#E03F46] px-1 py-[2px] text-[8px] font-semibold">
              {notificationCount}
            </div>
          )}
        </div>

        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
          <Popover.Trigger asChild>
            <button>
              {isOpen ? (
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
              <UserDropdownMenu user={user} onClose={handleClose} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-start gap-4">
      <div className="relative">
        <Bell className="text-txt-primary h-6 w-6" />
        {notificationCount > 0 && (
          <div className="text-txt-primary absolute top-[-5px] right-[-5px] rounded-lg bg-[#E03F46] px-1 py-[2px] text-[8px] font-semibold">
            {notificationCount}
          </div>
        )}
      </div>

      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
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
            <UserDropdownMenu user={user} onClose={handleClose} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
