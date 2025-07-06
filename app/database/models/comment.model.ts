import { model, Schema } from "mongoose";

export type CommentType = {
  id: string;
  content: string;
  mangaId?: string;
  postId?: string;
  userId: string;
  likeNumber: number;
  createdAt: Date;
  updatedAt: Date;
};

const CommentSchema = new Schema<CommentType>(
  {
    content: { type: String, required: true, trim: true },
    mangaId: { type: String, ref: "Manga", required: false },
    postId: { type: String, ref: "Post", required: false },
    userId: { type: String, ref: "User", required: true },
    likeNumber: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Validation để đảm bảo ít nhất một trong mangaId hoặc postId phải có
CommentSchema.pre("save", function () {
  if (!this.mangaId && !this.postId) {
    throw new Error("Comment must have either mangaId or postId");
  }
  if (this.mangaId && this.postId) {
    throw new Error("Comment cannot have both mangaId and postId");
  }
});

// Index để tối ưu hóa query theo mangaId và thời gian tạo
CommentSchema.index({ mangaId: 1, createdAt: -1 });
CommentSchema.index({ postId: 1, createdAt: -1 });
CommentSchema.index({ userId: 1, createdAt: -1 });

export const CommentModel = model("Comment", CommentSchema);
