const SPACE_REGEX = /\s+/g;
const NON_ALNUM_REGEX = /[^a-z0-9]+/g;
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const SPLIT_DELIMITERS = /[|/,;]+/g;

const VIETNAMESE_CHAR_MAP: Record<string, string> = {
  đ: "d",
  Đ: "D",
};

const DEFAULT_TOKEN_DELIMITERS = /[\s,;:/|]+/g;

export const SEARCH_SCOPES = ["all", "title", "alias", "character", "doujinshi"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];
export type SearchResultScope = Exclude<SearchScope, "all">;

export const DEFAULT_SCOPE: SearchScope = "all";

export function stripDiacritics(value: string): string {
  if (!value) return "";
  const normalized = value.normalize("NFD").replace(COMBINING_MARKS, "");
  return normalized
    .split("")
    .map((char) => VIETNAMESE_CHAR_MAP[char] ?? char)
    .join("");
}

export function normalizeText(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(NON_ALNUM_REGEX, " ")
    .replace(SPACE_REGEX, " ")
    .trim();
}

export function tokenizeText(value: string): string[] {
  if (!value) return [];
  return normalizeText(value)
    .split(SPACE_REGEX)
    .filter((token) => token.length > 0);
}

export function splitAliases(value?: string | string[] | null): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : value.split(SPLIT_DELIMITERS);
  return raw
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function buildTokenSet(values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  values.forEach((value) => {
    tokenizeText(value || "").forEach((token) => tokens.add(token));
  });
  return Array.from(tokens);
}

export function dedupeList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const key = value.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });
  return result;
}

export function tokensFromArrays(...arrays: Array<ReadonlyArray<string>>): string[] {
  const aggregated: string[] = [];
  arrays.forEach((items) => {
    items.forEach((item) => aggregated.push(...tokenizeText(item)));
  });
  return Array.from(new Set(aggregated));
}

export function scopeLabel(scope: SearchResultScope): string {
  switch (scope) {
    case "title":
      return "Tên truyện";
    case "alias":
      return "Tên khác";
    case "character":
      return "Nhân vật";
    case "doujinshi":
      return "Doujinshi";
    default:
      return scope;
  }
}

export const SCOPE_OPTIONS: Array<{ value: SearchScope; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "title", label: "Tên truyện" },
  { value: "alias", label: "Tên khác" },
  { value: "character", label: "Nhân vật" },
  { value: "doujinshi", label: "Doujinshi" },
];
