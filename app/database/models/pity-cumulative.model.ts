import { model, Schema } from "mongoose";

export type PityCumulativeType = {
  id: string;
  level: number;
  rates: number[];
  createdAt: Date;
  updatedAt: Date;
};

const PityCumulativeSchema = new Schema<PityCumulativeType>({
  level: { type: Number, required: true, unique: true },
  rates: { type: [Number], required: true },
});

export const PityCumulativeModel = model("PityCumulative", PityCumulativeSchema);
