import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { clientEnv } from "./config";

export const firebaseApp = initializeApp(clientEnv.firebase);
export const auth = getAuth(firebaseApp);
export const realtimeDb = getDatabase(firebaseApp);
