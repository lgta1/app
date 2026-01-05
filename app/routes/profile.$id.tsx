import { isValidObjectId } from "mongoose";
import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useState } from "react";

import { getUserInfoFromSession } from "@/services/session.svc";
import { ProfileOwnerView } from "~/components/profile-owner-view";
import { ProfileInfo } from "~/components/profile-info";
import { ProfileMangaUploadedPublic } from "~/components/profile-manga-uploaded-public";
import { UserModel } from "~/database/models/user.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard.model";
import { UserWaifuModel } from "~/database/models/user-waifu";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";
import { normalizeWaifuImageUrl } from "~/.server/utils/waifu-image";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = params.id;
  if (!userId || !isValidObjectId(userId)) {
    throw new Response("User not found", { status: 404 });
  }
  const sessionUser = await getUserInfoFromSession(request);
  const isOwner = !!sessionUser && sessionUser.id === userId;

  const userData = await UserModel.findById(userId)
    .select("name avatar createdAt level exp gold bio exp mangasCount faction gender")
    .lean();
  if (!userData) {
    throw new Response("User not found", { status: 404 });
  }
  const userIdString = String(userData?._id || userId);

  const chaptersRead = await UserReadChapterModel.countDocuments({
    userId,
  });

  const mangasFollowing = await UserFollowMangaModel.countDocuments({
    userId,
  });

  const userWaifuLeaderboard = await UserWaifuLeaderboardModel.findOne({
    userId,
  })
    .select("waifuCollection totalWaifu")
    .lean();

  let waifuCollection = Array.isArray(userWaifuLeaderboard?.waifuCollection)
    ? [...userWaifuLeaderboard.waifuCollection].sort((a: any, b: any) => (b?.stars || 0) - (a?.stars || 0))
    : [];

  if (waifuCollection.length) {
    waifuCollection = waifuCollection.map((w: any) => {
      const nextImg = normalizeWaifuImageUrl(w?.image);
      return nextImg ? { ...w, image: nextImg } : w;
    });
  }

  if (waifuCollection.length && isOwner) {
    waifuCollection = await Promise.all(
      waifuCollection.map(async (waifu: any) => {
        const waifuCount = await UserWaifuModel.countDocuments({
          userId,
          waifuId: waifu.waifuId,
        });

        return {
          ...waifu,
          count: waifuCount,
        };
      }),
    );
  }

  const waifuCount = userWaifuLeaderboard?.totalWaifu || 0;
  const userFull = await UserModel.findById(userId)
    .select("currentWaifu")
    .populate("currentWaifu")
    .lean();
  const currentWaifu = (() => {
    const cw: any = userFull?.currentWaifu || null;
    if (cw && typeof cw === "object") {
      const nextImg = normalizeWaifuImageUrl((cw as any).image);
      if (nextImg) (cw as any).image = nextImg;
    }
    return cw;
  })();

  return {
    profileUser: {
      ...userData,
      avatar: typeof (userData as any)?.avatar === "string" ? rewriteLegacyCdnUrl((userData as any).avatar) : (userData as any)?.avatar,
      id: userIdString,
      waifuCollection,
      waifuCount,
      currentWaifu,
      chaptersRead,
      mangasFollowing,
    },
    isOwner,
  };
}

export default function Profile() {
  const { profileUser, isOwner } = useLoaderData<typeof loader>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (isOwner) {
    return <ProfileOwnerView user={profileUser} />;
  }

  const waifuSlots = Array.from({ length: 4 }, (_, idx) => {
    const entry = profileUser.waifuCollection?.[idx];
    if (!entry) return null;
    if (typeof entry === "string") return entry;
    return (entry as any).image ?? null;
  });

  // Mobile: chạm vào 1 ảnh -> bật hiệu ứng giống hover trong 500ms
  const handleTap = (index: number) => {
    setActiveIndex(index);
    setTimeout(() => setActiveIndex(null), 500);
  };

  return (
    <div className="mx-auto flex w-full max-w-[968px] flex-col items-center gap-6 p-4 lg:py-8">
      <ProfileInfo user={profileUser} isOwner={false} />

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

        <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
          {waifuSlots.map((image: string | null, index: number) => {
            const isActive = activeIndex === index;
            if (!image) {
              return (
                <div
                  key={`slot-${index}`}
                  className="aspect-[2/3] w-full rounded-lg border border-dashed border-white/10 bg-white/5"
                />
              );
            }

            return (
              <div
                key={`slot-${index}`}
                onTouchStart={() => handleTap(index)}
                onClick={() => handleTap(index)}
                className={`aspect-[2/3] w-full overflow-hidden rounded-lg transition-all duration-300 ${
                  isActive
                    ? "scale-105 shadow-[0_0_12px_rgba(146,53,190,0.6)] ring-2 ring-lav-500"
                    : "hover:scale-105 hover:shadow-[0_0_12px_rgba(146,53,190,0.6)] hover:ring-2 hover:ring-lav-500"
                }`}
              >
                <img
                  src={image}
                  alt={`Waifu ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            );
          })}
        </div>
      </div>

      <ProfileMangaUploadedPublic userId={profileUser.id} />
    </div>
  );
}
