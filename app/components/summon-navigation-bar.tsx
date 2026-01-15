import { NavLink } from "react-router-dom";

interface NavigationBarProps {
  navItems: Array<{ label: string; to: string; id: string }>;
  onGuideClick?: () => void;
  onHistoryClick?: () => void;
  userGold?: number;
}

export function SummonNavigationBar({ navItems, onGuideClick, onHistoryClick, userGold }: NavigationBarProps) {
  return (
    <div className="flex w-full items-center justify-between gap-2 px-3 py-2 sm:gap-4">
      <div className="flex items-center gap-2 sm:gap-4">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            className={({ isActive }) =>
              `${
                isActive
                  ? "bg-btn-primary text-txt-inverse"
                  : "bg-bgc-layer-semi-neutral text-txt-primary"
              } rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      {(onGuideClick || onHistoryClick || typeof userGold === "number") && (
        <div className="flex items-center gap-2 sm:gap-3">
          {typeof userGold === "number" && (
            <div className="bg-bgc-layer1 flex items-center justify-center rounded-[32px] border border-white/70 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <img className="h-4 w-4 sm:h-5 sm:w-6" src="/images/icons/gold-icon.png" alt="Gem" />
                <div className="text-txt-primary font-sans text-xs leading-normal font-semibold sm:text-base">
                  {userGold}
                </div>
              </div>
            </div>
          )}
          {onHistoryClick && (
            <button
              onClick={onHistoryClick}
              className="rounded-[32px] border border-white/70 bg-black/55 px-3 py-1.5 text-xs text-white shadow-[0_6px_24px_rgba(0,0,0,.35)] backdrop-blur-sm transition-colors hover:bg-black/70 sm:px-5 sm:py-3 sm:text-base"
            >
              <div className="font-semibold">Nhận Thưởng</div>
            </button>
          )}
          {onGuideClick && (
            <button
              onClick={onGuideClick}
              className="rounded-[32px] border border-white/70 bg-black/55 px-3 py-1.5 text-xs text-white shadow-[0_6px_24px_rgba(0,0,0,.35)] backdrop-blur-sm transition-colors hover:bg-black/70 sm:px-5 sm:py-3 sm:text-base"
            >
              <div className="font-semibold">Hướng dẫn</div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
