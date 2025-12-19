import { Link } from "react-router-dom";
import { User as UserIcon } from "lucide-react";

import type { UserType } from "~/database/models/user.model";
import { getAvatarPath, getTitleImgPath } from "~/helpers/user.helper";
import { getMaxExp, MAX_LEVEL } from "~/helpers/user-level.helper";

interface LeaderboardTopUserProps {
  user: UserType;
  gradientStyle: string;
  borderColor: string;
  shadowColor: string;
}

export function LeaderboardTopUser({
  user,
  gradientStyle,
  borderColor,
  shadowColor,
}: LeaderboardTopUserProps) {
  const avatarUrl = getAvatarPath(user);
  const showIcon = !avatarUrl;

  const level = Math.max(1, Number(user.level) || 1);
  const exp = Math.max(0, Number((user as any).exp) || 0);
  const isMaxLevel = level >= MAX_LEVEL;
  const maxExpValue = isMaxLevel ? null : getMaxExp(level);
  const expPercent = isMaxLevel
    ? 100
    : Math.min(100, (exp / Math.max(1, Number(maxExpValue) || 1)) * 100);

  return (
    <Link
      to={`/profile/${user.id}`}
      className={`p-4 ${gradientStyle} rounded-2xl ${shadowColor} outline-1 outline-offset-[-1px] ${borderColor} flex items-start justify-start gap-4 backdrop-blur`}
    >
      <div className="flex items-center justify-start gap-4">
        <div className="relative h-24 w-24 overflow-hidden rounded bg-gradient-to-b from-gray-900/0 to-gray-900 flex items-center justify-center">
          {showIcon ? (
            <UserIcon className="h-10 w-10 text-txt-primary" />
          ) : (
            <img
              src={avatarUrl}
              alt={user.name}
              className="h-full w-full object-cover"
              onError={(e) => {
                // ẩn ảnh hỏng để lộ icon nền
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>

        <div className="inline-flex flex-col items-start justify-start gap-3">
          <div className="text-txt-primary w-44 justify-center text-base font-semibold">
            {user.name}
          </div>

          <div className="flex flex-col items-start justify-start gap-2 self-stretch">
            {user && (
              <div className="flex items-center gap-3 self-stretch">
                <span className="relative inline-flex h-6 overflow-visible">
                  <img
                    src={getTitleImgPath(user)}
                    alt="Title"
                    className="block h-full w-auto object-contain"
                    style={{
                      transform: "scale(2)",
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

                <div className="flex-1 flex items-center gap-2">
                  <div className="bg-bgc-layer2 h-2 w-full overflow-hidden rounded-full">
                    <div
                      className="h-full w-full rounded-full bg-gradient-to-r from-[#3D1351] to-[#E8B5FF]"
                      style={{ width: `${expPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
