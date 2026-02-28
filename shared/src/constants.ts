export const APP_NAME = "Munchscene";
export const MAX_ROOM_SIZE = 10;
export const DEFAULT_SEARCH_RADIUS_METERS = 4000;
export const DEFAULT_GOOGLE_PLACES_LIMIT = 24;

export const FAIRNESS_WEIGHTS = {
  cuisine: 0.4,
  vibe: 0.2,
  budgetComfort: 0.2,
  distanceComfort: 0.2,
  variancePenalty: 0.6,
  lowFloorPenalty: 0.4,
  ratingBonusCap: 0.05,
  lowFloorThreshold: 0.35
} as const;

export const DIETARY_RESTRICTION_OPTIONS = [
  "vegetarian",
  "vegan",
  "halal",
  "kosher",
  "gluten_free"
] as const;

export const VIBE_OPTIONS = [
  "quiet",
  "hype",
  "aesthetic",
  "casual"
] as const;

