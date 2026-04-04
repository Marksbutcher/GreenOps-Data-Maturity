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
    1: 'You cannot reliably say what assets you have, where they are, or who owns them. Rightsizing, lifecycle costing, supplier negotiations, and capacity planning all depend on this — and right now they are working blind. Orphaned and over-provisioned resources are almost certainly creating hidden waste.',
    2: 'You have partial asset visibility but it is inconsistent across environments. You can produce aggregate counts but cannot reconcile physical and logical estates. Supplier challenges, lifecycle cost models, and refresh planning are all running on incomplete data.',
    3: 'Most environments are inventoried with reasonable detail. Standard reporting and basic lifecycle planning work, but you cannot reliably link assets to services and owners — which limits accountability and service-level optimisation.',
    4: 'Asset data is solid across the estate. Lifecycle costing, capacity planning, and supplier negotiations can use credible evidence. The typical remaining gap is in edge cases: cloud ephemeral resources, shadow IT, and third-party managed estates.',
    5: 'Comprehensive, continuously validated asset data across all environments. Optimisation, lifecycle governance, supplier challenge, and audit traceability are all well supported.',
  },
  operational_power_energy: {
    1: 'You have no reliable energy measurement. Carbon calculations rely on estimates or vendor averages, typically carrying 30–50% uncertainty. You cannot find energy hotspots, validate efficiency investments, or credibly report consumption.',
    2: 'Facility-level energy data exists but breakdown is limited. You can report aggregate consumption but cannot attribute energy to specific systems, zones, or workloads. Efficiency initiatives are hard to prioritise or validate.',
    3: 'Site-level energy data is available with reasonable granularity. Footprint reporting and major consumption areas are visible, but sub-metering gaps limit precision for hotspot identification and workload-level attribution.',
    4: 'Energy measurement is granular and timely — typically sub-metered at zone or rack level. Consumption patterns, PUE validation, and demand-response decisions are all supported. The typical gap is real-time integration with workload scheduling.',
    5: 'Comprehensive real-time energy measurement integrated with workload and capacity systems. Dynamic optimisation, measured efficiency validation, and full energy traceability are all in place.',
  },
  water_data: {
    1: 'No water consumption data is available. Cooling efficiency, water risk exposure, and water stewardship compliance cannot be assessed.',
    2: 'Some facility-level water data exists, but it is aggregate and usually derived from utility bills rather than meters. Enough for basic disclosure, not for finding efficiency gains.',
    3: 'Water data is captured at site level with reasonable frequency. WUE calculations and high-consumption site identification work, but you cannot attribute water use to specific cooling systems or seasonal patterns.',
    4: 'Water measurement is granular — by cooling system or zone. Cooling strategy optimisation, technology comparisons, and water stress scenario planning all use measured data.',
    5: 'Full water lifecycle tracking: supply, treatment, and discharge. Integrated with efficiency metrics and climate risk assessments.',
  },
  infrastructure_efficiency_metrics: {
    1: 'No efficiency metrics are tracked. There is no basis for benchmarking, setting targets, or showing improvement. Any investment case for efficiency rests on vendor promises rather than measured performance.',
    2: 'Basic PUE may be estimated or reported at facility level, but the calculation boundary is unclear, data is infrequent, and there is no breakdown by sub-component. Efficiency claims cannot be trusted.',
    3: 'PUE is calculated consistently at major sites with defined boundaries. You can benchmark against industry averages and set targets, but you cannot tell which sub-systems (cooling, distribution, lighting) are driving overhead.',
    4: 'Multiple efficiency metrics (PUE, WUE, CUE, CLF) are measured with clear boundaries and regular validation. Sub-component analysis is possible, and investment in specific improvements can be justified with measured ROI.',
    5: 'Full efficiency measurement with real-time monitoring, anomaly detection, and integration into operational dashboards. Efficiency is continuously managed, not just measured.',
  },
  embodied_emissions: {
    1: 'Embodied carbon is not tracked. Procurement decisions ignore lifecycle emissions entirely, so the full carbon cost of hardware refresh cycles is invisible.',
    2: 'Some awareness of embodied carbon exists, typically using generic industry averages. Not specific enough to compare suppliers, asset types, or refresh strategies. Scope 3 reporting for this category is highly uncertain.',
    3: 'Product-family level embodied data is available for major asset categories. Reasonable Scope 3 estimates and broad new-versus-refurbished comparisons are possible, but supplier-specific data is limited.',
    4: 'Supplier-specific or product-level embodied data feeds into procurement and refresh decisions. You can model the carbon impact of lifecycle extension versus replacement and factor it into business cases.',
    5: 'Full lifecycle carbon data — manufacturing, transport, use-phase, and end-of-life — is available and integrated into procurement, refresh, and circularity decisions.',
  },
  carbon_factors: {
    1: 'Carbon factors are absent or use a single global average. All downstream carbon calculations carry very high uncertainty and cannot distinguish between locations, time periods, or energy sources.',
    2: 'Basic country or region-level grid factors are applied. Directional carbon estimates are possible but you cannot differentiate between sites in different grids, reflect time-of-day variation, or substantiate market-based claims.',
    3: 'Location-specific grid factors are used and updated periodically. Credible location-based carbon calculations are possible — you can distinguish high and low-carbon sites. Market-based accounting and renewable procurement effects are not yet reflected.',
    4: 'Both location-based and market-based factors are applied. Renewable procurement (PPAs, REGOs, RECs) is reflected in carbon accounting. You can show the carbon impact of energy sourcing decisions and challenge supplier claims.',
    5: 'Marginal emission factors, time-of-use adjustments, and full market-based accounting are integrated. Carbon factors are validated, auditable, and support optimisation including workload scheduling by carbon intensity.',
  },
  utilisation_and_service_usage: {
    1: 'No utilisation data. You have no visibility into how much provisioned capacity is actually used. Expect 40–70% waste from over-provisioning, zombie workloads, and unmanaged demand growth. This is typically the single largest source of hidden cost and carbon.',
    2: 'Some utilisation data exists from basic monitoring, but coverage is patchy and not systematically reviewed. Obvious waste is visible but you cannot quantify the scale or drive systematic rightsizing. Demand growth is ungoverned.',
    3: 'Utilisation is measured across major platforms with reasonable coverage. Under-used resources and waste estimates are available, but the link between the data and remediation action is informal. Rightsizing happens reactively, not through governance.',
    4: 'Comprehensive utilisation monitoring with thresholds and regular review cycles. Rightsizing recommendations are tracked. Demand, capacity, and cost are connected. Demand governance is in place for major platforms.',
    5: 'Real-time utilisation management with automated scaling, demand shaping, and continuous optimisation. Waste is minimised through systematic governance. New demand is assessed for efficiency before provisioning.',
  },
  allocation_attribution: {
    1: 'Carbon and cost cannot be attributed to services, teams, or business units. Overhead is allocated proportionally (if at all) rather than by actual consumption. Accountability is not possible.',
    2: 'Some attribution exists for major cost centres, but it is coarse and often based on proxies (headcount, revenue) rather than consumption. Meaningful chargeback or carbon showback is not possible.',
    3: 'Attribution is established for main platforms and service lines using consumption-based proxies. Directional carbon-per-service estimates are available, but precision varies across the estate.',
    4: 'Consumption-based attribution across most of the estate, linking resource use to services and owners. Carbon showback, FinOps integration, and accountability conversations work with credible data.',
    5: 'Full real-time consumption-based attribution. Carbon and cost move together through the same drivers. Service-level carbon budgets are managed and reviewed.',
  },
  cloud_telemetry: {
    1: 'Cloud resource consumption is not monitored beyond basic billing. You have no visibility into what is provisioned, how it is used, or what the carbon footprint is.',
    2: 'Cloud billing data gives aggregate cost and some resource breakdown, but telemetry is not linked to carbon, utilisation is not systematically reviewed, and many resource types are invisible.',
    3: 'Cloud telemetry covers major services with reasonable granularity. Major cost and consumption patterns are visible, but container workloads, serverless, and multi-cloud environments have gaps.',
    4: 'Comprehensive cloud telemetry covering compute, storage, networking, and managed services. Carbon estimates are derived from provider sustainability data. Cloud FinOps and GreenOps decisions use measured data.',
    5: 'Full cloud observability with real-time carbon-aware workload placement, automated cost-carbon optimisation, and integration across multi-cloud and hybrid environments.',
  },
  colo_provider_data: {
    1: 'No energy or efficiency data from colocation providers. You are entirely dependent on provider claims with no way to validate, challenge, or compare. Scope 3 reporting for hosted infrastructure is guesswork.',
    2: 'Some data is received — typically quarterly PUE or aggregate energy from provider reports. Quality, timeliness, and granularity are unclear. You cannot verify methodology or allocate consumption to your footprint.',
    3: 'Structured data sharing is in place with major providers. You receive facility-level metrics on a regular schedule and can factor them into carbon calculations, though granularity to your specific allocation is limited.',
    4: 'Provider data is detailed, timely, and aligned to your allocation. Contractual SLAs cover data quality and frequency. You can validate provider efficiency claims and use the data in procurement decisions.',
    5: 'Full transparency with real-time data feeds, granular allocation, and contractual obligations for continuous improvement. Provider data is integrated into your own systems and supports active performance management.',
  },
  temporal_timeliness: {
    1: 'Data is available only annually or quarterly. You cannot spot trends, seasonal patterns, or respond to changing conditions within a reporting period. Decision-makers always work with stale information.',
    2: 'Monthly or quarterly data is available in some areas. Broad trends over time are visible, but operational decisions needing weekly or daily data are not supported. Problems are found long after they start.',
    3: 'Monthly data is standard across most domains, with some daily granularity for key metrics. Periodic reporting and trend analysis work; real-time operational decisions and anomaly detection do not.',
    4: 'Daily or sub-daily data is available for key operational metrics. Demand-response decisions, prompt anomaly detection, and within-period trend reporting are all supported. Operational teams can act on current information.',
    5: 'Real-time or near-real-time data across all key domains. Dynamic optimisation, automated responses, and continuous improvement are supported. Data freshness is actively managed.',
  },
  lineage_assurance: {
    1: 'No traceability of data sources, transformations, or quality. You cannot explain how any number was derived, which means every figure is challengeable and no metric is auditable. This is a serious governance risk.',
    2: 'Some documentation of data sources exists but it is informal, incomplete, and not maintained. You can explain major data flows when asked, but there is no systematic audit trail. External challenge would expose gaps quickly.',
    3: 'Data lineage is documented for the main reporting pipelines. Sources, transformations, and assumptions are recorded. Audit queries can be answered, but the process is manual and depends on key individuals.',
    4: 'Systematic lineage tracking across main data flows with regular validation. Assumptions are documented and reviewed. Internal and external audit can be supported with a clear evidence trail.',
    5: 'Full automated lineage from source to report with version control, validation rules, and exception handling. External assurance is achievable. Any stakeholder can trace any number to its source.',
  },
  decision_integration: {
    1: 'No regular management reporting on energy, emissions, or efficiency across IT. Where environmental data exists, it is not reaching decision-makers or influencing operational or investment choices.',
    2: 'Some reporting exists but it is infrequent, narrowly distributed, and not connected to operations. Data may appear in an annual sustainability report but does not feed into infrastructure, procurement, or capacity decisions.',
    3: 'Regular reporting covers some areas — typically the main data centre or largest cloud accounts. Reports reach infrastructure leads but not consistently finance, procurement, or senior leadership. Actions are ad-hoc.',
    4: 'Structured reporting covers most of the estate with defined cadence, scope, and distribution. The right decision-makers receive reports, and there is a process for turning findings into actions with named owners. Outcome tracking is starting.',
    5: 'Comprehensive, multi-cadence reporting embedded in operational governance. Environmental and efficiency data is treated with the same discipline as financial reporting — targets, accountability, variance analysis, and closed-loop improvement.',
  },
};

