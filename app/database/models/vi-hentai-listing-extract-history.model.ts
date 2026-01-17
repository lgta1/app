import { model, Schema } from "mongoose";

export type ViHentaiListingExtractHistoryType = {
  id: string;

  url: string;
  ok?: boolean;

  linksCount?: number;
  capped?: boolean;
  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
};

const ViHentaiListingExtractHistorySchema = new Schema<ViHentaiListingExtractHistoryType>(
  {
    url: { type: String, required: true, index: true },
    ok: { type: Boolean, default: undefined, index: true },

    linksCount: { type: Number },
    capped: { type: Boolean },
    errorMessage: { type: String },
  },
  { timestamps: true },
);

ViHentaiListingExtractHistorySchema.index({ createdAt: -1 });

export const ViHentaiListingExtractHistoryModel = model(
  "ViHentaiListingExtractHistory",
  ViHentaiListingExtractHistorySchema,
);
