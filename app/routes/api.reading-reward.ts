import type { ActionFunctionArgs } from "react-router";

import { createNotification } from "@/mutations/notification.mutation";
import { getUserInfoFromSession } from "@/services/session.svc";

import { ReadingRewardModel } from "~/database/models/reading-reward.model";
import { UserModel } from "~/database/models/user.model";

const GOLD_REWARD_CHANCE = 0.25;

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json(
        { success: false, error: "Vui lòng đăng nhập" },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "claim-reading-reward") {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000); // 1 phút trước

      // Sử dụng findOneAndUpdate atomic operation để check và update
      // Chỉ cho phép claim nếu:
      // 1. Chưa có record hôm nay HOẶC
      // 2. Record hôm nay có rewardCount < 10 VÀ updatedAt cách đây ít nhất 1 phút
      const currentReward = await ReadingRewardModel.findOneAndUpdate(
        {
          userId: user.id,
          date: today,
          $and: [
            {
              $or: [
                { rewardCount: { $lt: 10 } }, // Chưa đủ 10 lần
                { rewardCount: { $exists: false } }, // Chưa có record
              ],
            },
            {
              $or: [
                { updatedAt: { $lt: oneMinuteAgo } }, // Lần cuối update cách đây ít nhất 1 phút
                { updatedAt: { $exists: false } }, // Chưa có record
              ],
            },
          ],
        },
        {},
        {
          new: false, // Trả về document cũ để check
          upsert: false, // Không tạo mới nếu không tìm thấy
        },
      );

      // Nếu không tìm thấy record phù hợp = bị rate limit hoặc đã đủ 10 lần
      if (!currentReward) {
        // Kiểm tra xem là do rate limit hay do đã đủ 10 lần
        const existingRecord = await ReadingRewardModel.findOne({
          userId: user.id,
          date: today,
        });

        if (existingRecord) {
          if (existingRecord.rewardCount >= 10) {
            return Response.json({
              success: false,
              error: "Bạn đã nhận đủ 10 lần vàng hôm nay!",
            });
          } else {
            // Rate limited
            const timeSinceLastUpdate =
              now.getTime() - existingRecord.updatedAt.getTime();
            const remainingSeconds = Math.ceil((60000 - timeSinceLastUpdate) / 1000);
            return Response.json({
              success: false,
              error: `Vui lòng chờ ${remainingSeconds} giây nữa mới có thể thử lại!`,
            });
          }
        }
      }

      const currentRewardCount = currentReward?.rewardCount || 0;

      // Double check giới hạn 10 lần/ngày (extra safety)
      if (currentRewardCount >= 10) {
        return Response.json({
          success: false,
          error: "Bạn đã nhận đủ 10 lần vàng hôm nay!",
        });
      }

      // Random 15% chance
      const isRewardGranted = Math.random() < GOLD_REWARD_CHANCE;

      if (!isRewardGranted) {
        // Cập nhật timestamp ngay cả khi không trúng để tránh spam
        await ReadingRewardModel.findOneAndUpdate(
          { userId: user.id, date: today },
          {
            $setOnInsert: { rewardCount: 0 },
            $set: { updatedAt: new Date() },
          },
          { upsert: true },
        );

        return Response.json({
          success: false,
          error: "Chúc bạn may mắn lần sau!",
        });
      }

      // Random số vàng từ 9-18
      const goldAmount = Math.floor(Math.random() * 10) + 9; // 9-18

      // Atomic update: tăng rewardCount và cập nhật timestamp
      const updatedReward = await ReadingRewardModel.findOneAndUpdate(
        { userId: user.id, date: today },
        { $inc: { rewardCount: 1 } },
        { upsert: true, new: true },
      );

      // Cập nhật vàng cho user
      await UserModel.findByIdAndUpdate(user.id, {
        $inc: { gold: goldAmount },
      });

      createNotification({
        userId: user.id,
        title: "Thưởng đọc truyện.",
        subtitle: `Chúc mừng bạn nhận được ${goldAmount} vàng!`,
        imgUrl: "/images/noti/gold.png",
      });

      return Response.json({
        success: true,
      });
    }

    return Response.json(
      { success: false, error: "Hành động không hợp lệ" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Lỗi khi nhận thưởng đọc truyện:", error);
    return Response.json(
      { success: false, error: "Có lỗi xảy ra khi xử lý yêu cầu" },
      { status: 500 },
    );
  }
}
