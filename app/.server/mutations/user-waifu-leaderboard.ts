import { UserModel } from "~/database/models/user.model";
import { UserWaifuModel } from "~/database/models/user-waifu";
import { UserWaifuLeaderboardModel } from "~/database/models/user-waifu-leaderboard.model";
import { WaifuModel } from "~/database/models/waifu.model";

export const checkWaifuToUpdate = async (userId: string, waifuId: string) => {
  const userHasWaifu = await UserWaifuModel.findOne({ userId, waifuId });
  if (!userHasWaifu) {
    const user = await UserModel.findById(userId);
    const waifu = await WaifuModel.findById(waifuId);
    await UserWaifuLeaderboardModel.findOneAndUpdate(
      {
        userId,
      },
      {
        $push: {
          waifuCollection: {
            name: waifu?.name,
            image: waifu?.image,
            stars: waifu?.stars,
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
          userAvatar: user?.avatar,
          userLevel: user?.level,
          userFaction: user?.faction,
          userGender: user?.gender,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
};
