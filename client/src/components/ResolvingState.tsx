import "./ResolvingState.css";

export function ResolvingState() {
  return (
    <div className="resolving-state">
      <div className="resolving-state__loader" aria-hidden />
      <p className="resolving-state__message">Resolving group tension...</p>
      <p className="resolving-state__hint">We're balancing preferences so no one gets left out.</p>
    </div>
  );
}
