import { FAIRNESS_WEIGHTS } from "./constants";

export const mean = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const variance = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  const average = mean(values);
  return mean(values.map((value) => (value - average) ** 2));
};

export const normalizeFairness = (rawVariance: number): number =>
  Math.max(0, Math.min(1, 1 - rawVariance));

export const lowFloorPenalty = (minUserScore: number): number => {
  if (minUserScore >= FAIRNESS_WEIGHTS.lowFloorThreshold) {
    return 0;
  }

  return (
    (FAIRNESS_WEIGHTS.lowFloorThreshold - minUserScore) /
    FAIRNESS_WEIGHTS.lowFloorThreshold
  );
};

export const ratingBonus = (rating?: number): number => {
  if (!rating) {
    return 0;
  }

  return Math.min(rating / 5, 1) * FAIRNESS_WEIGHTS.ratingBonusCap;
};

export const computeFinalScore = (scores: number[], rating?: number) => {
  const meanScore = mean(scores);
  const rawVariance = variance(scores);
  const minUserScore = scores.length > 0 ? Math.min(...scores) : 0;
  const floorPenalty = lowFloorPenalty(minUserScore);
  const finalScore =
    meanScore -
    FAIRNESS_WEIGHTS.variancePenalty * rawVariance -
    FAIRNESS_WEIGHTS.lowFloorPenalty * floorPenalty +
    ratingBonus(rating);

  return {
    finalScore,
    meanScore,
    variance: rawVariance,
    fairnessScore: normalizeFairness(rawVariance),
    minUserScore
  };
};

