export const MANGA_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
};

export const MANGA_USER_STATUS = {
  ON_GOING: 0,
  COMPLETED: 1,
};

export const MANGA_CONTENT_TYPE = {
  MANGA: "MANGA",
  COSPLAY: "COSPLAY",
} as const;

export type MangaContentType = (typeof MANGA_CONTENT_TYPE)[keyof typeof MANGA_CONTENT_TYPE];
