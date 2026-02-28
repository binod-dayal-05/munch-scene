import type { ResolveResult } from "@munchscene/shared";

/**
 * Mock result fixture shaped exactly like the shared ResolveResult contract.
 * Use for development and tests. Replace with adapter + API/Firebase in production.
 */
export const mockResolveResult: ResolveResult = {
  id: "res_mock_001",
  roomId: "room_abc",
  computedAt: new Date().toISOString(),
  eliminatedCount: 2,
  eliminations: [
    {
      placeId: "ch_elim_1",
      name: "Steakhouse Prime",
      reasons: ["Does not meet vegetarian requirements"],
    },
    {
      placeId: "ch_elim_2",
      name: "Luxury Sushi Bar",
      reasons: ["Over budget for 2 members", "Outside max distance for 1 member"],
    },
  ],
  rankedRestaurants: [
    {
      placeId: "ch_1",
      name: "The Green Fork",
      priceLevel: 1,
      rating: 4.6,
      userRatingsTotal: 320,
      types: ["restaurant", "vegetarian", "vegan_options"],
      address: "123 Main St",
      lat: 49.2827,
      lng: -123.1207,
      isOpenNow: true,
      finalScore: 0.82,
      meanScore: 0.78,
      fairnessScore: 0.91,
      variance: 0.04,
      minUserScore: 0.72,
      userScores: {
        u1: { cuisine: 0.9, vibe: 0.7, budgetComfort: 0.8, distanceComfort: 0.9, total: 0.82 },
        u2: { cuisine: 0.7, vibe: 0.85, budgetComfort: 0.9, distanceComfort: 0.75, total: 0.8 },
        u3: { cuisine: 0.72, vibe: 0.8, budgetComfort: 0.85, distanceComfort: 0.7, total: 0.76 },
      },
      explanation:
        "The Green Fork tops the list because it keeps everyone in their comfort zone: great veg options, casual vibe, and it fits everyone's budget. One of you gets the aesthetic vibe, the rest get a reliable crowd-pleaser.",
      keyTradeoffs: [
        "Slightly farther for Alex (still within range)",
        "Less 'hype' than one member wanted, but balanced by quality",
      ],
    },
    {
      placeId: "ch_2",
      name: "Pasta & Co",
      priceLevel: 2,
      rating: 4.4,
      userRatingsTotal: 180,
      types: ["restaurant", "italian"],
      address: "456 Oak Ave",
      lat: 49.283,
      lng: -123.118,
      isOpenNow: true,
      finalScore: 0.74,
      meanScore: 0.76,
      fairnessScore: 0.78,
      variance: 0.08,
      minUserScore: 0.65,
      userScores: {
        u1: { cuisine: 0.95, vibe: 0.6, budgetComfort: 0.7, distanceComfort: 0.85, total: 0.78 },
        u2: { cuisine: 0.5, vibe: 0.8, budgetComfort: 0.75, distanceComfort: 0.9, total: 0.73 },
        u3: { cuisine: 0.65, vibe: 0.75, budgetComfort: 0.8, distanceComfort: 0.7, total: 0.72 },
      },
      explanation:
        "Strong Italian pick with vegetarian options. A bit pricier for the budget-conscious, but the fairness score stays high because no one is left unhappy.",
      keyTradeoffs: [
        "Budget stretch for one member",
        "Slightly higher variance in satisfaction",
      ],
    },
    {
      placeId: "ch_3",
      name: "Noodle Bar Central",
      priceLevel: 1,
      rating: 4.2,
      userRatingsTotal: 210,
      types: ["restaurant", "asian"],
      address: "789 King St",
      lat: 49.281,
      lng: -123.122,
      isOpenNow: false,
      finalScore: 0.68,
      meanScore: 0.7,
      fairnessScore: 0.72,
      variance: 0.1,
      minUserScore: 0.58,
      userScores: {
        u1: { cuisine: 0.6, vibe: 0.9, budgetComfort: 0.95, distanceComfort: 0.7, total: 0.78 },
        u2: { cuisine: 0.75, vibe: 0.65, budgetComfort: 0.9, distanceComfort: 0.65, total: 0.73 },
        u3: { cuisine: 0.58, vibe: 0.7, budgetComfort: 0.85, distanceComfort: 0.6, total: 0.68 },
      },
      // No Gemini explanation — fallback copy should render
      keyTradeoffs: [
        "Closed at current time",
        "Lower minimum satisfaction for one member",
      ],
    },
  ],
};
