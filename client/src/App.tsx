import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
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
  listRecentRooms,
  removeRecentRoom,
  readSessionFromUrl,
  saveRecentRoom,
  updateRoomSearchParams
} from "./lib/session";
import { auth } from "./lib/firebase";
import {
  loginWithEmailPassword,
  logoutFromMunchscene,
  signupWithEmailPassword
} from "./lib/auth";

type Mode = "welcome" | "lobby";

type Notice = {
  tone: "error" | "info";
  message: string;
};

const describeAuthError = (
  error: unknown,
  provider: "email" | "general"
): string => {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";

  if (code === "auth/operation-not-allowed") {
    return provider === "email"
      ? "Email/password login is disabled. Enable Firebase Auth > Sign-in method > Email/Password."
      : "Sign-in method is disabled in Firebase Authentication.";
  }

  if (code === "auth/email-already-in-use") {
    return "This email is already in use. Try signing in instead.";
  }

  if (code === "auth/invalid-email") {
    return "Enter a valid email address.";
  }

  if (code === "auth/weak-password") {
    return "Password is too weak. Use at least 6 characters.";
  }

  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return "Incorrect email or password.";
  }

  if (code === "auth/user-not-found") {
    return "No account found for this email.";
  }

  if (code === "auth/too-many-requests") {
    return "Too many attempts. Wait a minute and try again.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to sign in right now.";
};

