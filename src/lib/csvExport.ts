import { OrganisationProfile, DomainAssessment, MaturityModel, INTENT_LABELS } from '../types';

export function generateCSV(
  profile: OrganisationProfile,
  results: DomainAssessment[],
  model: MaturityModel
): string {
  const headers = [
    'Domain ID',
    'Domain Name',
    'Calculated Maturity',
    'Assessor Override',
    'Effective Maturity',
    'Impact Score',
    'Confidence Score',
    'Target Maturity',
    'Priority',
    'Decision Support Status',
    'Weakness Flags',
    'Evidence',
    'Rationale',
  ];

  const rows = results.map((r) => {
    const domain = model.domains.find((d) => d.id === r.domain_id);
    return [
      r.domain_id,
      domain?.name || r.domain_id,
      String(r.calculated_maturity),
      r.assessor_override !== null ? String(r.assessor_override) : '',
      String(r.effective_maturity),
      String(r.impact_score),
      String(r.confidence_score),
      String(r.target_maturity),
      r.priority,
      r.decision_support_status,
      r.weakness_flags.join('; '),
      `"${(r.evidence || '').replace(/"/g, '""')}"`,
      `"${(r.rationale || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  const intentLabel = profile.assessment_intent ? INTENT_LABELS[profile.assessment_intent] : 'Not specified';

  const meta = [
    `# GreenOps Data Input Maturity Assessment`,
    `# Organisation: ${profile.organisation_name}`,
    `# Sector: ${profile.sector}`,
    `# Date: ${profile.assessment_date}`,
    `# Assessor: ${profile.assessor_name}`,
    `# Assessment Goal: ${intentLabel}`,
    `# Model Version: ${model.version}`,
    '',
  ];

  return [...meta, headers.join(','), ...rows].join('\n');
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
