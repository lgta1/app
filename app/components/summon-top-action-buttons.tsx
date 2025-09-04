import { NavLink } from "react-router";
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
              <div className="text-txt-primary font-sans text-base font-semibold leading-normal">
                {user?.gold}
              </div>
            </div>
          </div>

          <button
            onClick={onHistoryClick}
            className="bg-black/55 hover:bg-black/70 backdrop-blur-sm border border-white/70 text-white shadow-[0_6px_24px_rgba(0,0,0,.35)] rounded-[32px] px-5 py-3 transition-colors"
          >
            <div className="font-semibold">Lịch sử</div>
          </button>

          <button
            onClick={onWaifuListClick}
            className="bg-black/55 hover:bg-black/70 backdrop-blur-sm border border-white/70 text-white shadow-[0_6px_24px_rgba(0,0,0,.35)] rounded-[32px] px-5 py-3 transition-colors"
          >
            <div className="font-semibold">Danh sách Waifu</div>
          </button>
        </>
      )}

      <button
        onClick={onGuideClick}
        className="bg-black/55 hover:bg-black/70 backdrop-blur-sm border border-white/70 text-white shadow-[0_6px_24px_rgba(0,0,0,.35)] rounded-[32px] px-5 py-3 transition-colors"
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
    <div
      className="
        absolute inset-x-3 
        top-2
        z-10
        sm:hidden
      "
    >
      <div
        className="
          flex items-stretch justify-between
          rounded-2xl overflow-hidden
          border border-white/70 
          bg-black/55 text-white backdrop-blur-sm
          shadow-[0_6px_24px_rgba(0,0,0,.35)]
          divide-x divide-white/15
        "
      >
        {/* Trang chủ */}
        <NavLink
          to="/"
          className="flex-1 min-w-[72px] px-3 py-2 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" />
          <span className="text-white text-[12px] leading-[16px] text-center whitespace-normal break-words">
            Trang chủ
          </span>
        </NavLink>

        {/* Gem / Ngọc */}
        {user ? (
          <div className="flex-1 min-w-[72px] px-3 py-2 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <img className="h-4 w-4" src="/images/icons/gold-icon.png" alt="Gem" />
              <span
                className="text-white text-[12px] leading-[16px] font-semibold
                           text-center whitespace-normal break-words overflow-visible text-clip min-w-0"
              >
                {String(user?.gold ?? "")}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-[72px] px-3 py-2 flex items-center justify-center">
            <span className="text-white text-[12px] leading-[16px] text-center whitespace-normal break-words">
              …
            </span>
          </div>
        )}

        {/* Lịch sử */}
        <button
          onClick={onHistoryClick}
          className="flex-1 min-w-[72px] px-3 py-2 flex items-center justify-center"
        >
          <span className="text-white text-[12px] leading-[16px] text-center whitespace-normal break-words">
            Lịch sử
          </span>
        </button>

        {/* Danh sách Waifu */}
        <button
          onClick={onWaifuListClick}
          className="flex-1 min-w-[72px] px-3 py-2 flex items-center justify-center"
        >
          <span className="text-white text-[12px] leading-[16px] text-center">
            Danh sách<br />Waifu
          </span>
        </button>

        {/* Hướng dẫn */}
        <button
          onClick={onGuideClick}
          className="flex-1 min-w-[72px] px-3 py-2 flex items-center justify-center"
        >
          <span className="text-white text-[12px] leading-[16px] text-center whitespace-normal break-words">
            Hướng dẫn
          </span>
        </button>
      </div>
    </div>
  );
}
