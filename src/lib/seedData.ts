import { AssessmentState, DomainAssessment, OrganisationProfile } from '../types';
import model from '../data/greenops_maturity_model.json';
import { MaturityModel } from '../types';

const typedModel = model as unknown as MaturityModel;

// Predefined demo answer patterns per domain (option indices 0-4)
// Creates uneven maturity across domains for realistic demo
const demoAnswerPatterns: Record<string, number[]> = {
  asset_inventory_configuration: [2, 2, 1, 2, 1, 2, 1, 2],       // ~2
  operational_power_energy: [2, 1, 2, 1, 1, 2, 1, 1],             // ~1.7
  water_data: [0, 0, 1, 0, 0, 1, 0, 0],                           // ~1
  infrastructure_efficiency_metrics: [2, 2, 2, 1, 2, 1, 1, 2],     // ~2
  embodied_emissions: [1, 0, 1, 0, 0, 1, 0, 0],                    // ~1
  carbon_factors: [2, 2, 1, 2, 2, 1, 1, 2],                        // ~2
  utilisation_and_service_usage: [3, 2, 2, 2, 1, 2, 1, 2],         // ~2.5
  allocation_attribution: [1, 1, 1, 0, 0, 1, 0, 1],                // ~1.2
  cloud_telemetry: [3, 3, 2, 2, 2, 2, 1, 2],                       // ~2.5
  colo_provider_data: [1, 1, 1, 0, 1, 0, 0, 1],                    // ~1.2
  temporal_timeliness: [2, 1, 1, 2, 1, 1, 1, 1],                    // ~1.5
  lineage_assurance: [1, 1, 0, 1, 0, 0, 1, 0],                     // ~1
  decision_integration: [1, 1, 1, 0, 1, 0, 0, 1],                   // ~1.2
};

export function loadDemoData(): AssessmentState {
  const profile: OrganisationProfile = {
    organisation_name: 'Example Enterprise Bank plc',
    sector: 'Financial Services',
    sub_sector: 'Retail Banking',
    organisation_size: 'Large (5,000+)',
    hosting_profile: 'Hybrid (on-premise, colocation and cloud)',
    assessment_date: new Date().toISOString().split('T')[0],
    assessor_name: 'Demo Assessment',
    notes: 'Demonstration data showing a typical enterprise with uneven maturity across GreenOps data domains.',
  };

  const results: DomainAssessment[] = typedModel.domains.map((domain) => {
    const pattern = demoAnswerPatterns[domain.id] || [1, 1, 1, 1, 1, 1, 1, 1];
    const answers: Record<string, number> = {};
    domain.questions.forEach((q, i) => {
      answers[q.id] = pattern[i] !== undefined ? pattern[i] : 1;
    });

    return {
      domain_id: domain.id,
      question_answers: answers,
      calculated_maturity: 1,
      assessor_override: null,
      effective_maturity: 1,
      impact_score: domain.default_impact_score,
      confidence_score: 1,
      target_maturity: Math.min(domain.default_impact_score, 5),
      priority: '' as const,
      rationale: '',
      evidence: '',
      decision_support_status: 'Reporting only',
      supported_decisions: [],
      unsupported_decisions: [],
      dimension_scores: {},
      weakness_flags: [],
    };
  });

  return { profile, results, mode: 'facilitated', completed: true };
}
