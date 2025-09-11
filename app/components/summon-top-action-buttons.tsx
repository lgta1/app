import { NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import type { UserType } from "~/database/models/user.model";

/** =================== DESKTOP =================== */
interface DesktopTopActionButtonsProps {
  onGuideClick: () => void;
  onHistoryClick: () => void;
  onWaifuListClick: () => void;
  user: UserType;
}

export function SummonDesktopTopActionButtons({
  onGuideClick,
  onHistoryClick,
  onWaifuListClick,
  user,
}: DesktopTopActionButtonsProps) {
  return (
    <div className="absolute top-6 right-8 z-10 flex translate-y-full items-center gap-4">
      {/* Gem counter */}
      {user && (
        <>
          {/* Thay cả khối ô tiền theo yêu cầu */}
          <div className="bg-bgc-layer1 flex items-center justify-center rounded-[32px] border border-white px-5 py-3">
            <div className="flex items-center gap-2">
              <img className="h-5 w-6" src="/images/icons/gold-icon.png" alt="Gem" />
              <div className="text-txt-primary font-sans text-base leading-normal font-semibold">
                {user?.gold}
              </div>
            </div>
          </div>

          <button
            onClick={onHistoryClick}
            className="rounded-[32px] border border-white/70 bg-black/55 px-5 py-3 text-white shadow-[0_6px_24px_rgba(0,0,0,.35)] backdrop-blur-sm transition-colors hover:bg-black/70"
          >
            <div className="font-semibold">Lịch sử</div>
          </button>

          <button
            onClick={onWaifuListClick}
            className="rounded-[32px] border border-white/70 bg-black/55 px-5 py-3 text-white shadow-[0_6px_24px_rgba(0,0,0,.35)] backdrop-blur-sm transition-colors hover:bg-black/70"
          >
            <div className="font-semibold">Danh sách Waifu</div>
          </button>
        </>
      )}

      <button
        onClick={onGuideClick}
        className="rounded-[32px] border border-white/70 bg-black/55 px-5 py-3 text-white shadow-[0_6px_24px_rgba(0,0,0,.35)] backdrop-blur-sm transition-colors hover:bg-black/70"
      >
        <div className="font-semibold">Hướng dẫn</div>
      </button>
    </div>
  );
}

/** =================== MOBILE =================== */
interface MobileTopActionButtonsProps {
  onGuideClick: () => void;
  onHistoryClick: () => void;
  onWaifuListClick: () => void;
  user: UserType;
}

/**
 * Mobile bar “5 ô” – giữ nguyên layout hiện có
 * - Viền trắng, bo tròn, nền đen mờ + blur
 * - Chia 5 ô đều nhau bằng divide-white/15
 * - Đặt bên trong khung ảnh (yêu cầu parent là `relative`)
 */
export function SummonMobileTopActionButtons({
  onGuideClick,
  onHistoryClick,
  onWaifuListClick,
  user,
}: MobileTopActionButtonsProps) {
  return (
    <div className="absolute inset-x-3 top-2 z-10 sm:hidden">
      <div className="flex items-stretch justify-between divide-x divide-white/15 overflow-hidden rounded-2xl border border-white/70 bg-black/55 text-white shadow-[0_6px_24px_rgba(0,0,0,.35)] backdrop-blur-sm">
        {/* Trang chủ */}
        <NavLink
          to="/"
          className="flex min-w-[72px] flex-1 items-center justify-center gap-2 px-3 py-2"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" />
          <span className="text-center text-[12px] leading-[16px] break-words whitespace-normal text-white">
            Trang chủ
          </span>
        </NavLink>

        {/* Gem / Ngọc */}
        {user ? (
          <div className="flex min-w-[72px] flex-1 items-center justify-center px-3 py-2">
            <div className="flex items-center gap-2">
              <img className="h-4 w-4" src="/images/icons/gold-icon.png" alt="Gem" />
              <span className="min-w-0 overflow-visible text-center text-[12px] leading-[16px] font-semibold break-words text-clip whitespace-normal text-white">
                {String(user?.gold ?? "")}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex min-w-[72px] flex-1 items-center justify-center px-3 py-2">
            <span className="text-center text-[12px] leading-[16px] break-words whitespace-normal text-white">
              …
            </span>
          </div>
        )}

        {/* Lịch sử */}
        <button
          onClick={onHistoryClick}
          className="flex min-w-[72px] flex-1 items-center justify-center px-3 py-2"
        >
          <span className="text-center text-[12px] leading-[16px] break-words whitespace-normal text-white">
            Lịch sử
          </span>
        </button>

        {/* Danh sách Waifu */}
        <button
          onClick={onWaifuListClick}
          className="flex min-w-[72px] flex-1 items-center justify-center px-3 py-2"
        >
          <span className="text-center text-[12px] leading-[16px] text-white">
            Danh sách
            <br />
            Waifu
          </span>
        </button>

        {/* Hướng dẫn */}
        <button
          onClick={onGuideClick}
          className="flex min-w-[72px] flex-1 items-center justify-center px-3 py-2"
        >
          <span className="text-center text-[12px] leading-[16px] break-words whitespace-normal text-white">
            Hướng dẫn
          </span>
        </button>
      </div>
    </div>
  );
}
