import { useEffect, useMemo, useState } from "react";
import {
  APP_NAME,
  MAX_ROOM_SIZE,
  defaultUserPreferences,
  type MunchsceneRoom,
  type ResolveResult,
  type UserPreferences
} from "@munchscene/shared";
import { PreferenceEditor } from "./components/PreferenceEditor";
import { ResultsView } from "./components/ResultsView";
import {
  createRoom,
  hydrateRoomSession,
  joinRoomByCode,
  requestRoomResolution,
  subscribeToResult,
  subscribeToRoom,
  updateMemberName,
  updateMemberPreferences
} from "./lib/rooms";
import {
  getOrCreateMemberId,
  readSessionFromUrl,
  updateRoomSearchParams
} from "./lib/session";

type Mode = "welcome" | "lobby";

type Notice = {
  tone: "error" | "info";
  message: string;
};

const initialCreateForm = {
  hostName: "",
  locationLabel: "",
  latitude: "",
  longitude: ""
};

const initialJoinForm = {
  name: "",
  code: ""
};

export default function App() {
  const [mode, setMode] = useState<Mode>("welcome");
  const [memberId, setMemberId] = useState<string>("");
  const [room, setRoom] = useState<MunchsceneRoom | null>(null);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [joinForm, setJoinForm] = useState(initialJoinForm);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const persistedMemberId = getOrCreateMemberId();
    setMemberId(persistedMemberId);

    const session = readSessionFromUrl();

    if (!session.roomId || !session.memberId) {
      return;
    }

    setLoading(true);
    hydrateRoomSession(session.roomId, session.memberId)
      .then((nextRoom) => {
        setRoom(nextRoom);
        setMode("lobby");
        setMemberId(session.memberId ?? persistedMemberId);
      })
      .catch(() => {
        updateRoomSearchParams();
        setNotice({
          tone: "info",
          message: "Saved room session expired. Join again with a room code."
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!room) {
      return;
    }

    const subscription = subscribeToRoom(room.id, (nextRoom) => {
      setRoom(nextRoom);

      if (!nextRoom) {
        setResult(null);
        setMode("welcome");
        updateRoomSearchParams();
        setNotice({
          tone: "error",
          message: "This room was removed."
        });
      }
    });

    return subscription.unsubscribe;
  }, [room?.id]);

  useEffect(() => {
    if (!room?.latestResultId) {
      setResult(null);
      return;
    }

    const subscription = subscribeToResult(room.id, room.latestResultId, setResult);
    return subscription.unsubscribe;
  }, [room?.id, room?.latestResultId]);

  const currentMember = useMemo(() => {
    if (!room || !memberId) {
      return null;
    }

    return room.members[memberId] ?? null;
  }, [memberId, room]);

  const handleCreateRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setNotice(null);

    try {
      const nextRoom = await createRoom({
        hostName: createForm.hostName,
        memberId,
        locationLabel: createForm.locationLabel,
        latitude: createForm.latitude ? Number(createForm.latitude) : undefined,
        longitude: createForm.longitude ? Number(createForm.longitude) : undefined
      });

      setRoom(nextRoom);
      setResult(null);
      setMode("lobby");
      updateRoomSearchParams(nextRoom.id, memberId);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to create room right now"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setNotice(null);

    try {
      const nextRoom = await joinRoomByCode({
        code: joinForm.code,
        name: joinForm.name,
        memberId
      });

      setRoom(nextRoom);
      setResult(null);
      setMode("lobby");
      updateRoomSearchParams(nextRoom.id, memberId);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to join that room right now"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesChange = async (preferences: UserPreferences) => {
    if (!room || !currentMember) {
      return;
    }

    setRoom({
      ...room,
      members: {
        ...room.members,
        [currentMember.id]: {
          ...currentMember,
          preferences
        }
      }
    });

    try {
      await updateMemberPreferences(room.id, currentMember.id, preferences);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to save preferences"
      });
    }
  };

  const handleNameBlur = async (nextName: string) => {
    if (!room || !currentMember || nextName.trim() === currentMember.name) {
      return;
    }

    try {
      await updateMemberName(room.id, currentMember.id, nextName);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to update display name"
      });
    }
  };

  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      setNotice({
        tone: "error",
        message: "Geolocation is not available in this browser."
      });
      return;
    }

    setLoading(true);
    setNotice(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCreateForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          locationLabel:
            current.locationLabel || "Current location"
        }));
        setLoading(false);
      },
      () => {
        setNotice({
          tone: "error",
          message:
            "Location permission was denied. You can still paste latitude and longitude manually."
        });
        setLoading(false);
      }
    );
  };

  const handleResolve = async () => {
    if (!room || !currentMember?.isHost) {
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      await requestRoomResolution(room.id);
      setNotice({
        tone: "info",
        message: "Fairness engine finished. Results are now available for this room."
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to queue room resolution"
      });
    } finally {
      setLoading(false);
    }
  };

  const leaveRoom = () => {
    setRoom(null);
    setResult(null);
    setMode("welcome");
    setNotice(null);
    updateRoomSearchParams();
  };

  return (
    <div className="app-shell">
      <div className="background-orb orb-left" />
      <div className="background-orb orb-right" />
      <main className="page">
        <section className="hero-card">
          <div className="hero-topbar">
            <div>
              <p className="eyebrow">Fairness-first group dining</p>
              <h1>{APP_NAME}</h1>
              <p className="lede">
                Real-time restaurant decision rooms for groups who want less
                arguing and better compromises.
              </p>
            </div>

            {mode === "lobby" ? (
              <button
                type="button"
                className="button button-ghost"
                onClick={leaveRoom}
              >
                Home
              </button>
            ) : null}
          </div>
        </section>

        {notice ? (
          <div className={`notice notice-${notice.tone}`}>{notice.message}</div>
        ) : null}

        {mode === "welcome" ? (
          <section className="panel-grid">
            <form className="panel" onSubmit={handleCreateRoom}>
              <div className="panel-header">
                <h2>Create a room</h2>
                <p>Set the location anchor and become the host.</p>
              </div>

              <label className="field">
                <span>Your name</span>
                <input
                  required
                  minLength={2}
                  value={createForm.hostName}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      hostName: event.target.value
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Location label</span>
                <input
                  required
                  value={createForm.locationLabel}
                  placeholder="Vancouver"
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      locationLabel: event.target.value
                    }))
                  }
                />
              </label>

              <p className="helper-copy">
                City is enough for now. Browser location is optional and only helps
                later with distance-based scoring.
              </p>

              <button
                type="button"
                className="button button-ghost"
                onClick={handleUseMyLocation}
                disabled={loading}
              >
                Use my browser location
              </button>

              <button className="button" disabled={loading}>
                {loading ? "Creating..." : "Create room"}
              </button>
            </form>

            <form className="panel" onSubmit={handleJoinRoom}>
              <div className="panel-header">
                <h2>Join a room</h2>
                <p>Hop into an existing group with a six-character room code.</p>
              </div>

              <label className="field">
                <span>Your name</span>
                <input
                  required
                  minLength={2}
                  value={joinForm.name}
                  onChange={(event) =>
                    setJoinForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Room code</span>
                <input
                  required
                  minLength={6}
                  maxLength={6}
                  value={joinForm.code}
                  placeholder="AB12CD"
                  onChange={(event) =>
                    setJoinForm((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase()
                    }))
                  }
                />
              </label>

              <button className="button button-secondary" disabled={loading}>
                {loading ? "Joining..." : "Join room"}
              </button>
            </form>
          </section>
        ) : null}

        {mode === "lobby" && room && currentMember ? (
          <>
            {result ? <ResultsView result={result} /> : null}

            <section className="room-layout">
              <div className="panel room-summary">
                <div className="panel-header">
                  <div>
                    <h2>Room {room.code}</h2>
                    <p>{room.location.label}</p>
                  </div>
                  <div className="status-group">
                    <span className={`status status-${room.status}`}>{room.status}</span>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={leaveRoom}
                    >
                      Leave
                    </button>
                  </div>
                </div>

                <div className="stats-row">
                  <div className="stat-card">
                    <span>People in room</span>
                    <strong>
                      {Object.keys(room.members).length}/{MAX_ROOM_SIZE}
                    </strong>
                  </div>
                  <div className="stat-card">
                    <span>City</span>
                    <strong>{room.location.label}</strong>
                  </div>
                </div>

                <div className="member-list">
                  {Object.values(room.members)
                    .sort((left, right) => Number(right.isHost) - Number(left.isHost))
                    .map((member) => {
                      const memberPreferences =
                        member.preferences ?? defaultUserPreferences();

                      return (
                        <article
                          key={member.id}
                          className={`member-card ${
                            member.id === currentMember.id ? "member-card-active" : ""
                          }`}
                        >
                          <div className="member-header">
                            <strong>{member.name}</strong>
                            <span className="tag">
                              {member.isHost ? "Host" : "Guest"}
                            </span>
                          </div>
                          <p>
                            {memberPreferences.cuisinePreferences.join(", ") ||
                              "No cuisines yet"}
                          </p>
                          <small>
                            {memberPreferences.vibePreference} • budget{" "}
                            {memberPreferences.budgetMax} •{" "}
                            {memberPreferences.maxDistanceMeters}m
                          </small>
                        </article>
                      );
                    })}
                </div>

                {currentMember.isHost ? (
                  <button
                    type="button"
                    className="button"
                    onClick={handleResolve}
                    disabled={loading || Object.keys(room.members).length === 0}
                  >
                    {room.status === "resolving"
                      ? "Resolving group tension..."
                      : result
                        ? "Re-run fairness engine"
                        : "Resolve this room"}
                  </button>
                ) : (
                  <p className="helper-copy">
                    The host will trigger the fairness engine when everyone is ready.
                  </p>
                )}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>Your preferences</h2>
                  <p>These update live for everyone in the room.</p>
                </div>

                <label className="field">
                  <span>Display name</span>
                  <input
                    value={currentMember.name}
                    onChange={(event) =>
                      setRoom((currentRoom) =>
                        currentRoom
                          ? {
                              ...currentRoom,
                              members: {
                                ...currentRoom.members,
                                [currentMember.id]: {
                                  ...currentMember,
                                  name: event.target.value
                                }
                              }
                            }
                          : currentRoom
                      )
                    }
                    onBlur={(event) => handleNameBlur(event.target.value)}
                  />
                </label>

                <PreferenceEditor
                  disabled={loading}
                  preferences={currentMember.preferences ?? defaultUserPreferences()}
                  onChange={handlePreferencesChange}
                />
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
