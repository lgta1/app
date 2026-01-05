import { UserModel } from "~/database/models/user.model";
import { UserWaifuModel } from "~/database/models/user-waifu";
import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard.model";
import { WaifuModel } from "~/database/models/waifu.model";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";
import { normalizeWaifuImageUrl } from "~/.server/utils/waifu-image";

export const checkWaifuToUpdate = async (userId: string, waifuId: string) => {
  const userHasWaifu = await UserWaifuModel.findOne({ userId, waifuId });
  if (!userHasWaifu) {
    const user = await UserModel.findById(userId);
    const waifu = await WaifuModel.findById(waifuId).lean();

    const waifuImage = (() => {
      const normalized = normalizeWaifuImageUrl(waifu?.image);
      return normalized ?? (waifu?.image ? rewriteLegacyCdnUrl(String(waifu.image)) : waifu?.image);
    })();
    const userAvatar = user?.avatar ? rewriteLegacyCdnUrl(String(user.avatar)) : user?.avatar;

    await UserWaifuLeaderboardModel.findOneAndUpdate(
      {
        userId,
      },
      {
        $push: {
          waifuCollection: {
            waifuId: (waifu as any)?._id?.toString() ?? (waifu as any)?.id,
            name: waifu?.name,
            image: waifuImage,
            stars: waifu?.stars,
            expBuff: waifu?.expBuff,
            goldBuff: waifu?.goldBuff,
          },
        },
        $inc: {
          totalWaifu: 1,
          ...(waifu?.stars === 3 && { totalWaifu3Stars: 1 }),
          ...(waifu?.stars === 4 && { totalWaifu4Stars: 1 }),
          ...(waifu?.stars === 5 && { totalWaifu5Stars: 1 }),
        },
        $set: {
          userName: user?.name,
          userAvatar,
          userLevel: user?.level,
          userFaction: user?.faction,
          userGender: user?.gender,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
};
