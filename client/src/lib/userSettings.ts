import { get, ref, set } from "firebase/database";
import { realtimeDb } from "./firebase";

export type ThemePreference = "light" | "dark";

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "light" || value === "dark";

const userThemeRef = (uid: string) => ref(realtimeDb, `users/${uid}/settings/theme`);

export const readUserThemePreference = async (
  uid: string
): Promise<ThemePreference | null> => {
  const snapshot = await get(userThemeRef(uid));

  if (!snapshot.exists()) {
    return null;
  }

  const value = snapshot.val();
  return isThemePreference(value) ? value : null;
};

export const saveUserThemePreference = async (
  uid: string,
  theme: ThemePreference
): Promise<void> => {
  await set(userThemeRef(uid), theme);
};
