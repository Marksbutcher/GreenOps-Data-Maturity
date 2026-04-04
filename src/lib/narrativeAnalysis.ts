import { DomainAssessment, MaturityModel, Domain } from '../types';

export interface DomainNarrative {
  domain_id: string;
  domain_name: string;
  maturity_level: string;
  maturity_label: string;
  score_explanation: string;
  dimension_analysis: string;
  decision_support_summary: string;
  improvement_guidance: string;
  weakness_flags: string[];
  operational_impact: string;
  risk_statement: string;
}

/* ─── Domain-specific operational context ─── */
const OPERATIONAL_CONTEXT: Record<string, Record<number, string>> = {
  asset_inventory_configuration: {
    1: 'Your estate visibility is critically weak. You cannot reliably identify what assets you have, where they are, or who owns them. This blocks rightsizing, lifecycle cost allocation, supplier negotiations, and any credible capacity planning. Expect significant hidden waste from orphaned and over-provisioned resources.',
    2: 'You have partial asset visibility but coverage is inconsistent across environments. You can produce aggregate asset counts but cannot reliably reconcile physical and logical estates. Supplier challenge conversations, lifecycle cost modelling, and refresh planning are operating on incomplete data.',
    3: 'Most environments are inventoried with reasonable detail. You can support standard reporting and basic lifecycle planning, but gaps in attribution (linking assets to services and owners) limit your ability to drive accountability or optimise at service level.',
    4: 'Asset data is measured and managed across the estate with good coverage. You can support lifecycle costing, capacity planning, and supplier negotiations with credible evidence. The remaining gap is typically in edge cases — cloud ephemeral resources, shadow IT, and third-party managed estates.',
    5: 'Comprehensive, continuously validated asset data across all environments. You can drive optimisation decisions, automate lifecycle governance, challenge supplier claims, and demonstrate full traceability for audit purposes.',
  },
  operational_power_energy: {
    1: 'You have no reliable energy measurement. Any carbon calculations are based on estimates or vendor averages, which typically carry 30-50% uncertainty. You cannot identify energy hotspots, validate efficiency investments, or credibly report energy consumption.',
    2: 'Facility-level energy data exists but breakdown is limited. You can report aggregate consumption but cannot attribute energy to specific systems, zones, or workloads. Efficiency initiatives are difficult to prioritise or validate.',
    3: 'Site-level energy data is available with reasonable granularity. You can support footprint reporting and identify major consumption areas, but sub-metering gaps limit precision in hotspot identification and workload-level attribution.',
    4: 'Energy measurement is granular and timely, typically with sub-metering at zone or rack level. You can identify consumption patterns, validate PUE calculations, and support demand-response decisions. The remaining gap is typically real-time integration with workload scheduling.',
    5: 'Comprehensive, real-time energy measurement integrated with workload and capacity systems. You can optimise dynamically, validate all efficiency claims with measured data, and demonstrate full energy traceability.',
  },
  water_data: {
    1: 'No water consumption data is available. You cannot assess cooling efficiency, water risk exposure, or compliance with water stewardship commitments.',
    2: 'Some facility-level water data exists, but it is aggregate and often derived from utility bills rather than metering. Sufficient for basic disclosure but not for identifying efficiency opportunities.',
    3: 'Water data is captured at site level with reasonable frequency. You can support WUE calculations and identify high-consumption facilities, but cannot attribute water use to specific cooling systems or seasonal patterns.',
    4: 'Water measurement is granular, covering consumption by cooling system or zone. You can optimise cooling strategies, compare technologies, and plan for water stress scenarios with measured data.',
    5: 'Full water lifecycle tracking including supply, treatment, and discharge. Integrated with efficiency metrics and climate risk assessments.',
  },
  infrastructure_efficiency_metrics: {
    1: 'No efficiency metrics are tracked. You have no basis for benchmarking, target-setting, or demonstrating improvement. Investment cases for efficiency rely on vendor promises rather than measured performance.',
    2: 'Basic PUE may be estimated or reported at facility level, but the calculation boundary is unclear, data is infrequent, and there is no breakdown into sub-components. Any efficiency claims are unreliable.',
    3: 'PUE is calculated consistently at major sites with defined boundaries. You can benchmark against industry averages and set improvement targets, but cannot identify which sub-systems (cooling, distribution, lighting) are driving overhead.',
    4: 'Multiple efficiency metrics (PUE, WUE, CUE, CLF) are measured with clear boundaries and regular validation. Sub-component analysis is possible. You can justify investment in specific efficiency improvements with measured ROI.',
    5: 'Full efficiency measurement suite with real-time monitoring, anomaly detection, and integration into operational dashboards. Efficiency is continuously optimised, not just measured.',
  },
  embodied_emissions: {
    1: 'Embodied carbon is not tracked. Procurement decisions are made without any consideration of lifecycle emissions, meaning the full carbon impact of hardware refresh cycles is invisible.',
    2: 'Some awareness of embodied carbon exists, typically using generic industry averages. Not specific enough to compare suppliers, asset types, or refresh strategies. Scope 3 reporting for this category is highly uncertain.',
    3: 'Product-family level embodied data is available for major asset categories. You can produce reasonable Scope 3 estimates and make broad comparisons between new and refurbished options, but supplier-specific data is limited.',
    4: 'Supplier-specific or product-level embodied data is used in procurement and refresh decisions. You can model the carbon impact of lifecycle extension versus replacement and factor this into business cases.',
    5: 'Full lifecycle carbon data including manufacturing, transport, use-phase, and end-of-life is available and integrated into procurement, refresh, and circularity decisions.',
  },
  carbon_factors: {
    1: 'Carbon factors are absent or use single global averages. Any carbon calculations carry very high uncertainty and cannot distinguish between locations, time periods, or energy sources. This undermines the credibility of all downstream carbon reporting.',
    2: 'Basic country or region-level grid factors are applied. You can produce directional carbon estimates but cannot differentiate between sites in different grids, time-of-day variation, or renewable energy procurement effects. Market-based claims are not substantiated.',
    3: 'Location-specific grid factors are used and updated periodically. You can produce credible location-based carbon calculations and distinguish between high and low-carbon sites. However, market-based accounting and renewable procurement effects are not yet reflected.',
    4: 'Both location-based and market-based factors are applied. Renewable energy procurement (PPAs, REGOs, RECs) is reflected in carbon accounting. You can demonstrate the carbon impact of energy sourcing decisions and challenge supplier claims with evidence.',
    5: 'Marginal emission factors, time-of-use adjustments, and full market-based accounting are integrated. Carbon factors are validated, auditable, and support optimisation decisions including workload scheduling by carbon intensity.',
  },
  utilisation_and_service_usage: {
    1: 'No utilisation data is available. You have no visibility into how much of your provisioned capacity is actually being used. Expect 40-70% waste from over-provisioning, zombie workloads, and unmanaged demand growth. This is typically the single largest source of hidden cost and carbon.',
    2: 'Some utilisation data exists, typically from basic monitoring tools, but coverage is patchy and not systematically reviewed. You can identify obvious waste but cannot quantify the scale or drive systematic rightsizing. Demand growth is not governed.',
    3: 'Utilisation is measured across major platforms with reasonable coverage. You can identify under-used resources and estimate waste, but the link between utilisation data and remediation action is informal. Rightsizing happens reactively rather than through governance.',
    4: 'Comprehensive utilisation monitoring with established thresholds and regular review cycles. Rightsizing recommendations are generated and tracked. The connection between demand, capacity, and cost is managed. Demand governance is in place for major platforms.',
    5: 'Real-time utilisation management with automated scaling, demand shaping, and continuous optimisation. Waste is minimised through systematic governance. New demand is assessed for efficiency before provisioning.',
  },
  allocation_attribution: {
    1: 'Carbon and cost cannot be attributed to services, teams, or business units. You are allocating overhead proportionally (if at all) rather than based on actual consumption. Accountability is impossible.',
    2: 'Some attribution exists for major cost centres, but it is coarse and often based on proxies (headcount, revenue) rather than actual resource consumption. Cannot support meaningful chargeback or carbon showback.',
    3: 'Attribution is established for the main platforms and service lines using reasonable consumption-based proxies. You can produce directional carbon-per-service estimates but precision varies significantly across the estate.',
    4: 'Attribution is consumption-based across most of the estate, linking resource use to services and owners. You can support carbon showback, FinOps integration, and accountability conversations with credible data.',
    5: 'Full attribution with real-time consumption-based allocation. Carbon and cost move together through the same drivers. Service-level carbon budgets are managed and reviewed.',
  },
  cloud_telemetry: {
    1: 'Cloud resource consumption is not monitored beyond basic billing. You have no visibility into what resources are provisioned, how they are used, or what their carbon footprint is.',
    2: 'Cloud billing data provides aggregate cost and some resource breakdown, but telemetry is not linked to carbon, utilisation is not systematically reviewed, and many resource types are invisible.',
    3: 'Cloud telemetry covers the major services with reasonable granularity. You can identify major cost and resource consumption patterns, but container workloads, serverless, and multi-cloud environments have gaps.',
    4: 'Comprehensive cloud telemetry including compute, storage, networking, and managed services. Carbon estimates are derived from provider sustainability data. You can support cloud FinOps and GreenOps decisions with measured data.',
    5: 'Full cloud observability with real-time carbon-aware workload placement, automated cost-carbon optimisation, and integration across multi-cloud and hybrid environments.',
  },
  colo_provider_data: {
    1: 'No energy or efficiency data from colocation providers. You are entirely dependent on provider claims with no ability to validate, challenge, or compare. Scope 3 reporting for hosted infrastructure is guesswork.',
    2: 'Some data is received, typically quarterly PUE or aggregate energy consumption from provider reports. Quality, timeliness, and granularity are unclear. You cannot verify the methodology or allocate consumption to your footprint.',
    3: 'Structured data sharing is in place with major colocation providers. You receive facility-level metrics on a regular schedule and can factor them into carbon calculations, though granularity to your specific allocation remains limited.',
    4: 'Provider data is detailed, timely, and aligned to your allocated space. Contractual SLAs cover data quality and reporting frequency. You can validate provider efficiency claims against your own measurements and use data in procurement decisions.',
    5: 'Full transparency with real-time data feeds, granular allocation, and contractual obligations for continuous improvement. Provider data is integrated into your own operational systems and supports active provider performance management.',
  },
  temporal_timeliness: {
    1: 'Data is available only at annual or quarterly frequency. You cannot identify trends, seasonal patterns, or respond to changing conditions within any reporting period. Decision-makers are always working with stale information.',
    2: 'Monthly or quarterly data is available for some domains. You can identify broad trends over time but cannot support operational decisions that require weekly or daily granularity. Problems are identified long after they start.',
    3: 'Monthly data is standard across most domains with some daily granularity for key metrics. Sufficient for periodic reporting and trend analysis but not for real-time operational decisions or anomaly detection.',
    4: 'Daily or sub-daily data is available for key operational metrics. You can support demand-response decisions, identify anomalies promptly, and demonstrate trends within reporting periods. Operational teams can act on current information.',
    5: 'Real-time or near-real-time data across all key domains. Supports dynamic optimisation, automated responses, and continuous operational improvement. Data freshness is a managed attribute.',
  },
  lineage_assurance: {
    1: 'No traceability of data sources, transformations, or quality. You cannot explain how any number was derived, which means any figure is challengeable and no metric is auditable. This is a material governance risk.',
    2: 'Some documentation of data sources exists but it is informal, incomplete, and not maintained. You can explain major data flows when asked but cannot demonstrate a systematic audit trail. External challenge would expose gaps.',
    3: 'Data lineage is documented for the main reporting pipelines. Sources, transformations, and assumptions are recorded. You can respond to audit queries but the process is manual and dependent on key individuals.',
    4: 'Systematic lineage tracking across the main data flows with regular validation. Assumptions are documented and reviewed. You can support internal and external audit with a clear evidence trail.',
    5: 'Full automated lineage from source to report with version control, validation rules, and exception handling. External assurance is achievable. Any stakeholder can trace any number to its source.',
  },
  decision_integration: {
    1: 'No regular management reporting exists for energy, emissions or efficiency across the IT estate. Environmental data, where it exists, is not reaching decision-makers and is not influencing operational or investment priorities.',
    2: 'Some reporting exists but it is infrequent, narrowly distributed, and not connected to operational processes. Data may appear in an annual sustainability report but does not inform infrastructure, procurement, or capacity decisions.',
    3: 'Regular reporting is in place for some areas, typically the main data centre or largest cloud accounts. Reports reach infrastructure leads but not consistently finance, procurement, or senior leadership. Actions are taken ad-hoc rather than through a structured process.',
    4: 'Structured reporting covers most of the estate with defined cadence, scope, and distribution. Reports reach the right decision-makers and there is a process for turning findings into actions with named ownership. Outcomes are beginning to be tracked.',
    5: 'Comprehensive, multi-cadence reporting embedded in operational governance. Environmental and efficiency data is treated with the same rigour as financial reporting — with targets, accountability, variance analysis, and closed-loop improvement tracking.',
  },
};

