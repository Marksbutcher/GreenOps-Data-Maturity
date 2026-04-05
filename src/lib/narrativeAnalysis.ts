import { DomainAssessment, MaturityModel, Domain, MATURITY_LABELS } from '../types';
import { DEPENDENCY_MAP } from './dependencyChain';

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
  cascade_note: string;
  misinterpretation_risk: string;
  cross_domain_diagnosis: string;
}

/* ─── Domain-specific operational context ─── */
const OPERATIONAL_CONTEXT: Record<string, Record<number, string>> = {
  asset_inventory_configuration: {
    1: 'You cannot say what assets you have, where they sit, or who owns them. Rightsizing, lifecycle costing, and capacity planning all run blind. Orphaned servers, forgotten cloud instances, and over-provisioned storage create hidden waste that no one can quantify. Embodied emissions calculations have no denominator. Supplier negotiations lack basic estate facts.',
    2: 'Partial asset visibility exists but gaps between physical, virtual, and cloud estates make reconciliation unreliable. You can produce aggregate counts but cannot link assets to services or owners. Refresh planning uses incomplete data. Supplier challenges lack the detail to hold providers to account. Scope 3 hardware emissions rely on rough estimates because you cannot match assets to product-level embodied carbon data.',
    3: 'Major environments are inventoried with standard fields. Basic lifecycle planning and reporting work. The gap is linking assets to services and business owners, which blocks per-service carbon attribution and limits accountability. Edge estates (branch offices, shadow IT, contractor devices) are likely under-counted.',
    4: 'Asset data covers the estate with consistent detail. Lifecycle costing, capacity planning, and supplier negotiations use credible evidence. Typical remaining gaps: cloud ephemeral resources, shadow IT, and third-party managed estates where provider data feeds are incomplete.',
    5: 'Comprehensive, continuously validated asset data across all environments. Lifecycle governance, supplier challenge, audit traceability, and per-asset embodied carbon tracking all work from a single source of truth.',
  },
  operational_power_energy: {
    1: 'No reliable energy measurement exists. Carbon calculations rely on vendor averages or billing proxies, typically carrying 30-50% uncertainty. You cannot find energy hotspots, validate efficiency investments, or credibly report consumption. Any PUE figure is a guess. Power capacity planning uses nameplate ratings rather than measured draw, leading to stranded capacity or unexpected constraints.',
    2: 'Facility-level energy data exists from utility meters or BMS, but breakdown by zone, rack, or system is limited. You can report aggregate consumption but cannot attribute energy to specific workloads or business units. Efficiency initiatives cannot be validated after implementation because you have no baseline at the right granularity. The gap between IT load and total facility load remains opaque.',
    3: 'Site-level energy data is available with reasonable granularity. PUE calculations and major consumption areas are visible. Sub-metering gaps limit precision for hotspot identification and workload-level attribution. You can report energy trends but cannot connect energy consumption to specific services or cost centres with confidence.',
    4: 'Energy measurement is granular and timely, typically sub-metered at zone or rack level. PUE validation, demand-response decisions, and cooling optimisation all use measured data. The typical gap is real-time integration with workload scheduling and carbon-aware operations.',
    5: 'Comprehensive real-time energy measurement integrated with workload and capacity systems. Dynamic optimisation, measured efficiency validation, and full energy traceability are in place. Energy data feeds directly into operational and financial governance.',
  },
  water_data: {
    1: 'No water consumption data exists. You cannot assess cooling efficiency, water risk exposure, or water stewardship compliance. WUE is not calculable. Sites in water-stressed regions carry unquantified risk that will become material as regulation tightens.',
    2: 'Facility-level water data exists, usually from utility bills rather than meters. Enough for basic disclosure but not for finding efficiency gains. You cannot distinguish between cooling tower consumption, humidification, and domestic use. Seasonal variation and leak detection are invisible.',
    3: 'Water data is captured at site level with reasonable frequency. WUE calculations and high-consumption site identification work. You cannot attribute water use to specific cooling systems or seasonal patterns, limiting optimisation to broad site-level actions.',
    4: 'Water measurement is granular by cooling system or zone. Cooling strategy optimisation, technology comparisons, and water stress scenario planning all use measured data. Free cooling hours and water treatment efficiency are visible.',
    5: 'Full water lifecycle tracking: supply, treatment, and discharge. Integrated with efficiency metrics and climate risk assessments. Water consumption links to workload and thermal demand.',
  },
  infrastructure_efficiency_metrics: {
    1: 'No efficiency metrics are tracked. You have no basis for benchmarking, setting targets, or demonstrating improvement. Investment cases for cooling or power distribution upgrades rest on vendor promises rather than measured performance. PUE, WUE, and CUE are absent or meaningless.',
    2: 'Basic PUE may be estimated at facility level, but the calculation boundary is unclear, data is infrequent, and sub-component breakdown does not exist. A single PUE number hides whether the problem is cooling, power distribution, lighting, or IT load factor. Efficiency claims cannot be verified or compared across sites.',
    3: 'PUE is calculated consistently at major sites with defined boundaries. You can benchmark against industry averages and set targets. You cannot determine which sub-systems (cooling, UPS losses, distribution) drive overhead, which limits the precision of investment cases for specific improvements.',
    4: 'Multiple efficiency metrics (PUE, WUE, CUE, CLF) are measured with clear boundaries and regular validation. Sub-component analysis identifies where overhead sits. Investment in specific improvements can be justified with measured ROI. CER (Carbon Efficiency Ratio) links efficiency to emissions outcomes.',
    5: 'Full efficiency measurement with real-time monitoring, anomaly detection, and integration into operational dashboards. Efficiency is continuously managed. Seasonal variation, load-dependent behaviour, and infrastructure degradation are all visible and acted on.',
  },
  embodied_emissions: {
    1: 'Embodied carbon is not tracked. Procurement ignores lifecycle emissions, so the full carbon cost of hardware refresh cycles is invisible. A typical server refresh decision involves 1-2 tonnes of embodied CO2 per unit that never appears in any business case. Scope 3 Category 2 reporting is guesswork. Extending asset life by one year could save more carbon than a year of energy efficiency work, but you have no data to prove it.',
    2: 'Some awareness of embodied carbon exists, typically using generic industry averages (e.g. "a server is roughly 1 tonne CO2e"). Not specific enough to compare suppliers, asset types, or refresh strategies. A refurbished server versus a new one looks identical in your data. Scope 3 reporting for purchased goods carries high uncertainty that you cannot quantify or explain.',
    3: 'Product-family level embodied data covers major asset categories. Broad new-versus-refurbished comparisons are possible. You can produce credible Scope 3 estimates for major hardware categories. Supplier-specific data is limited, which means procurement cannot differentiate between vendors on embodied carbon grounds.',
    4: 'Supplier-specific or product-level embodied data feeds into procurement and refresh decisions. You can model the carbon trade-off of lifecycle extension versus replacement and factor it into business cases. Circular economy metrics (reuse rate, refurbishment %, ITAD recovery) are tracked.',
    5: 'Full lifecycle carbon data covering manufacturing, transport, use-phase, and end-of-life. Integrated into procurement scoring, refresh governance, and circularity reporting. Product-level data from suppliers is contractually required and validated.',
  },
  carbon_factors: {
    1: 'Carbon factors are absent or use a single global or national average. All downstream carbon calculations carry high uncertainty. A grid-average factor can be off by 2-5x compared to the actual marginal emission rate at the time and place of consumption. You cannot distinguish between a site powered by renewables and one running on coal. Renewable procurement (PPAs, REGOs, RECs) is invisible in your carbon numbers.',
    2: 'Country or region-level grid factors are applied. Directional carbon estimates are possible but you cannot differentiate between sites on different grids, reflect time-of-day variation, or show the impact of renewable energy procurement. Market-based and location-based accounting produce the same number because the data does not distinguish them. Carbon reduction from green tariffs or PPAs cannot be evidenced.',
    3: 'Location-specific grid factors are used and updated periodically. Credible location-based carbon calculations distinguish high and low-carbon sites. Market-based accounting and renewable procurement effects are not yet reflected, which means your reported emissions may overstate or understate your actual position depending on energy sourcing.',
    4: 'Both location-based and market-based factors are applied. Renewable procurement (PPAs, REGOs, RECs) is reflected in carbon accounting. You can show the carbon impact of energy sourcing decisions and challenge supplier green energy claims. Residual mix factors are used where appropriate.',
    5: 'Marginal emission factors, time-of-use adjustments, and full market-based accounting are integrated. Carbon factors are validated, auditable, and support carbon-aware workload scheduling. You can demonstrate the carbon impact of shifting load between time periods and locations.',
  },
  utilisation_and_service_usage: {
    1: 'No utilisation data exists. You cannot see how much provisioned capacity is used. Industry benchmarks suggest 15-30% average server utilisation in estates without active management. The gap between provisioned and consumed resources is the single largest source of hidden cost and carbon in most technology estates. Every idle CPU cycle burns energy and generates emissions for zero business value.',
    2: 'Some utilisation data exists from basic monitoring, but coverage is patchy and not reviewed systematically. Obvious waste is visible on individual systems but you cannot quantify the scale across the estate or drive systematic rightsizing. Demand growth goes ungoverned because you lack the baseline to challenge new requests against actual consumption.',
    3: 'Utilisation is measured across major platforms with reasonable coverage. Under-used resources and waste estimates are available. The link between the data and remediation action is informal. Rightsizing happens reactively when someone notices, not through governance. Demand management policies exist on paper but lack the consumption evidence to enforce them.',
    4: 'Comprehensive utilisation monitoring with thresholds and regular review cycles. Rightsizing recommendations are tracked and acted on. Demand, capacity, and cost are connected. New demand is assessed against actual consumption before provisioning. Waste reduction has named owners and measurable targets.',
    5: 'Real-time utilisation management with automated scaling, demand shaping, and continuous optimisation. Waste is minimised through systematic governance. Capacity planning uses measured demand trends rather than requested headroom.',
  },
  allocation_attribution: {
    1: 'Carbon and cost cannot be attributed to services, teams, or business units. Overhead is allocated by headcount or revenue if at all. No one owns their consumption because no one can see it. Without attribution, demand management is impossible and efficiency improvements benefit the estate but have no accountable owner.',
    2: 'Some attribution exists for major cost centres, but it uses proxies (headcount, revenue, floor space) rather than consumption data. Chargeback or carbon showback produces numbers that teams cannot act on because the allocation method does not reflect their actual resource usage. FinOps integration is blocked by the same data gap.',
    3: 'Attribution covers main platforms and service lines using consumption-based proxies. Directional carbon-per-service estimates are available. Precision varies across the estate. Cloud attribution is stronger than on-premise because cloud billing provides a natural consumption signal. Hybrid and colocation environments lag behind.',
    4: 'Consumption-based attribution across most of the estate links resource use to services and owners. Carbon showback, FinOps integration, and accountability conversations use credible data. Teams can see the environmental and financial impact of their technology choices.',
    5: 'Full real-time consumption-based attribution. Carbon and cost move together through the same drivers. Service-level carbon budgets are managed, reviewed, and feed into architectural decisions.',
  },
  cloud_telemetry: {
    1: 'Cloud resource consumption is not monitored beyond basic billing. You have no visibility into what is provisioned, how it is used, or what the carbon footprint is. Cloud spend grows unchecked because no one can see what drives it. Provider sustainability dashboards are not connected to your own reporting.',
    2: 'Cloud billing data gives aggregate cost and some resource breakdown. Telemetry is not linked to carbon, utilisation is not reviewed, and many resource types (storage tiers, networking, managed services) are invisible. FinOps and GreenOps both lack the granularity to act. Provider carbon data (AWS Customer Carbon Footprint, Azure Emissions Impact, GCP Carbon Footprint) may be available but is not integrated.',
    3: 'Cloud telemetry covers major services with reasonable granularity. Cost and consumption patterns are visible for compute and storage. Container workloads, serverless functions, and multi-cloud environments have gaps. Provider carbon estimates are available but methodology differences between providers limit comparability.',
    4: 'Comprehensive cloud telemetry covering compute, storage, networking, and managed services. Carbon estimates are derived from provider sustainability data and cross-referenced with your own factors. Cloud FinOps and GreenOps decisions use measured data. Multi-cloud comparison is possible.',
    5: 'Full cloud observability with real-time carbon-aware workload placement, automated cost-carbon optimisation, and integration across multi-cloud and hybrid environments. Cloud carbon is managed with the same discipline as cloud cost.',
  },
  colo_provider_data: {
    1: 'No energy or efficiency data from colocation providers. You rely on marketing claims with no way to validate, challenge, or compare. Scope 3 reporting for hosted infrastructure is guesswork. You are paying for energy you cannot measure, governed by SLAs that do not cover sustainability data.',
    2: 'Some data arrives, typically quarterly PUE or aggregate energy from provider reports. Quality, timeliness, and methodology are unclear. You cannot verify whether reported PUE covers the same boundary as your own calculations. Allocating consumption to your footprint requires assumptions you cannot defend.',
    3: 'Structured data sharing is in place with major providers. Facility-level metrics arrive on a regular schedule and feed into carbon calculations. Granularity to your specific allocation is limited. You report your share of a facility but cannot explain what drives variation in your allocation.',
    4: 'Provider data is detailed, timely, and allocated to your deployment. Contractual SLAs cover data quality and frequency. You can validate provider efficiency claims, compare providers, and use the data in procurement decisions. Carbon reporting reflects your actual colocation footprint rather than a pro-rata share.',
    5: 'Full transparency with real-time data feeds, granular allocation, and contractual obligations for continuous improvement. Provider data integrates into your own monitoring systems and supports active performance management and procurement scoring.',
  },
  temporal_timeliness: {
    1: 'Data arrives annually or quarterly at best. You cannot spot trends, seasonal patterns, or respond to changing conditions within a reporting period. Problems are discovered months after they start. By the time a report lands, the situation has changed and the data cannot inform current decisions.',
    2: 'Monthly or quarterly data exists in some areas. Broad trends over time are visible, but operational decisions needing weekly or daily data are not supported. Seasonal efficiency variation (cooling load in summer, free cooling in winter) is averaged out rather than managed.',
    3: 'Monthly data is standard across most domains, with some daily granularity for key metrics. Periodic reporting and trend analysis work. Real-time operational decisions and anomaly detection do not. You can report what happened last month but cannot act on what is happening now.',
    4: 'Daily or sub-daily data is available for key operational metrics. Anomaly detection, demand-response decisions, and within-period trend reporting are all supported. Operational teams act on current information rather than historical summaries.',
    5: 'Real-time or near-real-time data across all key domains. Dynamic optimisation, automated responses, and continuous improvement use live feeds. Data freshness is actively managed and monitored.',
  },
  lineage_assurance: {
    1: 'No traceability of data sources, transformations, or quality controls. You cannot explain how any number was derived. Every figure is challengeable and no metric is auditable. Under CSRD, EED, or similar disclosure requirements, this is a material governance risk. Internal stakeholders who use these numbers in business cases or board papers do so without understanding the uncertainty they carry.',
    2: 'Some documentation of data sources exists but it is informal, incomplete, and not maintained. You can explain major data flows when asked, but there is no systematic audit trail. External challenge (from auditors, regulators, or sustainability rating agencies) would expose gaps quickly. Assumptions buried in spreadsheets are treated as facts downstream.',
    3: 'Data lineage is documented for the main reporting pipelines. Sources, transformations, and assumptions are recorded. Audit queries can be answered, but the process is manual and depends on key individuals. If the person who built the model leaves, the lineage walks out with them.',
    4: 'Systematic lineage tracking across main data flows with regular validation. Assumptions are documented and reviewed. Internal and external audit can be supported with a clear evidence trail. Methodology changes are version-controlled.',
    5: 'Full automated lineage from source to report with version control, validation rules, and exception handling. External assurance is achievable. Any stakeholder can trace any number to its source and understand every transformation applied.',
  },
  decision_integration: {
    1: 'No regular management reporting on energy, emissions, or efficiency across IT. Where environmental data exists, it does not reach decision-makers or influence operational or investment choices. Sustainability is a side activity disconnected from how the technology estate is run.',
    2: 'Some reporting exists but it is infrequent, narrowly distributed, and disconnected from operations. Data may appear in an annual sustainability report but does not feed into infrastructure, procurement, or capacity decisions. The people who make spending decisions never see the environmental data.',
    3: 'Regular reporting covers the main data centre or largest cloud accounts. Reports reach infrastructure leads but not consistently finance, procurement, or senior leadership. Actions are ad-hoc. No one tracks whether recommendations from previous reports were implemented or what the outcome was.',
    4: 'Structured reporting covers most of the estate with defined cadence, scope, and distribution. The right decision-makers receive reports, and there is a process for turning findings into actions with named owners. Outcome tracking is starting.',
    5: 'Comprehensive, multi-cadence reporting embedded in operational governance. Environmental and efficiency data is treated with the same discipline as financial reporting. Targets, accountability, variance analysis, and closed-loop improvement are all in place.',
  },
};

