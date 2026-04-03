import { DomainAssessment, MaturityModel, DecisionAreaReadiness, DecisionReadinessLevel } from '../types';

function maturityToReadiness(score: number): DecisionReadinessLevel {
  if (score <= 1) return 'reporting_only';
  if (score <= 2) return 'directional';
  if (score <= 3) return 'directional';
  if (score <= 4) return 'decision_grade';
  return 'optimisation_grade';
}

function readinessLabel(level: DecisionReadinessLevel): string {
  const labels: Record<DecisionReadinessLevel, string> = {
    reporting_only: 'Reporting only',
    directional: 'Directional',
    decision_grade: 'Decision-grade',
    optimisation_grade: 'Optimisation-grade',
  };
  return labels[level];
}

export function generateDecisionReadiness(
  results: DomainAssessment[],
  model: MaturityModel
): DecisionAreaReadiness[] {
  return model.decision_readiness_categories.map((area) => {
    // Find domains that list this area (or a close match) in their decision_areas
    const relevantDomains = model.domains.filter((d) =>
      d.decision_areas.some(
        (da) =>
          da.toLowerCase().includes(area.toLowerCase().split(' ')[0]) ||
          area.toLowerCase().includes(da.toLowerCase().split(' ')[0])
      )
    );

    const domainScores = relevantDomains.map((d) => {
      const result = results.find((r) => r.domain_id === d.id);
      return { domain: d, score: result?.effective_maturity || 1 };
    });

    const minScore =
      domainScores.length > 0 ? Math.min(...domainScores.map((ds) => ds.score)) : 1;
    const avgScore =
      domainScores.length > 0
        ? domainScores.reduce((a, ds) => a + ds.score, 0) / domainScores.length
        : 1;

    // Use minimum as the readiness determinant (weakest link)
    const readiness = maturityToReadiness(minScore);

    const supporting = domainScores
      .filter((ds) => ds.score >= 3)
      .map((ds) => ds.domain.name);
    const limiting = domainScores
      .filter((ds) => ds.score <= 2)
      .map((ds) => ds.domain.name);

    const summaryParts: string[] = [];
    if (limiting.length > 0) {
      summaryParts.push(`Limited by weak maturity in: ${limiting.join(', ')}`);
    }
    if (supporting.length > 0) {
      summaryParts.push(`Supported by: ${supporting.join(', ')}`);
    }
    if (domainScores.length === 0) {
      summaryParts.push('No directly mapped domains');
    }

    return {
      area,
      readiness,
      label: readinessLabel(readiness),
      supporting_domains: supporting,
      limiting_domains: limiting,
      summary: (summaryParts.join('. ') || 'No data available') + '.',
    };
  });
}
