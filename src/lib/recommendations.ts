import { DomainAssessment, MaturityModel, Recommendation } from '../types';

/* ─── Phase classification considers maturity AND domain strategic weight ─── */
function classifyPhase(
  maturity: number,
  impactScore: number,
  weakDimCount: number
): 'Quick win' | 'Foundation' | 'Transformation' {
  // Foundation: low maturity with structural gaps
  if (maturity <= 2 && weakDimCount >= 2) return 'Foundation';
  if (maturity <= 2) return 'Foundation';
  // Quick win: mid-maturity, targeted improvements
  if (maturity === 3 && impactScore >= 3) return 'Quick win';
  if (maturity === 3) return 'Quick win';
  // Transformation: mature domains, strategic refinement
  return 'Transformation';
}

/* ─── Generate actionable benefit connected to decisions ─── */
function generateBenefit(
  domainName: string,
  maturity: number,
  domain: { decision_support_by_score: Record<string, { supports: string[]; does_not_support: string[] }> }
): string {
  const nextLevel = Math.min(maturity + 1, 5);
  const currentDs = domain.decision_support_by_score[String(maturity)];
  const nextDs = domain.decision_support_by_score[String(nextLevel)];

  if (currentDs && nextDs) {
    const newCapabilities = nextDs.supports.filter(
      (s) => !currentDs.supports.includes(s)
    );
    if (newCapabilities.length > 0) {
      return `Reaching level ${nextLevel} would unlock: ${newCapabilities.slice(0, 2).join('; ')}.`;
    }
  }

  if (maturity <= 2) {
    return `Closing the gap in ${domainName.toLowerCase()} removes a significant blind spot and enables evidence-based decisions in this area.`;
  }
  if (maturity === 3) {
    return `Moving from directional to decision-grade quality enables confident investment and governance decisions.`;
  }
  return `Further improvement supports operational optimisation and continuous improvement capability.`;
}

/* ─── Generate reason linked to dimension weaknesses ─── */
function generateReason(
  triggerGuidance: string | undefined,
  maturity: number,
  weakDims: string[]
): string {
  if (triggerGuidance) {
    if (weakDims.length > 0) {
      return `${triggerGuidance} Key dimension weaknesses: ${weakDims.join(', ')}.`;
    }
    return triggerGuidance;
  }
  if (weakDims.length > 0) {
    return `Current maturity is level ${maturity}. Weakest dimensions are ${weakDims.join(', ')}, which should be the initial focus.`;
  }
  return `Current maturity is level ${maturity}. Broad improvement needed across multiple dimensions.`;
}

export function generateRecommendations(
  results: DomainAssessment[],
  model: MaturityModel
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const result of results) {
    const domain = model.domains.find((d) => d.id === result.domain_id);
    if (!domain) continue;

    const maturity = result.effective_maturity;
    const dimEntries = Object.entries(result.dimension_scores);
    const weakDims = dimEntries
      .filter(([, s]) => s <= 2.5)
      .map(([d]) => d.replace(/_/g, ' '));

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

    // Select themes based on maturity — more themes at lower maturity
    const themes = domain.recommendation_themes;
    const selectedThemes =
      maturity <= 2 ? themes.slice(0, 3) : maturity <= 3 ? themes.slice(0, 2) : themes.slice(-2);

    const phase = classifyPhase(maturity, result.impact_score, weakDims.length);

    for (let i = 0; i < selectedThemes.length; i++) {
      const theme = selectedThemes[i];
      const trigger = triggeredGuidance[i] || triggeredGuidance[0];

      // Derive priority from gap analysis, not just trigger metadata
      let priority: 'High' | 'Medium' | 'Low';
      const gap = result.impact_score - maturity;
      if (gap >= 3 || (result.impact_score >= 4 && maturity <= 2)) {
        priority = 'High';
      } else if (gap >= 1.5 || (result.impact_score >= 3 && maturity <= 3)) {
        priority = 'Medium';
      } else {
        priority = 'Low';
      }

      recommendations.push({
        domain_id: domain.id,
        domain_name: domain.name,
        action: theme,
        reason: generateReason(trigger?.guidance, maturity, weakDims),
        benefit: generateBenefit(domain.name, maturity, domain),
        priority,
        phase,
      });
    }
  }

  return recommendations.sort((a, b) => {
    const pOrder = { High: 0, Medium: 1, Low: 2 };
    const phOrder = { Foundation: 0, 'Quick win': 1, Transformation: 2 };
    const pDiff = pOrder[a.priority] - pOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return phOrder[a.phase] - phOrder[b.phase];
  });
}