/* ─── Risk framing by maturity ─── */
function getRiskStatement(domain: Domain, maturity: number, weakDimNames: string[]): string {
  if (maturity <= 1) {
    return `Critical gap: ${domain.name} data is absent or unreliable. Decisions in this area are based on assumptions rather than evidence. This creates material exposure across regulatory disclosure, investment justification, and supplier negotiations. Any reported figures in this domain should be treated as indicative at best. Leadership should treat this as a priority governance issue, not a technical backlog item.`;
  }
  if (maturity === 2) {
    const weakNote = weakDimNames.length > 0
      ? ` Particular exposure in ${weakDimNames.join(' and ')}, which limits both operational and governance use.`
      : '';
    return `Significant gap: ${domain.name} data is partial and inconsistent. Data supports basic reporting but not confident operational decisions. Over-reliance on this data for investment or compliance purposes carries material risk. The organisation is likely making decisions in this area that are not supported by the evidence quality available.${weakNote}`;
  }
  if (maturity === 3) {
    return `Moderate gap: ${domain.name} data is adequate for periodic reporting but lacks the precision, coverage, or timeliness needed for operational management. You can report retrospectively but cannot optimise proactively. The gap between what is reported and what is operationally actionable should be made explicit to stakeholders.`;
  }
  if (maturity === 4) {
    return `Minor gap: ${domain.name} data is strong and decision-grade for most purposes. Remaining risks are typically in edge cases — coverage of newer platforms, real-time availability, or end-to-end auditability. Focus should be on sustaining quality and extending coverage to emerging estate areas.`;
  }
  return `${domain.name} data is mature and operationally embedded. The priority is maintaining governance discipline, validating continued quality as the estate evolves, and demonstrating value through operational outcomes.`;
}

