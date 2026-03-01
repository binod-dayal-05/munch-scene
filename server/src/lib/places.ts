import {
  DEFAULT_GOOGLE_PLACES_LIMIT,
  DEFAULT_SEARCH_RADIUS_METERS,
  type PriceLevel,
  type RestaurantCandidate
} from "@munchscene/shared";
import { serverEnv } from "../config/env";

type PlacesNearbySearchRequest = {
  includedTypes: string[];
  maxResultCount: number;
  locationRestriction: {
    circle: {
      center: {
        latitude: number;
        longitude: number;
      };
      radius: number;
    };
  };
};

type PlacesNearbySearchResponse = {
  places?: GooglePlace[];
};

type GooglePlace = {
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
  location?: {
    latitude?: number;
    longitude?: number;
  };
  regularOpeningHours?: {
    openNow?: boolean;
  };
  photos?: Array<{
    name?: string;
  }>;
};

const PLACES_NEARBY_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchNearby";

const GOOGLE_PLACE_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.priceLevel",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.formattedAddress",
  "places.location",
  "places.regularOpeningHours.openNow",
  "places.photos.name"
].join(",");

const toPriceLevel = (value: GooglePlace["priceLevel"]): PriceLevel | undefined => {
  switch (value) {
    case "PRICE_LEVEL_FREE":
      return 0;
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return undefined;
  }
};

const toCandidate = (place: GooglePlace): RestaurantCandidate | null => {
  if (
    !place.id ||
    !place.displayName?.text ||
    place.location?.latitude === undefined ||
    place.location.longitude === undefined
  ) {
    return null;
  }

  return {
    placeId: place.id,
    name: place.displayName.text,
    priceLevel: toPriceLevel(place.priceLevel),
    rating: place.rating,
    userRatingsTotal: place.userRatingCount,
    types: place.types ?? [],
    address: place.formattedAddress,
    lat: place.location.latitude,
    lng: place.location.longitude,
    isOpenNow: place.regularOpeningHours?.openNow,
    photoReference: place.photos?.[0]?.name
  };
};

export const fetchNearbyRestaurants = async (input: {
  lat: number;
  lng: number;
  radiusMeters?: number;
  maxResultCount?: number;
}): Promise<RestaurantCandidate[]> => {
  const payload: PlacesNearbySearchRequest = {
    includedTypes: ["restaurant"],
    maxResultCount: input.maxResultCount ?? DEFAULT_GOOGLE_PLACES_LIMIT,
    locationRestriction: {
      circle: {
        center: {
          latitude: input.lat,
          longitude: input.lng
        },
        radius: input.radiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS
      }
    }
  };

  const response = await fetch(PLACES_NEARBY_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": serverEnv.googlePlacesApiKey,
      "X-Goog-FieldMask": GOOGLE_PLACE_FIELD_MASK
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Places nearby search failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as PlacesNearbySearchResponse;

  return (data.places ?? [])
    .map(toCandidate)
    .filter((candidate): candidate is RestaurantCandidate => candidate !== null);
};
