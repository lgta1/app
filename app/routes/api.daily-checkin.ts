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
    const dailyRewards = [];
    const dayNames = ["T.Hai", "T.Ba", "T.Tư", "T.Năm", "T.Sáu", "T.Bảy", "C.Nhật"];

    for (let i = 0; i < DAILY_REWARD.DAYS_IN_WEEK; i++) {
      const isCompleted = checkinRecord.checkedDays.includes(i);
      const isToday = i === currentDay;
      const canClaim = isToday && !isCompleted;

      dailyRewards.push({
        day: dayNames[i],
        dayIndex: i,
        completed: isCompleted,
        reward: DAILY_REWARD.GOLD_AMOUNT,
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

      // Thực hiện check-in
      await DailyCheckinModel.findByIdAndUpdate(checkinRecord._id, {
        $push: { checkedDays: currentDay },
        $inc: { goldEarned: DAILY_REWARD.GOLD_AMOUNT },
      });

      // Cập nhật gold cho user
      await UserModel.findByIdAndUpdate(user.id, {
        $inc: { gold: DAILY_REWARD.GOLD_AMOUNT },
      });

      return Response.json({
        success: true,
        message: `Điểm danh thành công! Bạn nhận được ${DAILY_REWARD.GOLD_AMOUNT} Dâm Ngọc`,
        goldEarned: DAILY_REWARD.GOLD_AMOUNT,
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
