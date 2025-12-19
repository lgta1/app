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
  {
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
      // Nếu level up, cập nhật exp (reset theo level) và level
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
      // Nếu không level up, chỉ tăng exp (in-level)
      await UserModel.updateOne({ _id: user.id }, { $inc: { exp: expValue } });
    }

    const expItem = await WaifuModel.findOne({ stars: itemStar }).lean();

    await cleanupUserSummonHistory(user.id, 50);

    // Debug: log exp item created
    try {
      // eslint-disable-next-line no-console
      console.log(`[summon.svc] creating EXP item for user=${user.id} expItemId=${expItem?.id} name=${expItem?.name}`);
    } catch {}

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
      milestoneReached: reachedMilestone || null,
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

  try {
    // Debug: log before checking/updating leaderboard
    // eslint-disable-next-line no-console
    console.log(`[summon.svc] will checkWaifuToUpdate user=${user.id} waifuId=${waifu?.id} name=${waifu?.name} image=${waifu?.image}`);
  } catch {}

  await checkWaifuToUpdate(user.id, waifu.id);

  await cleanupUserSummonHistory(user.id, 50);


  const created = await UserWaifuModel.create({
    bannerId: banner.id,
    userId: user.id,
    waifuId: waifu.id,
    waifuName: waifu.name,
    waifuStars: waifu.stars,
  });

  try {
    // Debug: confirm creation and show the stored waifuId (string)
    // eslint-disable-next-line no-console
    console.log(`[summon.svc] created UserWaifu id=${(created as any)?._id?.toString()} waifuId=${(created as any)?.waifuId} for user=${user.id}`);
  } catch {}

  return {
    type: "waifu",
    itemStar,
    item: waifu,
    updatedSession,
    milestoneReached: reachedMilestone || null,
  };
};

// Guaranteed summon used by milestone claim: one free roll, forced star, affects summonCount and can chain milestones
export const summonGuaranteedWaifu = async (
  user: UserType,
  banner: BannerType,
  starWanted: number,
) => {
  try {
    // eslint-disable-next-line no-console
    console.log(`[summonGuaranteedWaifu] start user=${user.id} banner=${banner.id} star=${starWanted}`);
  } catch {}
  // Increase summonCount like a real summon (accept chain milestone behavior)
  const userFull = await UserModel.findOneAndUpdate(
    { _id: user.id },
    { $inc: { summonCount: 1 } },
    { new: true },
  ).lean();

  // Pick waifu by forced stars
  // 1) Ưu tiên danh sách banner nếu có (đảm bảo đúng theme sự kiện)
  let waifu: any = null;
  try {
    const candidates = (banner?.waifuList || []).filter((w: any) => Number(w?.stars) === Number(starWanted));
    if (candidates.length > 0) {
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      const chosenId = (chosen as any)?.id?.toString?.() ?? (chosen as any)?.id;
      if (chosenId) {
        waifu = await WaifuModel.findById(chosenId).lean();
      }
    }
  } catch {}

  // 2) Fallback global pool nếu banner rỗng hoặc waifu bị thiếu
  if (!waifu) {
    const waifuCount = await WaifuModel.countDocuments({ stars: starWanted });
    if (waifuCount <= 0) throw new BusinessError("Không tìm thấy waifu phù hợp");
    const waifuPool = await WaifuModel.find({ stars: starWanted })
      .select(["_id", "name", "image", "stars"]).limit(50).lean();
    if (!waifuPool || waifuPool.length === 0) throw new BusinessError("Không tìm thấy waifu phù hợp");
    waifu = waifuPool[Math.floor(Math.random() * waifuPool.length)];
  }
  if (!waifu) throw new BusinessError("Không tìm thấy waifu");

  try {
    // eslint-disable-next-line no-console
    console.log(`[summonGuaranteedWaifu] picked waifu id=${(waifu as any)?._id?.toString() ?? (waifu as any)?.id} name=${waifu?.name}`);
  } catch {}

  const waifuIdStr = (waifu as any)?._id?.toString?.() ?? (waifu as any)?.id;
  if (!waifuIdStr) throw new BusinessError("Thiếu mã waifu");
  await checkWaifuToUpdate(user.id, waifuIdStr);
  await cleanupUserSummonHistory(user.id, 50);

  const bannerIdStr = (banner as any)?._id?.toString?.() ?? (banner as any)?.id;
  if (!bannerIdStr) throw new BusinessError("Thiếu bannerId");
  const created = await UserWaifuModel.create({
    bannerId: bannerIdStr,
    userId: user.id,
    waifuId: waifuIdStr,
    waifuName: waifu.name,
    waifuStars: waifu.stars,
  });

  try {
    // eslint-disable-next-line no-console
    console.log(`[summonGuaranteedWaifu] created UserWaifu id=${(created as any)?._id?.toString()} waifuId=${(created as any)?.waifuId}`);
  } catch {}

  // Check if new milestone reached due to this free roll
  const reachedMilestone = await (async () => {
    const sc = (userFull?.summonCount ?? 0);
    const milestone = GIFT_MILESTONES.find((m: number) => m === sc);
    return milestone || null;
  })();

  return {
    type: "waifu" as const,
    itemStar: starWanted,
    item: waifu,
    milestoneReached: reachedMilestone,
    createdUserWaifuId: (created as any)?._id?.toString?.() ?? null,
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
  const milestone = GIFT_MILESTONES.find((milestone: number) => milestone === summonCount);
  if (milestone) {
    return milestone;
  }
  return false;
};
