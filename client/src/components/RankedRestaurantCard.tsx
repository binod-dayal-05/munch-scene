import type { RankedRestaurant } from "@munchscene/shared";
import { FairnessMeter } from "./FairnessMeter";
import "./RankedRestaurantCard.css";

type RankedRestaurantCardProps = {
  restaurant: RankedRestaurant;
  rank: number;
};

function priceLevelLabel(level?: number): string {
  if (level == null) return "—";
  return "$".repeat(Math.min(4, Math.max(0, level)));
}

export function RankedRestaurantCard({ restaurant, rank }: RankedRestaurantCardProps) {
  return (
    <article className="ranked-card">
      <div className="ranked-card__rank">#{rank}</div>
      <div className="ranked-card__main">
        <h3 className="ranked-card__name">{restaurant.name}</h3>
        <div className="ranked-card__meta">
          <span>{priceLevelLabel(restaurant.priceLevel)}</span>
          {restaurant.rating != null && (
            <span>★ {restaurant.rating.toFixed(1)}</span>
          )}
        </div>
        <FairnessMeter value={restaurant.fairnessScore} label="Fairness" />
      </div>
    </article>
  );
}
