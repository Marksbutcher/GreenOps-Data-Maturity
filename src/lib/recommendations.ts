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

  if (maturity <= 1) {
    return `Establishing basic data here closes a critical blind spot. Without it, decisions in ${domainName.toLowerCase()} are uninformed and waste is hidden.`;
  }
  if (maturity === 2) {
    return `Moving from ad-hoc to structured data removes reliance on estimates and makes evidence-based prioritisation possible.`;
  }
  if (maturity === 3) {
    return `Advancing to decision-grade means the data can support investment cases, governance reviews, and supplier challenges — not just periodic reporting.`;
  }
  return `At this level, the value comes from embedding data into operational processes — automation, continuous improvement, and active management rather than collecting more data.`;
}

/* ─── Generate reason linked to dimension weaknesses ─── */
function generateReason(
  triggerGuidance: string | undefined,
  maturity: number,
  weakDims: string[],
  impactScore: number
): string {
  const gapContext = impactScore >= 4 && maturity <= 2
    ? ' High-impact domain at low maturity — a priority gap.'
    : '';

  if (triggerGuidance) {
    if (weakDims.length > 0) {
      return `${triggerGuidance} Weakest dimensions: ${weakDims.join(', ')}.${gapContext}`;
    }
    return `${triggerGuidance}${gapContext}`;
  }
  if (weakDims.length > 0) {
    return `Level ${maturity}. Weakest dimensions: ${weakDims.join(', ')} — start here.${gapContext}`;
  }
  return `Level ${maturity}. Broad improvement needed across dimensions to move from directional to decision-grade.${gapContext}`;
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
        reason: generateReason(trigger?.guidance, maturity, weakDims, result.impact_score),
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

  // Opening — clear, direct
  let summary = `This assessment covers ${domainCount} data domains across the technology estate. Overall weighted maturity is ${weightedMaturity} out of 5, with domains ranging from level ${minMaturity} to level ${maxMaturity}. `;
  summary += `The scores reflect data quality — what you can measure and evidence — not sustainability ambition.`;

  // What that score means in practice
  if (weightedMaturity < 2.5) {
    summary += `\n\nAt this level, the data foundation is immature. Most inputs are partial, inconsistent, or absent. The estate is running on estimates rather than measured evidence. This limits you to basic compliance reporting and means efficiency gains, cost savings, and carbon reductions are being missed. External disclosure based on current data should be caveated.`;
  } else if (weightedMaturity < 3.5) {
    summary += `\n\nA basic data foundation exists in several areas, but significant gaps remain. Data works for periodic reporting and directional analysis, but is not consistently decision-grade. The priority is closing the weakest gaps — because they represent hidden risk, unquantified waste, and missed cost and carbon reduction.`;
  } else if (weightedMaturity < 4.5) {
    summary += `\n\nMost domains are at or near decision-grade quality. The focus should shift from establishing data to using it — embedding GreenOps metrics into governance, investment decisions, procurement, and continuous improvement. The risk now is that good data exists but is not systematically acted on.`;
  } else {
    summary += `\n\nThe data capability is mature and comprehensive. Focus on sustaining quality, extending automation, and ensuring governance keeps pace with estate changes and regulatory expectations.`;
  }

  // Domain counts
  if (belowThree > 0) {
    summary += `\n\n${belowThree} of ${domainCount} domains are below level 3 — data in those areas is not reliable enough for confident decisions.`;
    if (belowTwo > 0) {
      summary += ` Of these, ${belowTwo} ${belowTwo === 1 ? 'is' : 'are'} at level 1, meaning near-complete absence of usable data.`;
    }
  }
  if (atFourPlus > 0) {
    summary += ` ${atFourPlus} domain${atFourPlus > 1 ? 's are' : ' is'} at level 4 or above, providing decision-grade or optimisation-grade evidence.`;
  }

  summary += `\n\nStrongest areas: ${strongNames.join('; ')}.`;
  summary += `\n\nWeakest areas: ${weakNames.join('; ')}.`;

  // Priority gaps
  const highImpactWeak = results
    .filter((r) => r.effective_maturity <= 2 && r.impact_score >= 4)
    .map((r) => model.domains.find((d) => d.id === r.domain_id)?.name || r.domain_id);

  if (highImpactWeak.length > 0) {
    summary += `\n\nCritical priority: ${highImpactWeak.join(', ')} ${highImpactWeak.length === 1 ? 'is' : 'are'} high-impact but low-maturity — the biggest gap between importance and evidence quality. These need named ownership and clear timelines.`;
  }

  // Spread
  const spread = maxMaturity - minMaturity;
  if (spread >= 3) {
    summary += `\n\nThe ${spread}-level spread between strongest and weakest domains matters. Uneven maturity limits joined-up decisions — strong data in one area is less useful if related areas are weak. Closing the weakest gaps improves the usability of data across the whole estate.`;
  }

  // Caveats
  const flagged = results.filter((r) => r.weakness_flags.length > 0);
  if (flagged.length > 0) {
    summary += `\n\n${flagged.length} domain${flagged.length > 1 ? 's have' : ' has'} scoring caveats — typically where many level-1 answers or weak assurance limits confidence in the score. Review these in the domain detail.`;
  }

  const overrides = results.filter((r) => r.assessor_override !== null);
  if (overrides.length > 0) {
    summary += ` ${overrides.length} domain${overrides.length > 1 ? 's have' : ' has'} assessor overrides; both calculated and overridden scores are shown.`;
  }

  return summary;
}
