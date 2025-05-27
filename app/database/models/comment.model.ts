import { model, Schema, Types } from "mongoose";

export type CommentType = {
  id: string;
  content: string;
  mangaId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const CommentSchema = new Schema<CommentType>(
  {
    content: { type: String, required: true, trim: true },
    mangaId: { type: Schema.Types.ObjectId, ref: "Manga", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Index để tối ưu hóa query theo mangaId và thời gian tạo
CommentSchema.index({ mangaId: 1, createdAt: -1 });

export const CommentModel = model("Comment", CommentSchema);
