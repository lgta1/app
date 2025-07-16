import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { ProfileInfo } from "~/components/profile-info";
import { ProfileMangaManagement } from "~/components/profile-manga-management";
import { UserModel } from "~/database/models/user.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard.model";
import { getMaxExp } from "~/helpers/user-level.helper";

export async function loader({ params }: LoaderFunctionArgs) {
  const userId = params.id;
  const userData = await UserModel.findById(userId)
    .select("name avatar createdAt level exp gold bio exp mangasCount faction gender")
    .lean();

  const maxExp = userData?.level === 9 ? "Tối đa" : getMaxExp(userData?.level || 1);

  const chaptersRead = await UserReadChapterModel.countDocuments({
    userId: userId,
  });

  const mangasFollowing = await UserFollowMangaModel.countDocuments({
    userId: userId,
  });

  const userWaifuLeaderboard = await UserWaifuLeaderboardModel.findOne({
    userId: userId,
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
      <ProfileInfo user={user} isOwner={false} />

      {/* Waifu Collection Section */}
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/icons/multi-star.svg" alt="star" />
            <h2 className="text-xl font-semibold text-white uppercase">
              bộ sưu tập waifu
            </h2>
          </div>
        </div>
        <div className="flex gap-4 md:overflow-x-hidden lg:gap-6">
          {user.waifuCollection.map((image: string, index: number) => (
            <img
              key={index}
              className="aspect-2/3 h-40 rounded-lg object-cover sm:h-48 lg:h-50"
              src={image}
              alt={`Waifu ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <ProfileMangaManagement userId={user.id} />
    </div>
  );
}
