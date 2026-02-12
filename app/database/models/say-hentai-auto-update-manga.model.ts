import { model, Schema } from "mongoose";

export type SayHentaiAutoUpdateMangaType = {
  id: string;
  sayPath: string;
  vinaPath?: string;
  path?: string;
  createdAt: Date;
  updatedAt: Date;
};

const SayHentaiAutoUpdateMangaSchema = new Schema<SayHentaiAutoUpdateMangaType>(
  {
    sayPath: { type: String, required: true },
    vinaPath: { type: String },
    path: { type: String },
  },
  { timestamps: true },
);

SayHentaiAutoUpdateMangaSchema.index({ sayPath: 1 }, { unique: true });
// Backward compatibility with old unique index on `path`.
SayHentaiAutoUpdateMangaSchema.index({ path: 1 }, { unique: true, sparse: true });

export const SayHentaiAutoUpdateMangaModel = model(
  "SayHentaiAutoUpdateManga",
  SayHentaiAutoUpdateMangaSchema,
);
