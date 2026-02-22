import { NavLink } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import {
  BookmarkCheck,
  DollarSign,
  History,
  KeyRound,
  Layers3,
  Power,
  Search,
  Shuffle,
  ShieldBan,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRandomCooldown } from "~/hooks/use-random-cooldown";

export function UserDropdownMenu({
  setIsUserMenuOpen,
  onHireDialog,
  isMobile = false,
}: {
  setIsUserMenuOpen: (isOpen: boolean) => void;
  onHireDialog: () => void;
  isMobile?: boolean;
}) {
  const { isLocked: isRandomLocked, tryStartCooldown: tryStartRandomCooldown } = useRandomCooldown();

  type MenuEntry = {
    href?: string;
    action?: () => void;
    label: string;
    Icon: LucideIcon;
    gapBelow?: boolean;
    group: number;
  };

  const mobileItems: MenuEntry[] = [
    { href: "/random", label: "Random", Icon: Shuffle, group: 0 },
    { href: "/search/advanced", label: "Tìm kiếm nâng cao", Icon: Search, group: 0 },
    { href: "/user/blacklist-tags", label: "Lọc thể loại không thích", Icon: ShieldBan, gapBelow: true, group: 0 },
    { href: "/profile#reading-history", label: "Lịch sử đọc", Icon: History, group: 1 },
    { href: "/profile#saved-stories", label: "Truyện đang theo dõi", Icon: BookmarkCheck, gapBelow: true, group: 1 },
    { href: "/profile", label: "Trang cá nhân", Icon: UserRound, group: 2 },
    { href: "/truyen-hentai/manage", label: "Quản lý / Đăng truyện", Icon: Layers3, group: 2 },
    { action: () => onHireDialog(), label: "Thuê dịch truyện", Icon: DollarSign, group: 2 },
    { href: "/change-password", label: "Đổi mật khẩu", Icon: KeyRound, gapBelow: true, group: 2 },
  ];

  const desktopItems: MenuEntry[] = [
    { href: "/user/blacklist-tags", label: "Lọc thể loại không thích", Icon: ShieldBan, gapBelow: true, group: 0 },
    { href: "/profile#reading-history", label: "Lịch sử đọc", Icon: History, group: 1 },
    { href: "/profile#saved-stories", label: "Truyện đang theo dõi", Icon: BookmarkCheck, gapBelow: true, group: 1 },
    { href: "/profile", label: "Trang cá nhân", Icon: UserRound, group: 2 },
    { href: "/truyen-hentai/manage", label: "Quản lý / Đăng truyện", Icon: Layers3, group: 2 },
    { action: () => onHireDialog(), label: "Thuê dịch truyện", Icon: DollarSign, group: 2 },
    { href: "/change-password", label: "Đổi mật khẩu", Icon: KeyRound, gapBelow: true, group: 2 },
  ];

  const activeItems = isMobile ? mobileItems : desktopItems;

  const getRowBackgroundClass = (group: number) =>
    group % 2 === 0 ? "bg-[#0C1424]" : "bg-[#161E35]";
  // Helper to render either NavLink (desktop) or native anchor wrapped in Popover.Close (mobile)
  const renderItem = (
    item: MenuEntry,
    labelClassName: string = isMobile ? "text-[15px]" : "text-base",
  ) => {
    const { href, action, label, Icon, group, gapBelow } = item;
    const rowBackgroundClass = getRowBackgroundClass(group);
    const gapPaddingClass = gapBelow ? "pb-5" : "";
    const sharedClasses = `${rowBackgroundClass} group flex w-full items-center justify-start gap-3 border-b border-white/8 px-5 py-3.5 text-left transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C084FC] focus-visible:ring-offset-0 hover:bg-bgc-layer2/80 active:bg-bgc-layer2 md:border-b-0 ${gapPaddingClass}`;

    const inner = (
      <>
        <Icon className="h-5 w-5 text-[#BFC5E6] transition-colors group-hover:text-white" strokeWidth={2.25} />
        <span className={`text-[#D6DAE6] group-hover:text-white leading-6 font-semibold ${labelClassName} whitespace-nowrap`}>{label}</span>
      </>
    );

    // Button action item (e.g. opens a dialog)
    if (action) {
      const handleClick = () => {
        action();
      };
      if (isMobile) {
        return (
          <Popover.Close asChild key={label}>
            <button type="button" className={sharedClasses} data-user-menu-item="true" onClick={handleClick}>
              {inner}
            </button>
          </Popover.Close>
        );
      }
      return (
        <button
          key={label}
          type="button"
          className={`${sharedClasses} cursor-pointer`}
          // onMouseDown preventDefault prevents :focus-visible from triggering on mouse click in Chrome
          // (Chrome treats <button> specially: shows focus-visible ring on click, unlike <a> elements)
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setIsUserMenuOpen(false); handleClick(); }}
        >
          {inner}
        </button>
      );
    }

    if (isMobile) {
      const isRandomItem = href === "/random";
      const locked = isRandomItem ? isRandomLocked : false;

      return (
        <Popover.Close asChild key={href}>
          <a
            href={href}
            className={sharedClasses}
            data-user-menu-item="true"
            aria-disabled={locked}
            tabIndex={locked ? -1 : 0}
            style={locked ? { opacity: 0.6, userSelect: "none", cursor: "not-allowed" } : undefined}
            onClick={(event) => {
              if (!isRandomItem) return;
              if (locked) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              if (!tryStartRandomCooldown()) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
          >
            {inner}
          </a>
        </Popover.Close>
      );
    }

    return (
      <NavLink
        key={href}
        to={href!}
        className={`${sharedClasses} cursor-pointer`}
        onClick={() => setIsUserMenuOpen(false)}
      >
        {inner}
      </NavLink>
    );
  };

  return (
    <div className={`${isMobile ? "w-full" : "w-full px-6"} md:px-0`}>
    {activeItems.map((item) => renderItem(item))}

      {/* Logout (luôn ở cuối) */}
      {(() => {
        const rowBackgroundClass = getRowBackgroundClass(1);
        const logoutClasses = `${rowBackgroundClass} group flex w-full items-center justify-start gap-3 border-b border-white/8 px-5 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C084FC] focus-visible:ring-offset-0 hover:bg-bgc-layer2/80 active:bg-bgc-layer2 md:border-b-0`;

        if (isMobile) {
          return (
            <Popover.Close asChild>
              <a href="/logout" className={logoutClasses} data-user-menu-item="true">
                <Power className="h-4 w-4 text-[#E03F46]" />
                <span className="text-base leading-6 font-semibold text-[#E03F46] whitespace-nowrap">Đăng xuất</span>
              </a>
            </Popover.Close>
          );
        }

        return (
          <NavLink
            to="/logout"
            className={`${logoutClasses} cursor-pointer`}
            onClick={() => setIsUserMenuOpen(false)}
          >
            <Power className="h-4 w-4 text-[#E03F46]" />
            <span className="text-base leading-6 font-semibold text-[#E03F46] whitespace-nowrap">Đăng xuất</span>
          </NavLink>
        );
      })()}

    </div>
  );
}
