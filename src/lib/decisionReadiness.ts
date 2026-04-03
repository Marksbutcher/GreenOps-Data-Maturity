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

/* ─── Build a meaningful summary rather than just listing domain names ─── */
function buildReadinessSummary(
  area: string,
  readiness: DecisionReadinessLevel,
  domainScores: { domain: { id: string; name: string }; score: number }[],
  minScore: number,
  avgScore: number
): string {
  if (domainScores.length === 0) {
    return 'No directly mapped domains for this decision area. Assessment coverage may need to be extended.';
  }

  const limiting = domainScores
    .filter((ds) => ds.score <= 2)
    .sort((a, b) => a.score - b.score);
  const supporting = domainScores
    .filter((ds) => ds.score >= 3)
    .sort((a, b) => b.score - a.score);

  const parts: string[] = [];

  // Readiness interpretation
  switch (readiness) {
    case 'reporting_only':
      parts.push(
        `Data quality is insufficient for this decision area. Current inputs can support basic disclosure or narrative reporting, but not evidence-based decisions.`
      );
      break;
    case 'directional':
      parts.push(
        `Data supports directional analysis — sufficient to identify broad trends and prioritise investigation, but not precise enough for confident investment or governance decisions.`
      );
      break;
    case 'decision_grade':
      parts.push(
        `Data is at decision-grade quality. You can make confident operational and investment decisions in this area, supported by measured and attributed evidence.`
      );
      break;
    case 'optimisation_grade':
      parts.push(
        `Data supports continuous optimisation. You have the granularity, timeliness, and attribution needed for dynamic management and automated decision-making.`
      );
      break;
  }

  // Limiting factor diagnosis
  if (limiting.length > 0) {
    const weakestDomain = limiting[0];
    parts.push(
      `Constrained by ${weakestDomain.domain.name.toLowerCase()} (level ${weakestDomain.score}), which is the weakest input.`
    );

    // Remediation hint: what happens if the weakest link is fixed
    if (limiting.length === 1 && supporting.length > 0) {
      const nextMin = domainScores
        .filter((ds) => ds.domain.id !== weakestDomain.domain.id)
        .reduce((min, ds) => Math.min(min, ds.score), 5);
      if (nextMin >= 3) {
        parts.push(
          `If ${weakestDomain.domain.name.toLowerCase()} improves to level 3, this decision area reaches decision-grade readiness.`
        );
      }
    } else if (limiting.length > 1) {
      parts.push(
        `${limiting.length} domains need improvement: ${limiting.map((l) => `${l.domain.name} (${l.score})`).join(', ')}.`
      );
    }
  }

  // Supporting strength
  if (supporting.length > 0 && limiting.length > 0) {
    parts.push(
      `Supported by ${supporting.map((s) => s.domain.name.toLowerCase()).join(', ')}, which ${supporting.length === 1 ? 'is' : 'are'} at a usable level.`
    );
  }

  return parts.join(' ');
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

    const summary = buildReadinessSummary(area, readiness, domainScores, minScore, avgScore);

    return {
      area,
      readiness,
      label: readinessLabel(readiness),
      supporting_domains: supporting,
      limiting_domains: limiting,
      summary,
    };
  });
}
