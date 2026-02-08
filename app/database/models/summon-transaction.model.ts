import { model, Schema } from "mongoose";

export type SummonTransactionStatus = "started" | "committed" | "failed";

export type SummonTransactionType = {
  id: string;
  idempotencyKey: string;
  userId: string;
  bannerId: string;
  intent: "single" | "multi";
  cost: number;
  status: SummonTransactionStatus;
  response?: unknown;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const SummonTransactionSchema = new Schema<SummonTransactionType>(
  {
    idempotencyKey: { type: String, required: true },
    userId: { type: String, required: true },
    bannerId: { type: String, required: true },
    intent: { type: String, required: true },
    cost: { type: Number, required: true },
    status: { type: String, required: true },
    response: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

SummonTransactionSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
SummonTransactionSchema.index({ userId: 1, createdAt: -1 });

export const SummonTransactionModel = model(
  "SummonTransaction",
  SummonTransactionSchema,
);
