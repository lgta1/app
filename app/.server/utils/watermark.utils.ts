import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

// Applies a watermark deterministically when requested. Safe defaults to skip unsupported formats.
type WatermarkResult = {
  buffer: Buffer;
  applied: boolean;
  format?: string;
};

const SUPPORTED_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);
const LIMIT_PIXELS = 20000 * 20000; // guardrail against huge images

const watermarkPath = path.join(process.cwd(), "public", "images", "logo-watermark.webp");
let cachedWatermark: Buffer | null = null;

async function loadWatermarkBuffer(): Promise<Buffer | null> {
  if (cachedWatermark) return cachedWatermark;
  try {
    const data = await fs.readFile(watermarkPath);
    cachedWatermark = data;
    return data;
  } catch (error) {
    console.error("[watermark] cannot read watermark file", watermarkPath, error);
    return null;
  }
}

export async function applyWatermark(buffer: Buffer): Promise<WatermarkResult> {

  let image = sharp(buffer, { limitInputPixels: LIMIT_PIXELS });
  let metadata;
  try {
    metadata = await image.metadata();
  } catch (error) {
    console.error("[watermark] metadata failed", error);
    return { buffer, applied: false };
  }

  const format = (metadata.format || "").toLowerCase();
  if (!SUPPORTED_FORMATS.has(format)) {
    return { buffer, applied: false };
  }

  const watermark = await loadWatermarkBuffer();
  if (!watermark) return { buffer, applied: false };

  const width = metadata.width ?? 0;
  if (width < 200) {
    return { buffer, applied: false };
  }

  const targetWidth = Math.min(Math.round(width * 0.15), width - 1);
  let watermarkResized: Buffer;
  try {
    watermarkResized = await sharp(watermark, { limitInputPixels: LIMIT_PIXELS })
      .resize(targetWidth, undefined, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch (error) {
    console.error("[watermark] resize failed", error);
    return { buffer, applied: false };
  }

  const margin = 0;

  try {
    const composited = await sharp(buffer, { limitInputPixels: LIMIT_PIXELS })
      .composite([{ input: watermarkResized, left: margin, top: margin }])
      .toFormat(format as any)
      .toBuffer();

    return { buffer: composited, applied: true, format };
  } catch (error) {
    console.error("[watermark] composite failed", error);
    return { buffer, applied: false };
  }
}
