import { type LoaderFunctionArgs, NavLink } from "react-router";
import { useLoaderData } from "react-router";
import { Edit3, Eye } from "lucide-react";

import { requireLogin } from "@/services/auth.server";

import { ProfileMangaManagement } from "~/components/profile-manga-management";
import { ProfileRecentComment } from "~/components/profile-recent-comment";
import { UserModel, type UserType } from "~/database/models/user.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard.model";
import { getTitleImgPath } from "~/helpers/user.helper";
import { getMaxExp } from "~/helpers/user-level.helper";
import { formatDate } from "~/utils/date.utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const userSession = await requireLogin(request);
  const userData = await UserModel.findById(userSession.id)
    .select("name avatar createdAt level exp gold bio exp mangasCount faction gender")
    .lean();

  const maxExp = userData?.level === 9 ? "Tối đa" : getMaxExp(userData?.level || 1);

  const chaptersRead = await UserReadChapterModel.countDocuments({
    userId: userSession.id,
  });

  const mangasFollowing = await UserFollowMangaModel.countDocuments({
    userId: userSession.id,
  });

  const userWaifuLeaderboard = await UserWaifuLeaderboardModel.findOne({
    userId: userSession.id,
  }).select("waifuCollection totalWaifu");

  const waifuCollection =
    userWaifuLeaderboard?.waifuCollection
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 6)
      .map((waifu) => waifu.image) || [];

  const waifuCount = userWaifuLeaderboard?.totalWaifu || 0;

  return {
    ...userData,
    waifuCollection,
    waifuCount,
    chaptersRead,
    mangasFollowing,
    maxExp,
  };
}

export default function Profile() {
  const user = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto flex w-full max-w-[968px] flex-col items-center gap-6 p-4 lg:py-8">
      {/* Profile Info Section */}
      <div className="bg-bgc-layer1 border-bd-default flex w-full flex-col gap-6 rounded-xl border p-4 lg:flex-row lg:p-6">
        {/* Left Section - User Info */}
        <div className="flex flex-1 gap-4 lg:max-w-[514px]">
          <img
            className="h-16 w-16 rounded-full object-cover lg:h-24 lg:w-24"
            src={user.avatar}
            alt={user.name}
          />
          <div className="flex flex-1 flex-col gap-3">
            {/* Name and Badge */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="text-txt-primary font-sans text-lg font-semibold lg:text-xl">
                  {user.name}
                </h1>
                <img
                  className="h-6 w-20 lg:h-8 lg:w-28"
                  src={getTitleImgPath(user as UserType)}
                  alt="User Badge"
                />
              </div>
              <p className="text-txt-secondary text-xs font-medium">
                Ngày đăng ký: {formatDate(user.createdAt || new Date())}
              </p>
            </div>

            {/* Experience Bar */}
            <div className="flex items-center gap-1.5">
              <img
                className="h-8 w-10 lg:h-10 lg:w-12"
                src="/images/icons/exp.png"
                alt="EXP Icon"
              />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-txt-primary text-xs font-medium">
                    Kinh nghiệm
                  </span>
                  <span className="text-txt-primary text-xs font-medium">
                    {user.exp}/{user.maxExp}
                  </span>
                </div>
                <div className="bg-bgc-layer2 h-2 overflow-hidden rounded">
                  <div
                    className="via-lav-500 h-2 rounded bg-gradient-to-r from-[#3D1351] to-[#E8B5FF]"
                    style={{
                      width: `${((user.exp || 0) / (user.maxExp as any)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bio Section */}
            <div className="flex flex-col gap-[5px]">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Giới thiệu</h2>
                <NavLink to="/profile-edit">
                  <Edit3 className="text-success-success h-4 w-4" />
                </NavLink>
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
                <img
                  className="h-5 w-6"
                  src="/images/icons/gold-icon.png"
                  alt="Dâm Ngọc"
                />
                <div className="text-txt-primary text-base font-semibold">
                  {user.gold?.toLocaleString()}
                </div>
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
              <div className="text-txt-secondary text-xs font-medium">
                Truyện theo dõi
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Waifu Collection Section */}
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/icons/multi-star.svg" alt="star" />
            <h2 className="text-xl font-semibold text-white uppercase">
              bộ sưu tập waifu
            </h2>
          </div>
          <button className="border-lav-500 flex items-center gap-1.5 rounded-xl border px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)]">
            <Eye className="text-lav-500 h-5 w-5" />
            <span className="text-txt-focus text-sm font-semibold">Xem tất cả</span>
          </button>
        </div>
        <div className="flex gap-4 overflow-x-scroll md:overflow-x-hidden lg:gap-6">
          {user.waifuCollection.map((image: string, index: number) => (
            <img
              key={index}
              className="aspect-2/3 h-40 w-full rounded-lg object-cover sm:h-48 lg:h-50"
              src={image}
              alt={`Waifu ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <ProfileMangaManagement />

      <ProfileRecentComment />
    </div>
  );
}
