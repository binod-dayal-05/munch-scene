import { type ResolveRoomResponse } from "@munchscene/shared";
import { Router } from "express";
import { z } from "zod";
import { resolveRequestBodySchema, resolveRoom } from "../lib/resolveRoom";

export const resolveRouter = Router();

resolveRouter.post(
  "/rooms/:id/resolve",
  async (req, res): Promise<void> => {
    const roomId = req.params.id;

    if (!roomId) {
      res.status(400).json({
        error: "Missing room id in request path."
      });
      return;
    }

    try {
      const body = resolveRequestBodySchema.parse(req.body);
      const response: ResolveRoomResponse = await resolveRoom(roomId, body);
      res.status(200).json(response);
      return;
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid request body.",
          details: error.issues
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unexpected server error.";
      const status = message.startsWith("Room not found") ? 404 : 500;
      res.status(status).json({ error: message });
      return;
    }
  }
);
