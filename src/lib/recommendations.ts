import { Domain, DomainAssessment, Recommendation, MaturityModel } from '../types';

/**
 * Generate domain-specific, maturity-aware, decision-aware recommendations.
 */
export function generateRecommendations(
  results: DomainAssessment[],
  model: MaturityModel
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const result of results) {
    const domain = model.domains.find((d) => d.id === result.domain_id);
    if (!domain) continue;

    const score = result.maturity_score;
    const impact = result.impact_score;
    const gap = (result.target_maturity || 4) - score;

    // Select recommendation themes based on current maturity
    const themes = domain.recommendation_themes;
    let selectedThemes: string[];
    let phase: Recommendation['phase'];

    if (score <= 2) {
      selectedThemes = themes.low;
      phase = gap >= 2 ? 'Foundation' : 'Quick win';
    } else if (score <= 3) {
      selectedThemes = themes.mid;
      phase = gap >= 2 ? 'Foundation' : 'Quick win';
    } else {
      selectedThemes = themes.high;
      phase = 'Transformation';
    }

    // Determine priority from impact and gap
    let priority: Recommendation['priority'];
    if (impact >= 4 && score <= 2) priority = 'High';
    else if (impact >= 4 && score <= 3) priority = 'Medium';
    else if (gap >= 3) priority = 'High';
    else if (gap >= 2) priority = 'Medium';
    else priority = 'Low';

    // Get decision context
    const levelKey = String(Math.min(Math.max(score, 1), 5));
    const decisionSupport = domain.decision_support_by_level[levelKey];
    const unsupported = decisionSupport?.does_not_support || [];

    for (const theme of selectedThemes) {
      const benefit =
        unsupported.length > 0
          ? `Would help unlock: ${unsupported.slice(0, 2).join('; ')}`
          : `Strengthens ${domain.decision_areas.slice(0, 2).join(' and ')} capabilities`;

      const reason =
        score <= 2
          ? `Current maturity (Level ${score}) limits the organisation's ability to use ${domain.name.toLowerCase()} for confident decision-making.`
          : score <= 3
          ? `While ${domain.name.toLowerCase()} is standardised, further improvement would unlock stronger operational decisions.`
          : `Extending ${domain.name.toLowerCase()} maturity would support continuous optimisation and governance.`;

      recommendations.push({
        domain_id: domain.id,
        domain_name: domain.name,
        action: theme,
        reason,
        benefit,
        priority,
        phase,
      });
    }
  }

  // Sort by priority: High > Medium > Low, then by phase
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  const phaseOrder = { 'Quick win': 0, Foundation: 1, Transformation: 2 };
  recommendations.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return phaseOrder[a.phase] - phaseOrder[b.phase];
  });

  return recommendations;
}

/**
 * Generate executive summary narrative from assessment results.
 */
export function generateExecutiveSummary(
  results: DomainAssessment[],
  model: MaturityModel
): {
  overallSummary: string;
  strongestDomains: string[];
  weakestDomains: string[];
  topGaps: string[];
  keyRisks: string[];
  headlineRecommendations: string[];
} {
  const sorted = [...results].sort(
    (a, b) => a.maturity_score - b.maturity_score
  );
  const domainMap = new Map(model.domains.map((d) => [d.id, d]));

  const weakest = sorted.slice(0, 3).map((r) => ({
    result: r,
    domain: domainMap.get(r.domain_id)!,
  }));
  const strongest = sorted
    .slice(-3)
    .reverse()
    .map((r) => ({
      result: r,
      domain: domainMap.get(r.domain_id)!,
    }));

  const avgScore =
    results.reduce((a, r) => a + r.maturity_score, 0) / results.length;

  const highImpactLowMaturity = results
    .filter((r) => r.impact_score >= 4 && r.maturity_score <= 2)
    .map((r) => domainMap.get(r.domain_id)!);

  let overallSummary: string;
  if (avgScore <= 2) {
    overallSummary =
      'The organisation is at an early stage of GreenOps data maturity. Most data inputs are fragmented, proxy-heavy or inconsistently maintained. This significantly limits the range of GreenOps decisions that can be made with confidence. Priority action should focus on establishing foundational data quality across the highest-impact domains.';
  } else if (avgScore <= 3) {
    overallSummary =
      'The organisation has established repeatable practices in some areas but maturity remains uneven. Several high-impact domains lack the data quality needed for confident decision-making. The priority is to close critical gaps in the weakest high-impact areas while strengthening standardisation where it already exists.';
  } else if (avgScore <= 4) {
    overallSummary =
      'The organisation has strong foundations across most domains, with standardised and increasingly measured data inputs. The focus should now shift to embedding GreenOps data into operational decision-making, improving attribution, and closing remaining gaps in areas such as usage visibility and provider transparency.';
  } else {
    overallSummary =
      'The organisation demonstrates advanced GreenOps data maturity with strong measurement, governance and decision integration. The priority is continuous improvement, closing remaining edge-case gaps, and using data to drive optimisation at the service and workload level.';
  }

  const topGaps = highImpactLowMaturity.map(
    (d) =>
      `${d.name} (impact ${model.default_impact_scores[d.id]}, maturity ${results.find((r) => r.domain_id === d.id)!.maturity_score})`
  );

  const keyRisks = highImpactLowMaturity.slice(0, 3).map((d) => {
    const r = results.find((r) => r.domain_id === d.id)!;
    const levelDesc = d.maturity_levels[String(r.maturity_score)];
    return `Weak ${d.name.toLowerCase()} means: ${levelDesc}`;
  });

  const headlineRecommendations = weakest
    .filter((w) => w.result.impact_score >= 4)
    .slice(0, 4)
    .map((w) => {
      const themes =
        w.result.maturity_score <= 2
          ? w.domain.recommendation_themes.low
          : w.domain.recommendation_themes.mid;
      return `${w.domain.name}: ${themes[0]}`;
    });

  return {
    overallSummary,
    strongestDomains: strongest.map(
      (s) => `${s.domain.name} (Level ${s.result.maturity_score})`
    ),
    weakestDomains: weakest.map(
      (w) => `${w.domain.name} (Level ${w.result.maturity_score})`
    ),
    topGaps,
    keyRisks,
    headlineRecommendations,
  };
}
