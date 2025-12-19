import { model, Schema } from 'mongoose';

export type AdminActionLogType = {
  id: string;
  action: string; // e.g. TRANSFER_MANGA_OWNER, SET_ROLE_DICHGIA
  adminId: string;
  mangaId?: string;
  oldOwnerId?: string;
  newOwnerId?: string;
  targetUserId?: string; // for role changes
  createdAt: Date;
  updatedAt: Date;
};

const AdminActionLogSchema = new Schema<AdminActionLogType>({
  action: { type: String, required: true },
  adminId: { type: String, required: true },
  mangaId: { type: String },
  oldOwnerId: { type: String },
  newOwnerId: { type: String },
  targetUserId: { type: String },
}, { timestamps: true });

AdminActionLogSchema.index({ action: 1, createdAt: -1 });
AdminActionLogSchema.index({ adminId: 1, createdAt: -1 });

export const AdminActionLogModel = model('AdminActionLog', AdminActionLogSchema);
