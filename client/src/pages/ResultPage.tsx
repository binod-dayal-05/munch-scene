import type { ResolveResult } from "@munchscene/shared";
import { ResolvingState } from "../components/ResolvingState";
import { ResultHero } from "../components/ResultHero";
import { FairnessMeter } from "../components/FairnessMeter";
import { EliminatedCount } from "../components/EliminatedCount";
import { ExplanationCard } from "../components/ExplanationCard";
import { RankedList } from "../components/RankedList";
import "./ResultPage.css";

type ResultPageProps = {
  result: ResolveResult | null;
  resolving: boolean;
  onResolvingComplete?: () => void;
};

export function ResultPage({ result, resolving, onResolvingComplete }: ResultPageProps) {
  if (resolving) {
    return (
      <div className="result-page">
        <ResolvingState />
        {onResolvingComplete && (
          <button
            type="button"
            className="result-page__demo-btn"
            onClick={onResolvingComplete}
          >
            Show mock result (demo)
          </button>
        )}
      </div>
    );
  }

  if (!result || result.rankedRestaurants.length === 0) {
    return (
      <div className="result-page">
        <div className="result-page__empty">
          <p>No results yet. Start a room and resolve to see recommendations.</p>
        </div>
      </div>
    );
  }

  const top = result.rankedRestaurants[0];
  const rest = result.rankedRestaurants.slice(1);

  return (
    <div className="result-page">
      <div className="result-page__chrome">
        <h1 className="result-page__app-name">Munchscene</h1>
        <p className="result-page__tagline">Results</p>
      </div>

      <main className="result-page__main">
        <ResultHero restaurant={top} />

        <div className="result-page__fairness">
          <FairnessMeter value={top.fairnessScore} label="Group fairness" />
        </div>

        <EliminatedCount
          count={result.eliminatedCount}
          eliminations={result.eliminations.map((e) => ({ name: e.name, reasons: e.reasons }))}
        />

        <ExplanationCard restaurant={top} />

        <RankedList restaurants={result.rankedRestaurants} startRank={2} />
      </main>
    </div>
  );
}
