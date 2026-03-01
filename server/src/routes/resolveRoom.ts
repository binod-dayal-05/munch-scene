import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { ResolveResult, ResolveRoomResponse } from "@munchscene/shared";
import { fetchRestaurantCandidates } from "../lib/googlePlaces";
import { scoreRestaurants } from "../lib/fairness";
import { generateExplanation } from "../lib/gemini";
import {
  getRoomById,
  persistResolveResult,
  updateRoomStatus
} from "../lib/rooms";

export const resolveRoomRouter = Router();

resolveRoomRouter.post("/rooms/:roomId/resolve", async (req, res) => {
  const { roomId } = req.params;

  try {
    const room = await getRoomById(roomId);

    if (!room) {
      res.status(404).json({
        error: "Room not found"
      });
      return;
    }

    await updateRoomStatus(room.id, "resolving", room.latestResultId);

    const { anchor, candidates } = await fetchRestaurantCandidates(room);
    const { eliminations, rankedRestaurants } = scoreRestaurants(room, candidates, {
      anchor
    });

    await Promise.all(
      rankedRestaurants.slice(0, 3).map(async (restaurant) => {
        restaurant.explanation = await generateExplanation(
          restaurant,
          eliminations.length
        );
      })
    );

    const result: ResolveResult = {
      id: randomUUID(),
      roomId: room.id,
      computedAt: new Date().toISOString(),
      eliminatedCount: eliminations.length,
      eliminations,
      rankedRestaurants
    };

    await persistResolveResult(room.id, result.id, result);
    await updateRoomStatus(room.id, "complete", result.id);

    const response: ResolveRoomResponse = {
      room: {
        id: room.id,
        code: room.code,
        status: "complete",
        latestResultId: result.id
      },
      result
    };

    res.json(response);
  } catch (error) {
    await updateRoomStatus(roomId, "error").catch(() => undefined);

    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to resolve room"
    });
  }
});

