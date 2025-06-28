import { model, Schema } from "mongoose";

export type NotificationType = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  message: string;
  isRead: boolean;
};

const NotificationSchema = new Schema<NotificationType>(
  {
    userId: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, isRead: -1, createdAt: -1 });

export const NotificationModel = model("Notification", NotificationSchema);