/* ─── Dimension diagnosis ─── */
function buildDimensionAnalysis(
  dimEntries: [string, number][],
  domainName: string
): string {
  if (dimEntries.length === 0) {
    return 'No dimension scores available — assessment may be incomplete.';
  }

  const weakDims = dimEntries.filter(([, s]) => s <= 2.5).sort((a, b) => a[1] - b[1]);
  const strongDims = dimEntries.filter(([, s]) => s >= 3.5).sort((a, b) => b[1] - a[1]);
  const midDims = dimEntries.filter(([, s]) => s > 2.5 && s < 3.5);

  const parts: string[] = [];

  if (strongDims.length > 0) {
    parts.push(
      `Strongest dimensions: ${strongDims.map(([d, s]) => `${d.replace(/_/g, ' ')} (${s.toFixed(1)})`).join(', ')}.`
    );
  }

  if (weakDims.length > 0) {
    const weakNames = weakDims.map(([d, s]) => `${d.replace(/_/g, ' ')} (${s.toFixed(1)})`).join(', ');
    parts.push(`Weakest dimensions: ${weakNames}.`);

    // Diagnose interaction effects
    const weakSet = new Set(weakDims.map(([d]) => d));
    if (weakSet.has('coverage') && weakSet.has('attribution')) {
      parts.push('Weak coverage combined with weak attribution means you cannot identify where resources are consumed or by whom — this blocks both hotspot analysis and accountability.');
    } else if (weakSet.has('coverage')) {
      parts.push('Weak coverage means significant parts of your estate are invisible. You may be optimising what you can see while missing larger problems elsewhere.');
    } else if (weakSet.has('attribution')) {
      parts.push('Weak attribution means you can measure totals but cannot link consumption to services or owners, which blocks chargeback, showback, and accountability.');
    }
    if (weakSet.has('assurance_lineage') || weakSet.has('method_quality')) {
      parts.push('Weak assurance or method quality means your figures may not survive external challenge — a significant risk for regulatory disclosure or investment justification.');
    }
    if (weakSet.has('temporal_resolution') || weakSet.has('timeliness')) {
      parts.push('Weak temporal resolution limits your ability to detect trends, respond to anomalies, or support real-time operational decisions.');
    }
  }

  if (midDims.length > 0 && weakDims.length === 0) {
    parts.push('All dimensions are at a moderate level — no severe weaknesses, but broad improvement needed to reach decision-grade quality across the board.');
  }

  return parts.join(' ');
}

