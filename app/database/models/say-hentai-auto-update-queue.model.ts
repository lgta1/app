import { model, Schema } from "mongoose";

export type SayHentaiAutoUpdateQueueStatus = "queued" | "running" | "paused" | "succeeded" | "failed";
export type SayHentaiAutoUpdateQueueItemStatus = "queued" | "running" | "succeeded" | "failed" | "noop";

export type SayHentaiAutoUpdateQueueError = {
  url: string;
  message: string;
};

export type SayHentaiAutoUpdateQueueItem = {
  index: number;
  url: string;
  sayPath?: string;
  vinaPath?: string;
  status: SayHentaiAutoUpdateQueueItemStatus;
  mode?: string;
  parsedTitle?: string;
  mangaId?: string;
  mangaSlug?: string;
  chaptersAdded?: number;
  imagesUploaded?: number;
  message?: string;
  startedAt?: Date;
  finishedAt?: Date;
};

export type SayHentaiAutoUpdateQueueType = {
  id: string;
  status: SayHentaiAutoUpdateQueueStatus;
  listUrl: string;
  domain: string;
  maxNewChaptersPerManga: number;
  ownerId?: string;
  approveNewManga?: boolean;
  manualOverride?: boolean;
  lockedBy?: string;
  startedAt?: Date;
  finishedAt?: Date;
  processed: number;
  created: number;
  updated: number;
  noop: number;
  chaptersAdded: number;
  imagesUploaded: number;
  items: SayHentaiAutoUpdateQueueItem[];
  errors: SayHentaiAutoUpdateQueueError[];
  createdAt: Date;
};

const SayHentaiAutoUpdateQueueSchema = new Schema<SayHentaiAutoUpdateQueueType>(
  {
    status: { type: String, required: true },
    listUrl: { type: String, required: true },
    domain: { type: String, required: true },
    maxNewChaptersPerManga: { type: Number, required: true },
    ownerId: { type: String },
    approveNewManga: { type: Boolean },
    manualOverride: { type: Boolean },
    lockedBy: { type: String },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    processed: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    noop: { type: Number, default: 0 },
    chaptersAdded: { type: Number, default: 0 },
    imagesUploaded: { type: Number, default: 0 },
    items: {
      type: [
        {
          index: Number,
          url: String,
          sayPath: String,
          vinaPath: String,
          status: String,
          mode: String,
          parsedTitle: String,
          mangaId: String,
          mangaSlug: String,
          chaptersAdded: Number,
          imagesUploaded: Number,
          message: String,
          startedAt: Date,
          finishedAt: Date,
        },
      ],
      default: [],
    },
    errors: { type: [{ url: String, message: String }], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

SayHentaiAutoUpdateQueueSchema.index({ createdAt: -1 });
SayHentaiAutoUpdateQueueSchema.index({ status: 1, createdAt: -1 });

export const SayHentaiAutoUpdateQueueModel = model(
  "SayHentaiAutoUpdateQueue",
  SayHentaiAutoUpdateQueueSchema,
);
