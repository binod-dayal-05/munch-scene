import "./EliminatedCount.css";

type EliminatedCountProps = {
  count: number;
  /** Optional list of eliminated names to show on expand or tooltip. */
  eliminations?: Array<{ name: string; reasons: string[] }>;
};

export function EliminatedCount({ count, eliminations = [] }: EliminatedCountProps) {
  if (count === 0) return null;

  return (
    <div className="eliminated-count">
      <span className="eliminated-count__number">{count}</span>
      <span className="eliminated-count__label">
        {count === 1 ? "restaurant" : "restaurants"} eliminated (constraints)
      </span>
      {eliminations.length > 0 && (
        <ul className="eliminated-count__list" aria-label="Eliminated options">
          {eliminations.map((e, i) => (
            <li key={i} className="eliminated-count__item">
              <strong>{e.name}</strong>
              {e.reasons.length > 0 && (
                <span className="eliminated-count__reasons">
                  — {e.reasons.join("; ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
