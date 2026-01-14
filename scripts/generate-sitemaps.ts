import { generateSitemapsToDisk } from "~/.server/services/sitemap-generator.server";

async function main() {
  const origin = (process.env.CANONICAL_ORIGIN || process.env.VITE_CANONICAL_ORIGIN || "").trim();
  const outputDir = (process.env.SITEMAP_OUTPUT_DIR || "").trim();
  const chaptersPerFile = Number(process.env.SITEMAP_CHAPTERS_PER_FILE || "10000");
  const maxUserProfiles = Number(process.env.SITEMAP_MAX_USER_PROFILES || "1000");

  const r = await generateSitemapsToDisk({
    origin: origin || undefined,
    outputDir: outputDir || undefined,
    chaptersPerFile,
    maxUserProfiles,
  });

  // eslint-disable-next-line no-console
  console.log("SITEMAP_OK", JSON.stringify(r, null, 2));
  process.exit(0);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("SITEMAP_ERROR", e);
  process.exit(1);
});
