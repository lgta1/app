import { model, Schema } from "mongoose";

const resourceSchema = new Schema(
  {
    name: { type: String, required: true },
    test: { type: String, required: true },
  },
  { timestamps: true },
);

export const ResourceModel = model("Resource", resourceSchema);
