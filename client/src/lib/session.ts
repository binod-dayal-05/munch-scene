const RECENT_ROOMS_STORAGE_KEY = "munchscene.recentRooms";

export type RecentRoomSession = {
  roomId: string;
  memberId: string;
  roomCode: string;
  roomName: string;
  city: string;
  updatedAt: string;
};

const recentRoomsStorageKey = (uid: string) => `${RECENT_ROOMS_STORAGE_KEY}.${uid}`;

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

export const listRecentRooms = (uid: string): RecentRoomSession[] => {
  const rawValue = window.localStorage.getItem(recentRoomsStorageKey(uid));

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

export const saveRecentRoom = (
  uid: string,
  room: Omit<RecentRoomSession, "updatedAt">
) => {
  const nextRooms = [
    {
      ...room,
      updatedAt: new Date().toISOString()
    },
    ...listRecentRooms(uid).filter(
      (candidate) =>
        !(candidate.roomId === room.roomId && candidate.memberId === room.memberId)
    )
  ].slice(0, 8);

  window.localStorage.setItem(recentRoomsStorageKey(uid), JSON.stringify(nextRooms));
};

export const removeRecentRoom = (uid: string, roomId: string, memberId: string) => {
  const nextRooms = listRecentRooms(uid).filter(
    (candidate) =>
      !(candidate.roomId === roomId && candidate.memberId === memberId)
  );

  window.localStorage.setItem(recentRoomsStorageKey(uid), JSON.stringify(nextRooms));
};
