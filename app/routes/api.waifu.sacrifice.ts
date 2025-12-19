import { type ActionFunctionArgs } from "react-router";

import {
  commitUserSession,
  getUserInfoFromSession,
  getUserSession,
  setUserDataToSession,
} from "~/.server/services/session.svc";
import { UserModel, type UserType } from "~/database/models/user.model";
import { UserWaifuModel } from "~/database/models/user-waifu";
import { updateUserExp } from "~/helpers/user-level.helper";

// Bảng quy đổi theo cấp sao (Dâm Ngọc chi phí + EXP nhận)
const SACRIFICE_RATES = {
  3: { exp: 30, gold: 1 },
  4: { exp: 100, gold: 5 },
  5: { exp: 500, gold: 10 },
} as const;

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
    const waifuId = formData.get("waifuId") as string;
    const sacrificeAmount = parseInt(formData.get("sacrificeAmount") as string, 10);

    if (!waifuId || !sacrificeAmount || sacrificeAmount <= 0) {
      return Response.json(
        { success: false, error: "Thông tin hiến tế không hợp lệ" },
        { status: 400 },
      );
    }

    // Đếm số lượng waifu hiện có
    const waifuCount = await UserWaifuModel.countDocuments({
      userId: user.id,
      waifuId: waifuId,
    });

    // Validate: phải có ít nhất 2 waifu (giữ lại 1)
    if (waifuCount < 2) {
      return Response.json(
        { success: false, error: "Bạn cần có ít nhất 2 waifu cùng loại để hiến tế" },
        { status: 400 },
      );
    }

    // Validate: số hiến tế không được vượt quá số có thể hiến tế
    const maxSacrifice = waifuCount - 1;
    if (sacrificeAmount > maxSacrifice) {
      return Response.json(
        {
          success: false,
          error: `Bạn chỉ có thể hiến tế tối đa ${maxSacrifice} waifu`,
        },
        { status: 400 },
      );
    }

    // Lấy thông tin waifu để biết số sao
    const waifuInfo = await UserWaifuModel.findOne({
      userId: user.id,
      waifuId: waifuId,
    }).lean();

    if (!waifuInfo) {
      return Response.json(
        { success: false, error: "Không tìm thấy thông tin waifu" },
        { status: 404 },
      );
    }

    const waifuStars = waifuInfo.waifuStars as 3 | 4 | 5;

    // Validate cấp sao hợp lệ
    if (![3, 4, 5].includes(waifuStars)) {
      return Response.json(
        { success: false, error: "Chỉ có thể hiến tế waifu 3, 4, 5 sao" },
        { status: 400 },
      );
    }

    const rates = SACRIFICE_RATES[waifuStars];

    // Tính toán reward đơn giản
    const totalExp = rates.exp * sacrificeAmount;
    const totalGoldCost = rates.gold * sacrificeAmount;

    // Check user có đủ vàng/Dâm Ngọc & cần exp/level hiện tại cho logic cộng exp
    const currentUser = await UserModel.findById(user.id).select("gold level exp").lean();
    if (!currentUser || currentUser.gold < totalGoldCost) {
      return Response.json(
        {
          success: false,
          error: `Bạn cần ${totalGoldCost} Dâm Ngọc để thực hiện hiến tế này (hiện có: ${currentUser?.gold || 0})`,
        },
        { status: 400 },
      );
    }

    // Lấy danh sách waifu để xóa (lấy theo thời gian tạo mới nhất)
    const waifusToSacrifice = await UserWaifuModel.find({
      userId: user.id,
      waifuId: waifuId,
    })
      .sort({ createdAt: -1 })
      .limit(sacrificeAmount)
      .lean();

    if (waifusToSacrifice.length !== sacrificeAmount) {
      return Response.json(
        { success: false, error: "Không thể tìm đủ waifu để hiến tế" },
        { status: 400 },
      );
    }

    // Thực hiện hiến tế
    const waifuIdsToDelete = waifusToSacrifice.map((w) => w._id);

    // Tính toán exp và level trước khi cập nhật database
    const { newExp, newLevel, didLevelUp } = updateUserExp(
      currentUser as UserType,
      totalExp,
    );

    // Xóa waifu và cập nhật user
    await UserWaifuModel.deleteMany({ _id: { $in: waifuIdsToDelete } });

    let updatedSession = null;
    if (didLevelUp) {
      // Nếu level up, reset exp-in-level, cập nhật level và trừ gold
      await UserModel.updateOne(
        { _id: user.id },
        {
          $set: { exp: newExp, level: newLevel },
          $inc: { gold: -totalGoldCost },
        },
      );

      // Cập nhật session khi level thay đổi
      const session = await getUserSession(request);
      const updatedUserData = { ...user, level: newLevel, exp: newExp };
      setUserDataToSession(session, updatedUserData);
      updatedSession = session;
    } else {
      // Nếu không level up, chỉ tăng exp-in-level và trừ gold
      await UserModel.updateOne(
        { _id: user.id },
        {
          $inc: {
            exp: totalExp,
            gold: -totalGoldCost,
          },
        },
      );
    }

    const response = {
      success: true,
      message: `Hiến tế thành công ${sacrificeAmount} ${waifuInfo.waifuName}!`,
      data: {
        expGained: totalExp,
        goldSpent: totalGoldCost,
        waifuSacrificed: sacrificeAmount,
        waifuName: waifuInfo.waifuName,
        waifuStars: waifuStars,
      },
    };

    if (updatedSession) {
      return Response.json(response, {
        headers: {
          "Set-Cookie": await commitUserSession(updatedSession),
        },
      });
    }

    return Response.json(response);
  } catch (error) {
    console.error("Error in waifu sacrifice:", error);
    return Response.json(
      { success: false, error: "Có lỗi xảy ra khi hiến tế" },
      { status: 500 },
    );
  }
}
