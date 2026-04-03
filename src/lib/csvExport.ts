import { OrganisationProfile, DomainAssessment, MaturityModel } from '../types';
import { getDecisionSupportLabel } from './scoring';

export function generateCSV(
  profile: OrganisationProfile,
  results: DomainAssessment[],
  model: MaturityModel
): string {
  const domainMap = new Map(model.domains.map((d) => [d.id, d]));
  const rows: string[][] = [];

  // Header
  rows.push([
    'Organisation',
    'Sector',
    'Sub-sector',
    'Size',
    'Hosting Profile',
    'Assessment Date',
    'Assessor',
    'Domain ID',
    'Domain Name',
    'Maturity Score',
    'Impact Score',
    'Confidence Score',
    'Target Maturity',
    'Priority',
    'Decision Support Status',
    'Rationale',
    'Evidence',
    'Supported Decisions',
    'Unsupported Decisions',
  ]);

  for (const r of results) {
    const domain = domainMap.get(r.domain_id);
    rows.push([
      profile.organisation_name,
      profile.sector,
      profile.sub_sector,
      profile.organisation_size,
      profile.hosting_profile,
      profile.assessment_date,
      profile.assessor_name,
      r.domain_id,
      domain?.name || r.domain_id,
      String(r.maturity_score),
      String(r.impact_score),
      String(r.confidence_score),
      String(r.target_maturity),
      r.priority,
      getDecisionSupportLabel(model, r.decision_support_status),
      r.rationale,
      r.evidence,
      r.supported_decisions.join('; '),
      r.unsupported_decisions.join('; '),
    ]);
  }

  return rows
    .map((row) =>
      row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
