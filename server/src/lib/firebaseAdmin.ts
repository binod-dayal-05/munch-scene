import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { serverEnv } from "../config/env";

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: serverEnv.firebaseProjectId,
      clientEmail: serverEnv.firebaseClientEmail,
      privateKey: serverEnv.firebasePrivateKey
    }),
    databaseURL: serverEnv.firebaseDatabaseUrl
  });

export const adminDb = getDatabase(app);
