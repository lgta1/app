import mongoose from "mongoose";
import mongooseLeanId from "mongoose-lean-id";

import { ENV } from "@/configs/env.config";

const connectMongoDB = () => {
  console.info("Connecting to MongoDB...");
  mongoose
    .connect(ENV.MONGO.URI, {
      maxPoolSize: ENV.MONGO.MAX_POOL_SIZE,
      minPoolSize: ENV.MONGO.MIN_POOL_SIZE,
    })
    .catch((err: any) => {
      console.error("Error connecting MongoDB: " + err);
      console.info(`MongoDB reconnecting in ${ENV.MONGO.RECONNECT_INTERVAL / 1000}s`);
      setTimeout(connectMongoDB, ENV.MONGO.RECONNECT_INTERVAL);
    });
};

export const initMongoDB = () => {
  if (ENV.NODE_ENV === "development") {
    mongoose.set("debug", true);
    mongoose.set("debug", { color: true });
  }

  // Thiết lập plugin lean-id cho tất cả schema
  mongoose.plugin(mongooseLeanId);

  connectMongoDB();

  mongoose.connection.on("connected", () => {
    console.info("Connected to MongoDB!");
  });

  mongoose.connection.on("reconnected", () => {
    console.info("MongoDB reconnected!");
  });

  mongoose.connection.on("error", (error: any) => {
    console.error(`Error in MongoDB connection: ${error}`);
    mongoose
      .disconnect()
      .catch((err: any) => console.error(`Error disconnecting from MongoDB: ${err}`));
  });

  mongoose.connection.on("disconnected", () => {
    console.error(`MongoDB disconnected!`);
  });
};
