import {
  type ConstraintElimination,
  type DietaryRestriction,
  type RestaurantCandidate,
  type RoomMember
} from "@munchscene/shared";

export type CandidateWithDistance = RestaurantCandidate & {
  distanceMeters: number;
};

export type HardFilterOutput = {
  passing: CandidateWithDistance[];
  eliminations: ConstraintElimination[];
};

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (value: number) => (value * Math.PI) / 180;

export const haversineMeters = (
  source: { lat: number; lng: number },
  target: { lat: number; lng: number }
) => {
  const deltaLat = toRadians(target.lat - source.lat);
  const deltaLng = toRadians(target.lng - source.lng);
  const sourceLat = toRadians(source.lat);
  const targetLat = toRadians(target.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(sourceLat) * Math.cos(targetLat) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const includesAny = (content: string, terms: string[]) =>
  terms.some((term) => content.includes(term));

const satisfiesDietaryRestriction = (
  candidate: RestaurantCandidate,
  restriction: DietaryRestriction
) => {
  const haystack = normalize(
    [candidate.name, candidate.address ?? "", ...(candidate.types ?? [])].join(" ")
  );

  switch (restriction) {
    case "vegetarian":
      return includesAny(haystack, ["vegetarian", "vegan"]);
    case "vegan":
      return includesAny(haystack, ["vegan"]);
    case "halal":
      return includesAny(haystack, ["halal"]);
    case "kosher":
      return includesAny(haystack, ["kosher"]);
    case "gluten_free":
      return includesAny(haystack, ["gluten free", "gluten-free", "celiac"]);
    default:
      return true;
  }
};

export const applyHardConstraints = (input: {
  candidates: RestaurantCandidate[];
  roomOrigin: { lat: number; lng: number };
  members: RoomMember[];
}): HardFilterOutput => {
  const passing: CandidateWithDistance[] = [];
  const eliminations: ConstraintElimination[] = [];

  for (const candidate of input.candidates) {
    const reasons: string[] = [];
    const distanceMeters = haversineMeters(input.roomOrigin, {
      lat: candidate.lat,
      lng: candidate.lng
    });

    for (const member of input.members) {
      if (
        candidate.priceLevel !== undefined &&
        candidate.priceLevel > member.preferences.budgetMax
      ) {
        reasons.push(
          `${member.name}: price level ${candidate.priceLevel} exceeds budget ${member.preferences.budgetMax}`
        );
      }

      if (distanceMeters > member.preferences.maxDistanceMeters) {
        reasons.push(
          `${member.name}: distance ${Math.round(distanceMeters)}m exceeds max ${member.preferences.maxDistanceMeters}m`
        );
      }

      for (const restriction of member.preferences.dietaryRestrictions) {
        if (!satisfiesDietaryRestriction(candidate, restriction)) {
          reasons.push(`${member.name}: does not satisfy ${restriction}`);
        }
      }
    }

    if (reasons.length > 0) {
      eliminations.push({
        placeId: candidate.placeId,
        name: candidate.name,
        reasons: Array.from(new Set(reasons))
      });
      continue;
    }

    passing.push({
      ...candidate,
      distanceMeters
    });
  }

  return {
    passing,
    eliminations
  };
};
