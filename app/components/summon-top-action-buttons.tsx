import { NavLink } from "react-router";
import { ArrowLeft, Info } from "lucide-react";

import type { UserType } from "~/database/models/user.model";

interface DesktopTopActionButtonsProps {
  onGuideClick: () => void;
  onHistoryClick: () => void;
  onWaifuListClick: () => void;
  user: UserType;
}

interface MobileTopActionButtonsProps {
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
    <div className="absolute top-6 right-8 flex translate-y-full items-center gap-4">
      {/* Currency Counter */}
      {user && (
        <>
          <div className="bg-bgc-layer1 flex items-center justify-center gap-2.5 rounded-[32px] border border-white px-5 py-3">
            <div className="flex items-center justify-start gap-1.5">
              <img className="h-5 w-6" src="/images/icons/gold-icon.png" alt="Gem" />
              <div className="text-txt-primary justify-center text-center font-sans text-base leading-normal font-semibold">
                {user?.gold}
              </div>
            </div>
            <Info className="text-txt-secondary h-3.5 w-3.5" />
          </div>

          {/* Navigation Buttons */}
          <button
            onClick={onHistoryClick}
            className="bg-bgc-layer1 hover:bg-bgc-layer2 flex cursor-pointer items-center justify-center gap-2.5 rounded-[32px] border border-white px-5 py-3 transition-colors"
          >
            <div className="text-txt-primary justify-center font-sans text-base leading-normal font-semibold">
              Lịch sử
            </div>
          </button>

          <button
            onClick={onWaifuListClick}
            className="bg-bgc-layer1 hover:bg-bgc-layer2 flex cursor-pointer items-center justify-center gap-2.5 rounded-[32px] border border-white px-5 py-3 transition-colors"
          >
            <div className="text-txt-primary justify-center font-sans text-base leading-normal font-semibold">
              Danh sách Waifu
            </div>
          </button>
        </>
      )}

      <button
        onClick={onGuideClick}
        className="bg-bgc-layer1 hover:bg-bgc-layer2 flex cursor-pointer items-center justify-center gap-2.5 rounded-[32px] border border-white px-5 py-3 transition-colors"
      >
        <div className="text-txt-primary justify-center font-sans text-base leading-normal font-semibold">
          Hướng dẫn
        </div>
      </button>
    </div>
  );
}

export function SummonMobileTopActionButtons({
  onGuideClick,
  onHistoryClick,
  onWaifuListClick,
  user,
}: MobileTopActionButtonsProps) {
  return (
    <div className="absolute top-6 right-6 left-6 z-10 flex translate-y-full items-center justify-between">
      {/* Back to Home Button */}
      <NavLink
        to="/"
        className="bg-bgc-layer1 hover:bg-bgc-layer2 flex cursor-pointer items-center justify-center gap-2.5 rounded-[32px] border border-white px-3 py-2 transition-colors"
      >
        <ArrowLeft className="text-txt-primary h-6 w-6" />
        <div className="text-txt-primary justify-center font-sans text-xs leading-6 font-semibold">
          Trang chủ
        </div>
      </NavLink>

      {/* Right side buttons */}
      <div className="flex items-center gap-4">
        {/* Currency Counter */}
        {user && (
          <>
            <div className="bg-bgc-layer1 flex items-center justify-center gap-2.5 rounded-[32px] border border-white px-3 py-2">
              <div className="flex items-center justify-start gap-1.5">
                <img className="h-5 w-6" src="/images/icons/gold-icon.png" alt="Gem" />
                <div className="text-txt-primary justify-center text-center font-sans text-xs leading-6 font-semibold">
                  {user?.gold}
                </div>
              </div>
              <Info className="text-txt-secondary h-3.5 w-3.5" />
            </div>

            {/* History Button */}
            <button
              onClick={onHistoryClick}
              className="bg-bgc-layer1 hover:bg-bgc-layer2 flex cursor-pointer items-center justify-center gap-2.5 rounded-[32px] border border-white px-3 py-2 transition-colors"
            >
              <div className="text-txt-primary justify-center font-sans text-xs leading-6 font-semibold">
                Lịch sử
              </div>
            </button>

            {/* Waifu List Button */}
            <button
              onClick={onWaifuListClick}
              className="bg-bgc-layer1 hover:bg-bgc-layer2 flex cursor-pointer items-center justify-center gap-2.5 rounded-[32px] border border-white px-3 py-2 transition-colors"
            >
              <div className="text-txt-primary justify-center font-sans text-xs leading-6 font-semibold">
                Danh sách Waifu
              </div>
            </button>
          </>
        )}

        {/* Guide Button */}
        <button
          onClick={onGuideClick}
          className="bg-bgc-layer1 hover:bg-bgc-layer2 flex cursor-pointer items-center justify-center gap-2.5 rounded-[32px] border border-white px-3 py-2 transition-colors"
        >
          <div className="text-txt-primary justify-center font-sans text-xs leading-6 font-semibold">
            Hướng dẫn
          </div>
        </button>
      </div>
    </div>
  );
}
