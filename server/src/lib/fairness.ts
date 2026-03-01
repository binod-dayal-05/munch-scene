import {
  computeFinalScore,
  FAIRNESS_WEIGHTS,
  type ConstraintElimination,
  type MunchsceneRoom,
  type RankedRestaurant,
  type RestaurantCandidate,
  type RoomMember,
  type UserPreferences,
  type UserScoreBreakdown,
  type VibePreference
} from "@munchscene/shared";
import { haversineDistanceMeters } from "./geo";

type EvaluationContext = {
  anchor: { lat: number; lng: number } | null;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const getRestaurantSearchText = (restaurant: RestaurantCandidate) =>
  normalizeText(
    [restaurant.name, restaurant.address, ...(restaurant.types ?? [])].join(" ")
  );

const vibeKeywords: Record<VibePreference, string[]> = {
  quiet: ["cafe", "coffee", "bakery", "tea", "bistro", "library"],
  hype: ["bar", "night_club", "pub", "music", "lounge", "grill"],
  aesthetic: ["brunch", "cafe", "dessert", "rooftop", "wine", "gallery"],
  casual: ["restaurant", "meal_takeaway", "diner", "sandwich", "pizza", "burger"]
};

const matchesDietaryRestriction = (
  restaurant: RestaurantCandidate,
  restriction: UserPreferences["dietaryRestrictions"][number]
) => {
  const haystack = getRestaurantSearchText(restaurant);
  const keywords =
    restriction === "gluten_free"
      ? ["gluten free", "gluten-free"]
      : [restriction.replace("_", " "), restriction];

  return keywords.some((keyword) => haystack.includes(keyword));
};

const isStrictDietaryRestriction = (
  restriction: UserPreferences["dietaryRestrictions"][number]
) => restriction === "halal" || restriction === "kosher" || restriction === "gluten_free";

const violatesHardConstraints = (
  room: MunchsceneRoom,
  restaurant: RestaurantCandidate,
  context: EvaluationContext
): string[] => {
  const reasons: string[] = [];

  for (const member of Object.values(room.members)) {
    const { preferences } = member;

    if (
      restaurant.priceLevel !== undefined &&
      restaurant.priceLevel > preferences.budgetMax
    ) {
      reasons.push(`${member.name} budget ceiling exceeded`);
    }

    if (context.anchor) {
      const distance = haversineDistanceMeters(
        context.anchor.lat,
        context.anchor.lng,
        restaurant.lat,
        restaurant.lng
      );

      if (distance > preferences.maxDistanceMeters) {
        reasons.push(`${member.name} max distance exceeded`);
      }
    }

    for (const restriction of preferences.dietaryRestrictions) {
      if (
        isStrictDietaryRestriction(restriction) &&
        !matchesDietaryRestriction(restaurant, restriction)
      ) {
        reasons.push(`${member.name} dietary restriction unmet: ${restriction}`);
      }
    }
  }

  return Array.from(new Set(reasons));
};

const cuisineScore = (
  restaurant: RestaurantCandidate,
  preferences: UserPreferences
): number => {
  if (preferences.cuisinePreferences.length === 0) {
    return 0.6;
  }

  const haystack = getRestaurantSearchText(restaurant);
  const matches = preferences.cuisinePreferences.filter((preference) =>
    haystack.includes(normalizeText(preference))
  ).length;

  return matches === 0 ? 0 : Math.min(1, matches / preferences.cuisinePreferences.length);
};

const vibeScore = (restaurant: RestaurantCandidate, vibe: VibePreference): number => {
  const haystack = getRestaurantSearchText(restaurant);
  const keywords = vibeKeywords[vibe];
  const matches = keywords.filter((keyword) => haystack.includes(keyword)).length;

  if (matches === 0) {
    return vibe === "casual" ? 0.5 : 0.2;
  }

  return Math.min(1, matches / Math.max(keywords.length / 2, 1));
};

const budgetComfortScore = (
  restaurant: RestaurantCandidate,
  preferences: UserPreferences
): number => {
  if (restaurant.priceLevel === undefined) {
    return 0.65;
  }

  if (restaurant.priceLevel > preferences.budgetMax) {
    return 0;
  }

  const spread = Math.max(preferences.budgetMax, 1);
  return Math.max(0.35, 1 - (preferences.budgetMax - restaurant.priceLevel) / (spread + 1));
};

const distanceComfortScore = (
  restaurant: RestaurantCandidate,
  preferences: UserPreferences,
  context: EvaluationContext
): number => {
  if (!context.anchor) {
    return 0.6;
  }

  const distance = haversineDistanceMeters(
    context.anchor.lat,
    context.anchor.lng,
    restaurant.lat,
    restaurant.lng
  );

  if (distance > preferences.maxDistanceMeters) {
    return 0;
  }

  return Math.max(0.15, 1 - distance / preferences.maxDistanceMeters);
};

const buildUserScore = (
  restaurant: RestaurantCandidate,
  member: RoomMember,
  context: EvaluationContext
): UserScoreBreakdown => {
  const cuisine = cuisineScore(restaurant, member.preferences);
  const vibe = vibeScore(restaurant, member.preferences.vibePreference);
  const budgetComfort = budgetComfortScore(restaurant, member.preferences);
  const distanceComfort = distanceComfortScore(restaurant, member.preferences, context);
  const total =
    FAIRNESS_WEIGHTS.cuisine * cuisine +
    FAIRNESS_WEIGHTS.vibe * vibe +
    FAIRNESS_WEIGHTS.budgetComfort * budgetComfort +
    FAIRNESS_WEIGHTS.distanceComfort * distanceComfort;

  return {
    cuisine,
    vibe,
    budgetComfort,
    distanceComfort,
    total
  };
};

const buildTradeoffs = (restaurant: RestaurantCandidate, scores: number[]): string[] => {
  const messages: string[] = [];

  if (restaurant.priceLevel !== undefined) {
    messages.push(`Price level ${restaurant.priceLevel} stays inside the shared ceiling.`);
  }

  if (restaurant.rating && restaurant.rating >= 4.4) {
    messages.push(`Strong rating at ${restaurant.rating.toFixed(1)} helps the tie-break.`);
  }

  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  if (minScore < 0.55) {
    messages.push("Some preferences are compromised, but nobody falls below the fairness floor.");
  } else {
    messages.push("This option stays balanced across the whole group.");
  }

  return messages.slice(0, 3);
};

export const scoreRestaurants = (
  room: MunchsceneRoom,
  candidates: RestaurantCandidate[],
  context: EvaluationContext
): {
  eliminations: ConstraintElimination[];
  rankedRestaurants: RankedRestaurant[];
} => {
  const eliminations: ConstraintElimination[] = [];
  const rankedRestaurants: RankedRestaurant[] = [];

  for (const candidate of candidates) {
    const reasons = violatesHardConstraints(room, candidate, context);

    if (reasons.length > 0) {
      eliminations.push({
        placeId: candidate.placeId,
        name: candidate.name,
        reasons
      });
      continue;
    }

    const memberScores = Object.values(room.members).map((member) =>
      buildUserScore(candidate, member, context)
    );
    const userScores = Object.fromEntries(
      Object.values(room.members).map((member, index) => [member.id, memberScores[index]])
    );
    const totals = memberScores.map((score) => score.total);
    const finalMetrics = computeFinalScore(totals, candidate.rating);

    rankedRestaurants.push({
      ...candidate,
      ...finalMetrics,
      userScores,
      keyTradeoffs: buildTradeoffs(candidate, totals)
    });
  }

  rankedRestaurants.sort((left, right) => right.finalScore - left.finalScore);

  return {
    eliminations,
    rankedRestaurants
  };
};
