import { model, Schema } from "mongoose";

export type ViHentaiAutoUpdateQueueStatus = "queued" | "running" | "paused" | "succeeded" | "failed";
export type ViHentaiAutoUpdateQueueItemStatus = "queued" | "running" | "succeeded" | "failed" | "noop";

export type ViHentaiAutoUpdateQueueError = {
  url: string;
  message: string;
};

export type ViHentaiAutoUpdateQueueItem = {
  index: number;
  url: string;
  status: ViHentaiAutoUpdateQueueItemStatus;
  mode?: string;
  parsedTitle?: string;
  mangaId?: string;
  mangaSlug?: string;
  chaptersAdded?: number;
  imagesFound?: number;
  imagesUploaded?: number;
  errorDetail?: string;
  message?: string;
  startedAt?: Date;
  finishedAt?: Date;
};

export type ViHentaiAutoUpdateQueueType = {
  id: string;
  status: ViHentaiAutoUpdateQueueStatus;
  listUrl: string;
  maxManga: number;
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
  items: ViHentaiAutoUpdateQueueItem[];
  errors: ViHentaiAutoUpdateQueueError[];
  createdAt: Date;
};

const ViHentaiAutoUpdateQueueSchema = new Schema<ViHentaiAutoUpdateQueueType>(
  {
    status: { type: String, required: true },
    listUrl: { type: String, required: true },
    maxManga: { type: Number, required: true },
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
          status: String,
          mode: String,
          parsedTitle: String,
          mangaId: String,
          mangaSlug: String,
          chaptersAdded: Number,
          imagesFound: Number,
          imagesUploaded: Number,
          errorDetail: String,
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

ViHentaiAutoUpdateQueueSchema.index({ createdAt: -1 });
ViHentaiAutoUpdateQueueSchema.index({ status: 1, createdAt: -1 });

export const ViHentaiAutoUpdateQueueModel = model(
  "ViHentaiAutoUpdateQueue",
  ViHentaiAutoUpdateQueueSchema,
);
