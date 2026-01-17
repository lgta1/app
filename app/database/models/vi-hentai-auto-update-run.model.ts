import { model, Schema } from "mongoose";

export type ViHentaiAutoUpdateRunStatus = "running" | "succeeded" | "failed";

export type ViHentaiAutoUpdateRunError = {
  url: string;
  message: string;
};

export type ViHentaiAutoUpdateItemStatus = "running" | "succeeded" | "failed" | "noop";

export type ViHentaiAutoUpdateRunItem = {
  index: number;
  url: string;
  status: ViHentaiAutoUpdateItemStatus;
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

export type ViHentaiAutoUpdateRunType = {
  id: string;
  status: ViHentaiAutoUpdateRunStatus;
  listUrl: string;
  startedAt: Date;
  finishedAt?: Date;
  lockedBy?: string;
  processed: number;
  created: number;
  updated: number;
  noop: number;
  chaptersAdded: number;
  imagesUploaded: number;
  items?: ViHentaiAutoUpdateRunItem[];
  errors?: ViHentaiAutoUpdateRunError[];
  createdAt: Date;
};

const ViHentaiAutoUpdateRunSchema = new Schema<ViHentaiAutoUpdateRunType>(
  {
    status: { type: String, required: true },
    listUrl: { type: String, required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },
    lockedBy: { type: String },
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

ViHentaiAutoUpdateRunSchema.index({ createdAt: -1 });
ViHentaiAutoUpdateRunSchema.index({ status: 1, createdAt: -1 });

export const ViHentaiAutoUpdateRunModel = model(
  "ViHentaiAutoUpdateRun",
  ViHentaiAutoUpdateRunSchema,
);
