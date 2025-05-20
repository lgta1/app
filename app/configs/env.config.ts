export const ENV = {
  MONGO: {
    URI:
      process.env.MONGO_URL ||
      "mongodb+srv://hungnm:hungnm@test.jboefj0.mongodb.net/?retryWrites=true&w=majority&appName=test",
    RECONNECT_INTERVAL: Number(process.env.MONGO_RECONNECT_INTERVAL) || 3000,
  },
};
