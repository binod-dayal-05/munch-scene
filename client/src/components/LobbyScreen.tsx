import {
  defaultUserPreferences,
  MAX_ROOM_SIZE,
  type MunchsceneRoom,
  type ResolveResult,
  type UserPreferences,
} from "@munchscene/shared";
import { PreferenceEditor } from "./PreferenceEditor";
import { ResultsView } from "./ResultsView";

type Member = MunchsceneRoom["members"][string];

type LobbyScreenProps = {
  room: MunchsceneRoom;
  currentMember: Member;
  result: ResolveResult | null;
  onPreferencesChange: (prefs: UserPreferences) => void;
  onNameBlur: (name: string) => void;
  onNameChange: (name: string) => void;
  onResolve: () => void;
  loading: boolean;
};

export function LobbyScreen({
  room,
  currentMember,
  result,
  onPreferencesChange,
  onNameBlur,
  onNameChange,
  onResolve,
  loading,
}: LobbyScreenProps) {
  const members = Object.values(room.members).sort(
    (a, b) => Number(b.isHost) - Number(a.isHost)
  );

  return (
    <div>
      {/* ── Room header strip ── */}
      <div className="lobby-header">
        <div className="lobby-header__left">
          <div className="lobby-header__code">
            Room code
            <span className="lobby-header__code-val">{room.code}</span>
          </div>
          <h2 className="lobby-header__name">{room.roomName}</h2>
          <div className="lobby-header__city">{room.location.label}</div>
        </div>

        <div className="lobby-header__right">
          <span className={`ms-status ms-status--${room.status}`}>
            {room.status}
          </span>
        </div>
      </div>

      {/* ── Results (shows above grid when resolved) ── */}
      {result && <ResultsView result={result} />}

      {/* ── Two-column grid: members | preferences ── */}
      <div className="lobby-grid">
        {/* Members panel */}
        <div className="ms-panel">
          <div className="ms-panel__hd">
            <div>
              <div className="ms-panel__title">In the room</div>
            </div>
            <span className="ms-panel__badge">
              {members.length}/{MAX_ROOM_SIZE}
            </span>
          </div>

          <div className="ms-panel__bd">
            {members.map((member) => {
              const prefs = member.preferences ?? defaultUserPreferences();
              const isMe = member.id === currentMember.id;
              const initial = (member.name || "?").slice(0, 1).toUpperCase();
              const cuisines =
                prefs.cuisinePreferences.slice(0, 2).join(", ") ||
                "Any cuisine";
              const budget = "$".repeat(
                Math.max(1, prefs.budgetMax || 1)
              );

              return (
                <div
                  key={member.id}
                  className={`member-row${isMe ? " member-row--me" : ""}`}
                >
                  <div className="member-row__av">{initial}</div>
                  <div className="member-row__body">
                    <div className="member-row__name-line">
                      <span className="member-row__name">{member.name}</span>
                      {member.isHost && (
                        <span className="ms-tag">Host</span>
                      )}
                    </div>
                    <div className="member-row__detail">
                      {cuisines} · {budget} · {prefs.vibePreference}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ms-panel__ft">
            {currentMember.isHost ? (
              <button
                type="button"
                className="ms-btn ms-btn--primary ms-btn--full"
                onClick={onResolve}
                disabled={loading || members.length === 0}
              >
                {room.status === "resolving"
                  ? "Resolving group tension..."
                  : result
                    ? "Re-run fairness engine"
                    : "Resolve this room"}
              </button>
            ) : (
              <p className="lobby-resolve-hint">
                Waiting for the host to run the fairness engine when
                everyone&apos;s ready.
              </p>
            )}
          </div>
        </div>

        {/* Preferences panel */}
        <div className="ms-panel">
          <div className="prefs-panel-hd">
            <div className="prefs-panel-title">Your preferences</div>
            <div className="prefs-panel-sub">
              Updates sync live for everyone in the room.
            </div>
          </div>

          <div className="prefs-panel-body">
            <div className="display-name-field">
              <div className="ms-field">
                <label className="ms-field__label" htmlFor="display-name">
                  Display name
                </label>
                <input
                  id="display-name"
                  value={currentMember.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  onBlur={(e) => onNameBlur(e.target.value)}
                />
              </div>
            </div>

            <PreferenceEditor
              disabled={loading}
              preferences={
                currentMember.preferences ?? defaultUserPreferences()
              }
              onChange={onPreferencesChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
