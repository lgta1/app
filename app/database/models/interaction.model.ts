import { model, Schema } from "mongoose";

export type InteractionType = {
  id: string;
  story_id: Schema.Types.ObjectId;
  type: "view" | "like" | "comment";
  user_id?: Schema.Types.ObjectId;
  created_at: Date;
};

const InteractionSchema = new Schema<InteractionType>(
  {
    story_id: { type: Schema.ObjectId, ref: "Manga", required: true },
    type: {
      type: String,
      enum: ["view", "like", "comment"],
      required: true,
    },
    user_id: { type: Schema.Types.ObjectId, ref: "User" },
    created_at: { type: Date, default: Date.now, required: true },
  },
  {
    timestamps: false,
    collection: "interactions",
  },
);

// Index tối ưu cho leaderboard aggregation
InteractionSchema.index({ created_at: 1, story_id: 1, type: 1 });

export const InteractionModel = model("Interaction", InteractionSchema);
