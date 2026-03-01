import { defaultUserPreferences, type MunchsceneRoom, type RoomMember } from "@munchscene/shared";
import { adminDb } from "./firebaseAdmin";

const normalizeMember = (member: RoomMember): RoomMember => ({
  ...member,
  preferences: {
    ...defaultUserPreferences(),
    ...member.preferences,
    dietaryRestrictions: member.preferences?.dietaryRestrictions ?? [],
    cuisinePreferences: member.preferences?.cuisinePreferences ?? []
  }
});

export const normalizeRoom = (room: MunchsceneRoom): MunchsceneRoom => ({
  ...room,
  roomName: room.roomName?.trim() || room.location.label || `Room ${room.code}`,
  members: Object.fromEntries(
    Object.entries(room.members ?? {}).map(([memberId, member]) => [
      memberId,
      normalizeMember(member)
    ])
  )
});

export const getRoomById = async (roomId: string): Promise<MunchsceneRoom | null> => {
  const snapshot = await adminDb.ref(`rooms/${roomId}`).get();

  if (!snapshot.exists()) {
    return null;
  }

  return normalizeRoom(snapshot.val() as MunchsceneRoom);
};

export const updateRoomStatus = async (
  roomId: string,
  status: MunchsceneRoom["status"],
  latestResultId?: string
) => {
  await adminDb.ref(`rooms/${roomId}`).update({
    status,
    latestResultId: latestResultId ?? null,
    updatedAt: new Date().toISOString()
  });
};

export const persistResolveResult = async (
  roomId: string,
  resultId: string,
  payload: unknown
) => {
  await adminDb.ref(`results/${roomId}/${resultId}`).set(stripUndefined(payload));
};

const stripUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([entryKey, entryValue]) => [entryKey, stripUndefined(entryValue)])
    );
  }

  return value;
};
