import type { RankedRestaurant } from "@munchscene/shared";
import { RankedRestaurantCard } from "./RankedRestaurantCard";
import "./RankedList.css";

type RankedListProps = {
  /** Full list; typically skip index 0 (hero) and show 1..n here. */
  restaurants: RankedRestaurant[];
  /** Start rank to display (e.g. 2 when first is hero). */
  startRank?: number;
};

export function RankedList({ restaurants, startRank = 2 }: RankedListProps) {
  const rest = restaurants.slice(startRank - 1);

  if (rest.length === 0) return null;

  return (
    <section className="ranked-list" aria-label="Ranked options">
      <h2 className="ranked-list__title">Also in the running</h2>
      <ul className="ranked-list__items">
        {rest.map((r, i) => (
          <li key={r.placeId}>
            <RankedRestaurantCard restaurant={r} rank={startRank + i} />
          </li>
        ))}
      </ul>
    </section>
  );
}
