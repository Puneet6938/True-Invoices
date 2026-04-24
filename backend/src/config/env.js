import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: process.env.PORT || 5000,
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/true-invoices",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  clientUrl: process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173",
  whatsappBaseUrl: process.env.WHATSAPP_BASE_URL || "https://wa.me",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
};
