import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "~/.server/services/session.svc";
import { DAILY_REWARD } from "~/constants/user";
import { DailyCheckinModel } from "~/database/models/daily-checkin.model";
import { UserModel } from "~/database/models/user.model";

// Helper function để lấy ngày đầu tuần (thứ 2)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Chuyển chủ nhật (0) về -6
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// Helper function để lấy ngày hiện tại trong tuần (0 = thứ 2, 6 = chủ nhật)
function getCurrentDayOfWeek(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1; // Chuyển đổi để thứ 2 = 0, chủ nhật = 6
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json(
        { success: false, error: "Vui lòng đăng nhập" },
        { status: 401 },
      );
    }

    const now = new Date();
    const weekStart = getWeekStart(now);
    const currentDay = getCurrentDayOfWeek(now);

    // Lấy thông tin check-in của tuần hiện tại
    let checkinRecord = await DailyCheckinModel.findOne({
      userId: user.id,
      weekStart,
    }).lean();

    if (!checkinRecord) {
      // Tạo record mới cho tuần này
      checkinRecord = await DailyCheckinModel.create({
        userId: user.id,
        weekStart,
        checkedDays: [],
        goldEarned: 0,
      });
    }

    // Tạo data cho 7 ngày trong tuần
    const dailyRewards: Array<any> = [];
    const dayNames = ["T.Hai", "T.Ba", "T.Tư", "T.Năm", "T.Sáu", "T.Bảy", "C.Nhật"];

    // Determine reward range based on current waifu stars
    const userFull = await UserModel.findById(user.id).select("currentWaifu").populate("currentWaifu").lean();
    const stars = (userFull?.currentWaifu as any)?.stars || 0;
    const getRangeForStars = (s: number) => {
      if (s >= 5) return [5, 10];
      if (s === 4) return [3, 5];
      if (s === 3) return [1, 3];
      return [DAILY_REWARD.GOLD_AMOUNT, DAILY_REWARD.GOLD_AMOUNT];
    };

    const [minR, maxR] = getRangeForStars(stars);

    for (let i = 0; i < DAILY_REWARD.DAYS_IN_WEEK; i++) {
      const isCompleted = checkinRecord.checkedDays.includes(i);
      const isToday = i === currentDay;
      const canClaim = isToday && !isCompleted;

      // reward field shows the range as a string when variable by stars
      const reward = minR === maxR ? minR : `${minR}-${maxR}`;

      dailyRewards.push({
        day: dayNames[i],
        dayIndex: i,
        completed: isCompleted,
        reward,
        isToday,
        canClaim,
      });
    }

    return Response.json({
      success: true,
      data: {
        dailyRewards,
        currentDay,
        totalGoldEarned: checkinRecord.goldEarned,
        weekStart: checkinRecord.weekStart,
      },
    });
  } catch (error) {
    console.error("Error loading daily checkin:", error);
    return Response.json(
      { success: false, error: "Không thể lấy dữ liệu điểm danh" },
      { status: 500 },
    );
  }
}

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
    const actionType = formData.get("actionType") as string;

    if (actionType === "checkin") {
      const now = new Date();
      const weekStart = getWeekStart(now);
      const currentDay = getCurrentDayOfWeek(now);

      // Kiểm tra user có waifu đồng hành không
      const userData = await UserModel.findById(user.id)
        .select("currentWaifu gold")
        .lean();
      if (!userData?.currentWaifu) {
        return Response.json({
          success: false,
          error: "Bạn cần có waifu đồng hành để nhận quà hàng ngày",
        });
      }

      // Lấy hoặc tạo record check-in
      let checkinRecord = await DailyCheckinModel.findOne({
        userId: user.id,
        weekStart,
      }).lean();

      if (!checkinRecord) {
        checkinRecord = await DailyCheckinModel.create({
          userId: user.id,
          weekStart,
          checkedDays: [],
          goldEarned: 0,
        });
      }

      // Kiểm tra đã check-in hôm nay chưa
      if (checkinRecord.checkedDays.includes(currentDay)) {
        return Response.json({
          success: false,
          error: "Bạn đã điểm danh hôm nay rồi",
        });
      }

      // Determine reward amount based on current waifu stars
  const userFullData = await UserModel.findById(user.id).select("currentWaifu").populate("currentWaifu").lean();
  const starsNow = (userFullData?.currentWaifu as any)?.stars || 0;
      const getRange = (s: number) => {
        if (s >= 5) return [5, 10];
        if (s === 4) return [3, 5];
        if (s === 3) return [1, 3];
        return [DAILY_REWARD.GOLD_AMOUNT, DAILY_REWARD.GOLD_AMOUNT];
      };
      // Determine reward using weighted probabilities by waifu stars
      const getWeightedForStars = (s: number) => {
        if (s <= 3) {
          return { values: [1, 2, 3], weights: [50, 40, 10] };
        }
        if (s === 4) {
          return { values: [1, 2, 3, 4], weights: [10, 30, 40, 20] };
        }
        // 5★+
        return { values: [1, 2, 3, 4, 5, 6, 7, 8], weights: [0, 10, 20, 30, 20, 10, 5, 5] };
      };

      const weightedPick = (values: number[], weights: number[]) => {
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < weights.length; i++) {
          r -= weights[i];
          if (r <= 0) return values[i];
        }
        return values[values.length - 1];
      };

      const { values, weights } = getWeightedForStars(starsNow);
      const rewardAmount = weightedPick(values, weights);

      // Thực hiện check-in (ghi số tiền thực tế nhận được)
      await DailyCheckinModel.findByIdAndUpdate(checkinRecord._id, {
        $push: { checkedDays: currentDay },
        $inc: { goldEarned: rewardAmount },
      });

      // Cập nhật gold cho user
      await UserModel.findByIdAndUpdate(user.id, {
        $inc: { gold: rewardAmount },
      });

      // Try to include waifu name in the response message for a friendlier UX
      const waifuName = (userFullData?.currentWaifu as any)?.name || "Waifu";

      return Response.json({
        success: true,
        message: `Bạn nhận được ${rewardAmount} Dâm Ngọc từ ${waifuName}`,
        goldEarned: rewardAmount,
      });
    }

    return Response.json(
      { success: false, error: "Hành động không hợp lệ" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error in daily checkin action:", error);
    return Response.json(
      { success: false, error: "Có lỗi xảy ra khi điểm danh" },
      { status: 500 },
    );
  }
}
