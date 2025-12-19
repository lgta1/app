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
import { cleanupUserSummonHistory } from "~/helpers/user.helper";
import { updateUserExp } from "~/helpers/user-level.helper";

const RATE_UP_PERCENT = 55;

const getExpValue = (star: number) => {
  if (star === 1) return 5;
  if (star === 2) return 10;
  return 0;
};

const processMilestoneReward = async (
  user: UserType,
  reachedMilestone: number,
  request?: Request,
) => {
  let exp = 0;
  let gold = 0;
  let itemStar = 1;

  if (reachedMilestone === 50) {
    gold = 50;
    exp = 25;
  } else if (reachedMilestone === 100) {
    gold = 100;
    exp = 50;
  } else if (reachedMilestone === 200) {
    gold = 200;
    itemStar = 4;
  } else if (reachedMilestone === 450) {
    itemStar = 5;
  }

  // Lấy thông tin user hiện tại trước khi update
  const currentUser = await UserModel.findById(user.id).lean();
  if (!currentUser) {
    throw new BusinessError("Không tìm thấy thông tin người dùng");
  }

  const { newExp, newLevel, didLevelUp } = updateUserExp(currentUser as UserType, exp);

  let updatedSession = null;
  if (didLevelUp) {
    // Nếu level up, cập nhật exp (reset), level và tăng gold
    await UserModel.updateOne(
      { _id: user.id },
      {
        $set: { exp: newExp, level: newLevel },
        $inc: { gold },
      },
    );

    // Cập nhật session khi level thay đổi
    if (request) {
      const session = await getUserSession(request);
      const updatedUser = { ...user, level: newLevel, exp: newExp };
      setUserDataToSession(session, updatedUser);
      updatedSession = session;
    }
  } else {
    // Nếu không level up, chỉ tăng exp và gold
    await UserModel.updateOne({ _id: user.id }, { $inc: { gold, exp } });
  }

  return { itemStar, updatedSession };
};

export const summon = async (
  user: UserType,
  banner: BannerType,
  cum: PityCumulativeType,
  request?: Request,
) => {
  let reachedMilestone: number | false = false;
  let updatedSession = null;

  if (banner.isRateUp) {
    const userFull = await UserModel.findOneAndUpdate(
      { _id: user.id },
      { $inc: { summonCount: 1 } },
      { new: true },
    ).lean();
    reachedMilestone = await checkEligibleGift(userFull?.summonCount ?? 0);
  }

  //   Get item star
  let itemStar = 1;
  if (reachedMilestone) {
    const milestoneResult = await processMilestoneReward(user, reachedMilestone, request);
    itemStar = milestoneResult.itemStar;
    updatedSession = milestoneResult.updatedSession;
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

    // Lấy thông tin user hiện tại trước khi update
    const currentUserForExp = await UserModel.findById(user.id).lean();
    if (!currentUserForExp) {
      throw new BusinessError("Không tìm thấy thông tin người dùng");
    }

    const { newExp, newLevel, didLevelUp } = updateUserExp(
      currentUserForExp as UserType,
      expValue,
    );

    if (didLevelUp) {
      // Nếu level up, cập nhật exp (reset) và level
      await UserModel.updateOne(
        { _id: user.id },
        { $set: { exp: newExp, level: newLevel } },
      );

      // Cập nhật session nếu có request
      if (request) {
        const session = await getUserSession(request);
        const updatedUser = { ...user, level: newLevel, exp: newExp };
        setUserDataToSession(session, updatedUser);
        updatedSession = session;
      }
    } else {
      // Nếu không level up, chỉ tăng exp
      await UserModel.updateOne({ _id: user.id }, { $inc: { exp: expValue } });
    }

    const expItem = await WaifuModel.findOne({ stars: itemStar }).lean();

    await cleanupUserSummonHistory(user.id, 50);

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

  await cleanupUserSummonHistory(user.id, 50);

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
    return milestone;
  }
  return false;
};
