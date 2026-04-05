import { Domain, DomainAssessment, MaturityModel } from '../types';

/**
 * Calculate weighted average maturity from question answers.
 * Uses the v2 model: weighted average of selected option scores,
 * rounded to nearest band with .75 upward threshold.
 */
export function calculateWeightedMaturity(
  domain: Domain,
  answers: Record<string, number>
): { score: number; dimensionScores: Record<string, number>; weightedAvg: number } {
  let totalWeight = 0;
  let totalWeightedScore = 0;
  const dimensionTotals: Record<string, { weight: number; score: number }> = {};

  for (const q of domain.questions) {
    const idx = answers[q.id];
    // Skip unanswered AND "not assessed" (-1) questions — both excluded from scoring
    if (idx === undefined || idx === -1 || idx < 0 || idx >= q.options.length) continue;

    const optionScore = q.options[idx].score;
    totalWeight += q.weight;
    totalWeightedScore += q.weight * optionScore;

    if (!dimensionTotals[q.dimension]) {
      dimensionTotals[q.dimension] = { weight: 0, score: 0 };
    }
    dimensionTotals[q.dimension].weight += q.weight;
    dimensionTotals[q.dimension].score += q.weight * optionScore;
  }

  if (totalWeight === 0) return { score: 1, dimensionScores: {}, weightedAvg: 1 };

  const weightedAvg = totalWeightedScore / totalWeight;

  // Round to nearest band with .75 upward threshold
  const floor = Math.floor(weightedAvg);
  const score = (weightedAvg - floor) >= 0.75 ? Math.min(floor + 1, 5) : Math.max(floor, 1);

  const dimensionScores: Record<string, number> = {};
  for (const [dim, totals] of Object.entries(dimensionTotals)) {
    dimensionScores[dim] = Math.round((totals.score / totals.weight) * 10) / 10;
  }

  return { score, dimensionScores, weightedAvg };
}

/**
 * Apply override rules from the model to cap or flag scores.
 */
export function applyOverrideRules(
  domain: Domain,
  answers: Record<string, number>,
  calculatedScore: number
): { cappedScore: number; flags: string[] } {
  const flags: string[] = [];
  let cappedScore = calculatedScore;

  // Count level-1 answers and "not assessed" answers
  const answered = domain.questions.filter(q => answers[q.id] !== undefined);
  const notAssessedCount = answered.filter(q => answers[q.id] === -1).length;
  const scoreable = answered.filter(q => answers[q.id] !== -1);
  const level1Count = scoreable.filter(q => {
    const idx = answers[q.id];
    return idx !== undefined && q.options[idx]?.score === 1;
  }).length;

  // Rule: If >20% of answered questions are "not assessed", flag blind spots
  if (answered.length > 0 && (notAssessedCount / answered.length) > 0.2) {
    flags.push(`${notAssessedCount} question${notAssessedCount > 1 ? 's' : ''} marked as "not assessed" — the organisation has identified blind spots in this domain. Scores are derived from assessed questions only and may overstate actual capability.`);
  }

  // Rule: If >30% answers are level 1, cap at 3
  if (answered.length > 0 && (level1Count / answered.length) > 0.3) {
    if (cappedScore > 3) {
      cappedScore = 3;
      flags.push('Score capped at level 3: more than 30% of data inputs are at level 1 (ad hoc or absent). Significant gaps must be closed before this domain can reach decision-grade quality.');
    }
  }

  // Rule: Check assurance/lineage dimension
  const lineageQuestions = domain.questions.filter(q => q.dimension === 'assurance_lineage');
  const lineageScores = lineageQuestions
    .filter(q => answers[q.id] !== undefined)
    .map(q => q.options[answers[q.id]]?.score || 0);

  if (lineageScores.length > 0 && lineageScores.every(s => s <= 2)) {
    flags.push('Data lineage and assurance are weak. Without traceability back to source, calculations using this data cannot be independently verified or defended under challenge.');
  }

  return { cappedScore, flags };
}

/**
 * Derive confidence level from answer patterns.
 */
export function deriveConfidence(
  domain: Domain,
  answers: Record<string, number>
): number {
  const answered = domain.questions.filter(q => answers[q.id] !== undefined);
  const scoreable = answered.filter(q => answers[q.id] !== -1); // exclude "not assessed"
  const notAssessedCount = answered.filter(q => answers[q.id] === -1).length;
  const total = domain.questions.length;

  if (answered.length === 0) return 1;

  // Completeness penalises both unanswered AND "not assessed" — blind spots reduce confidence
  const completeness = scoreable.length / total;
  const scores = scoreable.map(q => q.options[answers[q.id]]?.score || 1);

  // Check consistency: standard deviation of scores
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, s) => a + (s - avg) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // High consistency + high completeness = high confidence
  if (completeness >= 0.875 && stdDev <= 1.0) return 4;
  if (completeness >= 0.75 && stdDev <= 1.5) return 3;
  if (completeness >= 0.5) return 2;
  return 1;
}

/**
 * Get decision support status from maturity score using domain mapping.
 */
