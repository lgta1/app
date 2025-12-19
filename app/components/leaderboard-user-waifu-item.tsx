import { isMobile } from "react-device-detect";
import { Link } from "react-router-dom";
import { User as UserIcon } from "lucide-react";

import type { UserWaifuLeaderboardType } from "~/database/models/user-waifu-leaderboard.model";
import { getTitleImgPath } from "~/helpers/user.helper";

export default function LeaderboardUserWaifuItem({
  leaderboard,
  index,
}: {
  leaderboard: UserWaifuLeaderboardType;
  index: number;
}) {
  const color =
    (index === 1 && "text-[#FFE133] text-2xl") ||
    (index === 2 && "text-[#5BD8FA] text-2xl") ||
    (index === 3 && "text-[#FF7158] text-2xl") ||
    "text-txt-primary text-base";

  const renderWaifuList = () => {
    if (![1, 2, 3].includes(index)) return null;

    const waifuList = leaderboard.waifuCollection?.sort((a, b) => b.stars - a.stars);
    const topWaifu = isMobile ? waifuList?.slice(0, 3) : waifuList?.slice(0, 6);
    return (
      <div className="border-bd-default flex items-center justify-center gap-4 border-t p-4">
        {topWaifu?.map((waifu) => (
          <img
            key={waifu.name}
            src={waifu.image}
            alt={waifu.name}
            className="aspect-2/3 w-[100px] rounded-lg"
          />
        ))}
      </div>
    );
  };

  const avatarUrl = leaderboard.userAvatar;
  const showIcon = !avatarUrl;

  const Wrapper: any = isMobile ? "a" : Link;
  const linkProps = isMobile ? { href: `/profile/${leaderboard.userId}` } : { to: `/profile/${leaderboard.userId}` };

  return (
    <Wrapper {...linkProps} className="border-bd-default inline-flex flex-col items-start justify-start self-stretch overflow-hidden rounded-xl border">
      <div className="bg-background-layer-1 flex flex-col items-start justify-center gap-4 self-stretch overflow-hidden p-3 md:flex-row md:justify-between md:gap-3">
        {/* User Info Section */}
        <div className="inline-flex items-center justify-start gap-3">
          <div
            className={`min-w-8 justify-center text-center leading-normal font-semibold ${color}`}
          >
            {index.toString().padStart(2, "0")}
          </div>

          {/* AVATAR: fallback icon lucide khi rỗng/ảnh lỗi (giữ khung cũ, không đổi layout) */}
          <div className="h-14 w-14 overflow-hidden rounded bg-gradient-to-b from-gray-900/0 to-gray-900 flex items-center justify-center">
            {showIcon ? (
              <UserIcon className="h-7 w-7 text-txt-primary" />
            ) : (
              <img
                className="h-full w-full object-cover"
                src={avatarUrl}
                alt={leaderboard.userName}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </div>

          <div className="inline-flex w-36 flex-col items-start justify-start gap-1">
            <div className="text-text-text-primary h-6 justify-center self-stretch text-base leading-normal font-semibold">
              {leaderboard.userName}
            </div>

            {/* BADGE/TITLE: bỏ w-28; giữ tỉ lệ gốc; mobile x2 / desktop x1.5; không làm to khung */}
            <span className="relative inline-flex h-6 overflow-visible">
              <img
                className="block h-full w-auto object-contain"
                src={getTitleImgPath({
                  level: leaderboard.userLevel,
                  faction: leaderboard.userFaction,
                  gender: leaderboard.userGender,
                } as any)}
                alt="Title"
                style={{
                  transform: "scale(2)", // mặc định mobile
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
          </div>
        </div>

        {/* Stats Section */}
        <div className="flex w-full items-center justify-between gap-2 overflow-x-auto sm:gap-4 md:w-auto md:overflow-x-visible">
          <div className="inline-flex min-w-20 flex-col items-start justify-start gap-1 sm:min-w-24">
            <div className="text-text-text-secondary justify-center text-xs leading-none font-medium">
              Tổng số Waifu
            </div>
            <div className="text-text-text-primary justify-center text-base leading-normal font-medium">
              {leaderboard.totalWaifu}
            </div>
          </div>
          <div className="inline-flex min-w-20 flex-col items-start justify-start gap-1 sm:min-w-24">
            <div className="text-text-text-secondary justify-center text-xs leading-none font-medium">
              Waifu 5 sao
            </div>
            <div className="text-text-text-primary justify-center text-base leading-normal font-medium">
              {leaderboard.totalWaifu5Stars}
            </div>
          </div>
          <div className="inline-flex min-w-20 flex-col items-start justify-start gap-1 sm:min-w-24">
            <div className="text-text-text-secondary justify-center text-xs leading-none font-medium">
              Waifu 4 sao
            </div>
            <div className="text-text-text-primary justify-center text-base leading-normal font-medium">
              {leaderboard.totalWaifu4Stars}
            </div>
          </div>
          <div className="inline-flex min-w-20 flex-col items-start justify-start gap-1 sm:min-w-24">
            <div className="text-text-text-secondary justify-center text-xs leading-none font-medium">
              Waifu 3 sao
            </div>
            <div className="text-text-text-primary justify-center text-base leading-normal font-medium">
              {leaderboard.totalWaifu3Stars}
            </div>
          </div>
        </div>
      </div>

      {/* Waifu List */}
      {renderWaifuList()}
    </Wrapper>
  );
}
