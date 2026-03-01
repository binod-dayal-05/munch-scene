import type { ResolveResult } from "@munchscene/shared";

type ResultsViewProps = {
  result: ResolveResult;
};

const sanitizeFeedText = (value: string): string =>
  value
    .replace(/\bn[1i!|]*g+\s*g+[e3]*r+\b/gi, "[redacted]")
    .replace(/\bn[1i!|]*g+\s*g+[a@]+\b/gi, "[redacted]");

const formatScore = (value: number) => `${Math.round(value * 100)}%`;

const priceLabel = (priceLevel?: number) => {
  if (priceLevel === undefined) {
    return null;
  }

  return "$".repeat(Math.max(priceLevel, 1));
};

export function ResultsView({ result }: ResultsViewProps) {
  const topPick = result.rankedRestaurants[0];
  const secondaryPicks = result.rankedRestaurants.slice(1);

  if (!topPick) {
    return (
      <section className="results-layout">
        <div className="panel result-empty">
          <h2>No ranked restaurants yet</h2>
          <p>
            The fairness engine ran, but every option was filtered out by the current
            group constraints.
          </p>
          <p>
            Eliminated restaurants: <strong>{result.eliminatedCount}</strong>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="results-layout">
      <div className="panel result-hero">
        <div className="result-kicker">Recommended for tonight</div>
        <h2>{topPick.name}</h2>
        <p className="result-address">{topPick.address ?? "Address unavailable"}</p>

        <div className="result-score-grid">
          <div className="score-chip">
            <span>Final score</span>
            <strong>{formatScore(topPick.finalScore)}</strong>
          </div>
          <div className="score-chip">
            <span>Match score</span>
            <strong>{formatScore(topPick.meanScore)}</strong>
          </div>
          <div className="score-chip">
            <span>Fairness score</span>
            <strong>{formatScore(topPick.fairnessScore)}</strong>
          </div>
          <div className="score-chip">
            <span>Eliminated</span>
            <strong>{result.eliminatedCount}</strong>
          </div>
        </div>

        <div className="fairness-meter">
          <div
            className="fairness-meter-fill"
            style={{ width: `${Math.max(8, topPick.fairnessScore * 100)}%` }}
          />
        </div>

        <p className="result-explanation">
          {topPick.explanation ??
            "This option best balances the room without leaving anyone too far behind."}
        </p>

        <div className="tradeoff-row">
          {topPick.keyTradeoffs.map((tradeoff) => (
            <span key={tradeoff} className="tradeoff-pill">
              {tradeoff}
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Next best options</h2>
            <p>Sorted by fairness-adjusted score after the top pick.</p>
          </div>
          <div className="result-meta">
            <span>{result.rankedRestaurants.length} viable spots</span>
          </div>
        </div>

        <div className="ranked-list">
          {secondaryPicks.map((restaurant, index) => (
            <article key={restaurant.placeId} className="ranked-card">
              <div className="ranked-card-top">
                <div>
                  <div className="ranked-index">#{index + 2}</div>
                  <h3>{restaurant.name}</h3>
                  <p>{restaurant.address ?? "Address unavailable"}</p>
                </div>
                <div className="ranked-badges">
                  {priceLabel(restaurant.priceLevel) ? (
                    <span className="result-badge">
                      {priceLabel(restaurant.priceLevel)}
                    </span>
                  ) : null}
                  {restaurant.rating ? (
                    <span className="result-badge">{restaurant.rating.toFixed(1)} stars</span>
                  ) : null}
                </div>
              </div>

              <div className="mini-score-grid">
                <div>
                  <span>Final</span>
                  <strong>{formatScore(restaurant.finalScore)}</strong>
                </div>
                <div>
                  <span>Mean</span>
                  <strong>{formatScore(restaurant.meanScore)}</strong>
                </div>
                <div>
                  <span>Fairness</span>
                  <strong>{formatScore(restaurant.fairnessScore)}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Constraint report</h2>
            <p>Restaurants filtered out by the group’s hard rules.</p>
          </div>
          <div className="result-meta">
            <span>{result.eliminatedCount} removed</span>
          </div>
        </div>

        {result.eliminations.length === 0 ? (
          <p className="helper-copy">No restaurants were removed by hard constraints.</p>
        ) : (
          <div className="elimination-list">
            {result.eliminations.map((elimination) => (
              <article key={elimination.placeId} className="elimination-card">
                <strong>{elimination.name}</strong>
                <p>{elimination.reasons.map(sanitizeFeedText).join(" · ")}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
