// Types derived from the GreenOps v2 deepened maturity model

export interface MaturityLevel {
  label: string;
  description: string;
}

export interface DecisionSupportTier {
  label: string;
  description: string;
}

export interface QuestionOption {
  label: string;
  score: number;
}

export interface Question {
  id: string;
  text: string;
  dimension: string;
  weight: number;
  guidance: string;
  evidence_hint: string;
  tags: string[];
  options: QuestionOption[];
}

export interface DomainScoring {
  method: string;
  normalisation: string;
  question_override_rules: string[];
  confidence_logic: Record<string, string>;
  decision_support_mapping: Record<string, string>;
}

export interface DecisionSupportByScore {
  status: string;
  supports: string[];
  does_not_support: string[];
}

export interface RecommendationTrigger {
  if_maturity_lte?: number;
  if_maturity_equals?: number;
  if_maturity_gte?: number;
  priority: string;
  guidance: string;
}

export interface GlobalScoringRules {
  primary_principle: string;
  derived_score_logic: string;
  direct_manual_override_policy: string;
  confidence_guidance: string;
  impact_guidance: string;
}

export interface Domain {
  id: string;
  name: string;
  definition: string;
  why_it_matters: string;
  default_impact_score: number;
  decision_areas: string[];
  common_evidence_examples: string[];
  recommendation_themes: string[];
  scoring: DomainScoring;
  questions: Question[];
  maturity_levels: Record<string, MaturityLevel>;
  decision_support_by_score: Record<string, DecisionSupportByScore>;
  recommendation_triggers: RecommendationTrigger[];
}

export interface MaturityModel {
  model_name: string;
  version: string;
  description: string;
  maturity_scale: Record<string, MaturityLevel>;
  decision_support_tiers: Record<string, DecisionSupportTier>;
  global_cross_cutting_lenses: string[];
  global_scoring_rules: GlobalScoringRules;
  decision_readiness_categories: string[];
  domains: Domain[];
}

export type AssessmentIntent =
  | 'compliance_reporting'
  | 'directional_insight'
  | 'evidence_based_decisions'
  | 'automated_governance';

export const INTENT_LABELS: Record<AssessmentIntent, string> = {
  compliance_reporting: 'Basic compliance and reporting',
  directional_insight: 'Directional insight and benchmarking',
  evidence_based_decisions: 'Evidence-based optimisation decisions',
  automated_governance: 'Automated governance and policy integration',
};

export const INTENT_DESCRIPTIONS: Record<AssessmentIntent, string> = {
  compliance_reporting: 'Produce high-level carbon reports, meet basic disclosure requirements, and report aggregate consumption figures.',
  directional_insight: 'Identify trends, compare sites or services, benchmark performance, and prioritise where to investigate further.',
  evidence_based_decisions: 'Support investment cases, procurement challenges, rightsizing decisions, and accountability with defensible evidence.',
  automated_governance: 'Embed data into continuous governance — automated controls, real-time optimisation, and policy-driven decision-making.',
};

/** Minimum data quality level needed for each intent */
export const INTENT_MINIMUM_LEVEL: Record<AssessmentIntent, number> = {
  compliance_reporting: 2,
  directional_insight: 3,
  evidence_based_decisions: 4,
  automated_governance: 5,
};

export type ConfidenceLevel = 'low' | 'moderate' | 'high';

/** Map numeric confidence (1-4) to named level */
export function confidenceLabel(score: number): ConfidenceLevel {
  if (score <= 1) return 'low';
  if (score <= 2) return 'low';
  if (score <= 3) return 'moderate';
  return 'high';
}

export const CONFIDENCE_DESCRIPTIONS: Record<ConfidenceLevel, string> = {
  low: 'Assessment is based on incomplete answers or inconsistent scoring. Treat results as indicative only.',
  moderate: 'Reasonable coverage with some variation. Results are directionally useful but may not withstand detailed challenge.',
  high: 'Strong coverage and consistent scoring. Results can support confident decisions and external reporting.',
};

export interface OrganisationProfile {
  organisation_name: string;
  sector: string;
  sub_sector: string;
  organisation_size: string;
  hosting_profile: string;
  assessment_date: string;
  assessor_name: string;
  notes: string;
  assessment_intent: AssessmentIntent;
}

export interface DomainAssessment {
  domain_id: string;
  question_answers: Record<string, number>; // question_id -> selected option index (0-4)
  calculated_maturity: number; // derived from weighted question scores
  assessor_override: number | null; // optional manual override, preserved alongside calculated
  effective_maturity: number; // assessor_override if set, else calculated_maturity
  impact_score: number;
  confidence_score: number;
  target_maturity: number;
  priority: 'High' | 'Medium' | 'Low' | '';
  rationale: string;
  evidence: string;
  decision_support_status: string;
  supported_decisions: string[];
  unsupported_decisions: string[];
  dimension_scores: Record<string, number>; // dimension -> weighted score for that dimension
  weakness_flags: string[]; // flags from override rules
}

export interface AssessmentState {
  profile: OrganisationProfile;
  results: DomainAssessment[];
  mode: 'self' | 'facilitated';
  completed: boolean;
}

export type DecisionReadinessLevel = 'reporting_only' | 'directional' | 'decision_grade' | 'optimisation_grade';

export interface Recommendation {
  domain_id: string;
  domain_name: string;
  action: string;
  reason: string;
  benefit: string;
  priority: 'High' | 'Medium' | 'Low';
  phase: 'Quick win' | 'Foundation' | 'Transformation';
}

export interface DecisionAreaReadiness {
  area: string;
  readiness: DecisionReadinessLevel;
  label: string;
  supporting_domains: string[];
  limiting_domains: string[];
  summary: string;
}

export type AppView = 'landing' | 'profile' | 'assessment' | 'results';

/** Canonical maturity level labels — CMMI-aligned, single source of truth */
export const MATURITY_LABELS: Record<number, string> = {
  1: 'Initial — ad hoc or absent',
  2: 'Managed — partial coverage',
  3: 'Defined — standardised and reportable',
  4: 'Quantitatively Managed — measured and defensible',
  5: 'Optimising — auditable and continuously improving',
};

/** Short labels for compact display (badges, charts) */
export const MATURITY_LABELS_SHORT: Record<number, string> = {
  1: 'Initial',
  2: 'Managed',
  3: 'Defined',
  4: 'Quantitatively Managed',
  5: 'Optimising',
};
