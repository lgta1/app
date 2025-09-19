import { S3Client, HeadBucketCommand, PutObjectCommand } from "@aws-sdk/client-s3";
const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const bucket   = process.env.R2_BUCKET || "vnht-images";
const s3 = new S3Client({
  region: "auto",
  endpoint,
  forcePathStyle: false,         // chuẩn cho R2
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
(async () => {
  try {
    console.log("Endpoint:", endpoint, "Bucket:", bucket);
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log("HeadBucket OK");
    const Key = `healthchecks/upload-test-${Date.now()}.txt`;
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key, Body: "ping", ContentType: "text/plain" }));
    console.log("PutObject OK:", Key);
    process.exit(0);
  } catch (e) { console.error("AWS-SDK ERROR:", e); process.exit(1); }
})();
