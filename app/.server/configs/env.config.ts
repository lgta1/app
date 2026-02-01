export const ENV = {
  MONGO: {
    URI:
      process.env.MONGO_URL ||
      "mongodb://admin:yourpassword@localhost:27017/?authSource=admin&maxPoolSize=100&minPoolSize=10&retryWrites=true&retryReads=true&w=majority&readPreference=primaryPreferred&serverSelectionTimeoutMS=5000&connectTimeoutMS=10000",
    RECONNECT_INTERVAL: Number(process.env.MONGO_RECONNECT_INTERVAL) || 3000,
  },
  SESSION: {
    SECRET: process.env.SESSION_SECRET || "s3crets3crets3cret_must_be_changed",
  },
  MINIO: {
    get ENDPOINT() {
      return process.env.MINIO_ENDPOINT || "172.188.218.21";
    },
    get PORT() {
      return Number(process.env.MINIO_PORT) || 9000;
    },
    get ACCESS_KEY() {
      return process.env.MINIO_ACCESS_KEY || "minioadmin";
    },
    get SECRET_KEY() {
      return process.env.MINIO_SECRET_KEY || "minioadmin";
    },
    get USE_SSL() {
      return process.env.MINIO_USE_SSL === "true" || false;
    },
    get DEFAULT_BUCKET() {
      return process.env.MINIO_DEFAULT_BUCKET || "vnht-images";
    },
    get REGION() {
      return (
        process.env.MINIO_REGION ||
        ((process.env.MINIO_ENDPOINT || "").includes(".r2.cloudflarestorage.com") ? "auto" : "")
      );
    },
    get S3_FORCE_PATH_STYLE() {
      const value = process.env.S3_FORCE_PATH_STYLE;
      if (typeof value === "undefined") return undefined;
      return value === "true";
    },
  },
  LEADERBOARD: {
    daily: {
      VIEW_WEIGHT: Number(process.env.DAILY_LEADERBOARD_VIEW_WEIGHT) || 1,
      LIKE_WEIGHT: Number(process.env.DAILY_LEADERBOARD_LIKE_WEIGHT) || 0,
      COMMENT_WEIGHT: Number(process.env.DAILY_LEADERBOARD_COMMENT_WEIGHT) || 50,
    },
    weekly: {
      VIEW_WEIGHT: Number(process.env.WEEKLY_LEADERBOARD_VIEW_WEIGHT) || 1,
      LIKE_WEIGHT: Number(process.env.WEEKLY_LEADERBOARD_LIKE_WEIGHT) || 10,
      COMMENT_WEIGHT: Number(process.env.WEEKLY_LEADERBOARD_COMMENT_WEIGHT) || 0,
    },
    monthly: {
      VIEW_WEIGHT: Number(process.env.MONTHLY_LEADERBOARD_VIEW_WEIGHT) || 1,
      LIKE_WEIGHT: Number(process.env.MONTHLY_LEADERBOARD_LIKE_WEIGHT) || 5,
      COMMENT_WEIGHT: Number(process.env.MONTHLY_LEADERBOARD_COMMENT_WEIGHT) || 0,
    },
    MAX_ITEMS: Number(process.env.LEADERBOARD_MAX_ITEMS) || 10,
  },
  CANONICAL_ORIGIN: (process.env.CANONICAL_ORIGIN || process.env.VITE_CANONICAL_ORIGIN || "").trim(),
  COOKIE_DOMAIN: (() => {
    const explicit = (process.env.COOKIE_DOMAIN || "").trim();
    if (explicit) return explicit;

    // Host-only cookies are required when serving multiple apex domains
    // (e.g. vinahentai.fun + vinahentai.one). Browsers will reject a cookie
    // Domain that doesn't match the current request host.
    return undefined;
  })(),
  NODE_ENV: process.env.NODE_ENV || "development",
  IS_PRODUCTION: process.env.NODE_ENV === "production",
};
