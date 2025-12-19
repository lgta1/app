import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

import { uploadToPublicBucket } from "~/utils/minio.utils";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 630;
// Poster nằm tràn viền trái và full-height theo spec.
const POSTER_HEIGHT = CANVAS_HEIGHT;
const POSTER_WIDTH = Math.round((POSTER_HEIGHT / 4) * 3); // giữ tỷ lệ 3:4
const POSTER_LEFT = 0;

// Title nằm bên phải poster và phải có safe padding.
const SAFE_PADDING = 48;
const TEXT_AREA_LEFT = POSTER_LEFT + POSTER_WIDTH + SAFE_PADDING;
const TEXT_AREA_WIDTH = CANVAS_WIDTH - TEXT_AREA_LEFT - SAFE_PADDING;

// Title cho phép xuống dòng tự nhiên nhưng giới hạn diện tích.
const TITLE_MAX_LINES = 3;
const TITLE_MAX_CHARS = 40;
const SHARE_PREFIX = "images-story";
const LOGO_PATH = path.resolve(process.cwd(), "public/images/logo.webp");
const LOGO_TARGET_WIDTH = Math.round(CANVAS_WIDTH * 0.3);

let cachedLogo: Buffer | null = null;

const escapeSvgText = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const truncateTitleForPreview = (title: string) => {
  const raw = String(title ?? "").trim();
  if (raw.length <= TITLE_MAX_CHARS) return raw;

  // Cắt tối đa 40 ký tự, không cắt giữa chừng: lùi về dấu cách gần nhất.
  const cut = raw.slice(0, TITLE_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace >= 12 ? cut.slice(0, lastSpace) : cut;
  return `${safe.trimEnd()}...`;
};

const wrapTitle = (title: string, maxCharsPerLine: number) => {
  const words = title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
    if (lines.length >= TITLE_MAX_LINES) break;
  }

  if (lines.length < TITLE_MAX_LINES && current) {
    lines.push(current);
  }

  if (lines.length > TITLE_MAX_LINES) {
    lines.length = TITLE_MAX_LINES;
  }

  if (lines.length === TITLE_MAX_LINES && words.length > 0) {
    const lastIdx = lines.length - 1;
    if (lines[lastIdx].length > maxCharsPerLine) {
      lines[lastIdx] = `${lines[lastIdx].slice(0, Math.max(0, maxCharsPerLine - 1)).trimEnd()}…`;
    }
  }

  return lines.length ? lines : [title.slice(0, Math.max(8, maxCharsPerLine))];
};

const createTitleSvg = (title: string, boxHeight: number) => {
  const safeTitle = truncateTitleForPreview(title);
  // Ước lượng wrap theo ký tự để tránh cắt chữ giữa chừng.
  const maxCharsPerLine = Math.max(12, Math.floor(TEXT_AREA_WIDTH / 30));
  const lines = wrapTitle(safeTitle, maxCharsPerLine).map(escapeSvgText);
  const svgHeight = Math.max(120, boxHeight);
  const lineHeight = 62;
  const startY = 78;

  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${TEXT_AREA_WIDTH}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 52px; font-weight: 700; fill: #ffffff; }
  </style>
  ${lines
    .map((line, index) => `<text x="0" y="${startY + index * lineHeight}" class="title">${line}</text>`)
    .join("\n")}
</svg>`);
};

const getLogoBuffer = async () => {
  if (cachedLogo) return cachedLogo;
  try {
    cachedLogo = await fs.readFile(LOGO_PATH);
  } catch (error) {
    console.error("[share-image] Không thể đọc logo", error);
    cachedLogo = null;
  }
  return cachedLogo;
};

const fetchPosterBuffer = async (posterUrl: string): Promise<Buffer | null> => {
  try {
    const response = await fetch(posterUrl);
    if (!response.ok) {
      console.error("[share-image] Poster không hợp lệ", posterUrl, response.status);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("[share-image] Không tải được poster", posterUrl, error);
    return null;
  }
};

const buildGradientOverlay = () =>
  Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0f0a18" stop-opacity="0.85" />
      <stop offset="55%" stop-color="#120c1f" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#0b0712" stop-opacity="0.7" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)" />
</svg>`);

const buildPosterBackground = async (poster: Buffer) =>
  sharp(poster)
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: "cover" })
    .blur(20)
    .modulate({ brightness: 0.85, saturation: 0.95 })
    .toBuffer();

const buildPosterForeground = async (poster: Buffer) =>
  sharp(poster)
    .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: "cover" })
    .toBuffer();

const buildLogo = async () => {
  const logo = await getLogoBuffer();
  if (!logo) return null;
  return sharp(logo)
    .resize({ width: LOGO_TARGET_WIDTH, fit: "inside" })
    .ensureAlpha()
    .toBuffer();
};

export const generateMangaShareImage = async ({
  mangaId,
  title,
  posterUrl,
  subtitle = "vinahentai.com",
}: {
  mangaId: string;
  title: string;
  posterUrl?: string | null;
  subtitle?: string;
}): Promise<string | null> => {
  if (!posterUrl) return null;

  const posterBuffer = await fetchPosterBuffer(posterUrl);
  if (!posterBuffer) return null;

  try {
    const [background, foreground, logo, gradient] = await Promise.all([
      buildPosterBackground(posterBuffer),
      buildPosterForeground(posterBuffer),
      buildLogo(),
      buildGradientOverlay(),
    ]);

    // Logo cần biết kích thước thực tế để canh right=0 bottom=0
    const logoMeta = logo ? await sharp(logo).metadata().catch(() => null) : null;
    const logoWidth = Math.max(0, Number(logoMeta?.width ?? 0));
    const logoHeight = Math.max(0, Number(logoMeta?.height ?? 0));
    const titleBoxHeight = Math.max(120, CANVAS_HEIGHT - (logoHeight > 0 ? logoHeight : 0) - SAFE_PADDING);
    const titleSvg = await createTitleSvg(title, titleBoxHeight);

    const composites: sharp.OverlayOptions[] = [
      { input: gradient },
      {
        input: foreground,
        left: POSTER_LEFT,
        top: 0,
      },
      {
        input: titleSvg,
        left: TEXT_AREA_LEFT,
        top: SAFE_PADDING,
      },
    ];

    if (logo) {
      composites.push({
        input: logo,
        left: Math.max(0, CANVAS_WIDTH - (logoWidth || LOGO_TARGET_WIDTH)),
        top: Math.max(0, CANVAS_HEIGHT - (logoHeight || 0)),
      });
    }

    const webpBuffer = await sharp(background)
      .composite(composites)
      .webp({ quality: 85 })
      .toBuffer();

    const uploadResult = await uploadToPublicBucket(webpBuffer, `${mangaId}.webp`, {
      prefixPath: SHARE_PREFIX,
      contentType: "image/webp",
      cacheControl: "public,max-age=604800,immutable",
    });

    return uploadResult.url;
  } catch (error) {
    console.error("[share-image] Lỗi khi tạo cover", error);
    return null;
  }
};
