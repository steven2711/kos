/**
 * Deterministic knowledge score (0-100).
 *
 * Two components, then a fixed blend:
 *   quality  = 100 - 6*errors - 1.5*warnings   (floored at 0)
 *   coverage = fraction of the 8 knowledge layers with a real document
 *   score    = round(0.6*quality + 0.4*coverage*100)
 *
 * The formula is intentionally simple and monotonic so the same vault always
 * yields the same number and fixing issues never lowers the score.
 */
const ERROR_PENALTY = 6;
const WARNING_PENALTY = 1.5;
const QUALITY_WEIGHT = 0.6;
const COVERAGE_WEIGHT = 0.4;

export interface ScoreInput {
  errors: number;
  warnings: number;
  layersCovered: number;
  layersTotal: number;
}

export interface ScoreBreakdown {
  score: number;
  quality: number;
  coverage: number;
  errors: number;
  warnings: number;
  layersCovered: number;
  layersTotal: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeScore(input: ScoreInput): ScoreBreakdown {
  const { errors, warnings, layersCovered, layersTotal } = input;
  const quality = clamp(
    100 - ERROR_PENALTY * errors - WARNING_PENALTY * warnings,
    0,
    100,
  );
  const coverage = layersTotal > 0 ? layersCovered / layersTotal : 0;
  const score = Math.round(
    QUALITY_WEIGHT * quality + COVERAGE_WEIGHT * coverage * 100,
  );
  return {
    score: clamp(score, 0, 100),
    quality: Math.round(quality),
    coverage: Math.round(coverage * 100),
    errors,
    warnings,
    layersCovered,
    layersTotal,
  };
}
