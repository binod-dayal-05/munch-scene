import type { ResolveResult, RankedRestaurant, ConstraintElimination, PriceLevel } from "@munchscene/shared";

/**
 * Raw shape that Firebase or your API might return.
 * Extend this type to match your actual API response; the adapter normalizes to ResolveResult.
 */
export type RawResolvePayload = {
  id: string;
  roomId: string;
  computedAt: string;
  eliminatedCount: number;
  eliminations?: Array<{ placeId: string; name: string; reasons: string[] }>;
  rankedRestaurants?: RawRankedRestaurant[];
};

export type RawRankedRestaurant = {
  placeId: string;
  name: string;
  priceLevel?: number;
  rating?: number;
  userRatingsTotal?: number;
  types: string[];
  address?: string;
  lat: number;
  lng: number;
  isOpenNow?: boolean;
  photoReference?: string;
  finalScore: number;
  meanScore: number;
  fairnessScore: number;
  variance: number;
  minUserScore: number;
  userScores: Record<string, { cuisine: number; vibe: number; budgetComfort: number; distanceComfort: number; total: number }>;
  explanation?: string | null;
  keyTradeoffs?: string[];
};

type RawElimination = { placeId: string; name: string; reasons: string[] };

function mapElimination(e: RawElimination): ConstraintElimination {
  return {
    placeId: e.placeId,
    name: e.name,
    reasons: Array.isArray(e.reasons) ? e.reasons : [],
  };
}

function mapRanked(r: RawRankedRestaurant): RankedRestaurant {
  const priceLevel: PriceLevel | undefined =
    r.priceLevel != null && r.priceLevel >= 0 && r.priceLevel <= 4
      ? (r.priceLevel as PriceLevel)
      : undefined;
  return {
    placeId: r.placeId,
    name: r.name,
    priceLevel,
    rating: r.rating,
    userRatingsTotal: r.userRatingsTotal,
    types: r.types ?? [],
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    isOpenNow: r.isOpenNow,
    photoReference: r.photoReference,
    finalScore: r.finalScore,
    meanScore: r.meanScore,
    fairnessScore: r.fairnessScore,
    variance: r.variance,
    minUserScore: r.minUserScore,
    userScores: r.userScores ?? {},
    explanation: r.explanation ?? undefined,
    keyTradeoffs: Array.isArray(r.keyTradeoffs) ? r.keyTradeoffs : [],
  };
}

/**
 * Adapt raw API/Firebase payload to ResolveResult.
 * Use this when replacing mocks with real data so the UI keeps a single contract.
 */
export function adaptResolveResult(raw: RawResolvePayload): ResolveResult {
  return {
    id: raw.id,
    roomId: raw.roomId,
    computedAt: raw.computedAt,
    eliminatedCount: raw.eliminatedCount ?? 0,
    eliminations: (raw.eliminations ?? []).map(mapElimination),
    rankedRestaurants: (raw.rankedRestaurants ?? []).map(mapRanked),
  };
}
