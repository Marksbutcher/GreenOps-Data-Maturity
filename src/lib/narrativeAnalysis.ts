import { Domain, DomainAssessment, MaturityModel } from '../types';

export interface DomainNarrative {
  domain_id: string;
  domain_name: string;
  currentLevel: string;
  currentLevelDescription: string;
  evidenceSummary: string;
  consequences: string;
  supportedDecisions: string[];
  unsupportedDecisions: string[];
  whatBetterUnlocks: string;
  improvementActions: string[];
  targetGap: number | null;
  maturityScore: number;
  impactScore: number;
  confidenceScore: number;
  priority: string;
}

/**
 * Generate detailed narrative analysis for each domain.
 */
export function generateDomainNarratives(
  results: DomainAssessment[],
  model: MaturityModel
): DomainNarrative[] {
  return results.map((result) => {
    const domain = model.domains.find((d) => d.id === result.domain_id)!;
    const score = result.maturity_score;
    const levelKey = String(Math.min(Math.max(score, 1), 5));
    const levelDesc = domain.maturity_levels[levelKey];
    const scaleLabel = model.maturity_scale[levelKey]?.label || '';

    const decisionSupport = domain.decision_support_by_level[levelKey];
    const supported = decisionSupport?.supports || [];
    const unsupported = decisionSupport?.does_not_support || [];

    // Consequences
    let consequences: string;
    if (score <= 2) {
      consequences = `At Level ${score} (${scaleLabel}), ${domain.name.toLowerCase()} is a significant constraint. ${domain.why_it_matters} Current weaknesses mean the organisation cannot confidently use this data for ${unsupported.length > 0 ? unsupported.slice(0, 2).join(' or ') : 'key operational decisions'}.`;
    } else if (score <= 3) {
      consequences = `At Level ${score} (${scaleLabel}), ${domain.name.toLowerCase()} supports standardised use but has clear limitations. ${unsupported.length > 0 ? `The data is not yet strong enough for ${unsupported[0]}.` : 'Further improvement would extend decision support.'}`;
    } else {
      consequences = `At Level ${score} (${scaleLabel}), ${domain.name.toLowerCase()} is relatively strong. The focus should be on extending coverage and embedding this data into continuous operational improvement.`;
    }

    // What better maturity would unlock
    const nextLevel = Math.min(score + 1, 5);
    const nextLevelDesc = domain.maturity_levels[String(nextLevel)];
    const nextDecisions = domain.decision_support_by_level[String(nextLevel)];
    const whatBetterUnlocks = nextLevel > score
      ? `Moving to Level ${nextLevel} would mean: ${nextLevelDesc} This would unlock: ${nextDecisions?.supports?.join('; ') || 'stronger decision support'}.`
      : 'This domain is at the highest maturity level.';

    // Improvement actions
    let actions: string[];
    if (score <= 2) {
      actions = domain.recommendation_themes.low;
    } else if (score <= 3) {
      actions = domain.recommendation_themes.mid;
    } else {
      actions = domain.recommendation_themes.high;
    }

    const targetGap = result.target_maturity ? result.target_maturity - score : null;

    const evidenceSummary = result.evidence
      ? `Evidence provided: ${result.evidence}. ${result.rationale || ''}`
      : result.rationale || 'No evidence or rationale recorded.';

    return {
      domain_id: result.domain_id,
      domain_name: domain.name,
      currentLevel: `Level ${score}: ${scaleLabel}`,
      currentLevelDescription: levelDesc,
      evidenceSummary,
      consequences,
      supportedDecisions: supported,
      unsupportedDecisions: unsupported,
      whatBetterUnlocks,
      improvementActions: actions,
      targetGap,
      maturityScore: score,
      impactScore: result.impact_score,
      confidenceScore: result.confidence_score,
      priority: result.priority,
    };
  });
}
