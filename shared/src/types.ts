import {
  DIETARY_RESTRICTION_OPTIONS,
  VIBE_OPTIONS
} from "./constants";

export type DietaryRestriction = (typeof DIETARY_RESTRICTION_OPTIONS)[number];
export type VibePreference = (typeof VIBE_OPTIONS)[number];

export type PriceLevel = 0 | 1 | 2 | 3 | 4;

export type RoomStatus = "lobby" | "resolving" | "complete" | "error";

export type UserPreferences = {
  budgetMax: PriceLevel;
  dietaryRestrictions: DietaryRestriction[];
  cuisinePreferences: string[];
  vibePreference: VibePreference;
  maxDistanceMeters: number;
};

export type RoomMember = {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: string;
  preferences: UserPreferences;
};

export type RoomLocation = {
  label: string;
  lat: number;
  lng: number;
};

export type MunchsceneRoom = {
  id: string;
  code: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: RoomStatus;
  location: RoomLocation;
  members: Record<string, RoomMember>;
  latestResultId?: string;
};

export type RestaurantCandidate = {
  placeId: string;
  name: string;
  priceLevel?: PriceLevel;
  rating?: number;
  userRatingsTotal?: number;
  types: string[];
  address?: string;
  lat: number;
  lng: number;
  isOpenNow?: boolean;
  photoReference?: string;
};

export type UserScoreBreakdown = {
  cuisine: number;
  vibe: number;
  budgetComfort: number;
  distanceComfort: number;
  total: number;
};

export type RankedRestaurant = RestaurantCandidate & {
  finalScore: number;
  meanScore: number;
  fairnessScore: number;
  variance: number;
  minUserScore: number;
  userScores: Record<string, UserScoreBreakdown>;
  explanation?: string;
  keyTradeoffs: string[];
};

export type ConstraintElimination = {
  placeId: string;
  name: string;
  reasons: string[];
};

export type ResolveResult = {
  id: string;
  roomId: string;
  computedAt: string;
  eliminatedCount: number;
  eliminations: ConstraintElimination[];
  rankedRestaurants: RankedRestaurant[];
};

export type ResolveRoomResponse = {
  room: Pick<MunchsceneRoom, "id" | "code" | "status" | "latestResultId">;
  result: ResolveResult;
};

