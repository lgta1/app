import { model, Schema } from "mongoose";

export type BannerType = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  totalRolls: number;
  imageUrl: string;
  mobileImageUrl: string;
  waifuList: {
    id: string;
    name: string;
    image: string;
    stars: number;
    expBuff: number;
    goldBuff: number;
  }[];
  isRateUp: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const BannerSchema = new Schema<BannerType>(
  {
    title: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalRolls: { type: Number, default: 0 },
    imageUrl: { type: String, required: true },
    mobileImageUrl: { type: String, required: true },
    waifuList: [
      {
        id: { type: Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        image: { type: String, required: true },
        stars: { type: Number, required: true },
        expBuff: { type: Number, required: true },
        goldBuff: { type: Number, required: true },
      },
    ],
    isRateUp: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Index tối ưu cho các query patterns thực tế
BannerSchema.index({ startDate: 1, endDate: 1 }); // Query active banners với range
BannerSchema.index({ isRateUp: -1, startDate: -1 }); // Sort banners theo priority và date

export const BannerModel = model("Banner", BannerSchema);
