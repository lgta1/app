export const ENV = {
  MONGO: {
    URI:
      process.env.MONGO_URL ||
      "mongodb+srv://hungnm:hungnm@test.jboefj0.mongodb.net/?retryWrites=true&w=majority&appName=test",
    RECONNECT_INTERVAL: Number(process.env.MONGO_RECONNECT_INTERVAL) || 3000,
  },
  SESSION: {
    SECRET: process.env.SESSION_SECRET || "s3crets3crets3cret_must_be_changed",
  },
  MINIO: {
    ENDPOINT: process.env.MINIO_ENDPOINT || "localhost",
    PORT: Number(process.env.MINIO_PORT) || 9000,
    ACCESS_KEY: process.env.MINIO_ACCESS_KEY || "minioadmin",
    SECRET_KEY: process.env.MINIO_SECRET_KEY || "minioadmin",
    USE_SSL: process.env.MINIO_USE_SSL === "true" || false,
    DEFAULT_BUCKET: process.env.MINIO_DEFAULT_BUCKET || "uploads",
  },
  NODE_ENV: process.env.NODE_ENV || "development",
  LEADERBOARD: {
    daily: {
      VIEW_WEIGHT: Number(process.env.DAILY_LEADERBOARD_VIEW_WEIGHT) || 1,
      LIKE_WEIGHT: Number(process.env.DAILY_LEADERBOARD_LIKE_WEIGHT) || 0,
      COMMENT_WEIGHT: Number(process.env.DAILY_LEADERBOARD_COMMENT_WEIGHT) || 100,
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
};
