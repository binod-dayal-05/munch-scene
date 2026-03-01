import { type RankedRestaurant, type RoomMember } from "@munchscene/shared";

type ExplanationInput = {
  rankedRestaurants: RankedRestaurant[];
  members: RoomMember[];
};

export const addRestaurantExplanations = async (
  input: ExplanationInput
): Promise<RankedRestaurant[]> => {
  void input.members;
  return input.rankedRestaurants.map((restaurant) => ({
    ...restaurant,
    explanation:
      restaurant.keyTradeoffs.length > 0
        ? `Fair pick with tradeoffs: ${restaurant.keyTradeoffs.join(", ")}.`
        : "Balanced pick across the group with strong overall fit."
  }));
};
