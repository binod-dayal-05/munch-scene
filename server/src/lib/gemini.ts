import type { ResolveResult } from "@munchscene/shared";
import { serverEnv } from "../config/env";

type GeminiCandidate = ResolveResult["rankedRestaurants"][number];

const fallbackExplanation = (restaurant: GeminiCandidate) =>
  `${restaurant.name} balances the group well with a ${restaurant.fairnessScore.toFixed(
    2
  )} fairness score and a ${restaurant.meanScore.toFixed(2)} average match.`;

export const generateExplanation = async (
  restaurant: GeminiCandidate,
  eliminatedCount: number
): Promise<string> => {
  const systemPrompt =
    "You explain restaurant choices to a group of friends. Be friendly, concise, playful, and emphasize fairness and compromise. Keep it to 2 short sentences max.";
  const prompt = [
    `Restaurant: ${restaurant.name}`,
    `Mean score: ${restaurant.meanScore.toFixed(3)}`,
    `Fairness score: ${restaurant.fairnessScore.toFixed(3)}`,
    `Eliminated count: ${eliminatedCount}`,
    `Key tradeoffs: ${restaurant.keyTradeoffs.join(" | ")}`
  ].join("\n");

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.openRouterApiKey}`
      },
      body: JSON.stringify({
        model: serverEnv.openRouterModel,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 90
      })
    }
  );

  if (!response.ok) {
    return fallbackExplanation(restaurant);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return payload.choices?.[0]?.message?.content?.trim() || fallbackExplanation(restaurant);
};
