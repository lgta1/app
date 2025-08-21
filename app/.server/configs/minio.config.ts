import { ENV } from "./env.config";

/**
 * MinIO Configuration
 * Export configuration for use in utils
 */
export const MINIO_CONFIG = {
  ENDPOINT: ENV.MINIO.ENDPOINT,
  PORT: ENV.MINIO.PORT,
  USE_SSL: ENV.MINIO.USE_SSL,
  ACCESS_KEY: ENV.MINIO.ACCESS_KEY,
  SECRET_KEY: ENV.MINIO.SECRET_KEY,
  DEFAULT_BUCKET: ENV.MINIO.DEFAULT_BUCKET,
} as const;
