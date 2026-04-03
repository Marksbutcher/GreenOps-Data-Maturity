// Types derived from the GreenOps maturity model

export interface MaturityLevel {
  label: string;
  description: string;
}

export interface DecisionSupportStatus {
  id: string;
  label: string;
  description: string;
}

export interface CrossCuttingLens {
  id: string;
  label: string;
  description: string;
}

export interface QuestionOption {
  text: string;
  level: number;
}

export interface Question {
  id: string;
  text: string;
  type: string;
  options: string[];
  maps_to_levels: number[];
}

export interface DecisionSupportByLevel {
  supports: string[];
  does_not_support: string[];
}

export interface RecommendationThemes {
  low: string[];
  mid: string[];
  high: string[];
}

export interface Domain {
  id: string;
  name: string;
  definition: string;
  why_it_matters: string;
  default_impact_score: number;
  decision_areas: string[];
  maturity_levels: Record<string, string>;
  questions: Question[];
  decision_support_by_level: Record<string, DecisionSupportByLevel>;
  recommendation_themes: RecommendationThemes;
  evidence_examples: string[];
}

export interface MaturityModel {
  model_name: string;
  version: string;
  description: string;
  maturity_scale: Record<string, MaturityLevel>;
  decision_support_statuses: DecisionSupportStatus[];
  cross_cutting_lenses: CrossCuttingLens[];
  default_impact_scores: Record<string, number>;
  domains: Domain[];
  output_sections: string[];
}

export interface OrganisationProfile {
  organisation_name: string;
  sector: string;
  sub_sector: string;
  organisation_size: string;
  hosting_profile: string;
  assessment_date: string;
  assessor_name: string;
  notes: string;
}

export interface DomainAssessment {
  domain_id: string;
  maturity_score: number;
  impact_score: number;
  confidence_score: number;
  target_maturity: number;
  priority: 'High' | 'Medium' | 'Low' | '';
  rationale: string;
  evidence: string;
  question_answers: Record<string, number>; // question_id -> selected option index
  decision_support_status: string;
  supported_decisions: string[];
  unsupported_decisions: string[];
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
