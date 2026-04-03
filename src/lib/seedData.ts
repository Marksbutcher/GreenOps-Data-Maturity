import demoSeed from '../data/demo_assessment_seed.json';
import { AssessmentState, DomainAssessment, OrganisationProfile } from '../types';

export function loadDemoData(): AssessmentState {
  const seed = demoSeed as {
    organisation_profile: Record<string, string>;
    assessment_results: Array<Record<string, unknown>>;
  };

  const profile: OrganisationProfile = {
    organisation_name: seed.organisation_profile.organisation_name || '',
    sector: seed.organisation_profile.sector || '',
    sub_sector: seed.organisation_profile.sub_sector || '',
    organisation_size: seed.organisation_profile.organisation_size || '',
    hosting_profile: seed.organisation_profile.hosting_profile || '',
    assessment_date: seed.organisation_profile.assessment_date || '',
    assessor_name: seed.organisation_profile.assessor_name || '',
    notes: seed.organisation_profile.notes || '',
  };

  const results: DomainAssessment[] = seed.assessment_results.map((r) => ({
    domain_id: r.domain_id as string,
    maturity_score: r.maturity_score as number,
    impact_score: r.impact_score as number,
    confidence_score: (r.confidence_score as number) || 3,
    target_maturity: (r.target_maturity as number) || 4,
    priority: (r.priority as DomainAssessment['priority']) || '',
    rationale: (r.rationale as string) || '',
    evidence: (r.evidence as string) || '',
    question_answers: {},
    decision_support_status: (r.decision_support_status as string) || 'directional',
    supported_decisions: (r.supported_decisions as string[]) || [],
    unsupported_decisions: (r.unsupported_decisions as string[]) || [],
  }));

  return {
    profile,
    results,
    mode: 'self',
    completed: true,
  };
}
