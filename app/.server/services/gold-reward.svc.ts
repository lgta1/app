import { createNotification } from "@/mutations/notification.mutation";
import { UserModel } from "~/database/models/user.model";

export type GoldRewardPayload = {
  userId: string;
  amount: number;
  title: string;
  subtitle?: string;
  type?: string;
  imgUrl?: string;
};

export const grantGoldReward = async (payload: GoldRewardPayload) => {
  const { userId, amount, title, subtitle, type, imgUrl } = payload;

  if (amount !== 0) {
    await UserModel.findByIdAndUpdate(userId, { $inc: { gold: amount } }, { timestamps: false });
  }

  await createNotification({
    userId,
    title,
    subtitle,
    imgUrl: imgUrl ?? "/images/noti/gold.png",
    type: type ?? "gold-reward",
  });
};