/* ─── Domain-specific misinterpretation risk ─── */
const MISINTERPRETATION_RISK: Record<string, Record<number, string>> = {
  asset_inventory_configuration: {
    1: 'Any per-asset calculation (embodied carbon, lifecycle cost, refresh ROI) is working from an incomplete denominator. You are optimising a partial view of the estate while the rest generates untracked waste.',
    2: 'Aggregate asset counts look precise but miss the detail needed for attribution. A "10,000 server estate" figure hides the mix of physical, virtual, and cloud resources that have completely different carbon and cost profiles.',
    3: 'Inventory data supports standard reporting but service-level attribution will show gaps under scrutiny. Per-service carbon figures depend on asset-to-service mapping that may not reflect reality for shared infrastructure.',
  },
  operational_power_energy: {
    1: 'Carbon figures derived from estimated energy carry 30-50% uncertainty. A facility reporting 10 GWh consumption could actually use 6-15 GWh. Investment cases built on these numbers risk approving the wrong projects or missing the real hotspots.',
    2: 'Facility-level energy looks credible but the lack of sub-metering means PUE improvements cannot be attributed to specific interventions. You may report efficiency gains that actually reflect load changes rather than infrastructure improvements.',
    3: 'Energy data supports periodic reporting and trend analysis. The risk appears when teams use site-level averages for workload-level carbon attribution. A single site average applied to hundreds of services creates false precision.',
  },
  carbon_factors: {
    1: 'A single grid-average carbon factor applied across all sites and time periods can produce results that are 2-5x wrong. A data centre on a clean grid looks identical to one running on coal. Renewable procurement is invisible. Carbon targets based on these factors set the wrong trajectory.',
    2: 'Regional factors improve accuracy but still mask significant variation. Two sites in the same country on different grids can have 3x carbon intensity differences. Market-based accounting is impossible because the data does not distinguish purchased energy sources.',
    3: 'Location-based reporting is credible, but market-based claims are not yet supported. If your organisation uses green tariffs, PPAs, or REGOs, the carbon benefit does not appear in your numbers. You may be understating progress or overstating your baseline.',
  },
  embodied_emissions: {
    1: 'Scope 3 hardware emissions are either missing or use a single "average server" figure that ignores the 5-10x range between a low-power edge device and a GPU-dense AI training node. Lifecycle extension business cases cannot be made because you have no embodied carbon baseline to offset against use-phase savings.',
    2: 'Generic embodied factors treat all servers as equivalent. A refurbished server with 0.2 tonnes embodied CO2 looks the same as a new high-spec unit at 2.5 tonnes. Procurement decisions that should favour reuse have no evidence to support the case.',
    3: 'Product-family data is credible for major categories but supplier-specific comparisons are not possible. Two vendors bidding for the same contract cannot be differentiated on embodied carbon. Circularity claims from ITAD providers cannot be validated.',
  },
  utilisation_and_service_usage: {
    1: 'Without utilisation data, every capacity request is approved at face value. Industry benchmarks suggest 15-30% average utilisation in unmanaged estates. You are likely provisioning 3-5x more capacity than workloads consume, but you have no data to challenge this.',
    2: 'Partial monitoring shows utilisation for visible systems but the unmeasured estate could be worse. Rightsizing recommendations target the systems you can see, potentially missing larger waste elsewhere. Demand growth continues unchecked.',
    3: 'Utilisation data supports waste identification but the link to action is informal. Reports show 20% of servers under 10% utilisation but no one owns the remediation. The data is decision-ready; the governance is not.',
  },
  allocation_attribution: {
    1: 'Without attribution, carbon reduction targets are estate-wide averages with no accountable owner. A business unit running inefficient workloads looks identical to one that has optimised aggressively. Efficiency investment has no return path to the team that benefits.',
    2: 'Proxy-based allocation (by headcount or revenue) produces attribution that teams cannot act on. A development team allocated 8% of carbon based on headcount has no way to reduce their share by changing technology choices.',
    3: 'Consumption-based attribution works for cloud (where billing provides the signal) but lags for on-premise and colocation. Hybrid environments produce inconsistent per-service figures that do not support comparison across deployment models.',
  },
  cloud_telemetry: {
    1: 'Cloud carbon estimates are either missing or derived from spend (cost-based proxies). Spend-based estimates can be off by 3-10x because a pound spent on storage has a completely different carbon profile from a pound spent on GPU compute. Optimising cloud cost does not necessarily reduce carbon if the mix shifts toward carbon-intensive services.',
    2: 'Billing-based cloud data looks granular but lacks the utilisation and carbon dimensions. You can tell what you spend but not how efficiently. Provider sustainability dashboards exist but produce numbers that cannot be reconciled with your own methodology.',
    3: 'Provider carbon data is available but methodology differences between AWS, Azure, and GCP limit cross-provider comparison. Multi-cloud estates cannot produce a consistent carbon view. Serverless and container workloads are under-counted because metering granularity does not reach them.',
  },
  colo_provider_data: {
    1: 'Colocation Scope 3 emissions are based on assumptions about provider efficiency that you cannot verify. A provider claiming PUE 1.2 may calculate it differently from your own methodology. The carbon figure you report for hosted infrastructure could be off by 50% or more.',
    2: 'Provider-reported PUE and energy data arrives but the calculation boundary, measurement method, and allocation approach are unclear. Comparing two colocation providers on environmental performance is not credible because the metrics are not measured the same way.',
    3: 'Structured data sharing with major providers is in place but granularity to your allocation is limited. You report a pro-rata share of facility energy, not the actual consumption of your racks. The carbon numbers are reasonable at portfolio level but not defensible at service level.',
  },
  infrastructure_efficiency_metrics: {
    1: 'Without measured efficiency metrics, any improvement claim is anecdotal. A cooling upgrade "expected to reduce PUE by 0.1" cannot be validated before or after. Investment cases rely on vendor projections rather than measured baselines.',
    2: 'A single PUE number hides whether overhead comes from cooling, UPS losses, or distribution. Improving cooling when the real problem is UPS efficiency wastes capital. The metric exists but is not granular enough to direct investment.',
    3: 'Consistent PUE with defined boundaries supports benchmarking and target-setting. The risk is treating PUE as a comprehensive efficiency measure when it only covers energy. Water efficiency (WUE), carbon efficiency (CUE), and compute efficiency (CLF) gaps remain invisible.',
  },
  water_data: {
    1: 'Water risk assessments for data centre sites have no consumption data to anchor them. A site in a water-stressed region could be consuming millions of litres annually through evaporative cooling, but you cannot quantify the exposure or compare cooling technology alternatives.',
    2: 'Utility-bill water data captures total site consumption but cannot distinguish cooling from domestic use. WUE calculations use the total figure, overstating or understating cooling-specific efficiency depending on non-cooling water use.',
    3: 'Site-level WUE is credible but you cannot compare cooling technologies (adiabatic vs. chiller vs. free cooling) because the data does not separate them. Seasonal variation is averaged out.',
  },
  temporal_timeliness: {
    1: 'Annual or quarterly data means every decision uses information that is 3-12 months old. A facility that developed a cooling problem in January will not show it in data until Q2. The cost of delay compounds because problems grow while invisible.',
    2: 'Monthly data catches major shifts but misses operational events (outages, demand spikes, efficiency degradation) that happen within a month. Seasonal patterns are visible but intra-month variation is not.',
    3: 'Monthly reporting supports periodic review. The risk is that operational teams assume the data reflects current state when it reflects last month. Anomaly detection and prompt intervention require daily or sub-daily feeds.',
  },
  lineage_assurance: {
    1: 'Every figure in every report is unchallengeable because it is also unverifiable. Under regulatory disclosure requirements (CSRD, EED), this is a compliance risk. Internally, leadership may be making investment decisions based on numbers no one can explain or defend.',
    2: 'Informal lineage means the person who built the model can explain it, but no one else can. Key-person dependency is high. If challenged by an auditor or rating agency, reconstructing the data trail takes weeks and reveals gaps.',
    3: 'Documented lineage covers the main pipelines, but methodology assumptions (emission factors, allocation rules, estimation methods) are not version-controlled. A year-on-year comparison may reflect methodology changes rather than real performance shifts.',
  },
  decision_integration: {
    1: 'Environmental data exists somewhere in the organisation but does not reach the people who make spending, procurement, and capacity decisions. Efficiency improvements happen by accident, not design. There is no feedback loop between sustainability reporting and operational action.',
    2: 'Reports are produced but arrive too late, too narrow, or too disconnected from operational context for anyone to act on them. An annual sustainability report published six months after year-end does not influence the infrastructure decisions made during the year.',
    3: 'Reporting reaches infrastructure leads but not finance, procurement, or senior leadership. Technical teams see the data; the people who approve budgets do not. Recommendations from reports are implemented ad-hoc and outcome tracking does not exist.',
  },
};

