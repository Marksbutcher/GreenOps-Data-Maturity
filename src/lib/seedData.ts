import { AssessmentState, DomainAssessment, OrganisationProfile } from '../types';
import model from '../data/greenops_maturity_model.json';
import { MaturityModel } from '../types';

const typedModel = model as unknown as MaturityModel;

// Predefined demo answer patterns per domain (option indices 0-4)
// Creates uneven maturity across domains for realistic demo
const demoAnswerPatterns: Record<string, number[]> = {
  asset_inventory_configuration: [2, 2, 1, 2, 1, 2, 1, 2],       // 8 Qs, ~2
  operational_power_energy: [2, 1, 2, 1, 1, 2, 1, 1, 1],          // 9 Qs (op10 removed), ~1.5
  water_data: [0, 0, 1, 0, 0, 1, 0, 0],                           // 8 Qs (wd9 removed), ~1
  infrastructure_efficiency_metrics: [2, 2, 2, 1, 2, 1, 1, 2],    // 8 Qs (im9 removed), ~1.8
  embodied_emissions: [1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],         // 11 Qs (ee11 replaced with disposal), ~1
  carbon_factors: [2, 2, 1, 2, 2, 1, 1, 2, 1],                    // 9 Qs, ~2
  utilisation_and_service_usage: [3, 2, 2, 2, 1, 2, 1, 2, 0, 0, 0], // 11 Qs, ~2.5
  allocation_attribution: [1, 1, 1, 0, 0, 1, 0, 1, 0],            // 9 Qs, ~1.2
  cloud_telemetry: [3, 3, 2, 2, 2, 2, 1, 2, 1],                   // 9 Qs (ct10 removed), ~2.5
  colo_provider_data: [1, 1, 1, 0, 1, 0, 0, 1],                   // 8 Qs (cp9 removed), ~1.2
  temporal_timeliness: [2, 1, 1, 2],                                // 4 Qs (tt5-tt8 removed), ~1.5
  lineage_assurance: [1, 1, 0, 0, 1],                              // 5 Qs (la4,la6,la8 removed), ~1
  decision_integration: [1, 1, 1, 0, 0, 1, 0, 0],                  // 8 Qs (+di9 targets, di10 financial, di11 benchmarking), ~1
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
