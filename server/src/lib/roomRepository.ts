import {
  type MunchsceneRoom,
  type ResolveResult,
  type ResolveRoomResponse,
  type RoomStatus
} from "@munchscene/shared";
import { adminDb } from "./firebaseAdmin";

const roomRef = (roomId: string) => adminDb.ref(`rooms/${roomId}`);

export const getRoomById = async (roomId: string): Promise<MunchsceneRoom | null> => {
  const snapshot = await roomRef(roomId).get();
  if (!snapshot.exists()) {
    return null;
  }

  const value = snapshot.val() as MunchsceneRoom;
  return {
    ...value,
    id: value.id || roomId
  };
};

export const setRoomStatus = async (roomId: string, status: RoomStatus): Promise<void> => {
  await roomRef(roomId).update({
    status,
    updatedAt: new Date().toISOString()
  });
};

export const persistResolveResult = async (input: {
  room: MunchsceneRoom;
  result: ResolveResult;
}): Promise<ResolveRoomResponse> => {
  const updates: Record<string, unknown> = {
    [`roomResults/${input.room.id}/${input.result.id}`]: input.result,
    [`rooms/${input.room.id}/latestResultId`]: input.result.id,
    [`rooms/${input.room.id}/status`]: "complete",
    [`rooms/${input.room.id}/updatedAt`]: new Date().toISOString()
  };

  await adminDb.ref().update(updates);

  return {
    room: {
      id: input.room.id,
      code: input.room.code,
      status: "complete",
      latestResultId: input.result.id
    },
    result: input.result
  };
};
