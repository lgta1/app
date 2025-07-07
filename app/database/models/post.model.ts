import { model, Schema } from "mongoose";

export type PostType = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  images: string[];
  authorId: string;
  likeNumber: number;
  commentNumber: number;
  viewNumber: number;
  isPinned: boolean;
  isPublished: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const PostSchema = new Schema<PostType>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
    images: { type: [String], default: [] },
    authorId: { type: String, ref: "User", required: true },
    likeNumber: { type: Number, default: 0 },
    commentNumber: { type: Number, default: 0 },
    viewNumber: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Index chính cho listing posts với pagination
PostSchema.index({ isPublished: 1, isDeleted: 1, isPinned: -1, createdAt: -1 });

// Index cho filter by author
PostSchema.index({ isPublished: 1, isDeleted: 1, authorId: 1, createdAt: -1 });

// Index cho filter by tags
PostSchema.index({ isPublished: 1, isDeleted: 1, tags: 1, createdAt: -1 });

export const PostModel = model("Post", PostSchema);
