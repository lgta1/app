import { model, Schema } from "mongoose";

export type HotCarouselSnapshotType = {
  id: string;
  key: string;
  items: string[];
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const HotCarouselSnapshotSchema = new Schema<HotCarouselSnapshotType>(
  {
    key: { type: String, required: true, unique: true, index: true },
    items: { type: [String], default: [] },
    computedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const HotCarouselSnapshotModel = model("HotCarouselSnapshot", HotCarouselSnapshotSchema);
