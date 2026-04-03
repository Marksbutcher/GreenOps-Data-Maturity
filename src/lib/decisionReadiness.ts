import { DomainAssessment, DecisionAreaReadiness, MaturityModel } from '../types';

/**
 * Overall GreenOps decision areas and which domains they depend on.
 */
const DECISION_AREA_MAPPINGS: {
  area: string;
  dependencies: string[];
  minMaturityForGrade: number;
}[] = [
  {
    area: 'Footprint reporting',
    dependencies: ['operational_power', 'carbon_factors', 'asset_inventory', 'lineage_assurance'],
    minMaturityForGrade: 3,
  },
  {
    area: 'Hotspot identification',
    dependencies: ['asset_inventory', 'operational_power', 'embodied_emissions', 'allocation_logic'],
    minMaturityForGrade: 3,
  },
  {
    area: 'Refresh and lifecycle decisions',
    dependencies: ['asset_inventory', 'embodied_emissions', 'usage_maturity'],
    minMaturityForGrade: 3,
  },
  {
    area: 'Rightsizing and decommissioning',
    dependencies: ['usage_maturity', 'allocation_logic', 'cloud_telemetry'],
    minMaturityForGrade: 3,
  },
  {
    area: 'Supplier challenge',
    dependencies: ['embodied_emissions', 'colo_provider_data', 'infra_efficiency_metrics'],
    minMaturityForGrade: 3,
  },
  {
    area: 'Workload placement',
    dependencies: ['cloud_telemetry', 'operational_power', 'carbon_factors', 'usage_maturity'],
    minMaturityForGrade: 4,
  },
  {
    area: 'Cloud optimisation',
    dependencies: ['cloud_telemetry', 'usage_maturity', 'allocation_logic'],
    minMaturityForGrade: 3,
  },
  {
    area: 'Non-IT load allocation',
    dependencies: ['infra_efficiency_metrics', 'operational_power', 'colo_provider_data'],
    minMaturityForGrade: 3,
  },
  {
    area: 'Service-level optimisation',
    dependencies: ['usage_maturity', 'allocation_logic', 'cloud_telemetry', 'operational_power'],
    minMaturityForGrade: 4,
  },
  {
    area: 'AI demand governance and optimisation',
    dependencies: ['usage_maturity', 'cloud_telemetry', 'allocation_logic', 'decision_integration'],
    minMaturityForGrade: 4,
  },
  {
    area: 'Operational improvement tracking',
    dependencies: ['decision_integration', 'lineage_assurance', 'temporal_timeliness'],
    minMaturityForGrade: 3,
  },
  {
    area: 'Target setting and governance',
    dependencies: ['lineage_assurance', 'decision_integration', 'temporal_timeliness', 'carbon_factors'],
    minMaturityForGrade: 3,
  },
];

function getReadinessLevel(
  avgMaturity: number,
  minMaturity: number,
  requiredMin: number
): { level: string; label: string } {
  if (minMaturity <= 1 || avgMaturity < 2) {
    return { level: 'reporting_only', label: 'Reporting only' };
  }
  if (avgMaturity < requiredMin - 0.5) {
    return { level: 'directional', label: 'Directional decision support' };
  }
  if (avgMaturity >= requiredMin + 1 && minMaturity >= requiredMin) {
    return { level: 'optimisation_grade', label: 'Optimisation-grade' };
  }
  if (avgMaturity >= requiredMin && minMaturity >= requiredMin - 1) {
    return { level: 'decision_grade', label: 'Decision-grade' };
  }
  return { level: 'directional', label: 'Directional decision support' };
}

export function generateDecisionReadiness(
  results: DomainAssessment[],
  _model: MaturityModel
): DecisionAreaReadiness[] {
  const scoreMap = new Map<string, number>();
  results.forEach((r) => scoreMap.set(r.domain_id, r.maturity_score));

  return DECISION_AREA_MAPPINGS.map((mapping) => {
    const depScores = mapping.dependencies
      .map((d) => scoreMap.get(d) || 1);
    const avg = depScores.reduce((a, b) => a + b, 0) / depScores.length;
    const min = Math.min(...depScores);

    const { level, label } = getReadinessLevel(avg, min, mapping.minMaturityForGrade);

    const supporting = mapping.dependencies.filter(
      (d) => (scoreMap.get(d) || 1) >= mapping.minMaturityForGrade
    );
    const limiting = mapping.dependencies.filter(
      (d) => (scoreMap.get(d) || 1) < mapping.minMaturityForGrade
    );

    let summary: string;
    if (level === 'reporting_only') {
      summary = `Current data is not yet sufficient for confident ${mapping.area.toLowerCase()}. Significant gaps remain in underpinning domains.`;
    } else if (level === 'directional') {
      summary = `Data supports directional ${mapping.area.toLowerCase()} but should not yet be treated as decision-grade. Key dependencies remain below the threshold needed for confident action.`;
    } else if (level === 'decision_grade') {
      summary = `Data is approaching decision-grade for ${mapping.area.toLowerCase()}. Core dependencies are sufficiently mature, though some areas could be strengthened further.`;
    } else {
      summary = `Strong data foundations support optimisation-grade ${mapping.area.toLowerCase()} across the relevant domains.`;
    }

    return {
      area: mapping.area,
      readiness: level as DecisionAreaReadiness['readiness'],
      label,
      supporting_domains: supporting,
      limiting_domains: limiting,
      summary,
    };
  });
}
