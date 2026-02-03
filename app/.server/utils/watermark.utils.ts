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

const watermarkPath = path.join(process.cwd(), "public", "images", "watermark.webp");
let cachedWatermark: Buffer | null = null;
let cachedWatermarkMeta: sharp.Metadata | null = null;

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

async function loadWatermarkMeta(): Promise<sharp.Metadata | null> {
  if (cachedWatermarkMeta) return cachedWatermarkMeta;
  const buf = await loadWatermarkBuffer();
  if (!buf) return null;
  try {
    cachedWatermarkMeta = await sharp(buf, { limitInputPixels: LIMIT_PIXELS }).metadata();
    return cachedWatermarkMeta;
  } catch (error) {
    console.error("[watermark] cannot read watermark metadata", error);
    return null;
  }
}


export async function applyWatermark(
  buffer: Buffer,
  opts?: {
    variant?: 1 | 2;
  },
): Promise<WatermarkResult> {
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

  const watermarkMeta = await loadWatermarkMeta();
  if (!watermarkMeta) return { buffer, applied: false };

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 200 || height < 200) {
    return { buffer, applied: false };
  }

  // Re-decode via sharp to ensure consistent processing; do NOT draw directly on the original image.
  image = sharp(buffer, { limitInputPixels: LIMIT_PIXELS });

  // 1) Decide strip height based on logo height.
  // Spec: stripHeight = logoHeight.
  const baseLogoW = watermarkMeta.width ?? 0;
  const baseLogoH = watermarkMeta.height ?? 0;
  if (!baseLogoW || !baseLogoH) {
    return { buffer, applied: false };
  }
  const logoAspect = baseLogoW / baseLogoH;

  const maxGroupWidth = Math.floor(width * 0.95);
  const messages = [
    "Truyện được đăng và đã cập nhật chương sau tại",
    "Đọc Hentai KHÔNG QUẢNG CÁO làm phiền tại",
  ] as const;
  const message = opts?.variant === 2 ? messages[1] : messages[0];
  const fontFamily = "Noto Sans, DejaVu Sans, Arial, sans-serif";

  // Layout tuning
  const charFactor = 0.55; // rough width/height ratio for sans fonts

  // IMPORTANT: size watermark based on the original image width (Wc).
  // Spec: strip height = 3.5% of Wc, and text/logo height equals strip height.
  const baseStripHeight = Math.max(1, Math.round(width * 0.035));
  let stripHeight = baseStripHeight;
  let logoH = baseStripHeight;
  let fontSize = Math.max(1, Math.floor(logoH * 0.8));
  let gap = 0;
  let logoW = Math.max(1, Math.floor(logoH * logoAspect));
  let textW = Math.ceil(message.length * fontSize * charFactor);
  let groupW = textW + gap + logoW;

  // Keep some padding so it never clips at the edges.
  const maxIters = 6;
  for (let i = 0; i < maxIters && groupW > maxGroupWidth; i++) {
    const scale = maxGroupWidth / groupW;
    stripHeight = Math.max(1, Math.floor(stripHeight * scale));
    logoH = stripHeight;
    fontSize = Math.max(1, Math.floor(logoH * 0.8));
    gap = 0;
    logoW = Math.max(1, Math.floor(logoH * logoAspect));
    textW = Math.ceil(message.length * fontSize * charFactor);
    groupW = textW + gap + logoW;
  }

  const canvasHeight = height + stripHeight;

  // 2) Build blurred strip background.
  // New rule (15/01/2026): use the overflow from a 1.5x scaled version of the original image
  // as the background for the extra strip.
  // Then increase blur strength by +40%.
  let stripBg: Buffer;
  try {
    const scale = 1.5;
    const scaledW = Math.max(1, Math.round(width * scale));
    const scaledH = Math.max(1, Math.round(height * scale));

    // If we draw the scaled image centered on the original image area (which starts at y=stripHeight),
    // the scaled image overflows above the strip. Map that overflow to a crop inside the scaled image.
    const idealLeft = (scaledW - width) / 2; // 0.25w when scale=1.5
    const idealTop = (scaledH - height) / 2 - stripHeight; // 0.25h - stripHeight when scale=1.5

    const extractLeft = Math.max(0, Math.min(Math.round(idealLeft), Math.max(0, scaledW - width)));
    const extractTop = Math.max(0, Math.min(Math.round(idealTop), Math.max(0, scaledH - stripHeight)));

    const blurSigma = 30;

    stripBg = await sharp(buffer, { limitInputPixels: LIMIT_PIXELS })
      .resize(scaledW, scaledH, { fit: "fill" })
      .extract({ left: extractLeft, top: extractTop, width, height: stripHeight })
      .blur(blurSigma)
      .png()
      .toBuffer();
  } catch (error) {
    console.error("[watermark] strip background failed", error);
    return { buffer, applied: false };
  }

  // 3) Resize logo to fit inside strip (keep aspect). Keep it sharp (no blur).
  let logoBuf: Buffer;
  try {
    const logo = sharp(watermark, { limitInputPixels: LIMIT_PIXELS }).resize(undefined, logoH, {
      fit: "inside",
      withoutEnlargement: true,
    });
    logoBuf = await logo.png().toBuffer();
  } catch (error) {
    console.error("[watermark] logo resize failed", error);
    return { buffer, applied: false };
  }

  // Use actual resized logo dimensions (avoid any mismatch due to fit/rounding).
  let actualLogoW = 0;
  let actualLogoH = 0;
  try {
    const meta = await sharp(logoBuf, { limitInputPixels: LIMIT_PIXELS }).metadata();
    actualLogoW = meta.width ?? 0;
    actualLogoH = meta.height ?? 0;
  } catch {
    // ignore
  }
  if (!actualLogoW || !actualLogoH) return { buffer, applied: false };

  // 5) Pick text color based on blurred strip average luminance.
  let isBgLight = false;
  try {
    const { data, info } = await sharp(stripBg).resize(1, 1, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
    if (info.channels >= 3 && data.length >= 3) {
      const r = data[0] ?? 0;
      const g = data[1] ?? 0;
      const b = data[2] ?? 0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      isBgLight = luminance > 140;
    }
  } catch {
    // ignore and default to white text
  }

  const fill = isBgLight ? "#111111" : "#FFFFFF";
  const stroke = isBgLight ? "#FFFFFF" : "#000000";

  // 6) Place text + logo as one centered row.
  // Text size ~75–80% logo height (already derived via fontSize above).
  // Keep a small padding to avoid clipping.
  const padX = Math.max(10, Math.floor(width * 0.02));
  const maxTextWidth = Math.max(1, maxGroupWidth - actualLogoW - gap);
  const effectiveTextWidth = Math.min(textW, maxTextWidth);
  const groupWidth = Math.min(maxGroupWidth, effectiveTextWidth + gap + actualLogoW);
  const startX = Math.max(padX, Math.floor((width - groupWidth) / 2));
  const textX = startX;
  const textY = Math.floor(stripHeight / 2);
  const logoX = Math.min(width - padX - actualLogoW, Math.floor(textX + effectiveTextWidth + gap));
  const logoY = Math.max(0, Math.floor((stripHeight - actualLogoH) / 2));

  // 7) Render text as SVG overlay (with thin outline + shadow).
  const strokeWidth = Math.max(1, Math.floor(fontSize * 0.08));
  const escapeXml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const shouldClampText = textW > maxTextWidth;
  const textSvg = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${stripHeight}">\n` +
      `  <defs>\n` +
      `    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">\n` +
      `      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${stroke}" flood-opacity="0.55"/>\n` +
      `    </filter>\n` +
      `  </defs>\n` +
      `  <text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="700" dominant-baseline="middle" text-anchor="start"\n` +
      `        fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke" filter="url(#shadow)"${shouldClampText ? ` textLength=\"${maxTextWidth}\" lengthAdjust=\"spacingAndGlyphs\"` : ""}>\n` +
      `    ${escapeXml(message)}\n` +
      `  </text>\n` +
      `</svg>\n`,
    "utf-8",
  );

  // 8) Compose: [strip bg] + [original image] + [text] + [logo].
  try {
    const base = sharp({
      create: {
        width,
        height: canvasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
      limitInputPixels: LIMIT_PIXELS,
    });

    const composited = base
      .composite([
        { input: stripBg, left: 0, top: 0 },
        { input: buffer, left: 0, top: stripHeight },
        { input: textSvg, left: 0, top: 0 },
        { input: logoBuf, left: logoX, top: logoY },
      ]);

    let out: Buffer;
    if (format === "jpeg" || format === "jpg") {
      out = await composited.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    } else if (format === "webp") {
      out = await composited.webp({ quality: 92, effort: 4 }).toBuffer();
    } else if (format === "png") {
      out = await composited.png({ compressionLevel: 9 }).toBuffer();
    } else {
      out = await composited.toFormat(format as any).toBuffer();
    }

    return { buffer: out, applied: true, format };
  } catch (error) {
    console.error("[watermark] composite failed", error);
    return { buffer, applied: false };
  }
}
