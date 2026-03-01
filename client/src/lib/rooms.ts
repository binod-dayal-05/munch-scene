import {
  MAX_ROOM_SIZE,
  createEmptyMember,
  defaultUserPreferences,
  type MunchsceneRoom,
  type ResolveResult,
  type RoomMember,
  type UserPreferences
} from "@munchscene/shared";
import {
  get,
  onValue,
  ref,
  runTransaction,
  set,
  update
} from "firebase/database";
import { clientEnv } from "./config";
import { realtimeDb } from "./firebase";

type CreateRoomInput = {
  hostName: string;
  memberId: string;
  roomName: string;
  locationLabel: string;
  latitude?: number;
  longitude?: number;
};

type JoinRoomInput = {
  code: string;
  name: string;
  memberId: string;
};

type RoomSubscription = {
  unsubscribe: () => void;
};

const normalizeCode = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

const generateRoomCode = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join("");
};

const roomRecordRef = (roomId: string) => ref(realtimeDb, `rooms/${roomId}`);
const roomMemberRef = (roomId: string, memberId: string) =>
  ref(realtimeDb, `rooms/${roomId}/members/${memberId}`);
const roomCodeRef = (code: string) =>
  ref(realtimeDb, `roomsByCode/${normalizeCode(code)}`);
const roomResultRef = (roomId: string, resultId: string) =>
  ref(realtimeDb, `results/${roomId}/${resultId}`);

const normalizeMember = (member: RoomMember): RoomMember => ({
  ...member,
  preferences: {
    ...defaultUserPreferences(),
    ...member.preferences,
    dietaryRestrictions: member.preferences?.dietaryRestrictions ?? [],
    cuisinePreferences: member.preferences?.cuisinePreferences ?? []
  }
});

const normalizeRoom = (room: MunchsceneRoom): MunchsceneRoom => ({
  ...room,
  roomName: room.roomName?.trim() || room.location.label || `Room ${room.code}`,
  members: Object.fromEntries(
    Object.entries(room.members ?? {}).map(([memberId, member]) => [
      memberId,
      normalizeMember(member)
    ])
  )
});

const buildRoom = ({
  hostName,
  memberId,
  roomName,
  locationLabel,
  latitude,
  longitude,
  code,
  roomId
}: CreateRoomInput & { code: string; roomId: string }): MunchsceneRoom => ({
  id: roomId,
  code,
  roomName: roomName.trim(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: memberId,
  status: "lobby",
  location: {
    label: locationLabel.trim(),
    lat: latitude ?? 0,
    lng: longitude ?? 0
  },
  members: {
    [memberId]: createEmptyMember(memberId, hostName.trim(), true)
  }
});

const lookupRoomIdByCode = async (code: string): Promise<string | null> => {
  const snapshot = await get(roomCodeRef(code));
  return snapshot.exists() ? snapshot.val() : null;
};

const readRoom = async (roomId: string): Promise<MunchsceneRoom | null> => {
  const snapshot = await get(roomRecordRef(roomId));
  return snapshot.exists() ? normalizeRoom(snapshot.val() as MunchsceneRoom) : null;
};

export const createRoom = async (input: CreateRoomInput): Promise<MunchsceneRoom> => {
  const roomId = crypto.randomUUID();
  let code = generateRoomCode();

  while (await lookupRoomIdByCode(code)) {
    code = generateRoomCode();
  }

  const room = buildRoom({
    ...input,
    roomId,
    code
  });

  await set(roomRecordRef(roomId), room);
  await set(roomCodeRef(code), roomId);

  return room;
};

export const joinRoomByCode = async ({
  code,
  name,
  memberId
}: JoinRoomInput): Promise<MunchsceneRoom> => {
  const roomId = await lookupRoomIdByCode(code);

  if (!roomId) {
    throw new Error("Room not found");
  }

  const room = await readRoom(roomId);

  if (!room) {
    throw new Error("Room record is missing");
  }

  const existingMember = room.members[memberId];

  if (!existingMember && Object.keys(room.members).length >= MAX_ROOM_SIZE) {
    throw new Error("This room is already full");
  }

  const nextMember: RoomMember = existingMember ?? {
    ...createEmptyMember(memberId, name.trim()),
    preferences: defaultUserPreferences()
  };

  await claimRoomSlot(roomId, {
    ...nextMember,
    name: name.trim()
  });

  const freshRoom = await readRoom(roomId);

  if (!freshRoom) {
    throw new Error("Room record is missing");
  }

  return freshRoom;
};

export const subscribeToRoom = (
  roomId: string,
  onChange: (room: MunchsceneRoom | null) => void
): RoomSubscription => {
  const unsubscribe = onValue(roomRecordRef(roomId), (snapshot) => {
    onChange(snapshot.exists() ? normalizeRoom(snapshot.val() as MunchsceneRoom) : null);
  });

  return {
    unsubscribe
  };
};

export const subscribeToResult = (
  roomId: string,
  resultId: string,
  onChange: (result: ResolveResult | null) => void
): RoomSubscription => {
  const unsubscribe = onValue(roomResultRef(roomId, resultId), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.val() as ResolveResult) : null);
  });

  return {
    unsubscribe
  };
};

export const updateMemberPreferences = async (
  roomId: string,
  memberId: string,
  preferences: UserPreferences
) => {
  await update(roomRecordRef(roomId), {
    updatedAt: new Date().toISOString(),
    [`members/${memberId}/preferences`]: preferences
  });
};

export const requestRoomResolution = async (roomId: string) => {
  await update(roomRecordRef(roomId), {
    status: "resolving",
    updatedAt: new Date().toISOString()
  });

  const response = await fetch(
    `${clientEnv.apiBaseUrl}/rooms/${encodeURIComponent(roomId)}/resolve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    await update(roomRecordRef(roomId), {
      status: "error",
      updatedAt: new Date().toISOString()
    });

    throw new Error(payload?.error || "Failed to resolve room");
  }
};

export const hydrateRoomSession = async (
  roomId: string,
  memberId: string
): Promise<MunchsceneRoom> => {
  const room = await readRoom(roomId);

  if (!room) {
    throw new Error("Room not found");
  }

  if (!room.members[memberId]) {
    throw new Error("This member is no longer in the room");
  }

  return room;
};

export const updateMemberName = async (
  roomId: string,
  memberId: string,
  name: string
) => {
  await update(roomMemberRef(roomId, memberId), {
    name: name.trim()
  });
  await update(roomRecordRef(roomId), {
    updatedAt: new Date().toISOString()
  });
};

export const claimRoomSlot = async (roomId: string, member: RoomMember) => {
  const transaction = await runTransaction(roomRecordRef(roomId), (roomValue) => {
    const room = roomValue as MunchsceneRoom | null;

    if (!room) {
      return roomValue;
    }

    const nextMembers = room.members ?? {};

    if (!nextMembers[member.id] && Object.keys(nextMembers).length >= MAX_ROOM_SIZE) {
      return;
    }

    return {
      ...room,
      updatedAt: new Date().toISOString(),
      members: {
        ...nextMembers,
        [member.id]: member
      }
    };
  });

  if (!transaction.committed) {
    throw new Error("Unable to claim a slot in this room");
  }
};
