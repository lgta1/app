import sharp from "sharp";

// Applies a watermark deterministically when requested. Safe defaults to skip unsupported formats.
type WatermarkResult = {
  buffer: Buffer;
  applied: boolean;
  format?: string;
};

const SUPPORTED_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);
const LIMIT_PIXELS = 20000 * 20000; // guardrail against huge images


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

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 200 || height < 200) {
    return { buffer, applied: false };
  }

  // Re-decode via sharp to ensure consistent processing; do NOT draw directly on the original image.
  image = sharp(buffer, { limitInputPixels: LIMIT_PIXELS });

  // 1) Decide strip height and text layout.
  const maxGroupWidth = Math.floor(width * 0.95);
  const messages = [
    "Truyện được đăng và đã cập nhật chương sau tại",
    "Đọc Hentai KHÔNG QUẢNG CÁO làm phiền tại",
  ] as const;
  const baseText = opts?.variant === 2 ? messages[1] : messages[0];
  const brandText = "VinaHentai";
  const message = `${baseText} ${brandText}`;
  const fontFamily = "Noto Sans, DejaVu Sans, Arial, sans-serif";

  // Layout tuning
  const charFactor = 0.55; // rough width/height ratio for sans fonts

  // IMPORTANT: size watermark based on the original image width (Wc).
  // Spec: strip height = 3.5% of Wc, and text height ~60% of strip height.
  const baseStripHeight = Math.max(1, Math.round(width * 0.035));
  let stripHeight = baseStripHeight;
  let fontSize = Math.max(1, Math.floor(stripHeight * 0.6));
  let textW = Math.ceil(message.length * fontSize * charFactor);
  let groupW = textW;

  // Keep some padding so it never clips at the edges.
  const maxIters = 6;
  for (let i = 0; i < maxIters && groupW > maxGroupWidth; i++) {
    const scale = maxGroupWidth / groupW;
    stripHeight = Math.max(1, Math.floor(stripHeight * scale));
    fontSize = Math.max(1, Math.floor(stripHeight * 0.6));
    textW = Math.ceil(message.length * fontSize * charFactor);
    groupW = textW;
  }

  const canvasHeight = height + stripHeight;

  // 2) Build blurred strip background.
  // New rule (03/02/2026): use the original image, translate up to reveal the bottom strip.
  // The revealed background is a 1.1x scaled + 50% blur version of the original.
  let stripBg: Buffer;
  try {
    const scale = 1.1;
    const scaledW = Math.max(1, Math.round(width * scale));
    const scaledH = Math.max(1, Math.round(height * scale));
    const offsetX = Math.max(0, Math.round((scaledW - width) / 2));
    const offsetY = Math.max(0, Math.round((scaledH - height) / 2));

    const extractLeft = Math.max(0, Math.min(offsetX, Math.max(0, scaledW - width)));
    const extractTop = Math.max(
      0,
      Math.min(Math.round(offsetY + Math.max(0, height - stripHeight)), Math.max(0, scaledH - stripHeight)),
    );

    const blurSigma = 50;

    stripBg = await sharp(buffer, { limitInputPixels: LIMIT_PIXELS })
      .resize(scaledW, scaledH, { fit: "fill" })
      .blur(blurSigma)
      .extract({ left: extractLeft, top: extractTop, width, height: stripHeight })
      .png()
      .toBuffer();
  } catch (error) {
    console.error("[watermark] strip background failed", error);
    return { buffer, applied: false };
  }

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

  // 6) Place text centered inside the strip.
  // Text size is ~70% strip height with padding above/below.
  const padX = Math.max(10, Math.floor(width * 0.02));
  const maxTextWidth = Math.max(1, width - padX * 2);
  const effectiveTextWidth = Math.min(textW, maxTextWidth);
  const textX = Math.floor(width / 2);
  const textY = Math.floor(stripHeight / 2);

  // 7) Render text as SVG overlay (no stroke, no shadow; pure outer glow on brand).
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
      `    <filter id="vhGlow" x="-50%" y="-50%" width="200%" height="200%">\n` +
    `      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur1"/>\n` +
    `      <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur2"/>\n` +
    `      <feFlood flood-color="#ff6bd6" flood-opacity="0.55" result="color1"/>\n` +
    `      <feFlood flood-color="#a855f7" flood-opacity="0.45" result="color2"/>\n` +
    `      <feComposite in="color1" in2="blur1" operator="in" result="glow1"/>\n` +
    `      <feComposite in="color2" in2="blur2" operator="in" result="glow2"/>\n` +
      `      <feMerge>\n` +
      `        <feMergeNode in="glow1"/>\n` +
      `        <feMergeNode in="glow2"/>\n` +
      `        <feMergeNode in="SourceGraphic"/>\n` +
      `      </feMerge>\n` +
      `    </filter>\n` +
      `  </defs>\n` +
      `  <text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="700" dominant-baseline="middle" text-anchor="middle"\n` +
      `        fill="${fill}" filter="url(#vhGlow)"${shouldClampText ? ` textLength=\"${maxTextWidth}\" lengthAdjust=\"spacingAndGlyphs\"` : ""}>\n` +
      `    ${escapeXml(message).replace(escapeXml(brandText), `<tspan filter=\"url(#vhGlow)\">${escapeXml(brandText)}</tspan>`)}\n` +
      `  </text>\n` +
      `</svg>\n`,
    "utf-8",
  );

  // 8) Compose: [original image] + [strip bg (bottom)] + [text].
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
        { input: buffer, left: 0, top: 0 },
        { input: stripBg, left: 0, top: height },
        { input: textSvg, left: 0, top: height },
      ]);

    let out: Buffer;
    if (format === "jpeg" || format === "jpg") {
      out = await composited.jpeg({ quality: 100, mozjpeg: true }).toBuffer();
    } else if (format === "webp") {
      out = await composited.webp({ quality: 100, effort: 4 }).toBuffer();
    } else if (format === "png") {
      out = await composited.png({ compressionLevel: 0 }).toBuffer();
    } else {
      out = await composited.toFormat(format as any).toBuffer();
    }

    return { buffer: out, applied: true, format };
  } catch (error) {
    console.error("[watermark] composite failed", error);
    return { buffer, applied: false };
  }
}
