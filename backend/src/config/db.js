import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb() {
  await mongoose.connect(env.mongodbUri);
  console.log("MongoDB connected");
}