export function getDecisionSupportStatus(domain: Domain, maturityScore: number): string {
  const mapping = domain.scoring.decision_support_mapping;
  return mapping[String(Math.min(Math.max(maturityScore, 1), 5))] || 'Reporting only';
}

/**
 * Get decision support detail from domain at a given maturity level.
 */
export function getDecisionSupport(
  domain: Domain,
  maturityScore: number
): { status: string; supports: string[]; does_not_support: string[] } {
  const level = String(Math.min(Math.max(maturityScore, 1), 5));
  const entry = domain.decision_support_by_score[level];
  if (!entry) return { status: 'Reporting only', supports: [], does_not_support: [] };
  return entry;
}

/**
 * Create a blank domain assessment from a domain definition.
 */
export function createBlankAssessment(domain: Domain): DomainAssessment {
  return {
    domain_id: domain.id,
    question_answers: {},
    calculated_maturity: 1,
    assessor_override: null,
    effective_maturity: 1,
    impact_score: domain.default_impact_score,
    confidence_score: 1,
    target_maturity: Math.min(domain.default_impact_score, 5),
    priority: '',
    rationale: '',
    evidence: '',
    decision_support_status: 'Reporting only',
    supported_decisions: [],
    unsupported_decisions: [],
    dimension_scores: {},
    weakness_flags: [],
  };
}

/**
 * Fully score a domain assessment from its answers.
 * Called after assessment completion, not during.
 */
export function scoreDomainAssessment(
  domain: Domain,
  assessment: DomainAssessment
): DomainAssessment {
  const { score, dimensionScores, weightedAvg } = calculateWeightedMaturity(domain, assessment.question_answers);
  const { cappedScore, flags } = applyOverrideRules(domain, assessment.question_answers, score);
  const confidence = deriveConfidence(domain, assessment.question_answers);
  const effectiveMaturity = assessment.assessor_override !== null ? assessment.assessor_override : cappedScore;
  const ds = getDecisionSupport(domain, effectiveMaturity);
  const priority = suggestPriority(effectiveMaturity, assessment.impact_score);

  return {
    ...assessment,
    calculated_maturity: cappedScore,
    effective_maturity: effectiveMaturity,
    confidence_score: confidence,
    dimension_scores: dimensionScores,
    weakness_flags: flags,
    decision_support_status: ds.status,
    supported_decisions: ds.supports,
    unsupported_decisions: ds.does_not_support,
    priority: assessment.priority || priority,
  };
}

/**
 * Calculate overall maturity statistics.
 */
export function calculateOverallStats(results: DomainAssessment[]) {
  const scores = results.map(r => r.effective_maturity);
  const impacts = results.map(r => r.impact_score);
  const avgMaturity = scores.reduce((a, b) => a + b, 0) / scores.length;
  const avgImpact = impacts.reduce((a, b) => a + b, 0) / impacts.length;
  const minMaturity = Math.min(...scores);
  const maxMaturity = Math.max(...scores);

  const weightedSum = results.reduce((acc, r) => acc + r.effective_maturity * r.impact_score, 0);
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
 * Suggest priority based on maturity and impact gap.
 */
export function suggestPriority(maturity: number, impact: number): 'High' | 'Medium' | 'Low' {
  const gap = impact - maturity;
  if (gap >= 3 || (impact >= 4 && maturity <= 2)) return 'High';
  if (gap >= 2 || (impact >= 4 && maturity <= 3)) return 'Medium';
  return 'Low';
}

/**
 * Get quadrant label for priority matrix.
 */
export function getQuadrant(maturity: number, impact: number): string {
  const lowMat = maturity <= 2.5;
  const highImp = impact >= 3.5;
  if (lowMat && highImp) return 'Transform now';
  if (!lowMat && highImp) return 'Exploit and extend';
  if (lowMat && !highImp) return 'Stabilise';
  return 'Maintain';
}

/**
 * Identify weakest dimensions driving a low score.
 */
export function getWeakestDimensions(dimensionScores: Record<string, number>, threshold: number = 2.5): string[] {
  return Object.entries(dimensionScores)
    .filter(([, score]) => score <= threshold)
    .sort((a, b) => a[1] - b[1])
    .map(([dim]) => dim);
}

/**
 * Get answer pattern summary for a domain.
 */
export function getAnswerPatternSummary(
  domain: Domain,
  answers: Record<string, number>
): { strongAreas: string[]; weakAreas: string[]; unanswered: number } {
  const strongAreas: string[] = [];
  const weakAreas: string[] = [];
  let unanswered = 0;

  for (const q of domain.questions) {
    const idx = answers[q.id];
    if (idx === undefined || idx === -1) {
      unanswered++;
      continue;
    }
    const score = q.options[idx]?.score || 1;
    if (score >= 4) strongAreas.push(q.dimension);
    if (score <= 2) weakAreas.push(q.dimension);
  }

  return { strongAreas: [...new Set(strongAreas)], weakAreas: [...new Set(weakAreas)], unanswered };
}
