import { model, Schema } from "mongoose";

export type CommentType = {
  id: string;
  content: string;
  mangaId: string;
  userId: string;
  likeNumber: number;
  createdAt: Date;
  updatedAt: Date;
};

const CommentSchema = new Schema<CommentType>(
  {
    content: { type: String, required: true, trim: true },
    mangaId: { type: String, ref: "Manga", required: true },
    userId: { type: String, ref: "User", required: true },
    likeNumber: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index để tối ưu hóa query theo mangaId và thời gian tạo
CommentSchema.index({ mangaId: 1, createdAt: -1 });
CommentSchema.index({ userId: 1, createdAt: -1 });

export const CommentModel = model("Comment", CommentSchema);
