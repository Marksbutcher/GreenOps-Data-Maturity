import { DomainAssessment, MaturityModel, Recommendation } from '../types';

export function generateRecommendations(
  results: DomainAssessment[],
  model: MaturityModel
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const result of results) {
    const domain = model.domains.find((d) => d.id === result.domain_id);
    if (!domain) continue;

    const maturity = result.effective_maturity;

    // Get triggered recommendation guidance
    const triggeredGuidance: { priority: string; guidance: string }[] = [];
    for (const trigger of domain.recommendation_triggers) {
      if (
        trigger.if_maturity_lte !== undefined &&
        maturity <= trigger.if_maturity_lte
      ) {
        triggeredGuidance.push(trigger);
      } else if (
        trigger.if_maturity_equals !== undefined &&
        maturity === trigger.if_maturity_equals
      ) {
        triggeredGuidance.push(trigger);
      } else if (
        trigger.if_maturity_gte !== undefined &&
        maturity >= trigger.if_maturity_gte
      ) {
        triggeredGuidance.push(trigger);
      }
    }

    // Select themes based on maturity
    const themes = domain.recommendation_themes;
    const selectedThemes =
      maturity <= 2 ? themes.slice(0, 3) : maturity <= 3 ? themes.slice(0, 2) : themes.slice(-2);

    for (const theme of selectedThemes) {
      const trigger = triggeredGuidance[0];
      const priority =
        trigger?.priority === 'high'
          ? 'High'
          : trigger?.priority === 'medium'
            ? 'Medium'
            : 'Low';
      const phase = maturity <= 2 ? 'Foundation' : maturity <= 3 ? 'Quick win' : 'Transformation';

      recommendations.push({
        domain_id: domain.id,
        domain_name: domain.name,
        action: theme,
        reason:
          trigger?.guidance ||
          `Current maturity is level ${maturity}`,
        benefit: `Improve ${domain.name.toLowerCase()} to support stronger decision-making`,
        priority: priority as 'High' | 'Medium' | 'Low',
        phase: phase as 'Quick win' | 'Foundation' | 'Transformation',
      });
    }
  }

  return recommendations.sort((a, b) => {
    const pOrder = { High: 0, Medium: 1, Low: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });
}

export function generateExecutiveSummary(
  results: DomainAssessment[],
  model: MaturityModel
): string {
  // Calculate overall statistics
  const domainCount = results.length;
  const effectiveMaturities = results.map((r) => r.effective_maturity);
  const minMaturity = Math.min(...effectiveMaturities);
  const maxMaturity = Math.max(...effectiveMaturities);
  const avgMaturity = effectiveMaturities.reduce((a, b) => a + b, 0) / domainCount;
  const weightedMaturity = Math.round(avgMaturity * 10) / 10;

  const sorted = [...results].sort((a, b) => a.effective_maturity - b.effective_maturity);
  const weakest = sorted.slice(0, 3);
  const strongest = sorted.slice(-3).reverse();

  const weakNames = weakest.map((r) => {
    const d = model.domains.find((dd) => dd.id === r.domain_id);
    return `${d?.name || r.domain_id} (level ${r.effective_maturity})`;
  });
  const strongNames = strongest.map((r) => {
    const d = model.domains.find((dd) => dd.id === r.domain_id);
    return `${d?.name || r.domain_id} (level ${r.effective_maturity})`;
  });

  const belowThree = results.filter((r) => r.effective_maturity < 3).length;

  let summary = `The assessment covers ${domainCount} GreenOps data input domains. `;
  summary += `The overall weighted maturity is ${weightedMaturity} out of 5, `;
  summary += `ranging from ${minMaturity} to ${maxMaturity}. `;

  if (belowThree > 0) {
    summary += `${belowThree} domain${belowThree > 1 ? 's are' : ' is'} below level 3, limiting decision-grade use in those areas. `;
  }

  summary += `\n\nStrongest areas: ${strongNames.join('; ')}. `;
  summary += `\n\nWeakest areas: ${weakNames.join('; ')}. `;

  // Add override warnings
  const overrides = results.filter((r) => r.assessor_override !== null);
  if (overrides.length > 0) {
    summary += `\n\nNote: ${overrides.length} domain${overrides.length > 1 ? 's have' : ' has'} assessor overrides applied. Calculated and overridden scores are both preserved.`;
  }

  // Add weakness flags
  const flagged = results.filter((r) => r.weakness_flags.length > 0);
  if (flagged.length > 0) {
    summary += `\n\n${flagged.length} domain${flagged.length > 1 ? 's have' : ' has'} scoring caveats applied (e.g. maturity caps due to answer patterns).`;
  }

  return summary;
}
