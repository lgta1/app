import { ENV } from "./env.config";

/**
 * MinIO Configuration
 * Export configuration for use in utils
 */
export const MINIO_CONFIG = {
  get ENDPOINT() {
    return ENV.MINIO.ENDPOINT;
  },
  get PORT() {
    return ENV.MINIO.PORT;
  },
  get USE_SSL() {
    return ENV.MINIO.USE_SSL;
  },
  get ACCESS_KEY() {
    return ENV.MINIO.ACCESS_KEY;
  },
  get SECRET_KEY() {
    return ENV.MINIO.SECRET_KEY;
  },
  get DEFAULT_BUCKET() {
    return ENV.MINIO.DEFAULT_BUCKET;
  },
  get REGION() {
    return ENV.MINIO.REGION;
  },
  get S3_FORCE_PATH_STYLE() {
    return ENV.MINIO.S3_FORCE_PATH_STYLE;
  },
} as const;
