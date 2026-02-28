import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { clientEnv } from "./config";

export const firebaseApp = initializeApp(clientEnv.firebase);
export const realtimeDb = getDatabase(firebaseApp);