export function generateExecutiveSummary(
  results: DomainAssessment[],
  model: MaturityModel
): string {
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
  const belowTwo = results.filter((r) => r.effective_maturity < 2).length;
  const atFourPlus = results.filter((r) => r.effective_maturity >= 4).length;

  // Opening assessment
  let summary = `This assessment covers ${domainCount} GreenOps data input domains across the technology estate. `;
  summary += `The overall weighted maturity is ${weightedMaturity} out of 5, with individual domains ranging from ${minMaturity} to ${maxMaturity}.`;

  // Maturity distribution interpretation
  if (weightedMaturity < 2.5) {
    summary += `\n\nAt this level, the organisation's GreenOps data foundation is immature. Most data inputs are partial, inconsistent, or absent. The estate is largely operating on estimates and assumptions rather than measured evidence. This limits the organisation to basic compliance reporting and prevents evidence-based operational decisions.`;
  } else if (weightedMaturity < 3.5) {
    summary += `\n\nThe organisation has established a basic data foundation in several areas but significant gaps remain. Data is adequate for periodic reporting and directional analysis, but not consistently decision-grade. The priority should be closing the weakest domain gaps to unlock operational value from the data that does exist.`;
  } else if (weightedMaturity < 4.5) {
    summary += `\n\nThe organisation has a solid data foundation with most domains at decision-grade quality. The focus should shift from establishing data to using it — embedding GreenOps metrics into operational governance, investment decisions, and continuous improvement processes.`;
  } else {
    summary += `\n\nThe organisation has a mature and comprehensive GreenOps data capability. The focus should be on sustaining quality, extending automation, and demonstrating value through operational outcomes.`;
  }

  // Domain breakdown
  if (belowThree > 0) {
    summary += `\n\n${belowThree} of ${domainCount} domains are below level 3, meaning data in those areas is not yet reliable enough to support confident operational decisions.`;
    if (belowTwo > 0) {
      summary += ` Of these, ${belowTwo} ${belowTwo === 1 ? 'is' : 'are'} at level 1, indicating near-complete absence of usable data.`;
    }
  }

  summary += `\n\nStrongest areas: ${strongNames.join('; ')}.`;
  summary += `\n\nWeakest areas requiring priority attention: ${weakNames.join('; ')}.`;

  // Strategic interpretation
  const highImpactWeak = results
    .filter((r) => r.effective_maturity <= 2 && r.impact_score >= 4)
    .map((r) => model.domains.find((d) => d.id === r.domain_id)?.name || r.domain_id);

  if (highImpactWeak.length > 0) {
    summary += `\n\nCritical priority: ${highImpactWeak.join(', ')} ${highImpactWeak.length === 1 ? 'is' : 'are'} both high-impact and low-maturity. These represent the largest gap between the importance of the domain and the quality of the data. Improvement here will deliver the most operational value per unit of effort.`;
  }

  // Flagged domains
  const flagged = results.filter((r) => r.weakness_flags.length > 0);
  if (flagged.length > 0) {
    summary += `\n\n${flagged.length} domain${flagged.length > 1 ? 's have' : ' has'} scoring caveats applied — typically where a high proportion of level-1 answers or weak assurance/lineage limits confidence in the calculated maturity.`;
  }

  // Overrides
  const overrides = results.filter((r) => r.assessor_override !== null);
  if (overrides.length > 0) {
    summary += ` ${overrides.length} domain${overrides.length > 1 ? 's have' : ' has'} assessor overrides applied; both calculated and overridden scores are preserved.`;
  }

  return summary;
}