/* ─── Cross-domain interaction diagnosis ─── */
interface CrossDomainInteraction {
  description: string;
  severity: 'high' | 'medium';
}

const CROSS_DOMAIN_RULES: Array<{
  domains: [string, string];
  check: (scores: Map<string, number>) => CrossDomainInteraction | null;
}> = [
  {
    domains: ['operational_power_energy', 'carbon_factors'],
    check: (scores) => {
      const power = scores.get('operational_power_energy') || 1;
      const carbon = scores.get('carbon_factors') || 1;
      if (power >= 3 && carbon <= 2) {
        return {
          description: `You measure energy at a reasonable level (level ${power}) but convert it to carbon using crude grid-average factors (level ${carbon}). The precision of your energy data is lost in the conversion. Granular power measurement through a blunt carbon factor produces numbers that look precise but carry the uncertainty of the weakest link.`,
          severity: 'high',
        };
      }
      if (carbon >= 3 && power <= 2) {
        return {
          description: `You have reasonable carbon factors (level ${carbon}) but the energy data feeding into them is weak (level ${power}). Good factors applied to estimated energy still produce estimated carbon. Fix the energy measurement first.`,
          severity: 'high',
        };
      }
      return null;
    },
  },
  {
    domains: ['utilisation_and_service_usage', 'allocation_attribution'],
    check: (scores) => {
      const util = scores.get('utilisation_and_service_usage') || 1;
      const alloc = scores.get('allocation_attribution') || 1;
      if (util >= 3 && alloc <= 2) {
        return {
          description: `You measure utilisation (level ${util}) but cannot attribute consumption to services or owners (level ${alloc}). You can see waste exists but cannot assign responsibility for it. Utilisation data without attribution produces reports that name the problem but not the accountable owner.`,
          severity: 'high',
        };
      }
      if (alloc >= 3 && util <= 2) {
        return {
          description: `You have an attribution model (level ${alloc}) but the underlying utilisation data is weak (level ${util}). Your cost and carbon allocations use proxies rather than measured consumption. Teams receive carbon showback figures they cannot influence through operational changes.`,
          severity: 'medium',
        };
      }
      return null;
    },
  },
  {
    domains: ['asset_inventory_configuration', 'embodied_emissions'],
    check: (scores) => {
      const assets = scores.get('asset_inventory_configuration') || 1;
      const embodied = scores.get('embodied_emissions') || 1;
      if (embodied >= 3 && assets <= 2) {
        return {
          description: `You have embodied carbon data at a reasonable level (level ${embodied}) but the asset inventory underneath it is incomplete (level ${assets}). Product-level embodied factors applied to an incomplete asset register produce a Scope 3 figure that looks precise but has an unknown denominator.`,
          severity: 'high',
        };
      }
      if (assets >= 3 && embodied <= 1) {
        return {
          description: `Your asset inventory is reasonable (level ${assets}) but embodied carbon is not tracked (level ${embodied}). You know what hardware you have but not what it cost in carbon to manufacture. Refresh decisions ignore lifecycle emissions entirely.`,
          severity: 'medium',
        };
      }
      return null;
    },
  },
  {
    domains: ['cloud_telemetry', 'allocation_attribution'],
    check: (scores) => {
      const cloud = scores.get('cloud_telemetry') || 1;
      const alloc = scores.get('allocation_attribution') || 1;
      if (cloud <= 2 && alloc >= 3) {
        return {
          description: `Your attribution model (level ${alloc}) works for on-premise but cloud telemetry is weak (level ${cloud}). Cloud consumption, often the fastest-growing part of the estate, falls outside your attribution framework. Per-service carbon figures undercount cloud and overweight on-premise.`,
          severity: 'medium',
        };
      }
      return null;
    },
  },
  {
    domains: ['operational_power_energy', 'infrastructure_efficiency_metrics'],
    check: (scores) => {
      const power = scores.get('operational_power_energy') || 1;
      const eff = scores.get('infrastructure_efficiency_metrics') || 1;
      if (eff >= 3 && power <= 2) {
        return {
          description: `You report efficiency metrics like PUE (level ${eff}) but the underlying energy measurement is weak (level ${power}). A PUE calculated from estimated IT load and facility-level meters has wide error bars. The efficiency metric exists but its inputs do not support the implied precision.`,
          severity: 'high',
        };
      }
      return null;
    },
  },
  {
    domains: ['colo_provider_data', 'carbon_factors'],
    check: (scores) => {
      const colo = scores.get('colo_provider_data') || 1;
      const carbon = scores.get('carbon_factors') || 1;
      if (colo <= 2 && carbon >= 3) {
        return {
          description: `Your own carbon factors are reasonable (level ${carbon}) but colocation provider data is weak (level ${colo}). You apply good factors to your own sites but guess at colocation energy. If a significant share of your estate sits in colocation, the weakest data covers some of your largest facilities.`,
          severity: 'medium',
        };
      }
      return null;
    },
  },
  {
    domains: ['lineage_assurance', 'decision_integration'],
    check: (scores) => {
      const lineage = scores.get('lineage_assurance') || 1;
      const decision = scores.get('decision_integration') || 1;
      if (decision >= 3 && lineage <= 2) {
        return {
          description: `You distribute sustainability reports to decision-makers (level ${decision}) but the data behind them lacks traceability (level ${lineage}). Leadership acts on figures that no one can fully explain or defend. When a board member or auditor asks "where does this number come from?", the answer is uncertain.`,
          severity: 'high',
        };
      }
      return null;
    },
  },
  {
    domains: ['temporal_timeliness', 'utilisation_and_service_usage'],
    check: (scores) => {
      const temporal = scores.get('temporal_timeliness') || 1;
      const util = scores.get('utilisation_and_service_usage') || 1;
      if (util >= 3 && temporal <= 2) {
        return {
          description: `You measure utilisation (level ${util}) but data arrives too slowly (level ${temporal}) to act on it. A monthly utilisation report showing 15% average use cannot drive rightsizing decisions that need to account for peak demand patterns within the month.`,
          severity: 'medium',
        };
      }
      return null;
    },
  },
];

