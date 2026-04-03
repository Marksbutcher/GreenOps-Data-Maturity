import { DomainAssessment, MaturityModel } from '../types';

export interface DomainNarrative {
  domain_id: string;
  domain_name: string;
  maturity_level: string;
  maturity_label: string;
  score_explanation: string;
  dimension_analysis: string;
  decision_support_summary: string;
  improvement_guidance: string;
  weakness_flags: string[];
}

export function generateDomainNarratives(
  results: DomainAssessment[],
  model: MaturityModel
): DomainNarrative[] {
  return results.map((result) => {
    const domain = model.domains.find((d) => d.id === result.domain_id);
    if (!domain) {
      return {
        domain_id: result.domain_id,
        domain_name: result.domain_id,
        maturity_level: '1',
        maturity_label: 'Unknown',
        score_explanation: 'Domain not found in model.',
        dimension_analysis: '',
        decision_support_summary: '',
        improvement_guidance: '',
        weakness_flags: [],
      };
    }

    const level = String(result.effective_maturity);
    const maturityInfo = domain.maturity_levels[level];
    const maturityLabel = maturityInfo ? maturityInfo.label : 'Unknown';
    const maturityDesc = maturityInfo ? maturityInfo.description : '';

    // Score explanation
    const overrideNote =
      result.assessor_override !== null
        ? ` (assessor override applied; calculated score was ${result.calculated_maturity})`
        : '';
    const flagNote =
      result.weakness_flags.length > 0 ? ` Caveats: ${result.weakness_flags.join('; ')}.` : '';
    const scoreExplanation = `Assessed at level ${result.effective_maturity} — ${maturityDesc}${overrideNote}.${flagNote}`;

    // Dimension analysis
    const dimEntries = Object.entries(result.dimension_scores);
    const weakDims = dimEntries
      .filter(([, s]) => s <= 2.5)
      .sort((a, b) => a[1] - b[1]);
    const strongDims = dimEntries
      .filter(([, s]) => s >= 3.5)
      .sort((a, b) => b[1] - a[1]);

    let dimAnalysis = '';
    if (strongDims.length > 0) {
      dimAnalysis += `Stronger dimensions: ${strongDims
        .map(([d, s]) => `${d.replace(/_/g, ' ')} (${s})`)
        .join(', ')}. `;
    }
    if (weakDims.length > 0) {
      dimAnalysis += `Weaker dimensions: ${weakDims
        .map(([d, s]) => `${d.replace(/_/g, ' ')} (${s})`)
        .join(', ')}. `;
    }
    if (dimEntries.length === 0) {
      dimAnalysis = 'No dimension scores available — assessment may be incomplete.';
    }

    // Decision support
    const ds = domain.decision_support_by_score[level];
    let dsSummary = '';
    if (ds) {
      dsSummary = `At this level, data supports: ${ds.supports.join('; ')}. `;
      if (
        ds.does_not_support.length > 0 &&
        !ds.does_not_support[0].startsWith('None')
      ) {
        dsSummary += `Does not yet support: ${ds.does_not_support.join('; ')}.`;
      }
    }

    // Improvement guidance from triggers
    const triggered = domain.recommendation_triggers.filter((t) => {
      if (t.if_maturity_lte !== undefined && result.effective_maturity <= t.if_maturity_lte)
        return true;
      if (t.if_maturity_equals !== undefined && result.effective_maturity === t.if_maturity_equals)
        return true;
      if (t.if_maturity_gte !== undefined && result.effective_maturity >= t.if_maturity_gte)
        return true;
      return false;
    });
    const guidance = triggered.map((t) => t.guidance).join(' ');

    return {
      domain_id: domain.id,
      domain_name: domain.name,
      maturity_level: level,
      maturity_label: maturityLabel,
      score_explanation: scoreExplanation,
      dimension_analysis: dimAnalysis,
      decision_support_summary: dsSummary,
      improvement_guidance:
        guidance ||
        `Continue improving ${domain.name.toLowerCase()} to support stronger operational decisions.`,
      weakness_flags: result.weakness_flags,
    };
  });
}
