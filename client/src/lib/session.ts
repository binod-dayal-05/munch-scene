const MEMBER_ID_STORAGE_KEY = "munchscene.memberId";

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