const initialCreateForm = {
  hostName: "",
  roomName: "",
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
  const [recentRooms, setRecentRooms] = useState(() => [] as ReturnType<typeof listRecentRooms>);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUserEmail, setAuthUserEmail] = useState("");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current) {
        return;
      }

      if (profileMenuRef.current.contains(event.target as Node)) {
        return;
      }

      setIsProfileMenuOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setMemberId("");
        setAuthUserEmail("");
        setRoom(null);
        setResult(null);
        setMode("welcome");
        setRecentRooms([]);
        return;
      }

      const nextMemberId = user.uid;
      setMemberId(nextMemberId);
      setAuthUserEmail(user.email ?? "");

      const session = readSessionFromUrl();

      if (!session.roomId) {
        return;
      }

      setLoading(true);
      hydrateRoomSession(session.roomId, nextMemberId)
        .then((nextRoom) => {
          setRoom(nextRoom);
          setMode("lobby");
          saveRecentRoom(nextMemberId, {
            roomId: nextRoom.id,
            memberId: nextMemberId,
            roomCode: nextRoom.code,
            roomName: nextRoom.roomName,
            city: nextRoom.location.label
          });
          setRecentRooms(listRecentRooms(nextMemberId));
          updateRoomSearchParams(nextRoom.id, nextMemberId);
        })
        .catch(() => {
          if (session.roomId && session.memberId) {
            removeRecentRoom(nextMemberId, session.roomId, session.memberId);
            setRecentRooms(listRecentRooms(nextMemberId));
          }
          updateRoomSearchParams();
          setNotice({
            tone: "info",
            message: "Saved room session expired. Join again with a room code."
          });
        })
        .finally(() => {
          setLoading(false);
        });
    });

    return unsubscribe;
  }, []);

  const handleEmailAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    setNotice(null);

    try {
      if (authMode === "signin") {
        await loginWithEmailPassword(authEmail.trim(), authPassword);
      } else {
        await signupWithEmailPassword(authEmail.trim(), authPassword);
      }

      setNotice({
        tone: "info",
        message:
          authMode === "signin" ? "Signed in successfully." : "Account created and signed in."
      });
      setAuthPassword("");
      setIsProfileMenuOpen(false);
    } catch (error) {
      setNotice({
        tone: "error",
        message: describeAuthError(error, "email")
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    setNotice(null);

    try {
      await logoutFromMunchscene();
      setAuthPassword("");
      setJoinForm(initialJoinForm);
      setCreateForm(initialCreateForm);
      setIsProfileMenuOpen(false);
      setNotice({
        tone: "info",
        message: "Signed out."
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: describeAuthError(error, "general")
      });
    } finally {
      setLoading(false);
    }
  };

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
      } else {
        saveRecentRoom(memberId, {
          roomId: nextRoom.id,
          memberId,
          roomCode: nextRoom.code,
          roomName: nextRoom.roomName,
          city: nextRoom.location.label
        });
        setRecentRooms(listRecentRooms(memberId));
      }
    });

    return subscription.unsubscribe;
  }, [memberId, room?.id]);

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

    if (!memberId) {
      setNotice({
        tone: "error",
        message: "Sign in with email/password to create a room."
      });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const nextRoom = await createRoom({
        hostName: createForm.hostName,
        roomName: createForm.roomName,
        memberId,
        locationLabel: createForm.locationLabel,
        latitude: createForm.latitude ? Number(createForm.latitude) : undefined,
        longitude: createForm.longitude ? Number(createForm.longitude) : undefined
      });

      setRoom(nextRoom);
      setResult(null);
      setMode("lobby");
        saveRecentRoom(memberId, {
          roomId: nextRoom.id,
          memberId,
          roomCode: nextRoom.code,
          roomName: nextRoom.roomName,
          city: nextRoom.location.label
        });
        setRecentRooms(listRecentRooms(memberId));
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

    if (!memberId) {
      setNotice({
        tone: "error",
        message: "Sign in with email/password to join a room."
      });
      return;
    }

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
      saveRecentRoom(memberId, {
        roomId: nextRoom.id,
        memberId,
        roomCode: nextRoom.code,
        roomName: nextRoom.roomName,
        city: nextRoom.location.label
      });
      setRecentRooms(listRecentRooms(memberId));
      updateRoomSearchParams(nextRoom.id, memberId);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to join that room right now"
      });
    } finally {
      setJoinForm(initialJoinForm);
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

  const handleOpenRecentRoom = async (roomId: string, sessionMemberId: string) => {
    if (!memberId) {
      setNotice({
        tone: "error",
        message: "Sign in with email/password to open a room."
      });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const nextRoom = await hydrateRoomSession(roomId, memberId);
      setRoom(nextRoom);
      setResult(null);
      setMode("lobby");
      saveRecentRoom(memberId, {
        roomId: nextRoom.id,
        memberId,
        roomCode: nextRoom.code,
        roomName: nextRoom.roomName,
        city: nextRoom.location.label
      });
      setRecentRooms(listRecentRooms(memberId));
      updateRoomSearchParams(nextRoom.id, memberId);
    } catch (error) {
      removeRecentRoom(memberId, roomId, sessionMemberId);
      setRecentRooms(listRecentRooms(memberId));
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to reopen that room"
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

            <div className="hero-actions">
              {mode === "lobby" ? (
                <button type="button" className="button button-ghost" onClick={leaveRoom}>
                  Home
                </button>
              ) : null}
              <div className="profile-menu" ref={profileMenuRef}>
                <button
                  type="button"
                  className="profile-button"
                  onClick={() => setIsProfileMenuOpen((current) => !current)}
                  aria-expanded={isProfileMenuOpen}
                  aria-label="Open account menu"
                >
                  <span className="profile-avatar">
                    {memberId ? (authUserEmail || "U").slice(0, 1).toUpperCase() : "Log in"}
                  </span>
                </button>
                {isProfileMenuOpen ? (
                  <div className="profile-dropdown">
                    {memberId ? (
                      <div className="profile-signed-in">
                        <span className="auth-tag">
                          Signed in{authUserEmail ? `: ${authUserEmail}` : ""}
                        </span>
                        <button
                          type="button"
                          className="button button-ghost"
                          onClick={handleSignOut}
                          disabled={loading}
                        >
                          Sign out
                        </button>
                      </div>
                    ) : (
                      <form className="auth-form" onSubmit={handleEmailAuthSubmit}>
                        <div className="auth-mode-toggle">
                          <button
                            type="button"
                            className={`pill ${authMode === "signin" ? "pill-active" : ""}`}
                            onClick={() => setAuthMode("signin")}
                            disabled={loading}
                          >
                            Sign in
                          </button>
                          <button
                            type="button"
                            className={`pill ${authMode === "signup" ? "pill-active" : ""}`}
                            onClick={() => setAuthMode("signup")}
                            disabled={loading}
                          >
                            Sign up
                          </button>
                        </div>
                        <label>
                          <span>Email</span>
                          <input
                            type="email"
                            autoComplete="email"
                            value={authEmail}
                            onChange={(event) => setAuthEmail(event.target.value)}
                            required
                          />
                        </label>
                        <label>
                          <span>Password</span>
                          <input
                            type="password"
                            autoComplete={
                              authMode === "signin" ? "current-password" : "new-password"
                            }
                            minLength={6}
                            value={authPassword}
                            onChange={(event) => setAuthPassword(event.target.value)}
                            required
                          />
                        </label>
                        <button
                          type="submit"
                          className="button button-secondary"
                          disabled={loading}
                        >
                          {authMode === "signin" ? "Sign in" : "Create account"}
                        </button>
                      </form>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
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
                <p>Name the group, set the city, and become the host.</p>
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
                <span>Room name</span>
                <input
                  required
                  minLength={2}
                  value={createForm.roomName}
                  placeholder="Friday dinner crew"
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      roomName: event.target.value
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

            <section className="panel">
              <div className="panel-header">
                <h2>Recent rooms</h2>
                <p>Jump back into the friend groups on this browser.</p>
              </div>

              {recentRooms.length === 0 ? (
                <p className="helper-copy">
                  No recent lobbies yet. Create one or join with a code.
                </p>
              ) : (
                <div className="recent-room-list">
                  {recentRooms.map((recentRoom) => (
                    <article
                      key={`${recentRoom.roomId}:${recentRoom.memberId}`}
                      className="recent-room-card"
                    >
                      <div>
                        <strong>{recentRoom.roomName}</strong>
                        <p>
                          {recentRoom.city} · code {recentRoom.roomCode}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() =>
                          handleOpenRecentRoom(
                            recentRoom.roomId,
                            recentRoom.memberId
                          )
                        }
                        disabled={loading}
                      >
                        Open lobby
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        ) : null}

        {mode === "lobby" && room && currentMember ? (
          <>
            {result ? <ResultsView result={result} /> : null}

            <section className="room-layout">
              <div className="panel room-summary">
                <div className="panel-header">
                  <div>
                    <h2>{room.roomName}</h2>
                    <p>Room code {room.code}</p>
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
