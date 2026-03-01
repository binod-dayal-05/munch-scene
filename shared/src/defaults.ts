import { DEFAULT_SEARCH_RADIUS_METERS } from "./constants";
import { type RoomMember, type UserPreferences } from "./types";

export const defaultUserPreferences = (): UserPreferences => ({
  budgetMax: 2,
  dietaryRestrictions: [],
  cuisinePreferences: [],
  vibePreference: "Casual",
  maxDistanceMeters: DEFAULT_SEARCH_RADIUS_METERS
});

export const createEmptyMember = (
  id: string,
  name: string,
  isHost = false
): RoomMember => ({
  id,
  name,
  isHost,
  joinedAt: new Date().toISOString(),
  preferences: defaultUserPreferences()
});