function diagnoseCrossDomainInteractions(
  results: DomainAssessment[]
): Map<string, string[]> {
  const scoreMap = new Map<string, number>();
  for (const r of results) scoreMap.set(r.domain_id, r.effective_maturity);

  const diagnosisByDomain = new Map<string, string[]>();

  for (const rule of CROSS_DOMAIN_RULES) {
    const interaction = rule.check(scoreMap);
    if (!interaction) continue;

    for (const domainId of rule.domains) {
      if (!diagnosisByDomain.has(domainId)) diagnosisByDomain.set(domainId, []);
      diagnosisByDomain.get(domainId)!.push(interaction.description);
    }
  }

  return diagnosisByDomain;
}

/* ─── Risk framing by maturity — focused on data credibility ─── */
function getRiskStatement(domain: Domain, maturity: number, weakDimNames: string[]): string {
  if (maturity <= 1) {
    const weakNote = weakDimNames.length > 0
      ? ` Weakest areas: ${weakDimNames.join(', ')}.`
      : '';
    return `Data is absent or unreliable. Any figures reported for ${domain.name.toLowerCase()} rest on assumptions rather than measurement. They should not be used for decisions or external disclosure without heavy caveats.${weakNote}`;
  }
  if (maturity === 2) {
    const weakNote = weakDimNames.length > 0
      ? ` Particular weakness in ${weakDimNames.join(' and ')}.`
      : '';
    return `Data is partial and inconsistent. Good enough for rough directional estimates, not for investment cases, regulatory disclosure, or external challenge. The organisation may place more weight on these figures than the evidence supports.${weakNote}`;
  }
  if (maturity === 3) {
    return `Data is structured and reportable. Periodic reporting and trend analysis work, but the data lacks the precision or timeliness to support active operational management or withstand detailed external challenge.`;
  }
  if (maturity === 4) {
    return `Data is measured and defensible. Supports investment cases, governance reviews, and supplier challenge. Remaining gaps are typically in edge cases: emerging platforms, real-time availability, or end-to-end audit traceability.`;
  }
  return `Data is comprehensive and continuously validated. Supports audit, automated governance, and continuous improvement. The priority is maintaining quality as the estate evolves.`;
}

