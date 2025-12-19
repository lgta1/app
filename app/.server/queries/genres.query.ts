import { GenresModel } from "~/database/models/genres.model";

const GENRES_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let cachedGenres: any[] | null = null;
let cachedAtMs = 0;

export const getAllGenres = async () => {
  const now = Date.now();
  if (cachedGenres && now - cachedAtMs < GENRES_CACHE_TTL_MS) {
    return cachedGenres;
  }

  const genres = await GenresModel.find({}).lean();
  cachedGenres = Array.isArray(genres) ? (genres as any[]) : [];
  cachedAtMs = now;
  return genres;
};
