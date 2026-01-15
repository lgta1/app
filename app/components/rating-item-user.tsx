import { Link } from "react-router-dom";
import { isMobile } from "react-device-detect";
import { User as UserIcon } from "lucide-react";

import type { UserType } from "~/database/models/user.model";
import { getAvatarPath, getTitleImgPath } from "~/helpers/user.helper";
import { getLevelDisplayTitle, getMaxExp, MAX_LEVEL } from "~/helpers/user-level.helper";

export default function RatingItemUser({
  user,
  index,
}: {
  user: UserType;
  index: number;
}) {
  const color =
    (index === 1 && "text-[#FFE133]") ||
    (index === 2 && "text-[#5BD8FA]") ||
    (index === 3 && "text-[#FF7158]") ||
    "text-txt-primary";

  const avatarUrl = getAvatarPath(user);
  const levelTitle = getLevelDisplayTitle(user.level, (user as any).exp);
  const displayName = levelTitle ? `${user.name} - ${levelTitle}` : user.name;

  const level = Math.max(1, Number(user.level) || 1);
  const exp = Math.max(0, Number(user.exp) || 0);
  const isMaxLevel = level >= MAX_LEVEL;
  const maxExpValue = isMaxLevel ? null : getMaxExp(level);
  const expPercent = isMaxLevel
    ? 100
    : Math.min(100, (exp / Math.max(1, Number(maxExpValue) || 1)) * 100);

  const Wrapper: any = isMobile ? "a" : Link;
  const linkProps = isMobile ? { href: `/profile/${user.id}` } : { to: `/profile/${user.id}` };

  return (
    <Wrapper {...linkProps} className="flex items-center gap-3 p-3">
      <span className={`w-5 text-center text-base font-semibold ${color}`}>{index}</span>

      {/* ✅ Avatar tròn hoàn toàn, cùng size h-14 w-14 */}
      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-[#121826] flex items-center justify-center">
        {/* Icon lucide fallback (hiện khi chưa upload ảnh hoặc ảnh lỗi) */}
        <UserIcon className="h-7 w-7 text-txt-primary" />
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user.name}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
      </div>

      <div className="flex-1 space-y-2">
        <h3 className="text-txt-primary text-base leading-6 font-semibold">
          {displayName}
        </h3>

        <div className="flex items-center gap-4">
          {/* Badge giữ tỉ lệ, mobile x2 / desktop x1.5 */}
          {user && (
            <span className="relative inline-flex h-6 overflow-visible flex-shrink-0 align-middle">
              <img
                src={getTitleImgPath(user)}
                alt="Title"
                className="block h-full w-auto object-contain"
                style={{
                  transform: "scale(2)", // mobile default
                  transformOrigin: "center",
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <style>
                {`
                  @media (min-width: 1024px) {
                    .relative.inline-flex.h-6.overflow-visible img {
                      transform: scale(1.5);
                    }
                  }
                `}
              </style>
            </span>
          )}

          <div className="flex-1 flex items-center align-middle">
            <div className="bg-bgc-layer2 h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full w-full rounded-full bg-gradient-to-r from-[#3D1351] to-[#E8B5FF]"
                style={{ width: `${expPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
