import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [showHireDialog, setShowHireDialog] = useState(false);
  const onHireDialog = () => setShowHireDialog(true);

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
              <UserDropdownMenu setIsUserMenuOpen={setIsUserMenuOpen} onHireDialog={onHireDialog} isMobile={true} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* Dialog: Thuê dịch truyện */}
        {showHireDialog && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(2px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowHireDialog(false); }}
          >
            <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0C1424] p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
              <button type="button" onClick={() => setShowHireDialog(false)} className="absolute right-4 top-4 text-white/40 hover:text-white transition-colors" aria-label="Đóng">
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-bold text-white pr-8">💸 Thuê dịch truyện</h2>
              <p className="text-[#C5CBDE] text-sm leading-relaxed">Hãy vào <strong className="text-white">KÊNH THUÊ DỊCH TRUYỆN</strong> trong Discord bằng cách bấm vào nút sau:</p>
              <a href="https://discord.gg/sr5TZ3P8TB" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 self-start rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                Vào kênh Discord
              </a>
              <div className="border-t border-white/10" />
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
            <UserDropdownMenu setIsUserMenuOpen={setIsUserMenuOpen} onHireDialog={onHireDialog} isMobile={false} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Dialog: Thuê dịch truyện */}
      {showHireDialog && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(2px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowHireDialog(false); }}
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0C1424] p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setShowHireDialog(false)} className="absolute right-4 top-4 text-white/40 hover:text-white transition-colors" aria-label="Đóng">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-white pr-8">💸 Thuê dịch truyện</h2>
            <p className="text-[#C5CBDE] text-sm leading-relaxed">Hãy vào <strong className="text-white">KÊNH THUÊ DỊCH TRUYỆN</strong> trong Discord bằng cách bấm vào nút sau:</p>
            <a href="https://discord.gg/sr5TZ3P8TB" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 self-start rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Vào kênh Discord
            </a>
            <div className="border-t border-white/10" />
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