/* ─── Cascade context — how this domain's quality affects downstream calculations ─── */
function getCascadeNote(
  domainId: string,
  domainName: string,
  maturity: number,
  allResults: DomainAssessment[],
  allDomainNames: Record<string, string>
): string {
  const dep = DEPENDENCY_MAP.find(d => d.domain_id === domainId);
  if (!dep) return '';

  const scoreMap = new Map<string, number>();
  for (const r of allResults) scoreMap.set(r.domain_id, r.effective_maturity);

  const parts: string[] = [];

  // Upstream constraints
  if (dep.depends_on.length > 0) {
    const weakUpstream = dep.depends_on
      .filter(upId => (scoreMap.get(upId) || 1) < maturity)
      .map(upId => `${allDomainNames[upId] || upId} (level ${scoreMap.get(upId) || 1})`)
      .sort();

    if (weakUpstream.length > 0) {
      parts.push(`Constrained by weaker upstream inputs: ${weakUpstream.join(', ')}. ${domainName} scores level ${maturity}, but weaker inputs feeding it limit the real-world reliability of calculations in this area.`);
    }
  }

  // Downstream impact
  if (dep.feeds_into.length > 0 && maturity <= 2) {
    const affected = dep.feeds_into
      .map(downId => allDomainNames[downId] || downId)
      .sort();
    parts.push(`This domain feeds into ${affected.join(', ')}. At level ${maturity}, it constrains all of them. Improving it has a multiplier effect.`);
  }

  return parts.join(' ');
}

