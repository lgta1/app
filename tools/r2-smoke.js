const { Client } = require("minio");

const cfg = {
  endPoint: process.env.MINIO_ENDPOINT,  // f6de4....r2.cloudflarestorage.com (KHÔNG có https://)
  port: 443,
  useSSL: String(process.env.MINIO_USE_SSL).toLowerCase() !== "false",
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  region: process.env.MINIO_REGION || "auto",
  // path style theo env hiện tại (true) — nếu lỗi sẽ thử false
  pathStyle: String(process.env.S3_FORCE_PATH_STYLE).toLowerCase() === "true",
};

const c = new Client(cfg);
(async () => {
  try {
    const bucket = process.env.MINIO_DEFAULT_BUCKET || "vnht-images";
    console.log("CFG:", cfg);
    console.log("bucketExists:", await c.bucketExists(bucket));
    const name = `healthchecks/upload-test-${Date.now()}.txt`;
    await c.putObject(bucket, name, Buffer.from("ping-" + Date.now()));
    console.log("putObject OK:", name);
    process.exit(0);
  } catch (e) {
    console.error("SMOKE ERROR:", e);
    process.exit(1);
  }
})();
