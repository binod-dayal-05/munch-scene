import {
  DEFAULT_GOOGLE_PLACES_LIMIT,
  DEFAULT_SEARCH_RADIUS_METERS,
  type ResolveResult,
  type ResolveRoomResponse,
  type RoomMember
} from "@munchscene/shared";
import { z } from "zod";
import { addRestaurantExplanations } from "./explanations";
import { applyHardConstraints } from "./hardConstraints";
import { fetchNearbyRestaurants } from "./places";
import {
  getRoomById,
  persistResolveResult,
  setRoomStatus
} from "./roomRepository";
import { rankRestaurants } from "./ranking";

export const resolveRequestBodySchema = z
  .object({
    persistResult: z.boolean().optional(),
    includeExplanations: z.boolean().optional()
  })
  .default({});

export type ResolveRequestBody = z.infer<typeof resolveRequestBodySchema>;

const getSearchRadius = (members: RoomMember[]) => {
  const maxMemberDistance = Math.max(
    ...members.map((member) => member.preferences.maxDistanceMeters),
    DEFAULT_SEARCH_RADIUS_METERS
  );

  return Math.max(500, Math.min(maxMemberDistance, 50_000));
};

export const resolveRoom = async (
  roomId: string,
  body: ResolveRequestBody
): Promise<ResolveRoomResponse> => {
  const room = await getRoomById(roomId);
  if (!room) {
    throw new Error(`Room not found: ${roomId}`);
  }

  const members = Object.values(room.members ?? {});
  if (members.length === 0) {
    throw new Error(`Room has no members: ${roomId}`);
  }

  await setRoomStatus(room.id, "resolving");

  try {
    const candidates = await fetchNearbyRestaurants({
      lat: room.location.lat,
      lng: room.location.lng,
      radiusMeters: getSearchRadius(members),
      maxResultCount: DEFAULT_GOOGLE_PLACES_LIMIT
    });

    const filtered = applyHardConstraints({
      candidates,
      roomOrigin: {
        lat: room.location.lat,
        lng: room.location.lng
      },
      members
    });

    let rankedRestaurants = rankRestaurants(filtered.passing, members);

    if (body.includeExplanations ?? true) {
      rankedRestaurants = await addRestaurantExplanations({
        rankedRestaurants,
        members
      });
    }

    const result: ResolveResult = {
      id: crypto.randomUUID(),
      roomId: room.id,
      computedAt: new Date().toISOString(),
      eliminatedCount: filtered.eliminations.length,
      eliminations: filtered.eliminations,
      rankedRestaurants
    };

    if (body.persistResult ?? true) {
      return persistResolveResult({
        room,
        result
      });
    }

    await setRoomStatus(room.id, "complete");

    return {
      room: {
        id: room.id,
        code: room.code,
        status: "complete",
        latestResultId: room.latestResultId
      },
      result
    };
  } catch (error) {
    await setRoomStatus(room.id, "error");
    throw error;
  }
};