/* ─── Dimension diagnosis ─── */
function buildDimensionAnalysis(
  dimEntries: [string, number][],
  domainName: string
): string {
  if (dimEntries.length === 0) {
    return 'No dimension scores available. Assessment may be incomplete.';
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
      parts.push('Weak coverage combined with weak attribution blocks both hotspot analysis and accountability. You cannot see where resources are consumed or assign them to owners.');
    } else if (weakSet.has('coverage')) {
      parts.push('Weak coverage means parts of your estate are invisible. You may be optimising what you can see while bigger problems sit elsewhere.');
    } else if (weakSet.has('attribution')) {
      parts.push('Weak attribution means you can measure totals but cannot link consumption to services or owners. Chargeback, showback, and accountability are blocked.');
    }
    if (weakSet.has('granularity') && weakSet.has('method_quality')) {
      parts.push('Weak granularity combined with weak method quality means you have coarse data collected through unreliable methods. Both the resolution and the accuracy need work.');
    } else if (weakSet.has('granularity')) {
      parts.push('Weak granularity limits the specificity of downstream calculations. Facility-level data applied to service-level questions creates false precision.');
    } else if (weakSet.has('method_quality')) {
      parts.push('Weak method quality means the data collection approach may not produce consistent, comparable results. Spend-based estimates, generic benchmarks, and manual collection all introduce systematic error.');
    }
    if (weakSet.has('assurance_lineage')) {
      parts.push('Weak assurance and lineage means these figures may not survive external challenge. Under regulatory disclosure or audit, the methodology gaps become a compliance risk.');
    }
    if (weakSet.has('temporal_resolution') || weakSet.has('timeliness')) {
      parts.push('Weak temporal resolution limits your ability to spot trends, respond to anomalies, or make real-time operational decisions. Problems compound while invisible.');
    }
    if (weakSet.has('locational_resolution')) {
      parts.push('Weak locational resolution means you cannot distinguish between sites, zones, or regions. All locations look the same in the data, hiding performance variation.');
    }
  }

  if (midDims.length > 0 && weakDims.length === 0) {
    parts.push('All dimensions sit at a moderate level. No severe weaknesses, but broad improvement is needed to reach decision-grade quality.');
  }

  return parts.join(' ');
}

