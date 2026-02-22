import { useState } from "react";
import { createPortal } from "react-dom";
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
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRandomCooldown } from "~/hooks/use-random-cooldown";

export function UserDropdownMenu({
  setIsUserMenuOpen,
  isMobile = false,
}: {
  setIsUserMenuOpen: (isOpen: boolean) => void;
  isMobile?: boolean;
}) {
  const { isLocked: isRandomLocked, tryStartCooldown: tryStartRandomCooldown } = useRandomCooldown();
  const [showHireDialog, setShowHireDialog] = useState(false);

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
    { action: () => setShowHireDialog(true), label: "Thuê dịch truyện", Icon: DollarSign, group: 2 },
    { href: "/change-password", label: "Đổi mật khẩu", Icon: KeyRound, gapBelow: true, group: 2 },
  ];

  const desktopItems: MenuEntry[] = [
    { href: "/user/blacklist-tags", label: "Lọc thể loại không thích", Icon: ShieldBan, gapBelow: true, group: 0 },
    { href: "/profile#reading-history", label: "Lịch sử đọc", Icon: History, group: 1 },
    { href: "/profile#saved-stories", label: "Truyện đang theo dõi", Icon: BookmarkCheck, gapBelow: true, group: 1 },
    { href: "/profile", label: "Trang cá nhân", Icon: UserRound, group: 2 },
    { href: "/truyen-hentai/manage", label: "Quản lý / Đăng truyện", Icon: Layers3, group: 2 },
    { action: () => setShowHireDialog(true), label: "Thuê dịch truyện", Icon: DollarSign, group: 2 },
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
        <button key={label} type="button" className={`${sharedClasses} cursor-pointer`} onClick={() => { setIsUserMenuOpen(false); handleClick(); }}>
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

      {/* Dialog: Thuê dịch truyện */}
      {showHireDialog && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(2px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowHireDialog(false); }}
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0C1424] p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Close */}
            <button
              type="button"
              onClick={() => setShowHireDialog(false)}
              className="absolute right-4 top-4 text-white/40 hover:text-white transition-colors"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Title */}
            <h2 className="text-lg font-bold text-white pr-8">💸 Thuê dịch truyện</h2>

            {/* CTA Discord */}
            <p className="text-[#C5CBDE] text-sm leading-relaxed">
              Hãy vào <strong className="text-white">KÊNH THUÊ DỊCH TRUYỆN</strong> trong Discord bằng cách bấm vào nút sau:
            </p>
            <a
              href="https://discord.gg/sr5TZ3P8TB"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Vào kênh Discord
            </a>

            {/* Divider */}
            <div className="border-t border-white/10" />

            {/* Hướng dẫn */}
            <div className="flex flex-col gap-3 text-sm text-[#C5CBDE] leading-relaxed">
              <p className="font-semibold text-white">📌 HƯỚNG DẪN SỬ DỤNG KÊNH THUÊ DỊCH TRUYỆN</p>
              <p>Nếu bạn có nhu cầu thuê dịch truyện, Admin gợi ý các bạn làm theo các bước sau:</p>

              <p><span className="text-white font-semibold">1️⃣</span> Tag trực tiếp role bằng cách gõ <strong className="text-white">@Dịch giả</strong> (mục đích là để thông báo tới tất cả dịch giả rằng có người muốn dịch truyện)</p>

              <div className="flex flex-col gap-1">
                <p><span className="text-white font-semibold">2️⃣</span> Ghi thông tin về truyện</p>
                <p className="text-white font-medium ml-4">Bắt buộc cần có: Tên truyện cần dịch.</p>
                <p className="ml-4">Thông tin tùy chọn bổ sung nếu có thì tốt:</p>
                <ul className="ml-6 flex flex-col gap-0.5 list-disc">
                  <li>Ảnh bìa truyện</li>
                  <li>Số chapter, truyện end hay chưa</li>
                  <li>Ngôn ngữ gốc</li>
                  <li>Deadline cho Dịch Giả (nếu có)</li>
                  <li>Ngân sách dự kiến (nếu muốn trao đổi nhanh hơn)</li>
                </ul>
              </div>

              <div className="border-t border-white/10 pt-2 flex flex-col gap-1.5">
                <p className="font-semibold text-white">📌 Sau khi bạn đăng yêu cầu:</p>
                <p>Dịch giả nào quan tâm sẽ chủ động nhắn tin riêng (DM) cho bạn để trao đổi chi tiết.</p>
                <p>Admin không đứng ra trung gian thương lượng giá.</p>
              </div>

              <div className="border-t border-white/10 pt-2 flex flex-col gap-1.5">
                <p className="font-semibold text-white">⚠️ Lưu ý:</p>
                <ul className="flex flex-col gap-0.5 list-disc ml-4">
                  <li>Không spam tag nhiều lần.</li>
                  <li>Không tag ngoài mục đích thuê dịch.</li>
                  <li>Trao đổi giá và điều khoản riêng tư qua tin nhắn cá nhân.</li>
                  <li>Giữ văn minh – rõ ràng – tôn trọng nhau để làm việc hiệu quả 🤝</li>
                </ul>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
