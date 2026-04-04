import { DomainAssessment } from '../types';

/**
 * Calculation dependency chain — models how weak data in upstream domains
 * cascades into unreliable outputs in downstream domains.
 *
 * The chain reflects GreenOps calculation reality:
 *   Power measurement → Efficiency metrics → Carbon factors → Allocation → Everything else
 *
 * If power data is unreliable, efficiency ratios derived from it are suspect,
 * carbon calculations that use those ratios inherit the uncertainty, and so on.
 */

export interface DomainDependency {
  domain_id: string;
  depends_on: string[];   // upstream domain IDs
  feeds_into: string[];   // downstream domain IDs
}

/**
 * Dependency map — which domains feed into which.
 * Read as: domain X depends_on [A, B] and feeds_into [C, D].
 */
export const DEPENDENCY_MAP: DomainDependency[] = [
  {
    domain_id: 'asset_inventory_configuration',
    depends_on: [],
    feeds_into: ['operational_power_energy', 'utilisation_and_service_usage', 'embodied_emissions', 'allocation_attribution'],
  },
  {
    domain_id: 'operational_power_energy',
    depends_on: ['asset_inventory_configuration'],
    feeds_into: ['infrastructure_efficiency_metrics', 'carbon_factors', 'allocation_attribution'],
  },
  {
    domain_id: 'water_data',
    depends_on: ['asset_inventory_configuration'],
    feeds_into: ['infrastructure_efficiency_metrics'],
  },
  {
    domain_id: 'infrastructure_efficiency_metrics',
    depends_on: ['operational_power_energy', 'water_data'],
    feeds_into: ['carbon_factors', 'allocation_attribution', 'decision_integration'],
  },
  {
    domain_id: 'carbon_factors',
    depends_on: ['operational_power_energy', 'infrastructure_efficiency_metrics'],
    feeds_into: ['allocation_attribution', 'decision_integration'],
  },
  {
    domain_id: 'embodied_emissions',
    depends_on: ['asset_inventory_configuration'],
    feeds_into: ['allocation_attribution', 'decision_integration'],
  },
  {
    domain_id: 'utilisation_and_service_usage',
    depends_on: ['asset_inventory_configuration'],
    feeds_into: ['allocation_attribution', 'decision_integration'],
  },
  {
    domain_id: 'allocation_attribution',
    depends_on: ['operational_power_energy', 'carbon_factors', 'utilisation_and_service_usage', 'embodied_emissions'],
    feeds_into: ['decision_integration'],
  },
  {
    domain_id: 'cloud_telemetry',
    depends_on: [],
    feeds_into: ['allocation_attribution', 'decision_integration'],
  },
  {
    domain_id: 'colo_provider_data',
    depends_on: [],
    feeds_into: ['operational_power_energy', 'infrastructure_efficiency_metrics', 'carbon_factors'],
  },
  {
    domain_id: 'temporal_timeliness',
    depends_on: [],
    feeds_into: [],  // cross-cutting — affects all domains
  },
  {
    domain_id: 'lineage_assurance',
    depends_on: [],
    feeds_into: [],  // cross-cutting — affects all domains
  },
  {
    domain_id: 'decision_integration',
    depends_on: ['allocation_attribution', 'carbon_factors', 'infrastructure_efficiency_metrics'],
    feeds_into: [],
  },
];

export interface CascadeRisk {
  domain_id: string;
  domain_name: string;
  effective_maturity: number;
  upstream_constraints: {
    domain_id: string;
    domain_name: string;
    maturity: number;
  }[];
  /** The effective ceiling — your data quality cannot exceed the weakest upstream input */
  cascade_ceiling: number;
  /** Whether this domain's score is artificially high relative to its inputs */
  overstated: boolean;
  summary: string;
}

/**
 * Analyse cascade risks — identify where downstream domains claim higher
 * maturity than their upstream inputs can support.
 */
