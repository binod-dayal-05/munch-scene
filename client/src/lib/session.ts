const MEMBER_ID_STORAGE_KEY = "munchscene.memberId";
const RECENT_ROOMS_STORAGE_KEY = "munchscene.recentRooms";

export type RecentRoomSession = {
  roomId: string;
  memberId: string;
  roomCode: string;
  roomName: string;
  city: string;
  updatedAt: string;
};

export const getOrCreateMemberId = (): string => {
  const existing = window.localStorage.getItem(MEMBER_ID_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const nextId = crypto.randomUUID();
  window.localStorage.setItem(MEMBER_ID_STORAGE_KEY, nextId);
  return nextId;
};

export const updateRoomSearchParams = (roomId?: string, memberId?: string) => {
  const url = new URL(window.location.href);

  if (roomId) {
    url.searchParams.set("room", roomId);
  } else {
    url.searchParams.delete("room");
  }

  if (memberId) {
    url.searchParams.set("member", memberId);
  } else {
    url.searchParams.delete("member");
  }

  window.history.replaceState({}, "", url);
};

export const readSessionFromUrl = () => ({
  roomId: new URL(window.location.href).searchParams.get("room"),
  memberId: new URL(window.location.href).searchParams.get("member")
});

export const listRecentRooms = (): RecentRoomSession[] => {
  const rawValue = window.localStorage.getItem(RECENT_ROOMS_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as RecentRoomSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveRecentRoom = (room: Omit<RecentRoomSession, "updatedAt">) => {
  const nextRooms = [
    {
      ...room,
      updatedAt: new Date().toISOString()
    },
    ...listRecentRooms().filter(
      (candidate) =>
        !(candidate.roomId === room.roomId && candidate.memberId === room.memberId)
    )
  ].slice(0, 8);

  window.localStorage.setItem(RECENT_ROOMS_STORAGE_KEY, JSON.stringify(nextRooms));
};

export const removeRecentRoom = (roomId: string, memberId: string) => {
  const nextRooms = listRecentRooms().filter(
    (candidate) =>
      !(candidate.roomId === roomId && candidate.memberId === memberId)
  );

  window.localStorage.setItem(RECENT_ROOMS_STORAGE_KEY, JSON.stringify(nextRooms));
};
