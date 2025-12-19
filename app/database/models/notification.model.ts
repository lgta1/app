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
  type?: string;
  targetType?: string | null;
  targetId?: string | null;
  targetSlug?: string | null;
  targetUrl?: string | null;
};

const NotificationSchema = new Schema<NotificationType>(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String },
    imgUrl: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    type: { type: String, default: "default" },
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    targetSlug: { type: String, default: null },
    targetUrl: { type: String, default: null },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, isRead: -1, createdAt: -1 });

export const NotificationModel = model("Notification", NotificationSchema);
