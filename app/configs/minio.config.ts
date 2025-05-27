import * as Minio from "minio";

import { ENV } from "./env.config";

// Singleton MinIO client instance
let minioClient: Minio.Client | null = null;

/**
 * Tạo và trả về MinIO client instance
 */
export const getMinioClient = (): Minio.Client => {
  if (!minioClient) {
    minioClient = new Minio.Client({
      endPoint: ENV.MINIO.ENDPOINT,
      port: ENV.MINIO.PORT,
      useSSL: ENV.MINIO.USE_SSL,
      accessKey: ENV.MINIO.ACCESS_KEY,
      secretKey: ENV.MINIO.SECRET_KEY,
    });
  }
  return minioClient;
};

/**
 * Kiểm tra kết nối MinIO
 */
export const testMinioConnection = async (): Promise<boolean> => {
  try {
    const client = getMinioClient();
    await client.listBuckets();
    return true;
  } catch (error) {
    console.error("MinIO connection failed:", error);
    return false;
  }
};

/**
 * Tạo bucket nếu chưa tồn tại
 */
export const ensureBucketExists = async (bucketName: string): Promise<void> => {
  try {
    const client = getMinioClient();
    const exists = await client.bucketExists(bucketName);

    if (!exists) {
      await client.makeBucket(bucketName);
      console.log(`Bucket '${bucketName}' created successfully`);
    }
  } catch (error) {
    console.error(`Error ensuring bucket '${bucketName}' exists:`, error);
    throw error;
  }
};

export { minioClient };