/* ─── Main export ─── */
export function generateDomainNarratives(
  results: DomainAssessment[],
  model: MaturityModel
): DomainNarrative[] {
  // Build domain name map for cascade analysis
  const domainNames: Record<string, string> = {};
  for (const d of model.domains) domainNames[d.id] = d.name;

  // Cross-domain interaction diagnosis
  const crossDomainDiagnosis = diagnoseCrossDomainInteractions(results);

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
        cascade_note: '',
        misinterpretation_risk: '',
        cross_domain_diagnosis: '',
      };
    }

    const level = String(result.effective_maturity);
    const maturityLabel = MATURITY_LABELS[result.effective_maturity] || 'Unknown';
    const maturityInfo = domain.maturity_levels[level];
    const maturityDesc = maturityInfo ? maturityInfo.description : '';

    // Score explanation
    const overrideNote =
      result.assessor_override !== null
        ? ` (assessor override applied; calculated score was ${result.calculated_maturity})`
        : '';
    const flagNote =
      result.weakness_flags.length > 0 ? ` Caveats: ${result.weakness_flags.join('; ')}.` : '';
    const scoreExplanation = `Level ${result.effective_maturity} — ${maturityLabel}. ${maturityDesc}${overrideNote}${flagNote}`;

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

    // Risk statement — data credibility framing
    const riskStatement = getRiskStatement(domain, result.effective_maturity, weakDimNames);

    // Misinterpretation risk — domain-specific consequences
    const domainMisinterp = MISINTERPRETATION_RISK[domain.id];
    const misinterpretationRisk = domainMisinterp
      ? domainMisinterp[result.effective_maturity] || ''
      : '';

    // Cascade note — upstream constraints and downstream impact
    const cascadeNote = getCascadeNote(domain.id, domain.name, result.effective_maturity, results, domainNames);

    // Cross-domain interaction diagnosis
    const crossDiag = crossDomainDiagnosis.get(domain.id) || [];
    const crossDomainDiagnosisText = crossDiag.join(' ');

    // Decision support — what you can and cannot do
    const ds = domain.decision_support_by_score[level];
    let dsSummary = '';
    if (ds) {
      if (ds.supports.length > 0) {
        dsSummary = `At level ${result.effective_maturity}, this data supports: ${ds.supports.join('; ')}. `;
      }
      if (ds.does_not_support.length > 0 && !ds.does_not_support[0].startsWith('None')) {
        dsSummary += `Not yet sufficient for: ${ds.does_not_support.join('; ')}.`;
        const nextLevel = Math.min(result.effective_maturity + 1, 5);
        const nextDs = domain.decision_support_by_score[String(nextLevel)];
        if (nextDs) {
          const newCaps = nextDs.supports.filter(s => !ds.supports.includes(s)).join('; ');
          if (newCaps) {
            dsSummary += ` Reaching level ${nextLevel} would unlock: ${newCaps}.`;
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
        guidance = `${domain.name} data is at a mature level. Focus on maintaining quality, extending automation, and ensuring governance keeps pace with estate changes.`;
      } else {
        guidance = `Closing the data gap in ${domain.name.toLowerCase()} directly improves the credibility of downstream calculations. Focus first on the weakest dimensions identified above.`;
      }
    }

    // Add dimension-specific guidance for weak areas
    if (weakDimNames.length > 0 && result.effective_maturity <= 3) {
      guidance += ` The weakest dimensions (${weakDimNames.join(', ')}) set the effective ceiling for this domain. Address them first.`;
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
      cascade_note: cascadeNote,
      misinterpretation_risk: misinterpretationRisk,
      cross_domain_diagnosis: crossDomainDiagnosisText,
    };
  });
}
