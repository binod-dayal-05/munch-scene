import { config as loadDotenv } from "dotenv";

loadDotenv({ path: "../.env" });

const requiredServerEnvKeys = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_DATABASE_URL",
  "GOOGLE_PLACES_API_KEY",
  "OPENROUTER_API_KEY"
] as const;

type RequiredServerEnvKey = (typeof requiredServerEnvKeys)[number];

const readEnv = (key: RequiredServerEnvKey): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required server env var: ${key}`);
  }

  return value;
};

const readOptionalBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

export const serverEnv = {
  port: Number(process.env.PORT ?? 8080),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  devBypassAuth: readOptionalBoolean(process.env.DEV_BYPASS_AUTH, false),
  firebaseProjectId: readEnv("FIREBASE_PROJECT_ID"),
  firebaseClientEmail: readEnv("FIREBASE_CLIENT_EMAIL"),
  firebasePrivateKey: readEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  firebaseDatabaseUrl: readEnv("FIREBASE_DATABASE_URL"),
  googlePlacesApiKey: readEnv("GOOGLE_PLACES_API_KEY"),
  openRouterApiKey: readEnv("OPENROUTER_API_KEY"),
  openRouterModel: process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash"
};
