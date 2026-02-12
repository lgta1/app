import { load } from "cheerio";

import { SayHentaiAutoUpdateConfigModel } from "~/database/models/say-hentai-auto-update-config.model";

export type SayHentaiDomainConfig = {
  domain: string;
  origin: string;
};

const CONFIG_KEY = "primary";
const DEFAULT_LIST_PATH = "/?page=1";

const isAllowedHost = (host: string) => host.toLowerCase().startsWith("sayhentai.");

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, "");

const buildListUrl = (origin: string) => `${normalizeOrigin(origin)}${DEFAULT_LIST_PATH}`;

const normalizeSayHentaiMangaPath = (raw: string, origin?: string): string | null => {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;

  try {
    const url = origin ? new URL(trimmed, origin) : new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, "");
    if (!pathname || !pathname.startsWith("/")) return null;
    if (!isSayHentaiMangaPath(pathname)) return null;
    return pathname;
  } catch {
    if (!trimmed.startsWith("/")) return null;
    const pathname = trimmed.replace(/\/+$/, "");
    if (!isSayHentaiMangaPath(pathname)) return null;
    return pathname;
  }
};

const isSayHentaiMangaPath = (pathname: string) => {
  if (/^\/truyen-[^\/\?#]+\.html$/i.test(pathname)) return true;
  if (/^\/truyen-[^\/\?#]+$/i.test(pathname)) return true;
  if (/^\/truyen\/[^\/\?#]+\/?$/i.test(pathname)) return true;
  return false;
};

const extractMangaLinksFromListingHtml = (html: string, listingUrl: URL): string[] => {
  const $ = load(html);

  const MAX_LINKS = 2000;
  const seen = new Set<string>();
  const links: string[] = [];

  $("a[href]")
    .toArray()
    .forEach((el) => {
      if (links.length >= MAX_LINKS) return;
      const href = String($(el).attr("href") || "").trim();
      if (!href) return;
      if (!href.includes("truyen")) return;

      try {
        const url = new URL(href, listingUrl.origin);
        const pathname = url.pathname.replace(/\/+$/, "");
        if (!isSayHentaiMangaPath(pathname)) return;
        const full = `${listingUrl.origin}${pathname}`;
        if (seen.has(full)) return;
        seen.add(full);
        links.push(full);
      } catch {
        return;
      }
    });

  return links;
};

const normalizeDomainInput = (input: string): SayHentaiDomainConfig => {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Domain is required");

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Invalid domain format");
  }

  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Invalid domain protocol");
  }

  const hostname = url.hostname.toLowerCase();
  if (!isAllowedHost(hostname)) {
    throw new Error("Domain must start with sayhentai");
  }

  url.pathname = "";
  url.search = "";
  url.hash = "";

  return { domain: hostname, origin: url.origin };
};

const fetchListingHtml = async (origin: string) => {
  const listUrl = buildListUrl(origin);
  const res = await fetch(listUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "vi,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`Cannot reach domain (${res.status} ${res.statusText})`);
  }

  return { html: await res.text(), listUrl };
};

const fetchDomainPing = async (origin: string) => {
  const maxRedirects = 1;
  let current = normalizeOrigin(origin) + "/";

  for (let attempt = 0; attempt <= maxRedirects; attempt += 1) {
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "vi,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`Redirect without location (${res.status})`);
      const nextUrl = new URL(location, current);
      if (!isAllowedHost(nextUrl.hostname)) {
        throw new Error(`Redirected to non-sayhentai host: ${nextUrl.toString()}`);
      }
      current = nextUrl.toString();
      continue;
    }

    if (!res.ok) {
      throw new Error(`Cannot reach domain (${res.status} ${res.statusText})`);
    }
    return;
  }

  throw new Error("Too many redirects");
};

export class AutoUpdateSayHentaiService {
  static async getConfig(): Promise<SayHentaiDomainConfig | null> {
    const doc = await SayHentaiAutoUpdateConfigModel.findOne({ key: CONFIG_KEY })
      .select({ domain: 1, origin: 1 })
      .lean();
    if (!doc) return null;
    return {
      domain: String((doc as any).domain || ""),
      origin: String((doc as any).origin || ""),
    };
  }

  static async saveDomain(input: string): Promise<SayHentaiDomainConfig> {
    const normalized = normalizeDomainInput(input);
    await fetchDomainPing(normalized.origin);
    await SayHentaiAutoUpdateConfigModel.updateOne(
      { key: CONFIG_KEY },
      { $set: { domain: normalized.domain, origin: normalized.origin } },
      { upsert: true },
    );
    return normalized;
  }

  static normalizeMangaPath(input: string, origin?: string): string | null {
    return normalizeSayHentaiMangaPath(input, origin);
  }

  static async getListingData(origin: string) {
    const { html, listUrl } = await fetchListingHtml(origin);
    const listingUrl = new URL(listUrl);
    const links = extractMangaLinksFromListingHtml(html, listingUrl);
    return { links, listUrl };
  }

  static buildListUrl(origin: string) {
    return buildListUrl(origin);
  }
}
