import {
  FAIRNESS_WEIGHTS,
  computeFinalScore,
  type RankedRestaurant,
  type RoomMember,
  type UserScoreBreakdown
} from "@munchscene/shared";
import { type CandidateWithDistance } from "./hardConstraints";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const VIBE_KEYWORDS: Record<string, string[]> = {
  quiet: ["quiet", "cozy", "romantic", "fine_dining", "cafe"],
  hype: ["bar", "night", "club", "pub", "karaoke", "live_music"],
  aesthetic: ["trendy", "stylish", "brunch", "rooftop", "cocktail", "dessert"],
  casual: ["casual", "fast_food", "quick", "diner", "takeout"]
};

const round = (value: number) => Number(value.toFixed(4));

const scoreCuisine = (
  candidateText: string,
  preferences: RoomMember["preferences"]["cuisinePreferences"]
) => {
  if (preferences.length === 0) {
    return 0.7;
  }

  const normalizedPreferences = preferences
    .map((preference) => normalize(preference))
    .filter(Boolean);

  if (normalizedPreferences.length === 0) {
    return 0.7;
  }

  const matchedCount = normalizedPreferences.filter((preference) =>
    candidateText.includes(preference)
  ).length;

  return matchedCount / normalizedPreferences.length;
};

const scoreVibe = (candidateText: string, vibePreference: RoomMember["preferences"]["vibePreference"]) => {
  const keywords = VIBE_KEYWORDS[vibePreference] ?? [];
  if (keywords.length === 0) {
    return 0.65;
  }

  return keywords.some((keyword) => candidateText.includes(keyword)) ? 1 : 0.45;
};

const scoreBudgetComfort = (
  candidatePriceLevel: number | undefined,
  budgetMax: number
) => {
  if (candidatePriceLevel === undefined) {
    return 0.65;
  }

  if (candidatePriceLevel > budgetMax) {
    return 0;
  }

  const slack = budgetMax - candidatePriceLevel;
  return Math.max(0.6, 1 - slack * 0.12);
};

const scoreDistanceComfort = (distanceMeters: number, maxDistanceMeters: number) => {
  const ratio = maxDistanceMeters > 0 ? distanceMeters / maxDistanceMeters : 1;

  if (ratio <= 1) {
    return Math.max(0.2, 1 - ratio * 0.7);
  }

  return 0;
};

const toBreakdown = (input: {
  cuisine: number;
  vibe: number;
  budgetComfort: number;
  distanceComfort: number;
}): UserScoreBreakdown => {
  const total =
    input.cuisine * FAIRNESS_WEIGHTS.cuisine +
    input.vibe * FAIRNESS_WEIGHTS.vibe +
    input.budgetComfort * FAIRNESS_WEIGHTS.budgetComfort +
    input.distanceComfort * FAIRNESS_WEIGHTS.distanceComfort;

  return {
    cuisine: round(input.cuisine),
    vibe: round(input.vibe),
    budgetComfort: round(input.budgetComfort),
    distanceComfort: round(input.distanceComfort),
    total: round(total)
  };
};

const buildTradeoffs = (restaurant: RankedRestaurant): string[] => {
  const tradeoffs: string[] = [];

  if (restaurant.variance > 0.05) {
    tradeoffs.push("uneven satisfaction across members");
  }
  if (restaurant.minUserScore < 0.45) {
    tradeoffs.push("at least one member has a low comfort score");
  }
  if (restaurant.rating !== undefined && restaurant.rating < 4) {
    tradeoffs.push("lower public rating than top alternatives");
  }
  if (restaurant.priceLevel !== undefined && restaurant.priceLevel >= 3) {
    tradeoffs.push("higher price point");
  }

  return tradeoffs.slice(0, 3);
};

export const rankRestaurants = (
  candidates: CandidateWithDistance[],
  members: RoomMember[]
): RankedRestaurant[] => {
  const ranked = candidates.map((candidate) => {
    const candidateText = normalize(
      [candidate.name, candidate.address ?? "", ...(candidate.types ?? [])].join(" ")
    );

    const userScores = members.reduce<Record<string, UserScoreBreakdown>>((acc, member) => {
      const breakdown = toBreakdown({
        cuisine: scoreCuisine(candidateText, member.preferences.cuisinePreferences),
        vibe: scoreVibe(candidateText, member.preferences.vibePreference),
        budgetComfort: scoreBudgetComfort(candidate.priceLevel, member.preferences.budgetMax),
        distanceComfort: scoreDistanceComfort(
          candidate.distanceMeters,
          member.preferences.maxDistanceMeters
        )
      });

      acc[member.id] = breakdown;
      return acc;
    }, {});

    const totals = Object.values(userScores).map((score) => score.total);
    const final = computeFinalScore(totals, candidate.rating);

    const restaurant: RankedRestaurant = {
      placeId: candidate.placeId,
      name: candidate.name,
      priceLevel: candidate.priceLevel,
      rating: candidate.rating,
      userRatingsTotal: candidate.userRatingsTotal,
      types: candidate.types,
      address: candidate.address,
      lat: candidate.lat,
      lng: candidate.lng,
      isOpenNow: candidate.isOpenNow,
      photoReference: candidate.photoReference,
      finalScore: round(final.finalScore),
      meanScore: round(final.meanScore),
      fairnessScore: round(final.fairnessScore),
      variance: round(final.variance),
      minUserScore: round(final.minUserScore),
      userScores,
      explanation: undefined,
      keyTradeoffs: []
    };

    restaurant.keyTradeoffs = buildTradeoffs(restaurant);
    return restaurant;
  });

  return ranked.sort((left, right) => right.finalScore - left.finalScore);
};
