module.exports = {
  apps: [{
    name: "ww",
    script: "./node_modules/.bin/react-router-serve",
    args: "./build/server/index.js --port 3000",
    exec_mode: "fork",
    instances: 1,
    env: {
      NODE_ENV: "production",
      PORT: "3000",

      // Mongo giữ nguyên
      MONGO_URL: "mongodb+srv://hungnm:hungnm@test.jboefj0.mongodb.net/?retryWrites=true&w=majority&appName=test",
      MONGO_URI: "mongodb+srv://hungnm:hungnm@test.jboefj0.mongodb.net/?retryWrites=true&w=majority&appName=test",
      DB_NAME: "ww",

      // R2 qua MinIO client (logic A – giữ nguyên)
      MINIO_ENDPOINT: "f6de453e5fe8af5525fa232b5a6f498a.r2.cloudflarestorage.com",
      MINIO_USE_SSL: "true",
      MINIO_ACCESS_KEY: "c339598fd4310c28d05ab2384407d9d2",
      MINIO_SECRET_KEY: "569335d9e6adff20de9c2a0ce527c5dddce9e1f886f691f40c39fabe9a2b214e",
      MINIO_DEFAULT_BUCKET: "vnht-images",
      MINIO_REGION: "auto",
      S3_FORCE_PATH_STYLE: "false"
    }
  }]
}