/* ─── Main export ─── */
export function generateDomainNarratives(
  results: DomainAssessment[],
  model: MaturityModel
): DomainNarrative[] {
  return results.map((result) => {
    const domain = model.domains.find((d) => d.id === result.domain_id);
    if (!domain) {
      return {
        domain_id: result.domain_id,
        domain_name: result.domain_id,
        maturity_level: '1',
        maturity_label: 'Unknown',
        score_explanation: 'Domain not found in model.',
        dimension_analysis: '',
        decision_support_summary: '',
        improvement_guidance: '',
        weakness_flags: [],
        operational_impact: '',
        risk_statement: '',
      };
    }

    const level = String(result.effective_maturity);
    const maturityInfo = domain.maturity_levels[level];
    const maturityLabel = maturityInfo ? maturityInfo.label : 'Unknown';
    const maturityDesc = maturityInfo ? maturityInfo.description : '';

    // Score explanation with context
    const overrideNote =
      result.assessor_override !== null
        ? ` (assessor override applied; calculated score was ${result.calculated_maturity})`
        : '';
    const flagNote =
      result.weakness_flags.length > 0 ? ` Caveats: ${result.weakness_flags.join('; ')}.` : '';
    const scoreExplanation = `Assessed at level ${result.effective_maturity} — ${maturityDesc}${overrideNote}.${flagNote}`;

    // Dimension analysis with diagnosis
    const dimEntries = Object.entries(result.dimension_scores);
    const weakDimNames = dimEntries
      .filter(([, s]) => s <= 2.5)
      .map(([d]) => d.replace(/_/g, ' '));
    const dimAnalysis = buildDimensionAnalysis(dimEntries, domain.name);

    // Operational impact from domain-specific context
    const domainContext = OPERATIONAL_CONTEXT[domain.id];
    const operationalImpact = domainContext
      ? domainContext[result.effective_maturity] || ''
      : '';

    // Risk statement
    const riskStatement = getRiskStatement(domain, result.effective_maturity, weakDimNames);

    // Decision support — what you can and cannot do
    const ds = domain.decision_support_by_score[level];
    let dsSummary = '';
    if (ds) {
      if (ds.supports.length > 0) {
        dsSummary = `At level ${result.effective_maturity}, your data supports: ${ds.supports.join('; ')}. `;
      }
      if (ds.does_not_support.length > 0 && !ds.does_not_support[0].startsWith('None')) {
        dsSummary += `Not yet sufficient for: ${ds.does_not_support.join('; ')}.`;
        // Add remediation hint
        const nextLevel = Math.min(result.effective_maturity + 1, 5);
        const nextDs = domain.decision_support_by_score[String(nextLevel)];
        if (nextDs) {
          dsSummary += ` Reaching level ${nextLevel} would additionally support: ${nextDs.supports.filter(s => !ds.supports.includes(s)).join('; ') || 'refinement of existing capabilities'}.`;
        }
      }
    }

    // Improvement guidance — triggered recommendations plus sequencing
    const triggered = domain.recommendation_triggers.filter((t) => {
      if (t.if_maturity_lte !== undefined && result.effective_maturity <= t.if_maturity_lte) return true;
      if (t.if_maturity_equals !== undefined && result.effective_maturity === t.if_maturity_equals) return true;
      if (t.if_maturity_gte !== undefined && result.effective_maturity >= t.if_maturity_gte) return true;
      return false;
    });

    let guidance = triggered.map((t) => t.guidance).join(' ');
    if (!guidance) {
      if (result.effective_maturity >= 4) {
        guidance = `${domain.name} is at a mature level. Focus on maintaining data quality, extending automation, and ensuring governance processes keep pace with estate changes.`;
      } else {
        guidance = `Prioritise closing the gap in ${domain.name.toLowerCase()} to unlock stronger operational decisions. Focus first on the weakest dimensions identified above.`;
      }
    }

    // Add dimension-specific guidance for weak areas
    if (weakDimNames.length > 0 && result.effective_maturity <= 3) {
      guidance += ` The weakest dimensions (${weakDimNames.join(', ')}) should be addressed first as they constrain the effective maturity of the entire domain.`;
    }

    return {
      domain_id: domain.id,
      domain_name: domain.name,
      maturity_level: level,
      maturity_label: maturityLabel,
      score_explanation: scoreExplanation,
      dimension_analysis: dimAnalysis,
      decision_support_summary: dsSummary,
      improvement_guidance: guidance,
      weakness_flags: result.weakness_flags,
      operational_impact: operationalImpact,
      risk_statement: riskStatement,
    };
  });
}
