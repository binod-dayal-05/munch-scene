import {
  DEFAULT_GOOGLE_PLACES_LIMIT,
  type MunchsceneRoom,
  type PriceLevel,
  type RestaurantCandidate
} from "@munchscene/shared";
import { serverEnv } from "../config/env";

type GoogleLocation = {
  latitude: number;
  longitude: number;
};

type PlaceSearchResult = {
  id?: string;
  displayName?: {
    text?: string;
  };
  priceLevel?:
    | "PRICE_LEVEL_FREE"
    | "PRICE_LEVEL_INEXPENSIVE"
    | "PRICE_LEVEL_MODERATE"
    | "PRICE_LEVEL_EXPENSIVE"
    | "PRICE_LEVEL_VERY_EXPENSIVE";
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  formattedAddress?: string;
  location?: GoogleLocation;
  regularOpeningHours?: {
    openNow?: boolean;
  };
  primaryType?: string;
};

type NewPlacesResponse = {
  places?: PlaceSearchResult[];
};

const placesFieldMask = [
  "places.id",
  "places.displayName",
  "places.priceLevel",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.formattedAddress",
  "places.location",
  "places.regularOpeningHours",
  "places.primaryType"
].join(",");

const priceLevelMap: Record<NonNullable<PlaceSearchResult["priceLevel"]>, PriceLevel> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4
};

const isCoordinateSet = (room: MunchsceneRoom) =>
  room.location.lat !== 0 || room.location.lng !== 0;

const buildCuisineQueries = (room: MunchsceneRoom): string[] => {
  const cuisines = Array.from(
    new Set(
      Object.values(room.members)
        .flatMap((member) => member.preferences.cuisinePreferences)
        .map((cuisine) => cuisine.trim())
        .filter(Boolean)
    )
  ).slice(0, 4);

  return cuisines.map((cuisine) => `${cuisine} restaurants in ${room.location.label}`);
};

const placesRequest = async (
  path: "searchText" | "searchNearby",
  body: Record<string, unknown>
): Promise<NewPlacesResponse> => {
  const response = await fetch(`https://places.googleapis.com/v1/places:${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": serverEnv.googlePlacesApiKey,
      "X-Goog-FieldMask": placesFieldMask
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Places API (New) ${path} failed with status ${response.status}: ${errorText}`
    );
  }

  return (await response.json()) as NewPlacesResponse;
};

const mapRestaurantCandidate = (candidate: PlaceSearchResult): RestaurantCandidate | null => {
  const location = candidate.location;
  const name = candidate.displayName?.text;

  if (!candidate.id || !name || !location) {
    return null;
  }

  return {
    placeId: candidate.id,
    name,
    priceLevel: candidate.priceLevel ? priceLevelMap[candidate.priceLevel] : undefined,
    rating: candidate.rating,
    userRatingsTotal: candidate.userRatingCount,
    types: candidate.types ?? (candidate.primaryType ? [candidate.primaryType] : []),
    address: candidate.formattedAddress,
    lat: location.latitude,
    lng: location.longitude,
    isOpenNow: candidate.regularOpeningHours?.openNow
  };
};

const normalizeListingText = (value: string) =>
  value
    .toLowerCase()
    .replace(/\(old listing\)/g, "")
    .replace(/\bold listing\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const candidateQualityScore = (candidate: RestaurantCandidate) =>
  (candidate.rating ?? 0) * 10 +
  (candidate.userRatingsTotal ?? 0) / 100 +
  (candidate.priceLevel !== undefined ? 2 : 0) +
  (candidate.isOpenNow ? 1 : 0);

const dedupeCandidates = (candidates: RestaurantCandidate[]) => {
  const deduped = new Map<string, RestaurantCandidate>();

  for (const candidate of candidates) {
    const normalizedAddress = normalizeListingText(candidate.address ?? "");
    const normalizedName = normalizeListingText(candidate.name);
    const key =
      normalizedAddress.length > 0
        ? `address:${normalizedAddress}`
        : `name:${normalizedName}`;
    const existing = deduped.get(key);

    if (!existing || candidateQualityScore(candidate) > candidateQualityScore(existing)) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values());
};

export const fetchRestaurantCandidates = async (
  room: MunchsceneRoom
): Promise<{ anchor: { lat: number; lng: number } | null; candidates: RestaurantCandidate[] }> => {
  const anchor = isCoordinateSet(room)
    ? { lat: room.location.lat, lng: room.location.lng }
    : null;

  console.log("[resolve] anchor", {
    roomId: room.id,
    city: room.location.label,
    usedStoredCoordinates: Boolean(anchor),
    anchor
  });

  const textBody: Record<string, unknown> = {
    textQuery: `restaurants in ${room.location.label}`,
    pageSize: DEFAULT_GOOGLE_PLACES_LIMIT
  };

  if (anchor) {
    textBody.locationBias = {
      circle: {
        center: {
          latitude: anchor.lat,
          longitude: anchor.lng
        },
        radius: 5000
      }
    };
  }

  const textQueries = [`restaurants in ${room.location.label}`, ...buildCuisineQueries(room)];
  const textRequests = textQueries.map((query) =>
    placesRequest("searchText", {
      ...textBody,
      textQuery: query
    })
  );
  const requests: Array<Promise<NewPlacesResponse>> = [...textRequests];

  if (anchor) {
    requests.push(
      placesRequest("searchNearby", {
        includedTypes: ["restaurant"],
        maxResultCount: DEFAULT_GOOGLE_PLACES_LIMIT,
        locationRestriction: {
          circle: {
            center: {
              latitude: anchor.lat,
              longitude: anchor.lng
            },
            radius: 5000
          }
        }
      })
    );
  }

  const responses = await Promise.all(requests);
  const textPayloads = responses.slice(0, textRequests.length);
  const nearbyPayload = anchor ? responses[responses.length - 1] : null;

  console.log("[resolve] places responses", {
    roomId: room.id,
    queries: textQueries,
    textCount: textPayloads.reduce(
      (total, payload) => total + (payload.places?.length ?? 0),
      0
    ),
    nearbyCount: nearbyPayload?.places?.length ?? 0
  });

  const rawPlaces = [
    ...textPayloads.flatMap((payload) => payload.places ?? []),
    ...(nearbyPayload?.places ?? [])
  ];

  const candidates = dedupeCandidates(
    rawPlaces
      .map(mapRestaurantCandidate)
      .filter((candidate): candidate is RestaurantCandidate => candidate !== null)
  ).slice(0, DEFAULT_GOOGLE_PLACES_LIMIT);

  console.log("[resolve] mapped candidates", {
    roomId: room.id,
    rawCount: rawPlaces.length,
    mappedCount: candidates.length,
    sample: candidates.slice(0, 3).map((candidate) => ({
      placeId: candidate.placeId,
      name: candidate.name,
      priceLevel: candidate.priceLevel,
      lat: candidate.lat,
      lng: candidate.lng
    }))
  });

  return {
    anchor,
    candidates
  };
};
