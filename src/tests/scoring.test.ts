import { describe, it, expect } from "vitest";
import { computeScore } from "../core/scoring.js";

describe("scoring", () => {
  it("is 100 for a perfect, fully-covered vault", () => {
    const s = computeScore({
      errors: 0,
      warnings: 0,
      layersCovered: 8,
      layersTotal: 8,
    });
    expect(s.score).toBe(100);
  });

  it("blends quality and coverage with the documented weights", () => {
    // quality=100, coverage=0 -> 0.6*100 + 0.4*0 = 60
    const s = computeScore({
      errors: 0,
      warnings: 0,
      layersCovered: 0,
      layersTotal: 8,
    });
    expect(s.score).toBe(60);
  });

  it("penalises errors more than warnings", () => {
    const oneError = computeScore({ errors: 1, warnings: 0, layersCovered: 8, layersTotal: 8 });
    const oneWarning = computeScore({ errors: 0, warnings: 1, layersCovered: 8, layersTotal: 8 });
    expect(oneError.score).toBeLessThan(oneWarning.score);
  });

  it("is monotonic: more errors never raises the score", () => {
    let prev = 101;
    for (let e = 0; e <= 20; e++) {
      const s = computeScore({ errors: e, warnings: 0, layersCovered: 4, layersTotal: 8 });
      expect(s.score).toBeLessThanOrEqual(prev);
      prev = s.score;
    }
  });

  it("clamps to [0,100]", () => {
    const s = computeScore({ errors: 100, warnings: 100, layersCovered: 0, layersTotal: 8 });
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
  });
});