export function analyseCascadeRisks(
  results: DomainAssessment[],
  domainNames: Record<string, string>
): CascadeRisk[] {
  const scoreMap = new Map<string, number>();
  for (const r of results) {
    scoreMap.set(r.domain_id, r.effective_maturity);
  }

  return DEPENDENCY_MAP
    .filter((dep) => dep.depends_on.length > 0)
    .map((dep) => {
      const myScore = scoreMap.get(dep.domain_id) || 1;

      const upstreamConstraints = dep.depends_on
        .map((upId) => ({
          domain_id: upId,
          domain_name: domainNames[upId] || upId,
          maturity: scoreMap.get(upId) || 1,
        }))
        .filter((u) => u.maturity < myScore)
        .sort((a, b) => a.maturity - b.maturity);

      const weakestUpstream = dep.depends_on.reduce(
        (min, upId) => Math.min(min, scoreMap.get(upId) || 1),
        5
      );

      // The cascade ceiling is the weakest upstream input + 1 (you can be slightly
      // better than your inputs through good process, but not dramatically)
      const ceiling = Math.min(weakestUpstream + 1, 5);
      const overstated = myScore > ceiling;

      let summary = '';
      if (overstated && upstreamConstraints.length > 0) {
        const weakest = upstreamConstraints[0];
        summary = `${domainNames[dep.domain_id]} is scored at level ${myScore}, but ${weakest.domain_name.toLowerCase()} — a key input — is only at level ${weakest.maturity}. Calculations in this area may be less reliable than the score suggests.`;
      } else if (upstreamConstraints.length > 0) {
        const weakest = upstreamConstraints[0];
        summary = `Constrained by ${weakest.domain_name.toLowerCase()} (level ${weakest.maturity}). Improving that input would strengthen results in this area.`;
      } else {
        summary = 'Upstream inputs are at or above this domain\'s level. No cascade risk identified.';
      }

      return {
        domain_id: dep.domain_id,
        domain_name: domainNames[dep.domain_id] || dep.domain_id,
        effective_maturity: myScore,
        upstream_constraints: upstreamConstraints,
        cascade_ceiling: ceiling,
        overstated,
        summary,
      };
    })
    .filter((cr) => cr.upstream_constraints.length > 0 || cr.overstated);
}

/**
 * Get the top limiting factors across the entire assessment — the domains
 * that constrain the most downstream calculations.
 */
export function getTopLimitingFactors(
  results: DomainAssessment[],
  domainNames: Record<string, string>,
  limit: number = 3
): { domain_id: string; domain_name: string; maturity: number; downstream_count: number; affected: string[] }[] {
  const scoreMap = new Map<string, number>();
  for (const r of results) {
    scoreMap.set(r.domain_id, r.effective_maturity);
  }

  // Count how many downstream domains each low-scoring domain constrains
  const impactMap = new Map<string, string[]>();

  for (const dep of DEPENDENCY_MAP) {
    for (const upId of dep.depends_on) {
      const upScore = scoreMap.get(upId) || 1;
      const downScore = scoreMap.get(dep.domain_id) || 1;
      if (upScore <= 2 || upScore < downScore) {
        if (!impactMap.has(upId)) impactMap.set(upId, []);
        impactMap.get(upId)!.push(dep.domain_id);
      }
    }
  }

  return Array.from(impactMap.entries())
    .map(([domainId, affected]) => ({
      domain_id: domainId,
      domain_name: domainNames[domainId] || domainId,
      maturity: scoreMap.get(domainId) || 1,
      downstream_count: affected.length,
      affected: affected.map((id) => domainNames[id] || id),
    }))
    .sort((a, b) => {
      // Sort by impact (downstream count) descending, then by maturity ascending
      if (b.downstream_count !== a.downstream_count) return b.downstream_count - a.downstream_count;
      return a.maturity - b.maturity;
    })
    .slice(0, limit);
}
