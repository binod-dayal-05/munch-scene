import { useState } from "react";

type CreateForm = {
  hostName: string;
  roomName: string;
  locationLabel: string;
  latitude: string;
  longitude: string;
};

type JoinForm = {
  name: string;
  code: string;
};

type RecentRoom = {
  roomId: string;
  memberId: string;
  roomName: string;
  city: string;
  roomCode: string;
};

type WelcomeScreenProps = {
  createForm: CreateForm;
  onCreateField: (field: keyof CreateForm, value: string) => void;
  onCreateRoom: (e: React.FormEvent<HTMLFormElement>) => void;
  joinForm: JoinForm;
  onJoinField: (field: keyof JoinForm, value: string) => void;
  onJoinRoom: (e: React.FormEvent<HTMLFormElement>) => void;
  recentRooms: RecentRoom[];
  onOpenRecentRoom: (roomId: string, memberId: string) => void;
  onUseMyLocation: () => void;
  loading: boolean;
};

export function WelcomeScreen({
  createForm,
  onCreateField,
  onCreateRoom,
  joinForm,
  onJoinField,
  onJoinRoom,
  recentRooms,
  onOpenRecentRoom,
  onUseMyLocation,
  loading,
}: WelcomeScreenProps) {
  const [tab, setTab] = useState<"create" | "join">("create");

  return (
    <div className="welcome-layout">
      {/* ── Left column: hero + recent rooms ── */}
      <div className="welcome-left">
        <div className="welcome-kicker">Fairness-first group dining</div>

        <h1 className="welcome-h1">
          Find where your group actually wants to eat.
        </h1>

        <p className="welcome-sub">
          Real-time decision rooms for groups who want less arguing and
          better outcomes. Set preferences, resolve, done.
        </p>

        <div className="welcome-features">
          <div className="welcome-feature">
            <div className="welcome-feature__icon">👥</div>
            <div className="welcome-feature__text">
              <strong>Live multiplayer rooms</strong> — everyone updates
              their preferences simultaneously, in real time
            </div>
          </div>
          <div className="welcome-feature">
            <div className="welcome-feature__icon">⚖️</div>
            <div className="welcome-feature__text">
              <strong>Fairness engine</strong> — scores restaurants by how
              well they satisfy every person in the room, not just the loudest
            </div>
          </div>
          <div className="welcome-feature">
            <div className="welcome-feature__icon">🍜</div>
            <div className="welcome-feature__text">
              <strong>Cuisine, vibe & budget</strong> — hard constraints
              eliminate bad fits before scoring even starts
            </div>
          </div>
        </div>

        {recentRooms.length > 0 && (
          <div className="recent-rooms">
            <div className="recent-rooms__title">Recent sessions</div>
            <div className="recent-rooms__list">
              {recentRooms.map((room) => (
                <div
                  key={`${room.roomId}:${room.memberId}`}
                  className="recent-room-row"
                >
                  <div className="recent-room-row__info">
                    <strong>{room.roomName}</strong>
                    <span>
                      {room.city} · {room.roomCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ms-btn ms-btn--ghost ms-btn--sm"
                    onClick={() =>
                      onOpenRecentRoom(room.roomId, room.memberId)
                    }
                    disabled={loading}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right column: create / join form card ── */}
      <div className="welcome-right">
        <div className="welcome-form-card">
          <div className="welcome-tabs">
            <button
              type="button"
              className={`welcome-tab${tab === "create" ? " welcome-tab--active" : ""}`}
              onClick={() => setTab("create")}
            >
              Create a room
            </button>
            <button
              type="button"
              className={`welcome-tab${tab === "join" ? " welcome-tab--active" : ""}`}
              onClick={() => setTab("join")}
            >
              Join with code
            </button>
          </div>

          <div className="welcome-form-body">
            {tab === "create" ? (
              <form onSubmit={onCreateRoom}>
                <div className="welcome-form-title">Start a room</div>
                <div className="welcome-form-sub">
                  You&apos;ll be the host. Share the code once it&apos;s
                  created.
                </div>

                <div className="ms-field">
                  <label className="ms-field__label" htmlFor="create-host-name">
                    Your name
                  </label>
                  <input
                    id="create-host-name"
                    required
                    minLength={2}
                    value={createForm.hostName}
                    onChange={(e) => onCreateField("hostName", e.target.value)}
                  />
                </div>

                <div className="ms-field">
                  <label className="ms-field__label" htmlFor="create-room-name">
                    Room name
                  </label>
                  <input
                    id="create-room-name"
                    required
                    minLength={2}
                    placeholder="Friday dinner crew"
                    value={createForm.roomName}
                    onChange={(e) => onCreateField("roomName", e.target.value)}
                  />
                </div>

                <div className="ms-field">
                  <label
                    className="ms-field__label"
                    htmlFor="create-location"
                  >
                    City / area
                  </label>
                  <input
                    id="create-location"
                    required
                    placeholder="Vancouver"
                    value={createForm.locationLabel}
                    onChange={(e) =>
                      onCreateField("locationLabel", e.target.value)
                    }
                  />
                  <span className="ms-field__hint">
                    City name is enough. Browser location helps with
                    distance-based scoring.
                  </span>
                </div>

                <button
                  type="button"
                  className="ms-location-btn"
                  onClick={onUseMyLocation}
                  disabled={loading}
                >
                  ↯ Use my browser location
                </button>

                <button
                  type="submit"
                  className="ms-btn ms-btn--primary ms-btn--full"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create room →"}
                </button>
              </form>
            ) : (
              <form onSubmit={onJoinRoom}>
                <div className="welcome-form-title">Join a room</div>
                <div className="welcome-form-sub">
                  Enter the 6-character code your host shared with you.
                </div>

                <div className="ms-field">
                  <label className="ms-field__label" htmlFor="join-name">
                    Your name
                  </label>
                  <input
                    id="join-name"
                    required
                    minLength={2}
                    value={joinForm.name}
                    onChange={(e) => onJoinField("name", e.target.value)}
                  />
                </div>

                <div className="ms-field">
                  <label className="ms-field__label" htmlFor="join-code">
                    Room code
                  </label>
                  <input
                    id="join-code"
                    required
                    minLength={6}
                    maxLength={6}
                    placeholder="AB12CD"
                    className="code-input"
                    value={joinForm.code}
                    onChange={(e) =>
                      onJoinField("code", e.target.value.toUpperCase())
                    }
                  />
                </div>

                <button
                  type="submit"
                  className="ms-btn ms-btn--secondary ms-btn--full"
                  disabled={loading}
                  style={{ marginTop: "0.25rem" }}
                >
                  {loading ? "Joining..." : "Join room →"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
