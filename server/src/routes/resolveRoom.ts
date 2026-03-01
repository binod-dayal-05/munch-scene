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
import {
  requireFirebaseAuth,
  type AuthenticatedRequest
} from "../middleware/auth";

export const resolveRoomRouter = Router();

resolveRoomRouter.post("/rooms/:roomId/resolve", requireFirebaseAuth, async (req, res) => {
  const roomIdParam = req.params.roomId;
  const roomId = Array.isArray(roomIdParam) ? roomIdParam[0] : roomIdParam;
  const userId = (req as AuthenticatedRequest).user.uid;

  if (!roomId) {
    res.status(400).json({
      error: "Missing room id"
    });
    return;
  }

  try {
    const room = await getRoomById(roomId);

    if (!room) {
      res.status(404).json({
        error: "Room not found"
      });
      return;
    }

    if (room.createdBy !== userId) {
      res.status(403).json({
        error: "Only the room host can resolve this room"
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
