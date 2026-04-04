import { DomainAssessment, MaturityModel, Recommendation, AssessmentIntent, INTENT_LABELS, INTENT_MINIMUM_LEVEL, MATURITY_LABELS_SHORT, confidenceLabel, CONFIDENCE_DESCRIPTIONS } from '../types';
import { getTopLimitingFactors } from './dependencyChain';

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
  model: MaturityModel,
  intent?: AssessmentIntent
): string {
  const domainCount = results.length;
  const effectiveMaturities = results.map((r) => r.effective_maturity);
  const minMaturity = Math.min(...effectiveMaturities);
  const maxMaturity = Math.max(...effectiveMaturities);
  const avgMaturity = effectiveMaturities.reduce((a, b) => a + b, 0) / domainCount;
  const weightedMaturity = Math.round(avgMaturity * 10) / 10;

  // Overall confidence from domain confidence scores
  const avgConfidence = results.reduce((a, r) => a + r.confidence_score, 0) / domainCount;
  const overallConfidence = confidenceLabel(avgConfidence);

  const sorted = [...results].sort((a, b) => a.effective_maturity - b.effective_maturity);
  const weakest = sorted.slice(0, 3);
  const strongest = sorted.slice(-3).reverse();

  const weakNames = weakest.map((r) => {
    const d = model.domains.find((dd) => dd.id === r.domain_id);
    return `${d?.name || r.domain_id} (level ${r.effective_maturity} — ${MATURITY_LABELS_SHORT[r.effective_maturity] || ''})`;
  });
  const strongNames = strongest.map((r) => {
    const d = model.domains.find((dd) => dd.id === r.domain_id);
    return `${d?.name || r.domain_id} (level ${r.effective_maturity} — ${MATURITY_LABELS_SHORT[r.effective_maturity] || ''})`;
  });

  const parts: string[] = [];

  // 1. Confidence and scope
  parts.push(
    `This assessment covers ${domainCount} data input domains. Overall assessment confidence is ${overallConfidence}. ${CONFIDENCE_DESCRIPTIONS[overallConfidence]}`
  );

  // 2. Intent gap analysis — the critical "is your data good enough for what you need?"
  if (intent) {
    const requiredLevel = INTENT_MINIMUM_LEVEL[intent];
    const intentLabel = INTENT_LABELS[intent];
    const belowRequired = results.filter((r) => r.effective_maturity < requiredLevel);

    if (belowRequired.length === 0) {
      parts.push(
        `Your stated goal is "${intentLabel}". All ${domainCount} domains meet or exceed the minimum data quality level (${requiredLevel}) needed to support this. The data foundation is in place for this use.`
      );
    } else {
      const belowNames = belowRequired
        .sort((a, b) => a.effective_maturity - b.effective_maturity)
        .slice(0, 4)
        .map((r) => {
          const d = model.domains.find((dd) => dd.id === r.domain_id);
          return `${d?.name || r.domain_id} (level ${r.effective_maturity})`;
        });
      parts.push(
        `Your stated goal is "${intentLabel}", which requires data quality at level ${requiredLevel} or above across all domains. ${belowRequired.length} of ${domainCount} domains fall short: ${belowNames.join('; ')}. Until these gaps are closed, results in those areas should be treated with caution and may not withstand challenge.`
      );
    }
  }

  // 3. Overall maturity context
  parts.push(
    `Overall weighted maturity is ${weightedMaturity} out of 5, ranging from level ${minMaturity} to level ${maxMaturity}. These scores reflect data quality — what you can measure and evidence — not sustainability ambition or operational intent.`
  );

  // 4. Top limiting factors from the calculation dependency chain
  const domainNames: Record<string, string> = {};
  for (const d of model.domains) domainNames[d.id] = d.name;
  const limitingFactors = getTopLimitingFactors(results, domainNames, 3);

  if (limitingFactors.length > 0) {
    const factorDesc = limitingFactors
      .map((f) => `${f.domain_name} (level ${f.maturity}) — constrains ${f.affected.map(a => a.toLowerCase()).join(', ')}`)
      .join('; ');
    parts.push(
      `Top calculation constraints: ${factorDesc}. Weak data in these upstream domains cascades into unreliable results downstream. Fixing them has a multiplier effect.`
    );
  }

  // 5. Domain distribution
  const belowThree = results.filter((r) => r.effective_maturity < 3).length;
  const belowTwo = results.filter((r) => r.effective_maturity < 2).length;
  const atFourPlus = results.filter((r) => r.effective_maturity >= 4).length;
  const distParts: string[] = [];

  if (belowThree > 0) {
    distParts.push(`${belowThree} of ${domainCount} domains are below level 3 — data in those areas is not reliable enough for confident decisions`);
    if (belowTwo > 0) {
      distParts.push(`${belowTwo} of those ${belowTwo === 1 ? 'is' : 'are'} at level 1, meaning near-complete absence of usable data`);
    }
  }
  if (atFourPlus > 0) {
    distParts.push(`${atFourPlus} domain${atFourPlus > 1 ? 's are' : ' is'} at level 4 or above, providing measured, defensible evidence`);
  }
  if (distParts.length > 0) {
    parts.push(distParts.join('. ') + '.');
  }

  parts.push(`Strongest areas: ${strongNames.join('; ')}.`);
  parts.push(`Weakest areas: ${weakNames.join('; ')}.`);

  // 6. Priority gaps
  const highImpactWeak = results
    .filter((r) => r.effective_maturity <= 2 && r.impact_score >= 4)
    .map((r) => model.domains.find((d) => d.id === r.domain_id)?.name || r.domain_id);

  if (highImpactWeak.length > 0) {
    parts.push(
      `Critical priority: ${highImpactWeak.join(', ')} ${highImpactWeak.length === 1 ? 'is' : 'are'} high-impact but low-maturity — the widest gap between importance and evidence quality. These need named ownership and a clear path to level 3.`
    );
  }

  // 7. Spread risk
  const spread = maxMaturity - minMaturity;
  if (spread >= 3) {
    parts.push(
      `The ${spread}-level spread between strongest and weakest domains is significant. Uneven maturity limits joined-up decisions — strong data in one area is less useful when related areas are weak. Closing the lowest gaps improves usability across the whole estate.`
    );
  }

  // 8. Caveats
  const flagged = results.filter((r) => r.weakness_flags.length > 0);
  if (flagged.length > 0) {
    parts.push(
      `${flagged.length} domain${flagged.length > 1 ? 's have' : ' has'} scoring caveats — typically where widespread level-1 answers or weak data lineage limits confidence. Review these in the domain detail.`
    );
  }

  const overrides = results.filter((r) => r.assessor_override !== null);
  if (overrides.length > 0) {
    parts.push(
      `${overrides.length} domain${overrides.length > 1 ? 's have' : ' has'} assessor overrides; both calculated and overridden scores are shown.`
    );
  }

  return parts.join('\n\n');
}
