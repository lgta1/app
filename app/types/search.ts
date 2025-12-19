import type { SearchResultScope, SearchScope } from "~/utils/text-normalize";

export type SmartSearchHit = {
  id: string;
  slug?: string;
  title: string;
  poster: string;
  genres: string[];
  chapters: number;
  scope: SearchResultScope;
  altTitle?: string;
  highlight?: {
    field: SearchResultScope;
    snippet: string;
  };
};

export interface SmartSearchResponse {
  items: SmartSearchHit[];
  hasMore: boolean;
  nextOffset: number;
  total: number;
  requestedOffset: number;
  scope: SearchScope;
  resolvedQuery: string;
}
