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
 * Tạo bucket policy cho public read access
 */
const createPublicReadPolicy = (bucketName: string) => {
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: "*",
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucketName}/*`],
      },
    ],
  };
};

/**
 * Thiết lập bucket policy thành public
 */
export const makePublicBucket = async (bucketName: string): Promise<void> => {
  try {
    const client = getMinioClient();
    const policy = createPublicReadPolicy(bucketName);

    await client.setBucketPolicy(bucketName, JSON.stringify(policy));
    console.log(`Bucket '${bucketName}' policy set to public read`);
  } catch (error) {
    console.error(`Error setting public policy for bucket '${bucketName}':`, error);
    throw error;
  }
};

/**
 * Tạo bucket nếu chưa tồn tại
 */
export const ensureBucketExists = async (
  bucketName: string,
  isPublic = false,
): Promise<void> => {
  try {
    const client = getMinioClient();
    const exists = await client.bucketExists(bucketName);

    if (!exists) {
      await client.makeBucket(bucketName);
      console.log(`Bucket '${bucketName}' created successfully`);

      // Thiết lập public policy nếu được yêu cầu
      if (isPublic) {
        await makePublicBucket(bucketName);
      }
    } else if (isPublic) {
      // Nếu bucket đã tồn tại nhưng cần public, thiết lập policy
      await makePublicBucket(bucketName);
    }
  } catch (error) {
    console.error(`Error ensuring bucket '${bucketName}' exists:`, error);
    throw error;
  }
};

/**
 * Tạo public bucket với policy read-only cho tất cả mọi người
 */
export const ensurePublicBucketExists = async (bucketName: string): Promise<void> => {
  await ensureBucketExists(bucketName, true);
};

export { minioClient };
