import type { RankedRestaurant } from "@munchscene/shared";
import "./ExplanationCard.css";

const FALLBACK_EXPLANATION =
  "We picked this spot because it balances everyone's preferences and keeps the group happy—no one gets left out.";

type ExplanationCardProps = {
  /** Top pick; uses explanation and keyTradeoffs. */
  restaurant: RankedRestaurant;
};

export function ExplanationCard({ restaurant }: ExplanationCardProps) {
  const hasGemini = Boolean(restaurant.explanation?.trim());
  const explanation = hasGemini ? restaurant.explanation! : FALLBACK_EXPLANATION;
  const tradeoffs = restaurant.keyTradeoffs ?? [];

  return (
    <section className="explanation-card" aria-label="Why this pick">
      <h2 className="explanation-card__title">Why this pick?</h2>
      <p className="explanation-card__body">{explanation}</p>
      {tradeoffs.length > 0 && (
        <div className="explanation-card__tradeoffs">
          <span className="explanation-card__tradeoffs-label">Trade-offs:</span>
          <ul className="explanation-card__tradeoffs-list">
            {tradeoffs.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
