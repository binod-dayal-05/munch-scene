import { useState } from "react";
import type { ResolveResult } from "@munchscene/shared";

const PAGE_SIZE = 5;

type ResultsViewProps = {
  result: ResolveResult;
};

const formatScore = (value: number) => `${Math.round(value * 100)}%`;

const priceLabel = (priceLevel?: number): string | null => {
  if (priceLevel === undefined) return null;
  return "$".repeat(Math.max(priceLevel, 1));
};

export function ResultsView({ result }: ResultsViewProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const ranked = result.rankedRestaurants ?? [];
  const eliminations = result.eliminations ?? [];
  const topPick = ranked[0];
  const secondaryPicks = ranked.slice(1);

  const visiblePicks = secondaryPicks.slice(0, visibleCount);
  const hasMore = visibleCount < secondaryPicks.length;
  const isExpanded = visibleCount > PAGE_SIZE;

  if (!topPick) {
    return (
      <div className="results-section">
        <div className="result-card">
          <div className="result-empty">
            <div className="result-empty__title">No ranked restaurants</div>
            <p className="result-empty__body">
              The fairness engine ran, but every option was filtered out by the
              group&apos;s constraints.
            </p>
            <p className="result-empty__body">
              Eliminated: <strong>{result.eliminatedCount}</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="results-section">
      {/* ── Top pick — dark reveal card ── */}
      <div className="result-reveal">
        <div className="result-reveal__kicker">
          <span className="result-reveal__kicker-dot" />
          Recommended for tonight
        </div>

        <div className="result-reveal__name">{topPick.name}</div>
        <div className="result-reveal__addr">
          {topPick.address ?? "Address unavailable"}
        </div>

        <div className="result-scores">
          <div className="result-score-tile">
            <span className="result-score-tile__lbl">Final score</span>
            <span className="result-score-tile__val">
              {formatScore(topPick.finalScore)}
            </span>
          </div>
          <div className="result-score-tile">
            <span className="result-score-tile__lbl">Match score</span>
            <span className="result-score-tile__val">
              {formatScore(topPick.meanScore)}
            </span>
          </div>
          <div className="result-score-tile">
            <span className="result-score-tile__lbl">Fairness</span>
            <span className="result-score-tile__val">
              {formatScore(topPick.fairnessScore)}
            </span>
          </div>
          <div className="result-score-tile">
            <span className="result-score-tile__lbl">Filtered out</span>
            <span className="result-score-tile__val">
              {result.eliminatedCount}
            </span>
          </div>
        </div>

        <div className="fairness-bar">
          <div className="fairness-bar__meta">
            <span>Fairness meter</span>
            <span>{formatScore(topPick.fairnessScore)}</span>
          </div>
          <div className="fairness-bar__track">
            <div
              className="fairness-bar__fill"
              style={{
                width: `${Math.max(8, topPick.fairnessScore * 100)}%`,
              }}
            />
          </div>
        </div>

        <p className="result-reveal__explain">
          {topPick.explanation ??
            "This option best balances the room without leaving anyone too far behind."}
        </p>

        {(topPick.keyTradeoffs ?? []).length > 0 && (
          <div className="result-tradeoffs">
            {(topPick.keyTradeoffs ?? []).map((tradeoff) => (
              <span key={tradeoff} className="result-tradeoff">
                {tradeoff}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Next best options ── */}
      {secondaryPicks.length > 0 && (
        <div className="result-card">
          <div className="result-card__hd">
            <span className="result-card__title">Next best options</span>
            <span className="result-card__count">
              {ranked.length} viable spots
            </span>
          </div>

          <div>
            {visiblePicks.map((restaurant, index) => (
              <div key={restaurant.placeId} className="runner-up-item">
                <div className="runner-up-item__rank">#{index + 2}</div>

                <div className="runner-up-item__main">
                  <div className="runner-up-item__name">{restaurant.name}</div>
                  <div className="runner-up-item__addr">
                    {restaurant.address ?? "Address unavailable"}
                  </div>
                  <div className="runner-up-scores">
                    <div className="runner-up-score">
                      <strong>{formatScore(restaurant.finalScore)}</strong>
                      Final
                    </div>
                    <div className="runner-up-score">
                      <strong>{formatScore(restaurant.meanScore)}</strong>
                      Mean
                    </div>
                    <div className="runner-up-score">
                      <strong>{formatScore(restaurant.fairnessScore)}</strong>
                      Fair
                    </div>
                  </div>
                </div>

                <div className="runner-up-item__badges">
                  {priceLabel(restaurant.priceLevel) && (
                    <span className="result-badge">
                      {priceLabel(restaurant.priceLevel)}
                    </span>
                  )}
                  {restaurant.rating && (
                    <span className="result-badge">
                      {restaurant.rating.toFixed(1)} ★
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(hasMore || isExpanded) && (
            <div className="runner-up-pagination">
              {hasMore && (
                <button
                  type="button"
                  className="ms-btn ms-btn--ghost ms-btn--sm"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, secondaryPicks.length - visibleCount)} more
                </button>
              )}
              {isExpanded && (
                <button
                  type="button"
                  className="ms-btn ms-btn--ghost ms-btn--sm"
                  onClick={() => setVisibleCount(PAGE_SIZE)}
                >
                  Show less
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Constraint report ── */}
      <div className="result-card">
        <div className="result-card__hd">
          <span className="result-card__title">Constraint report</span>
          <span className="result-card__count">
            {result.eliminatedCount} removed
          </span>
        </div>

        {eliminations.length === 0 ? (
          <div className="result-empty" style={{ padding: "1.25rem" }}>
            <p className="result-empty__body">
              No restaurants were removed by hard constraints.
            </p>
          </div>
        ) : (
          <div>
            {eliminations.map((elimination) => (
              <div key={elimination.placeId} className="elimination-item">
                <div className="elimination-item__x">✕</div>
                <div>
                  <div className="elimination-item__name">
                    {elimination.name}
                  </div>
                  <div className="elimination-item__reasons">
                    {elimination.reasons.join(" · ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
