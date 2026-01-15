import { NavLink } from "react-router-dom";
import { Edit3, User as UserIcon } from "lucide-react";

import { InfoTooltip } from "./info-tooltip";

import { getAvatarPath, getTitleImgPath } from "~/helpers/user.helper";
import { getLevelDisplayTitle, getMaxExp, MAX_LEVEL } from "~/helpers/user-level.helper";
import { formatDate } from "~/utils/date.utils";
import { DAM_NGOC_TOOLTIP_CONTENT } from "~/constants/dam-ngoc-tooltip";

interface ProfileInfoProps {
  user: any;
  isOwner?: boolean;
}

export function ProfileInfo({ user, isOwner = true }: ProfileInfoProps) {
  const avatarUrl: string = getAvatarPath(user);
  let showIcon = !avatarUrl;
  const levelTitle = getLevelDisplayTitle(user.level, user.exp);
  const displayName = levelTitle ? `${user.name} - ${levelTitle}` : user.name;
  const level = Math.max(1, Number(user.level) || 1);
  const expValue = Math.max(0, Number(user.exp) || 0);
  const isMaxLevel = level >= MAX_LEVEL;
  const maxExpValue = isMaxLevel ? null : getMaxExp(level);
  const expPercent = isMaxLevel
    ? 100
    : Math.min(100, (expValue / Math.max(1, Number(maxExpValue) || 1)) * 100);
  const expDisplayMax = isMaxLevel
    ? "Tối đa"
    : (maxExpValue ?? 0).toLocaleString("vi-VN");
  const expDisplayCurrent = expValue.toLocaleString("vi-VN");

  return (
    <div className="bg-bgc-layer1 border-bd-default flex w-full flex-col gap-6 rounded-xl border p-4 lg:flex-row lg:p-6">
      {/* Left Section - User Info */}
      <div className="flex flex-1 gap-4 lg:max-w-[514px]">
        <div className="flex flex-col items-center gap-2">
          {/* AVATAR: icon lucide khi chưa upload hoặc ảnh lỗi */}
          <div className="h-16 w-16 lg:h-24 lg:w-24 rounded-full overflow-hidden flex items-center justify-center bg-[#121826]">
            {showIcon ? (
              <UserIcon className="h-10 w-10 lg:h-14 lg:w-14 text-txt-primary" />
            ) : (
              <img
                className="block h-full w-full object-cover"
                src={avatarUrl}
                alt={user.name}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  showIcon = true;
                }}
              />
            )}
          </div>
          {isOwner && (
            <NavLink
              to="/profile-edit"
              className="text-xs font-semibold text-success-success underline decoration-dotted underline-offset-4"
            >
              Chỉnh sửa hồ sơ
            </NavLink>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3">
          {/* Name and Badge */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-txt-primary font-sans text-lg font-semibold lg:text-xl">
                {displayName}
              </h1>

              {/* BADGE/TITLE: scale 2x mobile, 1.5x desktop, không tăng chiều cao hàng */}
              <span className="relative inline-flex h-6 lg:h-8 overflow-visible">
                <img
                  className="block h-full w-auto object-contain"
                  src={getTitleImgPath(user as any)}
                  alt="User Badge"
                  style={{
                    transform: "scale(2)",              // default (mobile)
                    transformOrigin: "center",
                    marginLeft: "-2px",
                    marginRight: "-2px",
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
                <style>
                  {`
                    @media (min-width: 1024px) {
                      .relative.inline-flex.h-6.lg\\:h-8.overflow-visible img {
                        transform: scale(1.5);
                      }
                    }
                  `}
                </style>
              </span>
            </div>

            <p className="text-txt-secondary text-xs font-medium">
              Ngày đăng ký: {formatDate(user.createdAt || new Date())}
            </p>
          </div>

          {/* Experience Bar */}
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-txt-primary text-xs font-medium">Kinh nghiệm</span>
              <span className="text-txt-primary text-xs font-medium">
                {expDisplayCurrent}/{expDisplayMax}
              </span>
            </div>
            <div className="bg-bgc-layer2 h-2 overflow-hidden rounded">
              <div
                className="via-lav-500 h-2 rounded bg-gradient-to-r from-[#3D1351] to-[#E8B5FF]"
                style={{ width: `${expPercent}%` }}
              />
            </div>
          </div>

          {/* Bio Section */}
          <div className="flex flex-col gap-[5px]">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Giới thiệu</h2>
            </div>
            <p className="text-txt-secondary text-xs leading-none font-medium">
              {user.bio}
            </p>
          </div>
        </div>
      </div>

      {/* Right Section - Stats */}
      <div className="border-bd-default flex flex-1 flex-col gap-3 rounded-xl border p-2">
        <div className="flex">
          <div className="flex flex-1 flex-col items-center">
            <div className="text-txt-primary text-base font-semibold">{user.level}</div>
            <div className="text-txt-secondary text-xs font-medium">Cấp bậc</div>
          </div>
          <div className="flex flex-1 flex-col items-center">
            <div className="flex items-center gap-1.5">
              <img className="h-5 w-6" src="/images/icons/gold-icon.png" alt="Dâm Ngọc" />
              <div className="text-txt-primary text-base font-semibold">
                {user.gold?.toLocaleString()}
              </div>
              <InfoTooltip
                ariaLabel="Thông tin về Dâm Ngọc"
                content={DAM_NGOC_TOOLTIP_CONTENT}
              />
            </div>
            <div className="text-txt-secondary text-xs font-medium">Dâm Ngọc</div>
          </div>
        </div>
        <div className="flex">
          <div className="flex flex-1 flex-col items-center">
            <div className="text-txt-primary text-base font-semibold">
              {user.chaptersRead.toLocaleString() || 0}
            </div>
            <div className="text-txt-secondary text-xs font-medium">Chap đã đọc</div>
          </div>
          <div className="flex flex-1 flex-col items-center">
            <div className="text-txt-primary text-base font-semibold">
              {user.waifuCount || 0}
            </div>
            <div className="text-txt-secondary text-xs font-medium">Số Waifu</div>
          </div>
        </div>
        <div className="flex">
          <div className="flex flex-1 flex-col items-center">
            <div className="text-txt-primary text-base font-semibold">
              {user.mangasCount || 0}
            </div>
            <div className="text-txt-secondary text-xs font-medium">Truyện đã đăng</div>
          </div>
          <div className="flex flex-1 flex-col items-center">
            <div className="text-txt-primary text-base font-semibold">
              {user.mangasFollowing || 0}
            </div>
            <div className="text-txt-secondary text-xs font-medium">Đang theo dõi</div>
          </div>
        </div>
      </div>
    </div>
  );
}
