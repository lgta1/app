import type { ActionFunctionArgs } from "react-router";

import {
  commitUserSession,
  getUserInfoFromSession,
  getUserSession,
  setUserDataToSession,
} from "@/services/session.svc";

import { ChapterModel } from "~/database/models/chapter.model";
import { MangaModel } from "~/database/models/manga.model";
import { ReadingExpModel } from "~/database/models/reading-exp.model";
import { UserModel, type UserType } from "~/database/models/user.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { updateUserExp } from "~/helpers/user-level.helper";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json(
        { success: false, error: "Vui lòng đăng nhập để nhận EXP" },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "claim-reading-exp") {
      const chapterId = formData.get("chapterId");
      if (!chapterId) {
        return Response.json(
          { success: false, error: "Vui lòng cung cấp chapterId" },
          { status: 400 },
        );
      }

      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000); // 1 phút trước

      // Atomic check: chỉ cho phép claim nếu totalExp < 100 và updatedAt cách đây ít nhất 1 phút
      const currentExp = await ReadingExpModel.findOneAndUpdate(
        {
          userId: user.id,
          date: today,
          $and: [
            {
              $or: [
                { totalExp: { $lt: 100 } }, // Chưa đủ 100 exp
                { totalExp: { $exists: false } }, // Chưa có record
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

      await UserReadChapterModel.findOneAndUpdate(
        { userId: user.id, chapterId },
        { updatedAt: now },
        { upsert: true },
      );

      const chapter = await ChapterModel.findByIdAndUpdate(
        chapterId,
        { $inc: { viewNumber: 1 } },
        { timestamps: false },
      ).lean();

      await MangaModel.findByIdAndUpdate(
        chapter?.mangaId,
        { $inc: { viewNumber: 1 } },
        { timestamps: false },
      );

      // Nếu không tìm thấy record phù hợp = bị rate limit hoặc đã đủ 100 exp
      if (!currentExp) {
        const existingRecord = await ReadingExpModel.findOne({
          userId: user.id,
          date: today,
        });

        if (existingRecord) {
          if (existingRecord.totalExp >= 100) {
            return Response.json({
              success: false,
              error: "Bạn đã nhận đủ 100 exp từ đọc truyện hôm nay!",
            });
          } else {
            // Rate limited
            const timeSinceLastUpdate =
              now.getTime() - existingRecord.updatedAt.getTime();
            const remainingSeconds = Math.ceil((60000 - timeSinceLastUpdate) / 1000);
            return Response.json({
              success: false,
              error: `Vui lòng chờ ${remainingSeconds} giây nữa mới có thể nhận exp!`,
            });
          }
        }
      }

      const currentChaptersRead = currentExp?.chaptersRead || 0;
      const currentTotalExp = currentExp?.totalExp || 0;

      // Double check giới hạn 100 exp/ngày
      if (currentTotalExp >= 100) {
        return Response.json({
          success: false,
          error: "Bạn đã nhận đủ 100 exp từ đọc truyện hôm nay!",
        });
      }

      // Tính exp nhận được:
      // - 10 chap đầu tiên: 5 exp/chap
      // - Sau đó: 1 exp/chap
      let expToGain = 0;
      if (currentChaptersRead < 10) {
        expToGain = 5; // 10 chap đầu
      } else {
        expToGain = 1; // Các chap sau
      }

      // Đảm bảo không vượt quá 100 exp
      const maxPossibleExp = 100 - currentTotalExp;
      expToGain = Math.min(expToGain, maxPossibleExp);

      if (expToGain <= 0) {
        return Response.json({
          success: false,
          error: "Bạn đã nhận đủ 100 exp từ đọc truyện hôm nay!",
        });
      }

      // Atomic update: tăng chaptersRead và totalExp
      const updatedExp = await ReadingExpModel.findOneAndUpdate(
        { userId: user.id, date: today },
        {
          $inc: {
            chaptersRead: 1,
            totalExp: expToGain,
          },
        },
        { upsert: true, new: true },
      );

      const userFull = await UserModel.findOneAndUpdate(
        { _id: user.id },
        { $inc: { exp: expToGain } },
      ).lean();

      const { newLevel } = updateUserExp(userFull as UserType, expToGain);

      let updatedSession = null;
      if (userFull?.level && newLevel > userFull?.level) {
        await UserModel.updateOne({ _id: user.id }, { $set: { level: newLevel } });

        // Cập nhật session khi level thay đổi
        const session = await getUserSession(request);
        const updatedUser = { ...user, level: newLevel };
        setUserDataToSession(session, updatedUser);
        updatedSession = session;
      }

      const remainingExp = Math.max(0, 100 - updatedExp.totalExp);
      const isFirstTenChapters = updatedExp.chaptersRead <= 10;

      const response = {
        success: true,
        message: `Bạn nhận được ${expToGain} exp! (${isFirstTenChapters ? "10 chapter đầu" : "sau 10 chapter đầu"})`,
        expGained: expToGain,
        totalExp: updatedExp.totalExp,
        chaptersRead: updatedExp.chaptersRead,
        remainingExp,
        isFirstTenChapters,
      };

      if (updatedSession) {
        return Response.json(response, {
          headers: {
            "Set-Cookie": await commitUserSession(updatedSession),
          },
        });
      }

      return Response.json(response);
    }

    return Response.json(
      { success: false, error: "Hành động không hợp lệ" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Lỗi khi nhận exp đọc truyện:", error);
    return Response.json(
      { success: false, error: "Có lỗi xảy ra khi xử lý yêu cầu" },
      { status: 500 },
    );
  }
}
