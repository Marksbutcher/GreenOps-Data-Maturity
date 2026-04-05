import { AssessmentState, DomainAssessment, OrganisationProfile } from '../types';
import model from '../data/greenops_maturity_model.json';
import { MaturityModel } from '../types';

const typedModel = model as unknown as MaturityModel;

// Predefined demo answer patterns per domain (option indices 0-4)
// Realistic enterprise bank: strong on cloud/utilisation (vendor tooling), decent on
// asset inventory and power (operational basics), weak on embodied carbon, water,
// allocation/attribution, and lineage (typical blind spots). Mixed on carbon factors
// and colo data (partial supplier feeds). Decision integration very weak (common gap).
const demoAnswerPatterns: Record<string, number[]> = {
  asset_inventory_configuration: [3, 3, 2, 3, 2, 1, 2, 3],       // 8 Qs — CMDB exists but lifecycle/config weak → ~2.6
  operational_power_energy: [3, 2, 3, 2, 1, 3, 1, 2, 1],          // 9 Qs — metering at site level, poor at rack/zone → ~2.0
  water_data: [1, 0, 1, 0, 0, 1, 0, 0],                           // 8 Qs — almost nothing; typical blind spot → ~0.4
  infrastructure_efficiency_metrics: [3, 3, 2, 2, 3, 1, 2, 3],    // 8 Qs — PUE tracked, granularity poor → ~2.5
  embodied_emissions: [1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],         // 11 Qs — procurement captures very little → ~0.4
  carbon_factors: [3, 2, 2, 3, 2, 1, 1, 2, 2],                    // 9 Qs — location-based OK, market-based patchy → ~2.0
  utilisation_and_service_usage: [4, 3, 3, 3, 2, 3, 2, 3, 1, 1, 1], // 11 Qs — APM/cloud tools, on-prem weaker → ~2.5
  allocation_attribution: [1, 1, 2, 0, 1, 1, 0, 1, 0],            // 9 Qs — no systematic attribution to services → ~0.8
  cloud_telemetry: [4, 4, 3, 3, 3, 2, 2, 3, 2],                   // 9 Qs — native tooling mature, multi-cloud gaps → ~3.0
  colo_provider_data: [2, 1, 2, 1, 1, 0, 1, 1],                   // 8 Qs — basic billing data only → ~1.2
  temporal_timeliness: [3, 2, 1, 2],                                // 4 Qs — monthly at best, rarely real-time → ~2.0
  lineage_assurance: [1, 1, 0, 1, 1],                              // 5 Qs — no formal lineage or audit trail → ~0.8
  decision_integration: [2, 1, 1, 0, 1, 1, 0, 0],                  // 8 Qs — some dashboards, no closed-loop governance → ~0.8
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
    assessment_intent: 'evidence_based_decisions',
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
