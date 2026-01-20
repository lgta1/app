import { model, Schema } from "mongoose";

export type HotCarouselSnapshotType = {
  id: string;
  key: string;
  items: string[];
  /**
   * Per-story presence tracking for HOT carousel.
   * - streakStartedAt: when the story started its current continuous streak on the HOT leaderboard.
   * - lastSeenAt: last time we saw it included in snapshot.
   * - lastLeftAt: when it left the snapshot (used for re-entry cooldown).
   */
  presence?: Record<
    string,
    {
      streakStartedAt: Date;
      lastSeenAt: Date;
      lastLeftAt?: Date;
    }
  >;
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const HotCarouselPresenceSchema = new Schema(
  {
    streakStartedAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    lastLeftAt: { type: Date, required: false },
  },
  { _id: false },
);

const HotCarouselSnapshotSchema = new Schema<HotCarouselSnapshotType>(
  {
    key: { type: String, required: true, unique: true, index: true },
    items: { type: [String], default: [] },
    presence: { type: Map, of: HotCarouselPresenceSchema, default: {} },
    computedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const HotCarouselSnapshotModel = model("HotCarouselSnapshot", HotCarouselSnapshotSchema);
