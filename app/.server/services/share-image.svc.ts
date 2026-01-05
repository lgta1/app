import { promises as fs } from "fs";
import path from "path";
import { execFileSync } from "child_process";
import sharp from "sharp";

import { uploadToPublicBucket } from "~/utils/minio.utils";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 630;
// Layout dựa trên % để giữ ổn định theo kích thước ảnh.
// Spec: poster cách lề trái 1% (w) và lề trên/lề dưới 2% (h).
const PADDING_X = Math.round(CANVAS_WIDTH * 0.01);
const PADDING_Y = Math.round(CANVAS_HEIGHT * 0.02);

const POSTER_TOP = PADDING_Y;
const POSTER_LEFT = PADDING_X;
const POSTER_HEIGHT = CANVAS_HEIGHT - PADDING_Y * 2;
const POSTER_WIDTH = Math.round((POSTER_HEIGHT / 4) * 3); // giữ tỷ lệ 3:4

// Title nằm bên phải poster và phải có safe padding.
const TEXT_AREA_LEFT = POSTER_LEFT + POSTER_WIDTH + PADDING_X;
const TEXT_AREA_WIDTH = CANVAS_WIDTH - TEXT_AREA_LEFT - PADDING_X;

// Title cho phép xuống dòng tự nhiên nhưng giới hạn diện tích.
const TITLE_MAX_LINES = 4;
const SHARE_PREFIX = "images-story";
const LOGO_PATH = path.resolve(process.cwd(), "public/images/logo2.webp");
const LOGO_TARGET_WIDTH = Math.round(CANVAS_WIDTH * 0.3);

let cachedLogo: Buffer | null = null;
let cachedTitleFontFamily: string | null = null;

const escapeSvgText = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const ellipsizeToFit = (text: string, maxChars: number) => {
  const safe = String(text ?? "").trim();
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
};

const splitLongWord = (word: string, maxCharsPerLine: number) => {
  const chunks: string[] = [];
  let cursor = word;
  while (cursor.length > maxCharsPerLine) {
    chunks.push(cursor.slice(0, maxCharsPerLine));
    cursor = cursor.slice(maxCharsPerLine);
  }
  if (cursor) chunks.push(cursor);
  return chunks;
};

const pickTitleFontFamily = () => {
  if (cachedTitleFontFamily) return cachedTitleFontFamily;

  const preferredFonts = ["Inter", "Segoe UI", "Roboto"] as const;
  try {
    // Prefer fontconfig if available (common on Linux). This runs on the server where sharp renders SVG.
    const out = execFileSync("fc-list", ["--format", "%{family}\n"], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });

    const installed = new Set(
      out
        .split("\n")
        .flatMap((line) => line.split(","))
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.toLowerCase()),
    );

    for (const font of preferredFonts) {
      if (installed.has(font.toLowerCase())) {
        cachedTitleFontFamily = font;
        return cachedTitleFontFamily;
      }
    }
  } catch {
    // If fc-list isn't available, fall through to default.
  }

  cachedTitleFontFamily = "sans-serif";
  return cachedTitleFontFamily;
};

const wrapAndTruncateTitle = (rawTitle: string, maxCharsPerLine: number) => {
  const normalized = String(rawTitle ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const withEllipsis = (line: string) => {
    const safe = String(line ?? "").trimEnd();
    if (!safe) return "…";
    if (safe.endsWith("…")) return ellipsizeToFit(safe, maxCharsPerLine);
    return ellipsizeToFit(`${safe}…`, maxCharsPerLine);
  };

  const words = normalized.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const pushLine = (line: string) => {
    if (!line) return;
    lines.push(line);
  };

  for (const originalWord of words) {
    const wordParts = originalWord.length > maxCharsPerLine ? splitLongWord(originalWord, maxCharsPerLine) : [originalWord];
    for (const word of wordParts) {
      const candidate = current ? `${current} ${word}` : word;

      if (candidate.length <= maxCharsPerLine) {
        current = candidate;
        continue;
      }

      pushLine(current);
      current = word;

      if (lines.length >= TITLE_MAX_LINES) {
        const lastIdx = TITLE_MAX_LINES - 1;
        lines[lastIdx] = withEllipsis(lines[lastIdx] || "");
        return lines;
      }
    }
  }

  if (current && lines.length < TITLE_MAX_LINES) {
    pushLine(current);
  }

  if (lines.length > TITLE_MAX_LINES) {
    lines.length = TITLE_MAX_LINES;
  }

  return lines.length ? lines : [ellipsizeToFit(normalized, Math.max(8, maxCharsPerLine))];
};

const createTitleSvg = (title: string, boxHeight: number, fontFamily: string) => {
  // Ước lượng wrap theo ký tự để tránh cắt chữ giữa chừng.
  const maxCharsPerLine = Math.max(12, Math.floor(TEXT_AREA_WIDTH / 30));
  const lines = wrapAndTruncateTitle(title, maxCharsPerLine).slice(0, TITLE_MAX_LINES).map(escapeSvgText);
  const svgHeight = Math.max(120, boxHeight);
  const lineHeight = 62;
  const startY = 78;

  const safeFont = escapeSvgText(fontFamily);

  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${TEXT_AREA_WIDTH}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-family: '${safeFont}'; font-size: 52px; font-weight: 700; fill: #ffffff; }
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
  subtitle = "vinahentai.xyz",
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
    const titleBoxHeight = Math.max(120, CANVAS_HEIGHT - (logoHeight > 0 ? logoHeight : 0) - PADDING_Y * 2);
    const titleFontFamily = pickTitleFontFamily();
    const titleSvg = await createTitleSvg(title, titleBoxHeight, titleFontFamily);

    const composites: sharp.OverlayOptions[] = [
      { input: gradient },
      {
        input: foreground,
        left: POSTER_LEFT,
        top: POSTER_TOP,
      },
      {
        input: titleSvg,
        left: TEXT_AREA_LEFT,
        top: PADDING_Y,
      },
    ];

    if (logo) {
      composites.push({
        input: logo,
        left: Math.max(0, CANVAS_WIDTH - (logoWidth || LOGO_TARGET_WIDTH) - PADDING_X),
        top: Math.max(0, CANVAS_HEIGHT - (logoHeight || 0) - PADDING_Y),
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
