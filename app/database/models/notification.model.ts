import { model, Schema } from "mongoose";

export type NotificationType = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  title: string;
  subtitle: string;
  imgUrl: string;
  isRead: boolean;
};

const NotificationSchema = new Schema<NotificationType>(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    imgUrl: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, isRead: -1, createdAt: -1 });

export const NotificationModel = model("Notification", NotificationSchema);
