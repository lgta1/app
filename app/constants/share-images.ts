const normalizeOrigin = (value: string | undefined): string | undefined => {
	const raw = (value ?? "").trim();
	if (!raw) return undefined;
	try {
		return new URL(raw).origin;
	} catch {
		return undefined;
	}
};

const stripWww = (hostname: string): string => hostname.replace(/^www\./i, "");

const deriveCdnBase = (): string | undefined => {
	const viteCdn = ((import.meta as any)?.env?.VITE_CDN_BASE as string | undefined)?.trim();
	if (viteCdn) return viteCdn;

	const nodeCdn = ((globalThis as any)?.process?.env?.CDN_BASE as string | undefined)?.trim();
	if (nodeCdn) return nodeCdn;

	const canonical =
		normalizeOrigin((import.meta as any)?.env?.VITE_CANONICAL_ORIGIN as string | undefined) ??
		normalizeOrigin((globalThis as any)?.process?.env?.CANONICAL_ORIGIN as string | undefined) ??
		(typeof window !== "undefined" ? normalizeOrigin(window.location.origin) : undefined);

	if (canonical) {
		try {
			const host = stripWww(new URL(canonical).hostname);
			if (host) return `https://cdn.${host}`;
		} catch {}
	}

	return undefined;
};

const CDN_BASE = deriveCdnBase() ?? "https://cdn.vinahentai.xyz";

export const DEFAULT_SHARE_IMAGE = `${CDN_BASE}/test/images-story/011111111111.webp`;
export const WAIFU_SUMMON_SHARE_IMAGE = `${CDN_BASE}/test/images-story/011111111112.webp`;
export const SHARE_IMAGE_CDN_BASE = CDN_BASE;
