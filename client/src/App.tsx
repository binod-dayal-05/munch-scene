import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  type MunchsceneRoom,
  type ResolveResult,
  type UserPreferences,
} from "@munchscene/shared";
import { Navbar } from "./components/Navbar";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import {
  createRoom,
  hydrateRoomSession,
  joinRoomByCode,
  requestRoomResolution,
  subscribeToResult,
  subscribeToRoom,
  updateMemberName,
  updateMemberPreferences,
} from "./lib/rooms";
import {
  listRecentRooms,
  removeRecentRoom,
  readSessionFromUrl,
  saveRecentRoom,
  updateRoomSearchParams,
} from "./lib/session";
import { auth } from "./lib/firebase";
import {
  loginWithEmailPassword,
  logoutFromMunchscene,
  signupWithEmailPassword,
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
  longitude: "",
};

const initialJoinForm = {
  name: "",
  code: "",
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
  const [recentRooms, setRecentRooms] = useState(
    () => [] as ReturnType<typeof listRecentRooms>
  );
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUserEmail, setAuthUserEmail] = useState("");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // Close profile menu on outside click
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (profileMenuRef.current.contains(event.target as Node)) return;
      setIsProfileMenuOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  // Auth state observer + URL session hydration
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

      if (!session.roomId) return;

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
            city: nextRoom.location.label,
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
            message:
              "Saved room session expired. Join again with a room code.",
          });
        })
        .finally(() => {
          setLoading(false);
        });
    });

    return unsubscribe;
  }, []);

  // Real-time room subscription
  useEffect(() => {
    if (!room) return;

    const subscription = subscribeToRoom(room.id, (nextRoom) => {
      setRoom(nextRoom);

      if (!nextRoom) {
        setResult(null);
        setMode("welcome");
        updateRoomSearchParams();
        setNotice({
          tone: "error",
          message: "This room was removed.",
        });
      } else {
        saveRecentRoom(memberId, {
          roomId: nextRoom.id,
          memberId,
          roomCode: nextRoom.code,
          roomName: nextRoom.roomName,
          city: nextRoom.location.label,
        });
        setRecentRooms(listRecentRooms(memberId));
      }
    });

    return subscription.unsubscribe;
  }, [memberId, room?.id]);

  // Real-time result subscription
  useEffect(() => {
    if (!room?.latestResultId) {
      setResult(null);
      return;
    }

    const subscription = subscribeToResult(
      room.id,
      room.latestResultId,
      setResult
    );
    return subscription.unsubscribe;
  }, [room?.id, room?.latestResultId]);

  const currentMember = useMemo(() => {
    if (!room || !memberId) return null;
    return room.members[memberId] ?? null;
  }, [memberId, room]);

  // ── Handlers ──────────────────────────────────────────────

  const handleEmailAuthSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
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
          authMode === "signin"
            ? "Signed in successfully."
            : "Account created and signed in.",
      });
      setAuthPassword("");
      setIsProfileMenuOpen(false);
    } catch (error) {
      setNotice({
        tone: "error",
        message: describeAuthError(error, "email"),
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
      setNotice({ tone: "info", message: "Signed out." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: describeAuthError(error, "general"),
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
        message: "Sign in with email/password to create a room.",
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
        longitude: createForm.longitude
          ? Number(createForm.longitude)
          : undefined,
      });

      setRoom(nextRoom);
      setResult(null);
      setMode("lobby");
      saveRecentRoom(memberId, {
        roomId: nextRoom.id,
        memberId,
        roomCode: nextRoom.code,
        roomName: nextRoom.roomName,
        city: nextRoom.location.label,
      });
      setRecentRooms(listRecentRooms(memberId));
      updateRoomSearchParams(nextRoom.id, memberId);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to create room right now",
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
        message: "Sign in with email/password to join a room.",
      });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const nextRoom = await joinRoomByCode({
        code: joinForm.code,
        name: joinForm.name,
        memberId,
      });

      setRoom(nextRoom);
      setResult(null);
      setMode("lobby");
      saveRecentRoom(memberId, {
        roomId: nextRoom.id,
        memberId,
        roomCode: nextRoom.code,
        roomName: nextRoom.roomName,
        city: nextRoom.location.label,
      });
      setRecentRooms(listRecentRooms(memberId));
      updateRoomSearchParams(nextRoom.id, memberId);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to join that room right now",
      });
    } finally {
      setJoinForm(initialJoinForm);
      setLoading(false);
    }
  };

  const handlePreferencesChange = async (preferences: UserPreferences) => {
    if (!room || !currentMember) return;

    setRoom({
      ...room,
      members: {
        ...room.members,
        [currentMember.id]: { ...currentMember, preferences },
      },
    });

    try {
      await updateMemberPreferences(room.id, currentMember.id, preferences);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to save preferences",
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
        message:
          error instanceof Error ? error.message : "Failed to update display name",
      });
    }
  };

  const handleNameChange = (name: string) => {
    if (!currentMember) return;

    setRoom((currentRoom) =>
      currentRoom
        ? {
            ...currentRoom,
            members: {
              ...currentRoom.members,
              [currentMember.id]: { ...currentMember, name },
            },
          }
        : currentRoom
    );
  };

  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      setNotice({
        tone: "error",
        message: "Geolocation is not available in this browser.",
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
          locationLabel: current.locationLabel || "Current location",
        }));
        setLoading(false);
      },
      () => {
        setNotice({
          tone: "error",
          message:
            "Location permission was denied. You can still paste latitude and longitude manually.",
        });
        setLoading(false);
      }
    );
  };

  const handleResolve = async () => {
    if (!room || !currentMember?.isHost) return;

    setLoading(true);
    setNotice(null);

    try {
      await requestRoomResolution(room.id);
      setNotice({
        tone: "info",
        message:
          "Fairness engine finished. Results are now available for this room.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to queue room resolution",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecentRoom = async (
    roomId: string,
    sessionMemberId: string
  ) => {
    if (!memberId) {
      setNotice({
        tone: "error",
        message: "Sign in with email/password to open a room.",
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
        city: nextRoom.location.label,
      });
      setRecentRooms(listRecentRooms(memberId));
      updateRoomSearchParams(nextRoom.id, memberId);
    } catch (error) {
      removeRecentRoom(memberId, roomId, sessionMemberId);
      setRecentRooms(listRecentRooms(memberId));
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to reopen that room",
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

  // ── Render ────────────────────────────────────────────────

  // Build recent rooms list with the shape WelcomeScreen expects
  const recentRoomsList = recentRooms.map((r) => ({
    roomId: r.roomId,
    memberId: r.memberId,
    roomName: r.roomName,
    city: r.city,
    roomCode: r.roomCode,
  }));

  return (
    <div className="ms-root">
      <Navbar
        isLoggedIn={!!memberId}
        userEmail={authUserEmail}
        isInLobby={mode === "lobby"}
        roomCode={room?.code}
        isAuthOpen={isProfileMenuOpen}
        authMenuRef={profileMenuRef}
        onToggleAuth={() => setIsProfileMenuOpen((v) => !v)}
        onLeaveRoom={leaveRoom}
        authMode={authMode}
        onSetAuthMode={setAuthMode}
        authEmail={authEmail}
        onSetAuthEmail={setAuthEmail}
        authPassword={authPassword}
        onSetAuthPassword={setAuthPassword}
        onAuthSubmit={handleEmailAuthSubmit}
        onSignOut={handleSignOut}
        loading={loading}
      />

      {notice && (
        <div className={`ms-notice ms-notice--${notice.tone}`}>
          <span>{notice.message}</span>
          <button
            type="button"
            className="ms-notice__dismiss"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <main className="ms-page">
        {mode === "welcome" && (
          <WelcomeScreen
            createForm={createForm}
            onCreateField={(field, value) =>
              setCreateForm((f) => ({ ...f, [field]: value }))
            }
            onCreateRoom={handleCreateRoom}
            joinForm={joinForm}
            onJoinField={(field, value) =>
              setJoinForm((f) => ({ ...f, [field]: value }))
            }
            onJoinRoom={handleJoinRoom}
            recentRooms={recentRoomsList}
            onOpenRecentRoom={handleOpenRecentRoom}
            onUseMyLocation={handleUseMyLocation}
            loading={loading}
          />
        )}

        {mode === "lobby" && room && currentMember && (
          <LobbyScreen
            room={room}
            currentMember={currentMember}
            result={result}
            onPreferencesChange={handlePreferencesChange}
            onNameBlur={handleNameBlur}
            onNameChange={handleNameChange}
            onResolve={handleResolve}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}

