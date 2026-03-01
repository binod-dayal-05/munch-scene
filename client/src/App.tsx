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
import { Toggle } from "./components/Toggle";
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
import { readUserThemePreference, saveUserThemePreference } from "./lib/userSettings";
import { auth } from "./lib/firebase";
import {
  loginWithEmailPassword,
  logoutFromMunchscene,
  signupWithEmailPassword
} from "./lib/auth";

type Mode = "welcome" | "lobby";
type HomeIntent = "create" | "join";

type Notice = {
  tone: "error" | "info";
  message: string;
};

const THEME_STORAGE_KEY = "munchscene.theme";
const themeStorageKeyForUser = (uid: string) => `munchscene.theme.${uid}`;

const describeAuthError = (
  error: unknown,
  provider: "email" | "general"
): string => {
  const code =
    typeof error === "object" && error && "code" in error
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

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatPrice = (level?: number) => (level === undefined ? "-" : "$".repeat(Math.max(level, 1)));
const capitalizeFirst = (value: string): string =>
  value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
const formatDistanceKm = (meters: number): string => {
  const km = meters / 1000;
  const normalized = Number.isInteger(km)
    ? String(km)
    : km.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

  return `${normalized}km`;
};
const sanitizeFeedText = (value: string): string =>
  value
    .replace(/\bn[1i!|]*g+\s*g+[e3]*r+\b/gi, "[redacted]")
    .replace(/\bn[1i!|]*g+\s*g+[a@]+\b/gi, "[redacted]");

const toFriendlyReason = (value: string): string => {
  const sanitized = sanitizeFeedText(value);

  if (/budget ceiling exceeded/i.test(sanitized)) {
    return "Over budget for someone in the room";
  }

  if (/max distance exceeded/i.test(sanitized)) {
    return "Too far for someone in the room";
  }

  const dietaryMatch = sanitized.match(/dietary restriction unmet:\s*(.+)$/i);
  if (dietaryMatch) {
    return `Does not match a dietary need (${dietaryMatch[1]})`;
  }

  return sanitized;
};

export default function App() {
  const [mode, setMode] = useState<Mode>("welcome");
  const [homeIntent, setHomeIntent] = useState<HomeIntent>("create");
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isThemeReadyForSync, setIsThemeReadyForSync] = useState(false);
  const [flippedPodiumCards, setFlippedPodiumCards] = useState<Record<string, boolean>>({});
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
  });
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", isDarkMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? "dark" : "light");
    if (memberId) {
      window.localStorage.setItem(
        themeStorageKeyForUser(memberId),
        isDarkMode ? "dark" : "light"
      );
    }
  }, [isDarkMode, memberId]);

  useEffect(() => {
    if (!memberId) {
      setIsThemeReadyForSync(false);
      return;
    }

    setIsThemeReadyForSync(false);
    let isCancelled = false;

    const hydrateTheme = async () => {
      try {
        const remoteTheme = await readUserThemePreference(memberId);

        if (isCancelled) {
          return;
        }

        if (remoteTheme) {
          setIsDarkMode(remoteTheme === "dark");
          window.localStorage.setItem(THEME_STORAGE_KEY, remoteTheme);
          window.localStorage.setItem(themeStorageKeyForUser(memberId), remoteTheme);
        } else {
          const localTheme =
            window.localStorage.getItem(themeStorageKeyForUser(memberId)) ??
            window.localStorage.getItem(THEME_STORAGE_KEY) ??
            "light";
          const nextTheme = localTheme === "dark" ? "dark" : "light";

          setIsDarkMode(nextTheme === "dark");
          window.localStorage.setItem(themeStorageKeyForUser(memberId), nextTheme);
          void saveUserThemePreference(memberId, nextTheme).catch(() => {
            // Local preference still works if Firebase write is blocked.
          });
        }
      } catch {
        if (isCancelled) {
          return;
        }

        const localTheme =
          window.localStorage.getItem(themeStorageKeyForUser(memberId)) ??
          window.localStorage.getItem(THEME_STORAGE_KEY);
        if (localTheme === "dark" || localTheme === "light") {
          setIsDarkMode(localTheme === "dark");
        }
      } finally {
        if (!isCancelled) {
          setIsThemeReadyForSync(true);
        }
      }
    };

    void hydrateTheme();

    return () => {
      isCancelled = true;
    };
  }, [memberId]);

  useEffect(() => {
    if (!memberId || !isThemeReadyForSync) {
      return;
    }

    void saveUserThemePreference(memberId, isDarkMode ? "dark" : "light").catch(() => {
      // Keep local persistence even if Firebase write fails.
    });
  }, [isDarkMode, memberId, isThemeReadyForSync]);

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
        setRecentRooms(listRecentRooms(nextMemberId));
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
        return;
      }

      saveRecentRoom(memberId, {
        roomId: nextRoom.id,
        memberId,
        roomCode: nextRoom.code,
        roomName: nextRoom.roomName,
        city: nextRoom.location.label
      });
      setRecentRooms(listRecentRooms(memberId));
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

  useEffect(() => {
    setFlippedPodiumCards({});
  }, [result?.id]);

  const currentMember = useMemo(() => {
    if (!room || !memberId) {
      return null;
    }

    return room.members[memberId] ?? null;
  }, [memberId, room]);

  const sortedMembers = useMemo(() => {
    if (!room) {
      return [];
    }

    return Object.values(room.members).sort(
      (left, right) => Number(right.isHost) - Number(left.isHost)
    );
  }, [room]);

  const readiness = useMemo(() => {
    if (!room) {
      return { completed: 0, total: 0 };
    }

    const members = Object.values(room.members);
    const completed = members.filter((member) => {
      const prefs = member.preferences ?? defaultUserPreferences();
      return (
        prefs.cuisinePreferences.length > 0 &&
        prefs.vibePreference &&
        prefs.maxDistanceMeters > 0
      );
    }).length;

    return { completed, total: members.length };
  }, [room]);

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
      setCreateForm(initialCreateForm);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to create room right now"
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
        message: error instanceof Error ? error.message : "Unable to join that room right now"
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
        message: error instanceof Error ? error.message : "Failed to save preferences"
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
        message: error instanceof Error ? error.message : "Failed to queue room resolution"
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
    setIsMobileMenuOpen(false);
    updateRoomSearchParams();
  };

  const togglePodiumCard = (placeId: string) => {
    setFlippedPodiumCards((current) => ({
      ...current,
      [placeId]: !current[placeId]
    }));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="kicker">Find your next:</p>
          <button
            type="button"
            className="brand-home-btn"
            onClick={leaveRoom}
            aria-label="Go to home"
          >
            <h1>{APP_NAME}</h1>
          </button>
        </div>

        <button
          type="button"
          className={`mobile-menu-toggle ${isMobileMenuOpen ? "mobile-menu-toggle-open" : ""}`.trim()}
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`topbar-actions ${isMobileMenuOpen ? "topbar-actions-open" : ""}`.trim()}>
          <Toggle
            isChecked={isDarkMode}
            handleChange={(event) => setIsDarkMode(event.target.checked)}
          />

          {mode === "lobby" ? (
            <button type="button" className="ghost-btn topbar-exit-btn" onClick={leaveRoom}>
              Exit room
            </button>
          ) : null}

          <div className="profile-menu" ref={profileMenuRef}>
            <button
              type="button"
              className={`profile-button ${memberId ? "" : "profile-button-login"}`.trim()}
              onClick={() => setIsProfileMenuOpen((current) => !current)}
              aria-expanded={isProfileMenuOpen}
              aria-label="Open account menu"
            >
              <span className={`profile-avatar ${memberId ? "" : "profile-avatar-login"}`.trim()}>
                {memberId ? (authUserEmail || "U").slice(0, 1).toUpperCase() : "Log in"}
              </span>
            </button>

            {isProfileMenuOpen ? (
              <div className="profile-dropdown">
                {memberId ? (
                  <div className="profile-signed-in">
                    <span className="auth-label">
                      Signed in{authUserEmail ? ` as ${authUserEmail}` : ""}
                    </span>
                    <button
                      type="button"
                      className="ghost-btn"
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
                        className={`mode-chip ${authMode === "signin" ? "mode-chip-active" : ""}`}
                        onClick={() => setAuthMode("signin")}
                        disabled={loading}
                      >
                        Sign in
                      </button>
                      <button
                        type="button"
                        className={`mode-chip ${authMode === "signup" ? "mode-chip-active" : ""}`}
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
                        autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                        minLength={6}
                        value={authPassword}
                        onChange={(event) => setAuthPassword(event.target.value)}
                        required
                      />
                    </label>

                    <button type="submit" className="primary-btn" disabled={loading}>
                      {authMode === "signin" ? "Sign in" : "Create account"}
                    </button>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {notice ? <div className={`notice notice-${notice.tone}`}>{notice.message}</div> : null}

      <main className="scene">
        {mode === "welcome" ? (
          <section className="entry-experience">
            <aside className="story-rail">
              <h2>How it works</h2>
              <p>
                Plan a Munchscene or join a scene with your friends. Add your
                preferences, and the fairness engine will make the final call on the munch.
              </p>
              <ol className="flow-list">
                <li>Gather your friends</li>
                <li>Add group preferences</li>
                <li>Find the perfect spot</li>
              </ol>

              <div className="recent-strip">
                <h3>Recent rooms</h3>
                {recentRooms.length === 0 ? (
                  <p>No rooms yet on this account.</p>
                ) : (
                  <div className="recent-list">
                    {recentRooms.map((recentRoom) => (
                      <button
                        type="button"
                        key={`${recentRoom.roomId}:${recentRoom.memberId}`}
                        className="recent-pill"
                        onClick={() =>
                          handleOpenRecentRoom(recentRoom.roomId, recentRoom.memberId)
                        }
                        disabled={loading}
                      >
                        <strong>{recentRoom.roomName}</strong>
                        <span>{capitalizeFirst(recentRoom.city)} • {recentRoom.roomCode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            <section className="entry-studio">
              <div className="studio-tabs">
                <button
                  type="button"
                  className={`tab-btn ${homeIntent === "create" ? "tab-btn-active" : ""}`}
                  onClick={() => setHomeIntent("create")}
                >
                  Start a room
                </button>
                <button
                  type="button"
                  className={`tab-btn ${homeIntent === "join" ? "tab-btn-active" : ""}`}
                  onClick={() => setHomeIntent("join")}
                >
                  Join by code
                </button>
              </div>

              {homeIntent === "create" ? (
                <form className="studio-form" onSubmit={handleCreateRoom}>
                  <h3>Host a new session</h3>
                  <div className="studio-grid">
                    <label>
                      <span>Your name</span>
                      <input
                        required
                        minLength={2}
                        value={createForm.hostName}
                        onChange={(event) =>
                          setCreateForm((current) => ({ ...current, hostName: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      <span>Room name</span>
                      <input
                        required
                        minLength={2}
                        value={createForm.roomName}
                        placeholder="Friday dinner crew"
                        onChange={(event) =>
                          setCreateForm((current) => ({ ...current, roomName: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      <span>City or area</span>
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
                  </div>

                  <button type="submit" className="primary-btn" disabled={loading}>
                    {loading ? "Creating room..." : "Launch room"}
                  </button>
                </form>
              ) : (
                <form className="studio-form" onSubmit={handleJoinRoom}>
                  <h3>Enter an existing room</h3>
                  <div className="studio-grid">
                    <label>
                      <span>Your name</span>
                      <input
                        required
                        minLength={2}
                        value={joinForm.name}
                        onChange={(event) =>
                          setJoinForm((current) => ({ ...current, name: event.target.value }))
                        }
                      />
                    </label>
                    <label>
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
                  </div>

                  <button type="submit" className="primary-btn" disabled={loading}>
                    {loading ? "Joining..." : "Enter room"}
                  </button>
                </form>
              )}
            </section>
          </section>
        ) : null}

        {mode === "lobby" && room && currentMember ? (
          <>
            {result ? (
              <section className="reveal-stage">
                {result.rankedRestaurants[0] ? (
                  <>
                    <p className="reveal-kicker">Fairness reveal</p>
                    <h2>{result.rankedRestaurants[0].name}</h2>
                    <p className="reveal-address">
                      {result.rankedRestaurants[0].address ?? "Address unavailable"}
                    </p>

                    <div className="reveal-metrics">
                      <article>
                        <span>Final score</span>
                        <strong>{formatPercent(result.rankedRestaurants[0].finalScore)}</strong>
                      </article>
                      <article>
                        <span>Fairness</span>
                        <strong>{formatPercent(result.rankedRestaurants[0].fairnessScore)}</strong>
                      </article>
                      <article>
                        <span>Mean match</span>
                        <strong>{formatPercent(result.rankedRestaurants[0].meanScore)}</strong>
                      </article>
                      <article>
                        <span>Filtered out</span>
                        <strong>{result.eliminatedCount}</strong>
                      </article>
                    </div>

                    <p className="reveal-explainer">
                      {result.rankedRestaurants[0].explanation ??
                        "This option best balances the room while minimizing compromise pain."}
                    </p>

                    <div className="podium-row">
                      {result.rankedRestaurants.slice(0, 3).map((restaurant, index) => (
                        <button
                          key={restaurant.placeId}
                          type="button"
                          className={`podium-card ${flippedPodiumCards[restaurant.placeId] ? "podium-card-flipped" : ""}`}
                          onClick={() => togglePodiumCard(restaurant.placeId)}
                          aria-pressed={Boolean(flippedPodiumCards[restaurant.placeId])}
                        >
                          <div className="podium-card-inner">
                            <div className="podium-face podium-face-front">
                              <span>#{index + 1}</span>
                              <strong>{restaurant.name}</strong>
                              <small className="podium-address">
                                {restaurant.address ?? "Address unavailable"}
                              </small>
                              <small>
                                {formatPercent(restaurant.finalScore)} • {formatPrice(restaurant.priceLevel)}
                              </small>
                            </div>

                            <div className="podium-face podium-face-back">
                              <span>Stats</span>
                              <strong>{formatPercent(restaurant.fairnessScore)} fairness</strong>
                              <small>
                                Mean {formatPercent(restaurant.meanScore)} • Min user{" "}
                                {formatPercent(restaurant.minUserScore)}
                              </small>
                              <small>
                                {restaurant.rating ? `${restaurant.rating.toFixed(1)}★ rating` : "No rating"} •{" "}
                                {restaurant.userRatingsTotal
                                  ? `${restaurant.userRatingsTotal.toLocaleString()} reviews`
                                  : "No review volume"}
                              </small>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="reveal-kicker">Fairness reveal</p>
                    <h2>No ranked restaurants</h2>
                    <p className="reveal-explainer">
                      The resolver completed, but all options were filtered by hard constraints.
                    </p>
                  </>
                )}
              </section>
            ) : null}

            <section className="live-room">
              <header className="live-header">
                <div>
                  <h2>{room.roomName}</h2>
                  <p>
                    Code <strong>{room.code}</strong> • {capitalizeFirst(room.location.label)}
                  </p>
                </div>

                <div className="live-controls">
                  {currentMember.isHost ? (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={handleResolve}
                      disabled={loading || sortedMembers.length === 0}
                    >
                      {room.status === "resolving"
                        ? "Resolving..."
                        : result
                          ? "Run again"
                          : "Resolve room"}
                    </button>
                  ) : (
                    <p className="waiting-note">Waiting for host to resolve.</p>
                  )}
                </div>
              </header>

              <section className="member-arena">
                <div className="arena-headline">
                  <h3>People in the room</h3>
                  <span>
                    {sortedMembers.length}/{MAX_ROOM_SIZE} Joined • {readiness.completed}/{readiness.total} Ready
                  </span>
                </div>

                <div className="member-orbit">
                  {sortedMembers.map((member) => {
                    const prefs = member.preferences ?? defaultUserPreferences();
                    const isMe = member.id === currentMember.id;

                    return (
                      <article key={member.id} className={`orbit-member ${isMe ? "orbit-member-me" : ""}`}>
                        <div className="member-topline">
                          <strong>{member.name}</strong>
                          <span>{member.isHost ? "Host" : "Guest"}</span>
                        </div>
                        <p>
                          {prefs.cuisinePreferences.length > 0
                            ? prefs.cuisinePreferences.map((value) => capitalizeFirst(value.trim())).join(", ")
                            : "No cuisines yet"}
                        </p>
                        <small>
                          {capitalizeFirst(prefs.vibePreference)} • Budget {prefs.budgetMax} •{" "}
                          {formatDistanceKm(prefs.maxDistanceMeters)}
                        </small>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="workbench">
                <article className="self-panel">
                  <h3>Your live profile</h3>
                  <label>
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
                    disabled={loading || room.status === "resolving"}
                    preferences={currentMember.preferences ?? defaultUserPreferences()}
                    onChange={handlePreferencesChange}
                  />
                </article>

                <article className="signal-panel">
                  <h3>Room information</h3>
                  <div className="signal-grid">
                    <div>
                      <span>Room status</span>
                      <strong>{capitalizeFirst(room.status)}</strong>
                    </div>
                    <div>
                      <span>Members joined</span>
                      <strong>{sortedMembers.length}</strong>
                    </div>
                    <div>
                      <span>Capacity left</span>
                      <strong>{Math.max(0, MAX_ROOM_SIZE - sortedMembers.length)}</strong>
                    </div>
                  </div>

                  {result ? (
                    <div className="elimination-feed">
                      <h4>Why options were removed:</h4>
                      {result.eliminations.length === 0 ? (
                        <p>No options were filtered out by group rules.</p>
                      ) : (
                        <ul>
                          {result.eliminations.slice(0, 5).map((item) => (
                            <li key={item.placeId}>
                              <strong>{item.name}</strong>
                              <span>{item.reasons.map(toFriendlyReason).join(" · ")}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="waiting-note">
                      Once resolved, this panel shows elimination reasons and outcome signals.
                    </p>
                  )}
                </article>
              </section>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
