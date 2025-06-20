import { checkWaifuToUpdate } from "@/mutations/user-waifu-leaderboard";

import { GIFT_MILESTONES } from "~/constants/summon";
import { type BannerType } from "~/database/models/banner.model";
import { type PityCumulativeType } from "~/database/models/pity-cumulative.model";
import { UserModel, type UserType } from "~/database/models/user.model";
import { UserWaifuModel } from "~/database/models/user-waifu";
import { WaifuModel } from "~/database/models/waifu.model";
import { BusinessError } from "~/helpers/errors.helper";
import { updateUserExp } from "~/helpers/user-level.helper";

const RATE_UP_PERCENT = 55;
const EXP_VALUE_1_STAR = [5, 10];
const EXP_VALUE_2_STAR = [10, 20];

const getExpValue = (star: number) => {
  if (star === 1)
    return (
      Math.floor(Math.random() * (EXP_VALUE_1_STAR[1] - EXP_VALUE_1_STAR[0] + 1)) +
      EXP_VALUE_1_STAR[0]
    );
  if (star === 2)
    return (
      Math.floor(Math.random() * (EXP_VALUE_2_STAR[1] - EXP_VALUE_2_STAR[0] + 1)) +
      EXP_VALUE_2_STAR[0]
    );
  return 0;
};

export const summon = async (
  user: UserType,
  banner: BannerType,
  cum: PityCumulativeType,
) => {
  let eligibleGift = false;
  if (banner.isRateUp) {
    const userFull = await UserModel.findOneAndUpdate(
      { _id: user.id },
      { $inc: { summonCount: 1 } },
      { new: true },
    ).lean();
    eligibleGift = await checkEligibleGift(userFull?.summonCount ?? 0);
  }

  //   Get item star
  let itemStar = 1;
  if (eligibleGift) {
    itemStar = 5;
  } else {
    const r = Math.random() * 100;
    for (let i = 0; i < cum.rates.length; i++) {
      if (r < cum.rates[i]) {
        itemStar = i + 1;
        break;
      }
    }
  }

  //   Get item exp
  if (itemStar < 3) {
    const expValue = getExpValue(itemStar);

    const { newExp, newLevel } = updateUserExp(user, expValue);

    await UserModel.updateOne({ _id: user.id }, { $set: { exp: newExp } });
    // temp console.log("🚀 ~ level: newLevel:", level: newLevel)

    const expItem = await WaifuModel.findOne({ stars: itemStar }).lean();

    await UserWaifuModel.create({
      bannerId: banner.id,
      userId: user.id,
      waifuId: expItem?.id,
      waifuName: expItem?.name,
      waifuStars: expItem?.stars,
    });

    return {
      type: "exp",
      itemStar,
      item: expItem,
      expValue,
    };
  }

  //   Get item waifu
  let waifu;
  if (banner?.isRateUp && Math.random() * 100 < RATE_UP_PERCENT) {
    const waifuRateUpList = banner.waifuList.filter((waifu) => waifu.stars === itemStar);
    if (waifuRateUpList.length > 0) {
      waifu = waifuRateUpList[Math.floor(Math.random() * waifuRateUpList.length)];
    }
  }
  if (!waifu) {
    const waifuCount = await WaifuModel.countDocuments({ stars: itemStar });
    const waifuIndex = Math.floor(Math.random() * waifuCount);
    waifu = await WaifuModel.findOne({ stars: itemStar }).skip(waifuIndex).lean();
  }

  if (!waifu) throw new BusinessError("Không tìm thấy waifu");

  await checkWaifuToUpdate(user.id, waifu.id);

  await UserWaifuModel.create({
    bannerId: banner.id,
    userId: user.id,
    waifuId: waifu.id,
    waifuName: waifu.name,
    waifuStars: waifu.stars,
  });

  return {
    type: "waifu",
    itemStar,
    item: waifu,
  };
};

export const multiSummon = async (
  user: UserType,
  banner: BannerType,
  cum: PityCumulativeType,
  count: number,
) => {
  const summons = Array(count)
    .fill(null)
    .map(() => summon(user, banner, cum));

  const summonResults = await Promise.all(summons);

  return summonResults;
};

const checkEligibleGift = async (currentSummonCount: number) => {
  const summonCount = currentSummonCount;
  const milestone = GIFT_MILESTONES.find((milestone) => milestone === summonCount);
  if (milestone) {
    return true;
  }
  return false;
};
