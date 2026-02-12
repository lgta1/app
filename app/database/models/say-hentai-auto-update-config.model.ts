import { model, Schema } from "mongoose";

export type SayHentaiAutoUpdateConfigType = {
  id: string;
  key: string;
  domain: string;
  origin: string;
  createdAt: Date;
  updatedAt: Date;
};

const SayHentaiAutoUpdateConfigSchema = new Schema<SayHentaiAutoUpdateConfigType>(
  {
    key: { type: String, required: true },
    domain: { type: String, required: true },
    origin: { type: String, required: true },
  },
  { timestamps: true },
);

SayHentaiAutoUpdateConfigSchema.index({ key: 1 }, { unique: true });

export const SayHentaiAutoUpdateConfigModel = model(
  "SayHentaiAutoUpdateConfig",
  SayHentaiAutoUpdateConfigSchema,
);
