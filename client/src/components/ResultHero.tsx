import type { RankedRestaurant } from "@munchscene/shared";
import "./ResultHero.css";

type ResultHeroProps = {
  restaurant: RankedRestaurant;
};

function priceLevelLabel(level?: number): string {
  if (level == null) return "—";
  return "$".repeat(Math.min(4, Math.max(0, level)));
}

export function ResultHero({ restaurant }: ResultHeroProps) {
  return (
    <header className="result-hero">
      <div className="result-hero__badge">Top pick</div>
      <h1 className="result-hero__name">{restaurant.name}</h1>
      <div className="result-hero__meta">
        <span className="result-hero__price">{priceLevelLabel(restaurant.priceLevel)}</span>
        {restaurant.rating != null && (
          <span className="result-hero__rating">
            ★ {restaurant.rating.toFixed(1)}
            {restaurant.userRatingsTotal != null && (
              <span className="result-hero__reviews"> ({restaurant.userRatingsTotal})</span>
            )}
          </span>
        )}
        {restaurant.address && (
          <span className="result-hero__address">{restaurant.address}</span>
        )}
      </div>
      {restaurant.isOpenNow != null && (
        <span className={`result-hero__open ${restaurant.isOpenNow ? "result-hero__open--yes" : "result-hero__open--no"}`}>
          {restaurant.isOpenNow ? "Open now" : "Closed"}
        </span>
      )}
    </header>
  );
}
