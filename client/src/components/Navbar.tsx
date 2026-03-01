import type { RefObject } from "react";
import { APP_NAME } from "@munchscene/shared";

type NavbarProps = {
  isLoggedIn: boolean;
  userEmail: string;
  isInLobby: boolean;
  roomCode?: string;
  isAuthOpen: boolean;
  authMenuRef: RefObject<HTMLDivElement | null>;
  onToggleAuth: () => void;
  onLeaveRoom: () => void;
  authMode: "signin" | "signup";
  onSetAuthMode: (mode: "signin" | "signup") => void;
  authEmail: string;
  onSetAuthEmail: (email: string) => void;
  authPassword: string;
  onSetAuthPassword: (password: string) => void;
  onAuthSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
  loading: boolean;
};

export function Navbar({
  isLoggedIn,
  userEmail,
  isInLobby,
  roomCode,
  isAuthOpen,
  authMenuRef,
  onToggleAuth,
  onLeaveRoom,
  authMode,
  onSetAuthMode,
  authEmail,
  onSetAuthEmail,
  authPassword,
  onSetAuthPassword,
  onAuthSubmit,
  onSignOut,
  loading,
}: NavbarProps) {
  const initial = isLoggedIn ? (userEmail || "U").slice(0, 1).toUpperCase() : null;

  return (
    <nav className="ms-nav">
      <div className="ms-nav__inner">
        <div className="ms-nav__logo">
          {APP_NAME.slice(0, 5)}<em>{APP_NAME.slice(5)}</em>
        </div>

        <div className="ms-nav__right">
          {isInLobby && roomCode && (
            <div className="ms-nav__live-badge">
              <span className="ms-nav__live-dot" />
              {roomCode}
            </div>
          )}

          {isInLobby && (
            <button
              type="button"
              className="ms-nav__back"
              onClick={onLeaveRoom}
            >
              ← Home
            </button>
          )}

          <div className="ms-nav__auth-wrap" ref={authMenuRef}>
            <button
              type="button"
              className="ms-nav__auth-btn"
              onClick={onToggleAuth}
              aria-expanded={isAuthOpen}
              aria-label="Account menu"
            >
              {initial ? (
                <>
                  <span className="ms-nav__avatar">{initial}</span>
                  Account
                </>
              ) : (
                "Sign in"
              )}
            </button>

            {isAuthOpen && (
              <div className="ms-auth-dropdown">
                {isLoggedIn ? (
                  <div className="ms-signed-in-info">
                    <div className="ms-signed-in-email">
                      {userEmail || "Signed in"}
                    </div>
                    <button
                      type="button"
                      className="ms-btn ms-btn--ghost ms-btn--full"
                      onClick={onSignOut}
                      disabled={loading}
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <form onSubmit={onAuthSubmit}>
                    <div className="ms-auth-segmented">
                      <button
                        type="button"
                        className={`ms-auth-seg-btn${authMode === "signin" ? " ms-auth-seg-btn--active" : ""}`}
                        onClick={() => onSetAuthMode("signin")}
                        disabled={loading}
                      >
                        Sign in
                      </button>
                      <button
                        type="button"
                        className={`ms-auth-seg-btn${authMode === "signup" ? " ms-auth-seg-btn--active" : ""}`}
                        onClick={() => onSetAuthMode("signup")}
                        disabled={loading}
                      >
                        Sign up
                      </button>
                    </div>

                    <div className="ms-auth-field">
                      <label htmlFor="nav-auth-email">Email</label>
                      <input
                        id="nav-auth-email"
                        type="email"
                        autoComplete="email"
                        value={authEmail}
                        onChange={(e) => onSetAuthEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="ms-auth-field">
                      <label htmlFor="nav-auth-password">Password</label>
                      <input
                        id="nav-auth-password"
                        type="password"
                        autoComplete={
                          authMode === "signin" ? "current-password" : "new-password"
                        }
                        minLength={6}
                        value={authPassword}
                        onChange={(e) => onSetAuthPassword(e.target.value)}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="ms-btn ms-btn--secondary ms-btn--full"
                      disabled={loading}
                      style={{ marginTop: "0.25rem" }}
                    >
                      {authMode === "signin" ? "Sign in" : "Create account"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
