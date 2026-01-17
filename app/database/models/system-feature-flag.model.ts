import { model, Schema } from "mongoose";

export type SystemFeatureFlagType = {
  key: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const SystemFeatureFlagSchema = new Schema<SystemFeatureFlagType>(
  {
    key: { type: String, required: true },
    enabled: { type: Boolean, required: true },
  },
  { timestamps: true },
);

SystemFeatureFlagSchema.index({ key: 1 }, { unique: true });

export const SystemFeatureFlagModel = model<SystemFeatureFlagType>(
  "SystemFeatureFlag",
  SystemFeatureFlagSchema,
);
