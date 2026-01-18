import { model, Schema } from "mongoose";

export type ViHentaiAutoDownloadJobStatus = "queued" | "running" | "paused" | "succeeded" | "failed";

export type ViHentaiAutoDownloadJobProgress = {
  stage?: "manga" | "poster" | "chapters" | "chapter" | "image" | "done";
  message?: string;

  chapterIndex?: number; // 1-based
  chapterCount?: number;
  chapterTitle?: string;
  chapterUrl?: string;

  imageIndex?: number; // 1-based
  imageCount?: number;
  imageUrl?: string;

  updatedAt?: Date;
};

export type ViHentaiAutoDownloadJobResultSummary = {
  message?: string;
  createdId?: string;
  createdSlug?: string;
  chaptersImported?: number;
  imagesUploaded?: number;
  chapterErrors?: number;
};

export type ViHentaiAutoDownloadJobType = {
  id: string;

  batchId: string;
  url: string;
  ownerId: string;

  translationTeam?: string;
  approve?: boolean;
  dryRun?: boolean;
  skipIfExists?: boolean;
  downloadPoster?: boolean;

  contentType?: string;
  userStatus?: string;
  maxChapters?: number;

  status: ViHentaiAutoDownloadJobStatus;
  paused?: boolean;

  startedAt?: Date;
  finishedAt?: Date;
  lastHeartbeatAt?: Date;

  progress?: ViHentaiAutoDownloadJobProgress;

  result?: ViHentaiAutoDownloadJobResultSummary;
  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
};

const ViHentaiAutoDownloadJobSchema = new Schema<ViHentaiAutoDownloadJobType>(
  {
    batchId: { type: String, required: true, index: true },
    url: { type: String, required: true },
    ownerId: { type: String, required: true, index: true },

    translationTeam: { type: String },
    approve: { type: Boolean, default: false },
    dryRun: { type: Boolean, default: false },
    skipIfExists: { type: Boolean, default: true },
    downloadPoster: { type: Boolean, default: true },

    contentType: { type: String },
    userStatus: { type: String },
    maxChapters: { type: Number },

    status: { type: String, required: true, index: true },
    paused: { type: Boolean, default: false, index: true },

    startedAt: { type: Date },
    finishedAt: { type: Date },
    lastHeartbeatAt: { type: Date },

    progress: {
      type: {
        stage: { type: String },
        message: { type: String },
        chapterIndex: { type: Number },
        chapterCount: { type: Number },
        chapterTitle: { type: String },
        chapterUrl: { type: String },
        imageIndex: { type: Number },
        imageCount: { type: Number },
        imageUrl: { type: String },
        updatedAt: { type: Date },
      },
      default: undefined,
    },

    result: {
      type: {
        message: { type: String },
        createdId: { type: String },
        createdSlug: { type: String },
        chaptersImported: { type: Number },
        imagesUploaded: { type: Number },
        chapterErrors: { type: Number },
      },
      default: undefined,
    },
    errorMessage: { type: String },
  },
  { timestamps: true },
);

ViHentaiAutoDownloadJobSchema.index({ batchId: 1, createdAt: 1 });
ViHentaiAutoDownloadJobSchema.index({ status: 1, paused: 1, createdAt: 1 });

export const ViHentaiAutoDownloadJobModel = model(
  "ViHentaiAutoDownloadJob",
  ViHentaiAutoDownloadJobSchema,
);