/* ─── Risk framing by maturity ─── */
function getRiskStatement(domain: Domain, maturity: number, weakDimNames: string[]): string {
  if (maturity <= 1) {
    const weakNote = weakDimNames.length > 0
      ? ` Weakest areas: ${weakDimNames.join(', ')}.`
      : '';
    return `Critical gap: ${domain.name} data is absent or unreliable. Decisions here are based on assumptions, not evidence. Reported figures should be treated as indicative at best. This needs ownership and priority — it is a governance issue, not just a data one.${weakNote}`;
  }
  if (maturity === 2) {
    const weakNote = weakDimNames.length > 0
      ? ` Particular weakness in ${weakDimNames.join(' and ')}.`
      : '';
    return `Significant gap: ${domain.name} data is partial and inconsistent. It supports basic reporting but not confident decisions. The organisation is likely acting on weaker evidence than it realises in this area.${weakNote}`;
  }
  if (maturity === 3) {
    return `Moderate gap: ${domain.name} data works for periodic reporting but lacks the precision or timeliness for active management. You can report on the past but cannot optimise in real time.`;
  }
  if (maturity === 4) {
    return `Minor gap: ${domain.name} data is decision-grade for most purposes. Remaining risks are typically edge cases — newer platforms, real-time availability, or end-to-end auditability. Focus on sustaining quality and extending to emerging areas.`;
  }
  return `${domain.name} data is mature and embedded in operations. The priority is maintaining quality as the estate evolves and demonstrating value through outcomes.`;
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
      parts.push('Weak coverage combined with weak attribution means you cannot tell where resources are consumed or by whom — blocking both hotspot analysis and accountability.');
    } else if (weakSet.has('coverage')) {
      parts.push('Weak coverage means parts of your estate are invisible. You may be optimising what you can see while missing bigger problems elsewhere.');
    } else if (weakSet.has('attribution')) {
      parts.push('Weak attribution means you can measure totals but cannot link consumption to services or owners, which blocks chargeback, showback, and accountability.');
    }
    if (weakSet.has('assurance_lineage') || weakSet.has('method_quality')) {
      parts.push('Weak assurance or method quality means your figures may not survive external challenge — a risk for regulatory disclosure or investment justification.');
    }
    if (weakSet.has('temporal_resolution') || weakSet.has('timeliness')) {
      parts.push('Weak temporal resolution limits your ability to spot trends, respond to anomalies, or make real-time operational decisions.');
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
        const nextLevel = Math.min(result.effective_maturity + 1, 5);
        const nextDs = domain.decision_support_by_score[String(nextLevel)];
        if (nextDs) {
          const newCaps = nextDs.supports.filter(s => !ds.supports.includes(s)).join('; ');
          if (newCaps) {
            dsSummary += ` Reaching level ${nextLevel} would also support: ${newCaps}.`;
          }
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
