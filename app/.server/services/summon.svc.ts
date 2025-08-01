import Promise from "bluebird";

import { checkWaifuToUpdate } from "@/mutations/user-waifu-leaderboard";

import { getUserSession, setUserDataToSession } from "./session.svc";

import { GIFT_MILESTONES } from "~/constants/summon";
import { type BannerType } from "~/database/models/banner.model";
import { type PityCumulativeType } from "~/database/models/pity-cumulative.model";
import { UserModel, type UserType } from "~/database/models/user.model";
import { UserWaifuModel } from "~/database/models/user-waifu";
import { WaifuModel } from "~/database/models/waifu.model";
import { BusinessError } from "~/helpers/errors.helper";
import { updateUserExp } from "~/helpers/user-level.helper";

const RATE_UP_PERCENT = 55;

const getExpValue = (star: number) => {
  if (star === 1) return 5;
  if (star === 2) return 10;
  return 0;
};

export const summon = async (
  user: UserType,
  banner: BannerType,
  cum: PityCumulativeType,
  request?: Request,
) => {
  let eligibleGift = false;
  let updatedSession = null;

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

    const userFull = await UserModel.findOneAndUpdate(
      { _id: user.id },
      { $inc: { exp: expValue } },
    ).lean();

    const { newLevel } = updateUserExp(userFull as UserType, expValue);

    if (userFull?.level && newLevel > userFull?.level) {
      await UserModel.updateOne({ _id: user.id }, { $set: { level: newLevel } });

      // Cập nhật session nếu có request
      if (request) {
        const session = await getUserSession(request);
        const updatedUser = { ...user, level: newLevel };
        setUserDataToSession(session, updatedUser);
        updatedSession = session;
      }
    }

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
      updatedSession,
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
    updatedSession,
  };
};

export const multiSummon = async (
  user: UserType,
  banner: BannerType,
  cum: PityCumulativeType,
  count: number,
  request?: Request,
) => {
  const summons = Array(count).fill(null);

  const summonResults: any[] = [];

  await Promise.each(summons, async () => {
    const result = await summon(user, banner, cum, request);
    summonResults.push(result);
  });

  // Tìm session đã được update (nếu có)
  const updatedSession =
    summonResults.findLast((result) => result.updatedSession)?.updatedSession || null;

  return {
    items: summonResults,
    updatedSession,
  };
};

const checkEligibleGift = async (currentSummonCount: number) => {
  const summonCount = currentSummonCount;
  const milestone = GIFT_MILESTONES.find((milestone) => milestone === summonCount);
  if (milestone) {
    return true;
  }
  return false;
};
