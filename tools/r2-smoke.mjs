import { Client } from "minio";
const cfg = {
  endPoint: process.env.MINIO_ENDPOINT,   // KHÔNG có https://, chỉ hostname
  port: 443,
  useSSL: true,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  region: process.env.MINIO_REGION || "auto",
  pathStyle: false, // R2 thường dùng virtual-hosted style
};
const c = new Client(cfg);
(async () => {
  try {
    const bucket = process.env.MINIO_DEFAULT_BUCKET || "vnht-images";
    console.log("CFG:", cfg);
    console.log("bucketExists:", await c.bucketExists(bucket));
    const name = `healthchecks/upload-test-${Date.now()}.txt`;
    await c.putObject(bucket, name, Buffer.from("ping-"+Date.now()));
    console.log("putObject OK:", name);
    process.exit(0);
  } catch (e) {
    console.error("SMOKE ERROR:", e);
    process.exit(1);
  }
})();
