import { Domain, DomainAssessment, MaturityModel } from '../types';

/**
 * Infer a maturity score from question answers.
 * Uses the median of mapped levels, rounded down.
 */
export function inferMaturityFromAnswers(
  domain: Domain,
  answers: Record<string, number>
): number {
  const levels: number[] = [];
  for (const q of domain.questions) {
    const idx = answers[q.id];
    if (idx !== undefined && idx >= 0 && idx < q.maps_to_levels.length) {
      levels.push(q.maps_to_levels[idx]);
    }
  }
  if (levels.length === 0) return 1;
  levels.sort((a, b) => a - b);
  const mid = Math.floor(levels.length / 2);
  return levels.length % 2 === 0
    ? Math.floor((levels[mid - 1] + levels[mid]) / 2)
    : levels[mid];
}

/**
 * Determine decision support status from maturity score.
 */
export function getDecisionSupportStatus(maturityScore: number): string {
  if (maturityScore <= 1) return 'reporting_only';
  if (maturityScore <= 2) return 'directional';
  if (maturityScore <= 3) return 'decision_grade';
  if (maturityScore <= 4) return 'decision_grade';
  return 'optimisation_grade';
}

/**
 * Get decision support label from status id.
 */
export function getDecisionSupportLabel(
  model: MaturityModel,
  statusId: string
): string {
  const status = model.decision_support_statuses.find((s) => s.id === statusId);
  return status ? status.label : statusId;
}

/**
 * Get supported and unsupported decisions for a domain at a given maturity level.
 */
export function getDecisionSupport(
  domain: Domain,
  maturityScore: number
): { supports: string[]; does_not_support: string[] } {
  const level = String(Math.min(Math.max(maturityScore, 1), 5));
  const entry = domain.decision_support_by_level[level];
  if (!entry) return { supports: [], does_not_support: [] };
  return entry;
}

/**
 * Get recommendations for a domain based on maturity score.
 */
export function getRecommendations(
  domain: Domain,
  maturityScore: number
): string[] {
  const themes = domain.recommendation_themes;
  if (maturityScore <= 2) return [...themes.low, ...themes.mid.slice(0, 1)];
  if (maturityScore <= 3) return [...themes.mid, ...themes.high.slice(0, 1)];
  return themes.high;
}

/**
 * Calculate overall maturity statistics.
 */
export function calculateOverallStats(results: DomainAssessment[]) {
  const scores = results.map((r) => r.maturity_score);
  const impacts = results.map((r) => r.impact_score);
  const avgMaturity = scores.reduce((a, b) => a + b, 0) / scores.length;
  const avgImpact = impacts.reduce((a, b) => a + b, 0) / impacts.length;
  const minMaturity = Math.min(...scores);
  const maxMaturity = Math.max(...scores);

  // Weighted average: maturity weighted by impact
  const weightedSum = results.reduce(
    (acc, r) => acc + r.maturity_score * r.impact_score,
    0
  );
  const weightTotal = results.reduce((acc, r) => acc + r.impact_score, 0);
  const weightedMaturity = weightTotal > 0 ? weightedSum / weightTotal : 0;

  return {
    avgMaturity: Math.round(avgMaturity * 10) / 10,
    avgImpact: Math.round(avgImpact * 10) / 10,
    weightedMaturity: Math.round(weightedMaturity * 10) / 10,
    minMaturity,
    maxMaturity,
    domainCount: results.length,
  };
}

/**
 * Create a blank domain assessment from a domain definition.
 */
export function createBlankAssessment(domain: Domain): DomainAssessment {
  return {
    domain_id: domain.id,
    maturity_score: 1,
    impact_score: domain.default_impact_score,
    confidence_score: 3,
    target_maturity: Math.min(domain.default_impact_score, 5),
    priority: '',
    rationale: '',
    evidence: '',
    question_answers: {},
    decision_support_status: 'reporting_only',
    supported_decisions: [],
    unsupported_decisions: [],
  };
}

/**
 * Suggest priority based on maturity and impact gap.
 */
export function suggestPriority(
  maturity: number,
  impact: number
): 'High' | 'Medium' | 'Low' {
  const gap = impact - maturity;
  if (gap >= 3 || (impact >= 4 && maturity <= 2)) return 'High';
  if (gap >= 2 || (impact >= 4 && maturity <= 3)) return 'Medium';
  return 'Low';
}

/**
 * Get quadrant label for priority matrix.
 */
export function getQuadrant(
  maturity: number,
  impact: number
): string {
  const lowMat = maturity <= 2.5;
  const highImp = impact >= 3.5;
  if (lowMat && highImp) return 'Transform now';
  if (!lowMat && highImp) return 'Exploit and extend';
  if (lowMat && !highImp) return 'Stabilise';
  return 'Maintain';
}
