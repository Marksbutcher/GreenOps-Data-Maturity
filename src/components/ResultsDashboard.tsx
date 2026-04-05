import { Fragment, useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  Cell, Legend,
} from 'recharts';
import { MaturityModel, DomainAssessment, OrganisationProfile, MATURITY_LABELS, MATURITY_LABELS_SHORT, INTENT_LABELS, INTENT_MINIMUM_LEVEL, confidenceLabel, CONFIDENCE_DESCRIPTIONS } from '../types';
import { calculateOverallStats, getAnswerPatternSummary } from '../lib/scoring';
import { generateDomainNarratives, DomainNarrative } from '../lib/narrativeAnalysis';
import { generateRecommendations, generateExecutiveSummary } from '../lib/recommendations';
import { generateDecisionReadiness } from '../lib/decisionReadiness';
import { getTopLimitingFactors, analyseCascadeRisks } from '../lib/dependencyChain';
import { type PDFSectionOptions, DEFAULT_PDF_SECTIONS, PDF_SECTION_LABELS } from '../lib/pdfExport';
import PosetivLogo from './PosetivLogo';

interface Props {
  model: MaturityModel;
  profile: OrganisationProfile;
  results: DomainAssessment[];
  onExportPDF: (sections?: PDFSectionOptions) => void;
  onExportCSV: () => void;
  onBack: () => void;
  onStartOver: () => void;
}

type Tab = 'overview' | 'enables' | 'focus' | 'readiness' | 'detail';

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  enables: 'What Your Data Enables',
  focus: 'Where to Focus',
  readiness: 'Decision Readiness',
  detail: 'Domain Detail',
};

/* ─── Colour helpers ─── */
const LEVEL_COLOURS: Record<number, string> = {
  1: '#dc2626', 2: '#f59e0b', 3: '#eab308', 4: '#22c55e', 5: '#16a34a',
};
const LEVEL_BG: Record<number, string> = {
  1: '#fef2f2', 2: '#fffbeb', 3: '#fefce8', 4: '#f0fdf4', 5: '#f0fdf4',
};
const LEVEL_LABELS = MATURITY_LABELS_SHORT;

const READINESS_COLOURS: Record<string, string> = {
  reporting_only: '#dc2626',
  directional: '#f59e0b',
  decision_grade: '#22c55e',
  optimisation_grade: '#16a34a',
};

function levelLabel(level: number): string {
  return `Level ${level} — ${LEVEL_LABELS[level] || ''}`;
}

/* ─── Save assessment ─── */
function handleSaveAssessment(profile: OrganisationProfile, results: DomainAssessment[]) {
  const payload = {
    version: '2.0',
    saved_at: new Date().toISOString(),
    profile,
    results,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = profile.organisation_name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'assessment';
  a.download = `greenops-assessment-${slug}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultsDashboard({
  model, profile, results, onExportPDF, onExportCSV, onBack, onStartOver,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const stats = useMemo(() => calculateOverallStats(results), [results]);
  const narratives = useMemo(() => generateDomainNarratives(results, model), [results, model]);
  const recommendations = useMemo(() => generateRecommendations(results, model), [results, model]);
  const decisionReadiness = useMemo(() => generateDecisionReadiness(results, model), [results, model]);
  const execSummary = useMemo(() => generateExecutiveSummary(results, model, profile.assessment_intent), [results, model, profile.assessment_intent]);

  // Bar chart data — sorted weakest first
  const barData = useMemo(() => {
    return [...results]
      .sort((a, b) => a.effective_maturity - b.effective_maturity)
      .map((r) => {
        const d = model.domains.find((dd) => dd.id === r.domain_id);
        return {
          name: d?.name || r.domain_id,
          shortName: (d?.name || r.domain_id).length > 28
            ? (d?.name || r.domain_id).slice(0, 26) + '…'
            : (d?.name || r.domain_id),
          maturity: r.effective_maturity,
          target: r.target_maturity,
          gap: r.target_maturity - r.effective_maturity,
        };
      });
  }, [results, model]);

  // Radar data — target is now intent-derived (minimum level for stated goal)
  const intentTarget = profile.assessment_intent ? INTENT_MINIMUM_LEVEL[profile.assessment_intent] : 3;
  const radarData = useMemo(() => {
    return results.map((r) => {
      const d = model.domains.find((dd) => dd.id === r.domain_id);
      const label = d?.name || r.domain_id;
      return {
        domain: label.length > 20 ? label.slice(0, 18) + '…' : label,
        maturity: r.effective_maturity,
        target: intentTarget,
      };
    });
  }, [results, model, intentTarget]);

  // "What your data enables" data
  const enablesData = useMemo(() => {
    return results.map((r) => {
      const d = model.domains.find((dd) => dd.id === r.domain_id);
      const level = String(r.effective_maturity);
      const ds = d?.decision_support_by_score[level];
      const gap = r.impact_score - r.effective_maturity;
      let priority: string;
      if (gap >= 3 || (r.impact_score >= 4 && r.effective_maturity <= 2)) priority = 'High';
      else if (gap >= 1.5 || (r.impact_score >= 3 && r.effective_maturity <= 3)) priority = 'Medium';
      else priority = 'Low';
      return {
        domain_id: r.domain_id,
        name: d?.name || r.domain_id,
        level: r.effective_maturity,
        supports: ds?.supports || [],
        does_not_support: ds?.does_not_support || [],
        priority,
        flags: r.weakness_flags,
      };
    });
  }, [results, model]);

  // Roadmap grouped by phase, then by domain within each phase
  const groupedRecs = useMemo(() => {
    const phases = ['Foundation', 'Quick win', 'Transformation'] as const;
    const result: Record<string, Map<string, typeof recommendations>> = {};
    for (const phase of phases) {
      const phaseRecs = recommendations.filter(r => r.phase === phase);
      const byDomain = new Map<string, typeof recommendations>();
      for (const rec of phaseRecs) {
        if (!byDomain.has(rec.domain_name)) byDomain.set(rec.domain_name, []);
        byDomain.get(rec.domain_name)!.push(rec);
      }
      result[phase] = byDomain;
    }
    return result;
  }, [recommendations]);

  // Domain name map for dependency chain
  const domainNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of model.domains) map[d.id] = d.name;
    return map;
  }, [model]);

  // Cascade risks and limiting factors
  const cascadeRisks = useMemo(() => analyseCascadeRisks(results, domainNames), [results, domainNames]);
  const limitingFactors = useMemo(() => getTopLimitingFactors(results, domainNames, 3), [results, domainNames]);

  // Intent gap analysis
  const intentGap = useMemo(() => {
    const intent = profile.assessment_intent;
    if (!intent) return null;
    const requiredLevel = INTENT_MINIMUM_LEVEL[intent];
    const belowRequired = results.filter(r => r.effective_maturity < requiredLevel);
    return {
      intent,
      label: INTENT_LABELS[intent],
      requiredLevel,
      shortfall: belowRequired.length,
      total: results.length,
      gaps: belowRequired.sort((a, b) => a.effective_maturity - b.effective_maturity).map(r => ({
        name: domainNames[r.domain_id] || r.domain_id,
        level: r.effective_maturity,
        needed: requiredLevel,
      })),
    };
  }, [results, profile.assessment_intent, domainNames]);

  // Overall confidence
  const overallConfidence = useMemo(() => {
    const avg = results.reduce((a, r) => a + r.confidence_score, 0) / results.length;
    return confidenceLabel(avg);
  }, [results]);

  // Key stats for summary strip
  const belowThree = results.filter(r => r.effective_maturity < 3).length;
  const atFourPlus = results.filter(r => r.effective_maturity >= 4).length;
  const highPriority = results.filter(r => r.impact_score >= 4 && r.effective_maturity <= 2).length;

  const handleSave = useCallback(() => {
    handleSaveAssessment(profile, results);
  }, [profile, results]);

  const [showMoreMenu, setShowMoreMenu] = useState(false);

  /* ─── Item 4: PDF section selection modal ─── */
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [pdfSections, setPdfSections] = useState<PDFSectionOptions>({ ...DEFAULT_PDF_SECTIONS });

  const handlePDFExport = useCallback(() => {
    onExportPDF(pdfSections);
    setShowPDFModal(false);
  }, [onExportPDF, pdfSections]);

  /* ─── Item 5: Assessment comparison ─── */
  const [comparisonResults, setComparisonResults] = useState<DomainAssessment[] | null>(null);
  const [comparisonProfile, setComparisonProfile] = useState<OrganisationProfile | null>(null);
  const [showComparisonUpload, setShowComparisonUpload] = useState(false);

  const handleComparisonUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.profile && data.results) {
          setComparisonProfile(data.profile);
          setComparisonResults(data.results);
          setShowComparisonUpload(false);
        } else {
          alert('Invalid assessment file — expected profile and results data.');
        }
      } catch {
        alert('Could not parse assessment file.');
      }
    };
    reader.readAsText(file);
  }, []);

  return (
    <div className="results-page">
      <div className="container-wide">
        {/* Header */}
        <div className="results-header">
          <div className="results-header-left">
            <div className="results-logo">
              <PosetivLogo variant="dark" height={28} />
            </div>
            <div>
              <h1 className="results-title">Assessment Results</h1>
              <p className="results-org">{profile.organisation_name} — {profile.assessment_date}</p>
            </div>
          </div>
          <div className="results-actions">
            <button className="btn btn-outline" onClick={onBack}>Back to assessment</button>
            <button className="btn btn-outline" onClick={handleSave}>Save progress</button>
            <button className="btn btn-accent" onClick={() => setShowPDFModal(true)}>Export PDF report</button>
            <div className="more-menu-wrapper">
              <button className="btn btn-ghost" onClick={() => setShowMoreMenu(!showMoreMenu)}>
                More ▾
              </button>
              {showMoreMenu && (
                <div className="more-menu-dropdown" onMouseLeave={() => setShowMoreMenu(false)}>
                  <button className="more-menu-item" onClick={() => { onExportCSV(); setShowMoreMenu(false); }}>Export CSV</button>
                  <button className="more-menu-item" onClick={() => { setShowComparisonUpload(true); setShowMoreMenu(false); }}>Compare with previous</button>
                  <button className="more-menu-item" onClick={() => { onStartOver(); }}>Start over</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="tab-content">

          {/* ═══ OVERVIEW ═══ */}
          {activeTab === 'overview' && (
            <div className="overview-panel">

              {/* Hero results — overall maturity with label */}
              <div className="overview-hero">
                <div className="overview-hero-main">
                  <div className="overview-hero-score">
                    <span className="hero-score-number">{stats.weightedMaturity}</span>
                    <span className="hero-score-max">/ 5</span>
                  </div>
                  <div className="overview-hero-detail">
                    <span className="hero-maturity-label">
                      {MATURITY_LABELS[Math.round(stats.weightedMaturity)] || MATURITY_LABELS[Math.floor(stats.weightedMaturity)] || 'Unknown'}
                    </span>
                    <span className="hero-maturity-subtext">
                      Weighted average across {results.length} domains
                    </span>
                  </div>
                </div>
                <div className="overview-hero-stats">
                  <div className="hero-stat">
                    <span className="hero-stat-value">{stats.minMaturity}–{stats.maxMaturity}</span>
                    <span className="hero-stat-label">Range</span>
                    <span className="hero-stat-detail">
                      {MATURITY_LABELS_SHORT[stats.minMaturity]} to {MATURITY_LABELS_SHORT[stats.maxMaturity]}
                    </span>
                  </div>
                  <div className="hero-stat-divider" aria-hidden="true" />
                  <div className="hero-stat">
                    <span className="hero-stat-value hero-stat-alert">{belowThree}</span>
                    <span className="hero-stat-label">Below level 3</span>
                    <span className="hero-stat-detail">
                      {belowThree === 0 ? 'No critical gaps' : belowThree === 1 ? '1 domain needs attention' : `${belowThree} domains need attention`}
                    </span>
                  </div>
                  <div className="hero-stat-divider" aria-hidden="true" />
                  <div className="hero-stat">
                    <span className="hero-stat-value hero-stat-good">{atFourPlus}</span>
                    <span className="hero-stat-label">At level 4+</span>
                    <span className="hero-stat-detail">
                      {atFourPlus === 0 ? 'No domains at decision-grade' : atFourPlus === 1 ? '1 domain is decision-grade' : `${atFourPlus} domains are decision-grade`}
                    </span>
                  </div>
                </div>
                <div className="overview-hero-confidence">
                  <span className={`confidence-badge confidence-${overallConfidence}`} role="status" aria-label={`Assessment confidence: ${overallConfidence}`}>
                    {overallConfidence.charAt(0).toUpperCase() + overallConfidence.slice(1)} confidence
                  </span>
                  <span className="confidence-desc">{CONFIDENCE_DESCRIPTIONS[overallConfidence]}</span>
                </div>
              </div>

              {/* Intent gap — below the results */}
              {intentGap && intentGap.shortfall > 0 && (
                <div className="intent-gap-banner intent-gap-warning" role="alert" aria-label="Assessment goal gap warning">
                  <div className="intent-gap-banner-header">
                    <span className="intent-gap-banner-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </span>
                    <div className="intent-gap-banner-title">
                      Your data does not yet support your stated goal
                    </div>
                  </div>
                  <p className="intent-gap-banner-text">
                    You selected <strong>{intentGap.label}</strong>, which requires all domains at level {intentGap.requiredLevel} or above.
                    {' '}<strong>{intentGap.shortfall} of {intentGap.total} domains</strong> fall short.
                  </p>
                  <div className="intent-gap-domain-list" role="list" aria-label="Domains below target">
                    {intentGap.gaps.map((g) => (
                      <div key={g.name} className="intent-gap-domain-item" role="listitem">
                        <span className={`level-badge l${g.level}`} aria-label={`Current level ${g.level}`}>
                          <span className="level-badge-icon" aria-hidden="true">{g.level}</span>
                          Level {g.level}
                        </span>
                        <span className="intent-gap-domain-name">{g.name}</span>
                        <span className="intent-gap-domain-needed" aria-label={`Needs level ${g.needed}`}>needs level {g.needed}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {intentGap && intentGap.shortfall === 0 && (
                <div className="intent-gap-banner intent-gap-success" role="status" aria-label="Assessment goal met">
                  <div className="intent-gap-banner-header">
                    <span className="intent-gap-banner-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </span>
                    <div className="intent-gap-banner-title">
                      All domains meet your stated goal
                    </div>
                  </div>
                  <p className="intent-gap-banner-text">
                    Your data meets the minimum level {intentGap.requiredLevel} required for <strong>{intentGap.label}</strong> across all {intentGap.total} domains.
                  </p>
                </div>
              )}

              {/* Executive narrative — formatted with visual hierarchy */}
              <div className="overview-narrative">
                <div className="exec-summary">
                  {execSummary.split('\n\n').map((para, i) => {
                    // First paragraph is the headline finding — style it bigger
                    if (i === 0) {
                      return <p key={i} className="exec-lead">{para}</p>;
                    }
                    // Highlight key phrases within paragraphs
                    const highlighted = para
                      .replace(/(Critical priority:)/g, '|||STRONG|||$1|||/STRONG|||')
                      .replace(/(Strongest areas:)/g, '|||STRONG|||$1|||/STRONG|||')
                      .replace(/(Weakest areas[^:]*:)/g, '|||STRONG|||$1|||/STRONG|||')
                      .replace(/(\d+ of \d+ domains)/g, '|||STRONG|||$1|||/STRONG|||')
                      .replace(/(level \d)/gi, '|||EM|||$1|||/EM|||');

                    const parts = highlighted.split(/\|\|\|/);
                    return (
                      <p key={i} className="exec-para">
                        {parts.map((part, j) => {
                          if (part === 'STRONG') return null;
                          if (part === '/STRONG') return null;
                          if (part === 'EM') return null;
                          if (part === '/EM') return null;
                          // Check what the previous marker was
                          const prevMarker = parts[j - 1];
                          if (prevMarker === 'STRONG') return <strong key={j}>{part}</strong>;
                          if (prevMarker === 'EM') return <em key={j} className="exec-level">{part}</em>;
                          if (part === '') return null;
                          return <Fragment key={j}>{part}</Fragment>;
                        })}
                      </p>
                    );
                  })}
                </div>
              </div>

              {/* Charts — bar full width, radar alongside */}
              <div className="overview-charts-row">
                <div className="overview-chart-bar">
                  <h3 className="section-heading">Maturity by domain</h3>
                  <ResponsiveContainer width="100%" height={Math.max(barData.length * 40, 400)}>
                    <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" horizontal={false} />
                      <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={260}
                        tick={{ fontSize: 11, fill: '#495057' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="chart-tooltip">
                              <strong>{d.name}</strong><br />
                              Current: {levelLabel(d.maturity)}<br />
                              Target: Level {d.target}<br />
                              Gap: {d.gap > 0 ? `${d.gap} levels to close` : 'On target'}
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="maturity" radius={[0, 4, 4, 0]} barSize={22}>
                        {barData.map((entry, i) => (
                          <Cell key={i} fill={LEVEL_COLOURS[entry.maturity] || '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="overview-chart-radar">
                  <h3 className="section-heading">Maturity profile</h3>
                  <ResponsiveContainer width="100%" height={420}>
                    <RadarChart data={radarData} outerRadius="68%">
                      <PolarGrid stroke="#e9ecef" />
                      <PolarAngleAxis dataKey="domain" tick={{ fontSize: 9, fill: '#495057' }} />
                      <Radar name="Current" dataKey="maturity" stroke="#5AA63E" fill="#5AA63E" fillOpacity={0.3} />
                      <Radar name="Required for goal" dataKey="target" stroke="#94a3b8" fill="none" strokeDasharray="4 4" />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Limiting factors — cascade analysis */}
              {limitingFactors.length > 0 && (
                <div className="overview-limiting">
                  <h3 className="section-heading">Top calculation constraints</h3>
                  <p className="section-subtext">
                    These upstream data domains constrain the reliability of downstream calculations.
                    Improving them has a multiplier effect across the assessment.
                  </p>
                  <div className="limiting-list">
                    {limitingFactors.map((f) => (
                      <div key={f.domain_id} className="limiting-item">
                        <div className="limiting-item-header">
                          <span className={`level-badge l${f.maturity}`}>Level {f.maturity}</span>
                          <strong>{f.domain_name}</strong>
                        </div>
                        <p className="limiting-item-impact">
                          Constrains: {f.affected.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ WHAT YOUR DATA ENABLES ═══ */}
          {activeTab === 'enables' && (
            <div className="enables-panel">
              <p className="section-subtext">
                This view translates domain scores into practical consequences: what decisions your data can credibly support right now,
                where coverage is inconsistent, and which capabilities are blocked until data quality improves. The assessment maps each
                domain's maturity against the decisions it feeds — so gaps here are not abstract scores but real constraints on what the
                organisation can confidently act on.
              </p>

              {/* Intent context */}
              {intentGap && (
                <div className="enables-intent-context">
                  <strong>Your goal: {intentGap.label}</strong>
                  {intentGap.shortfall > 0 ? (
                    <span className="intent-gap-unmet" style={{ marginLeft: 12 }}>
                      {intentGap.shortfall} domain{intentGap.shortfall !== 1 ? 's' : ''} below required level {intentGap.requiredLevel}
                    </span>
                  ) : (
                    <span className="intent-gap-met" style={{ marginLeft: 12 }}>All domains meet required level</span>
                  )}
                </div>
              )}

              {/* Use-case view — good enough / partially / not good enough */}
              <div className="enables-use-cases">
                {(() => {
                  const supportedSet = new Map<string, string[]>();
                  const unsupportedSet = new Map<string, { domains: string[]; minLevel: number }>();

                  for (const d of enablesData) {
                    for (const s of d.supports) {
                      if (!supportedSet.has(s)) supportedSet.set(s, []);
                      supportedSet.get(s)!.push(d.name);
                    }
                    for (const s of d.does_not_support) {
                      if (s.startsWith('None')) continue;
                      if (!unsupportedSet.has(s)) unsupportedSet.set(s, { domains: [], minLevel: 5 });
                      const entry = unsupportedSet.get(s)!;
                      entry.domains.push(d.name);
                      entry.minLevel = Math.min(entry.minLevel, d.level);
                    }
                  }

                  const goodEnough = Array.from(supportedSet.entries())
                    .filter(([cap]) => !unsupportedSet.has(cap))
                    .sort((a, b) => b[1].length - a[1].length);

                  const notYet = Array.from(unsupportedSet.entries())
                    .sort((a, b) => a[1].minLevel - b[1].minLevel);

                  const partial = Array.from(supportedSet.entries())
                    .filter(([cap]) => unsupportedSet.has(cap));

                  const totalCaps = goodEnough.length + partial.length + notYet.filter(([cap]) => !supportedSet.has(cap)).length;

                  return (
                    <>
                      {/* Narrative summary of overall data capability */}
                      <div className="enables-narrative-summary">
                        {goodEnough.length === 0 && partial.length === 0 ? (
                          <p>No capabilities are fully supported by current data quality. Every decision area has at least one domain where data inputs are too weak to act on with confidence. This means the organisation is operating without reliable evidence in most areas that matter for GreenOps, sustainability reporting, and operational efficiency.</p>
                        ) : goodEnough.length > 0 && notYet.length > 0 ? (
                          <p>Of the {totalCaps} capabilities assessed, <strong>{goodEnough.length}</strong> are fully supported by current data, <strong>{partial.length}</strong> have inconsistent coverage across domains, and <strong>{notYet.filter(([cap]) => !supportedSet.has(cap)).length}</strong> are blocked by data gaps. The good-enough capabilities provide a foundation — but the blocked items represent real constraints on what the organisation can report, optimise, or govern with confidence.</p>
                        ) : (
                          <p>All assessed capabilities are supported by current data quality. This is a strong position — the organisation has the data foundation needed for its stated goals. The focus should shift from closing gaps to embedding data into operational governance and continuous improvement.</p>
                        )}
                      </div>

                      {goodEnough.length > 0 && (
                        <div className="enables-group">
                          <h3 className="enables-group-heading enables-good">Good enough for</h3>
                          <p className="enables-group-narrative">
                            These capabilities are supported by data that is structured, measurable, and consistent enough to inform decisions.
                            The underlying domains have reached a maturity level where the data can be trusted for its intended use — though
                            continued attention to freshness and traceability will maintain that confidence.
                          </p>
                          <div className="enables-cap-list">
                            {goodEnough.slice(0, 12).map(([cap, domains]) => (
                              <div key={cap} className="enables-cap-item enables-cap-good">
                                <span className="enables-cap-text">{cap}</span>
                                <span className="enables-cap-domains">Supported across {domains.length} domain{domains.length !== 1 ? 's' : ''}: {domains.slice(0, 3).join(', ')}{domains.length > 3 ? ` +${domains.length - 3} more` : ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {partial.length > 0 && (
                        <div className="enables-group">
                          <h3 className="enables-group-heading enables-partial">Partially supported — inconsistent across domains</h3>
                          <p className="enables-group-narrative">
                            These capabilities are supported in some domains but not others. In practice this means the organisation can produce
                            partial answers — enough for directional insight in some areas, but not a complete or defensible picture. The risk is
                            that stakeholders assume full coverage when the data only tells part of the story. Closing the gaps in blocking
                            domains would move these from partial to reliable.
                          </p>
                          <div className="enables-cap-list">
                            {partial.slice(0, 10).map(([cap, supportingDomains]) => {
                              const blocking = unsupportedSet.get(cap);
                              return (
                                <div key={cap} className="enables-cap-item enables-cap-partial">
                                  <span className="enables-cap-text">{cap}</span>
                                  <span className="enables-cap-detail">
                                    Supported by: {supportingDomains.slice(0, 2).join(', ')}{supportingDomains.length > 2 ? ` +${supportingDomains.length - 2}` : ''}.
                                    {' '}Blocked by: {blocking?.domains.slice(0, 2).join(', ')}{(blocking?.domains.length || 0) > 2 ? ` +${(blocking?.domains.length || 0) - 2}` : ''}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {notYet.filter(([cap]) => !supportedSet.has(cap)).length > 0 && (
                        <div className="enables-group">
                          <h3 className="enables-group-heading enables-blocked">Not yet good enough for</h3>
                          <p className="enables-group-narrative">
                            These capabilities are blocked by data gaps in one or more domains. The organisation cannot credibly make
                            these decisions today — any attempt to do so would be based on incomplete, inconsistent, or unverifiable data.
                            These represent the strongest case for improvement investment, particularly where the blocked capability aligns
                            with the stated assessment goal.
                          </p>
                          <div className="enables-cap-list">
                            {notYet.filter(([cap]) => !supportedSet.has(cap)).slice(0, 12).map(([cap, info]) => (
                              <div key={cap} className="enables-cap-item enables-cap-blocked">
                                <span className="enables-cap-text">{cap}</span>
                                <span className="enables-cap-domains">Blocked by: {info.domains.slice(0, 3).join(', ')}{info.domains.length > 3 ? ` +${info.domains.length - 3} more` : ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Per-domain detail below for drill-down */}
              <details className="enables-domain-detail">
                <summary className="enables-detail-toggle">View by domain</summary>
                <div className="enables-list" style={{ marginTop: 16 }}>
                  {enablesData
                    .sort((a, b) => a.level - b.level)
                    .map((d) => {
                      const narrative = narratives.find(n => n.domain_id === d.domain_id);
                      return (
                        <div key={d.domain_id} className="enables-card" style={{ borderLeftColor: LEVEL_COLOURS[d.level] }}>
                          <div className="enables-card-header">
                            <div className="enables-title-row">
                              <span className="enables-domain-name">{d.name}</span>
                              <span className={`priority-tag ${d.priority.toLowerCase()}`}>{d.priority}</span>
                            </div>
                            <span className="enables-level-text" style={{ color: LEVEL_COLOURS[d.level] }}>
                              Level {d.level} — {LEVEL_LABELS[d.level]}
                            </span>
                          </div>
                          {narrative?.operational_impact && (
                            <p className="enables-card-narrative">{narrative.operational_impact}</p>
                          )}
                          <div className="enables-card-body">
                            {d.supports.length > 0 && (
                              <div className="enables-section enables-supports">
                                <span className="enables-label">Good enough for</span>
                                <ul className="enables-items-list">
                                  {d.supports.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                              </div>
                            )}
                            {d.does_not_support.length > 0 && !d.does_not_support[0]?.startsWith('None') && (
                              <div className="enables-section enables-gaps">
                                <span className="enables-label">Not yet good enough for</span>
                                <ul className="enables-items-list">
                                  {d.does_not_support.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                              </div>
                            )}
                            {d.flags.length > 0 && (
                              <div className="enables-section enables-flags">
                                <span className="enables-label">Caveats</span>
                                <ul className="enables-items-list">
                                  {d.flags.map((f, i) => <li key={i}>{f}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                          {(narrative?.misinterpretation_risk || narrative?.cross_domain_diagnosis) && (
                            <div className="enables-card-warnings">
                              {narrative?.misinterpretation_risk && (
                                <div className="enables-warning enables-misinterp">
                                  <span className="enables-warning-label">What this costs you</span>
                                  <p>{narrative.misinterpretation_risk}</p>
                                </div>
                              )}
                              {narrative?.cross_domain_diagnosis && (
                                <div className="enables-warning enables-crossdomain">
                                  <span className="enables-warning-label">Cross-domain interaction</span>
                                  <p>{narrative.cross_domain_diagnosis}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </details>
            </div>
          )}

          {/* ═══ WHERE TO FOCUS ═══ */}
          {activeTab === 'focus' && (
            <div className="focus-panel">
              <p className="section-subtext">
                Improvement actions grouped into three phases.
                <strong> Foundation</strong> builds basic capability.
                <strong> Quick wins</strong> unlock specific decisions.
                <strong> Transformation</strong> embeds data into governance.
              </p>

              {/* Intent gap — domains that need fixing to meet stated goal */}
              {intentGap && intentGap.shortfall > 0 && (
                <div className="focus-intent-gap">
                  <h3 className="section-heading" style={{ fontSize: '0.9375rem' }}>
                    Priority: close the gap to your stated goal
                  </h3>
                  <p className="focus-intent-text">
                    To support <strong>{intentGap.label}</strong>, all domains need to reach at least level {intentGap.requiredLevel}.
                    These {intentGap.shortfall} domains fall short:
                  </p>
                  <div className="focus-intent-list">
                    {intentGap.gaps.map((g) => (
                      <div key={g.name} className="focus-intent-item">
                        <span className={`level-badge l${g.level}`}>Level {g.level}</span>
                        <span className="focus-intent-domain">{g.name}</span>
                        <span className="focus-intent-needed">needs level {g.needed}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Limiting factors — cascade constraints */}
              {limitingFactors.length > 0 && (
                <div className="focus-limiting">
                  <h3 className="section-heading" style={{ fontSize: '0.9375rem' }}>
                    Fix these first — they constrain downstream calculations
                  </h3>
                  <div className="limiting-list">
                    {limitingFactors.map((f) => (
                      <div key={f.domain_id} className="limiting-item">
                        <div className="limiting-item-header">
                          <span className={`level-badge l${f.maturity}`}>Level {f.maturity}</span>
                          <strong>{f.domain_name}</strong>
                        </div>
                        <p className="limiting-item-impact">
                          Constrains: {f.affected.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(['Foundation', 'Quick win', 'Transformation'] as const).map((phase) => {
                const domainMap = groupedRecs[phase];
                if (!domainMap || domainMap.size === 0) return null;
                const totalActions = Array.from(domainMap.values()).reduce((s, r) => s + r.length, 0);
                return (
                  <div key={phase} className="focus-phase-group">
                    <div className="focus-phase-header">
                      <span className={`phase-tag phase-${phase.toLowerCase().replace(/\s/g, '-')}`}>{phase}</span>
                      <span className="focus-phase-count">{domainMap.size} domain{domainMap.size !== 1 ? 's' : ''}, {totalActions} action{totalActions !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="focus-domain-groups">
                      {Array.from(domainMap.entries()).map(([domainName, recs]) => (
                        <div key={domainName} className="focus-domain-group">
                          <div className="focus-domain-header">
                            <span className="focus-domain-name">{domainName}</span>
                            <span className={`priority-tag ${recs[0].priority.toLowerCase()}`}>{recs[0].priority}</span>
                          </div>
                          <p className="focus-reason">{recs[0].reason}</p>
                          <div className="focus-actions-list">
                            {recs.map((rec, i) => (
                              <div key={i} className="focus-action-item">
                                <span className="focus-action-bullet" />
                                <span className="focus-action-text">{rec.action}</span>
                              </div>
                            ))}
                          </div>
                          {recs[0].benefit && (
                            <p className="focus-benefit">{recs[0].benefit}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ DECISION READINESS ═══ */}
          {activeTab === 'readiness' && (
            <div className="readiness-panel">
              <p className="section-subtext">
                Can your data answer the questions that matter? Each question maps to the domains that
                feed it — readiness is set by the weakest input.
              </p>

              {/* Summary strip */}
              {(() => {
                const drMap = new Map(decisionReadiness.map(dr => [dr.area, dr]));
                const belowDecisionGrade = decisionReadiness.filter(
                  dr => dr.readiness === 'reporting_only' || dr.readiness === 'directional'
                ).length;

                // Persona-grouped decision questions
                const PERSONA_GROUPS: {
                  persona: string;
                  description: string;
                  questions: { question: string; areas: string[]; }[];
                }[] = [
                  {
                    persona: 'Sustainability and reporting',
                    description: 'Can we produce credible environmental reports and meet disclosure requirements?',
                    questions: [
                      { question: 'Can we credibly report our carbon footprint?', areas: ['footprint reporting'] },
                      { question: 'Can we set and track environmental targets?', areas: ['target setting and governance', 'operational improvement tracking'] },
                    ],
                  },
                  {
                    persona: 'Infrastructure and operations',
                    description: 'Can we identify waste, optimise resources, and justify efficiency investments?',
                    questions: [
                      { question: 'Can we find where energy and resources are being wasted?', areas: ['hotspot identification'] },
                      { question: 'Can we rightsize or decommission with confidence?', areas: ['rightsizing and decommissioning'] },
                      { question: 'Can we make evidence-based refresh and lifecycle decisions?', areas: ['refresh and lifecycle decisions'] },
                      { question: 'Can we optimise workload placement by cost, carbon, or efficiency?', areas: ['workload placement'] },
                    ],
                  },
                  {
                    persona: 'Procurement and finance',
                    description: 'Can we attribute costs and carbon, challenge suppliers, and support business cases?',
                    questions: [
                      { question: 'Can we challenge supplier efficiency and sustainability claims?', areas: ['supplier challenge'] },
                      { question: 'Can we attribute consumption to services, teams, or business units?', areas: ['non-IT load allocation', 'service-level optimisation'] },
                    ],
                  },
                  {
                    persona: 'Cloud and AI governance',
                    description: 'Can we govern cloud spend and AI demand with environmental and efficiency data?',
                    questions: [
                      { question: 'Can we optimise cloud cost and carbon together?', areas: ['cloud optimisation'] },
                      { question: 'Can we govern AI infrastructure demand and efficiency?', areas: ['AI demand governance and optimisation'] },
                    ],
                  },
                ];

                // Helper: get best readiness for a question (from its mapped areas)
                const getQuestionReadiness = (areas: string[]) => {
                  const matched = areas.map(a => drMap.get(a)).filter(Boolean) as typeof decisionReadiness;
                  if (matched.length === 0) return { readiness: 'reporting_only' as const, label: 'No data', limiting: [] as string[], summary: '' };
                  // Use the worst readiness among matched areas
                  const order: Record<string, number> = { reporting_only: 0, directional: 1, decision_grade: 2, optimisation_grade: 3 };
                  const worst = matched.reduce((w, dr) => order[dr.readiness] < order[w.readiness] ? dr : w);
                  const allLimiting = [...new Set(matched.flatMap(dr => dr.limiting_domains))];
                  return { readiness: worst.readiness, label: worst.label, limiting: allLimiting, summary: worst.summary };
                };

                const readinessIcon = (r: string) => {
                  if (r === 'optimisation_grade') return '●';
                  if (r === 'decision_grade') return '●';
                  if (r === 'directional') return '◐';
                  return '○';
                };

                return (
                  <>
                    <div className="readiness-summary-strip">
                      <p className="readiness-summary-note">
                        <strong>{belowDecisionGrade} of {decisionReadiness.length}</strong> decision areas
                        are below decision-grade. Data gaps are limiting what the organisation can confidently act on.
                      </p>
                    </div>

                    <div className="readiness-personas">
                      {PERSONA_GROUPS.map((group) => (
                        <div key={group.persona} className="readiness-persona-group">
                          <div className="readiness-persona-header">
                            <h3 className="readiness-persona-title">{group.persona}</h3>
                            <p className="readiness-persona-desc">{group.description}</p>
                          </div>
                          <div className="readiness-questions">
                            {group.questions.map((q) => {
                              const qr = getQuestionReadiness(q.areas);
                              const colour = READINESS_COLOURS[qr.readiness] || '#94a3b8';
                              return (
                                <div key={q.question} className="readiness-question-row">
                                  <span className="readiness-q-icon" style={{ color: colour }}>{readinessIcon(qr.readiness)}</span>
                                  <div className="readiness-q-content">
                                    <span className="readiness-q-text">{q.question}</span>
                                    <div className="readiness-q-answer">
                                      <span className="readiness-q-badge" style={{ background: colour }}>{qr.label}</span>
                                      {qr.limiting.length > 0 && (
                                        <span className="readiness-q-constraint">
                                          Constrained by: {qr.limiting.join(', ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Collapsible original detail */}
                    <details className="readiness-raw-detail">
                      <summary className="enables-detail-toggle">View all decision areas</summary>
                      <div className="readiness-grid-v2" style={{ marginTop: 16 }}>
                        {decisionReadiness.map((dr) => {
                          const colour = READINESS_COLOURS[dr.readiness] || '#94a3b8';
                          return (
                            <div key={dr.area} className="readiness-card-v2" style={{ borderLeftColor: colour }}>
                              <div className="readiness-header-v2">
                                <span className="readiness-area-v2">{dr.area}</span>
                                <span className="readiness-badge-v2" style={{ background: colour }}>
                                  {dr.label}
                                </span>
                              </div>
                              {dr.summary && <p className="readiness-summary-v2">{dr.summary}</p>}
                              <div className="readiness-domains-v2">
                                {dr.limiting_domains.length > 0 && (
                                  <div className="readiness-domain-row">
                                    <span className="readiness-row-label constraint">Constrained by</span>
                                    <div className="readiness-chips">
                                      {dr.limiting_domains.map((d) => (
                                        <span key={d} className="readiness-chip constraint">{d}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </>
                );
              })()}
            </div>
          )}

          {/* ═══ DOMAIN DETAIL ═══ */}
          {activeTab === 'detail' && (
            <div className="analysis-list">
              {narratives.map((n) => {
                const result = results.find((r) => r.domain_id === n.domain_id);
                const domain = model.domains.find((d) => d.id === n.domain_id);
                return (
                  <div key={n.domain_id} className="analysis-card">
                    <div className="analysis-header">
                      <h3>{n.domain_name}</h3>
                      <span className={`level-badge l${n.maturity_level}`}>{levelLabel(Number(n.maturity_level))}</span>
                    </div>
                    <div className="analysis-body-grid">
                      {/* Left column — data quality narrative */}
                      <div className="analysis-col-main">
                        {n.operational_impact && (
                          <div className="analysis-section">
                            <h4>What This Data Quality Means</h4>
                            <p>{n.operational_impact}</p>
                          </div>
                        )}
                        {n.dimension_analysis && (
                          <div className="analysis-section">
                            <h4>Dimension Breakdown</h4>
                            <p>{n.dimension_analysis}</p>
                            {result && Object.keys(result.dimension_scores).length > 0 && (
                              <div className="dimension-bars">
                                {Object.entries(result.dimension_scores).map(([dim, score]) => (
                                  <div key={dim} className="dimension-bar-row">
                                    <span className="dim-label">{dim.replace(/_/g, ' ')}</span>
                                    <div className="dim-bar-track">
                                      <div className={`dim-bar-fill ${score <= 2 ? 'weak' : score >= 4 ? 'strong' : 'mid'}`} style={{ width: `${(score / 5) * 100}%` }} />
                                    </div>
                                    <span className="dim-score">{score}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {n.decision_support_summary && (
                          <div className="analysis-section">
                            <h4>What This Data Supports</h4>
                            <p>{n.decision_support_summary}</p>
                          </div>
                        )}
                        {n.improvement_guidance && (
                          <div className="analysis-section">
                            <h4>Path Forward</h4>
                            <p>{n.improvement_guidance}</p>
                          </div>
                        )}
                      </div>

                      {/* Right column — risks, cascade, warnings */}
                      <div className="analysis-col-risk">
                        {n.risk_statement && (
                          <div className="analysis-section risk-section">
                            <h4>Data Credibility</h4>
                            <p>{n.risk_statement}</p>
                          </div>
                        )}
                        {n.misinterpretation_risk && (
                          <div className="analysis-section misinterpretation-section">
                            <h4>Misinterpretation Risk</h4>
                            <p>{n.misinterpretation_risk}</p>
                          </div>
                        )}
                        {n.cascade_note && (
                          <div className="analysis-section cascade-section">
                            <h4>Calculation Dependencies</h4>
                            <p>{n.cascade_note}</p>
                          </div>
                        )}
                        {n.cross_domain_diagnosis && (
                          <div className="analysis-section cross-domain-section">
                            <h4>Cross-Domain Interaction</h4>
                            <p>{n.cross_domain_diagnosis}</p>
                          </div>
                        )}
                        {n.weakness_flags.length > 0 && (
                          <div className="analysis-section caveats">
                            <h4>Scoring Caveats</h4>
                            {n.weakness_flags.map((f, i) => <p key={i} className="caveat-flag">{f}</p>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Item 4: PDF Section Selection Modal ═══ */}
      {showPDFModal && (
        <div className="modal-backdrop" onClick={() => setShowPDFModal(false)} role="dialog" aria-modal="true" aria-label="Select PDF report sections">
          <div className="modal-content pdf-section-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Export PDF report</h3>
            <p className="modal-subtitle">Select which sections to include. Different stakeholders need different views.</p>
            <div className="pdf-section-list" role="group" aria-label="Report sections">
              {(Object.keys(pdfSections) as (keyof PDFSectionOptions)[]).map((key) => (
                <label key={key} className="pdf-section-item">
                  <input
                    type="checkbox"
                    checked={pdfSections[key]}
                    onChange={(e) => setPdfSections((prev) => ({ ...prev, [key]: e.target.checked }))}
                    aria-label={PDF_SECTION_LABELS[key]}
                  />
                  <span className="pdf-section-label">{PDF_SECTION_LABELS[key]}</span>
                </label>
              ))}
            </div>
            <div className="pdf-section-presets">
              <button className="btn btn-ghost btn-sm" onClick={() => setPdfSections({
                cover: true, executive_summary: true, overview: true,
                domain_detail: false, recommendations: false, decision_readiness: false,
                methodology: false, appendix: false,
              })}>Leadership summary</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPdfSections({
                cover: true, executive_summary: true, overview: true,
                domain_detail: true, recommendations: true, decision_readiness: true,
                methodology: true, appendix: true,
              })}>Full report</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPdfSections({
                cover: true, executive_summary: false, overview: false,
                domain_detail: true, recommendations: true, decision_readiness: false,
                methodology: false, appendix: false,
              })}>Technical detail</button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowPDFModal(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={handlePDFExport}>Export PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Item 5: Comparison Upload Modal ═══ */}
      {showComparisonUpload && (
        <div className="modal-backdrop" onClick={() => setShowComparisonUpload(false)} role="dialog" aria-modal="true" aria-label="Upload previous assessment for comparison">
          <div className="modal-content comparison-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Compare with previous assessment</h3>
            <p className="modal-subtitle">Upload a previously saved assessment JSON file to see what changed.</p>
            <div className="comparison-upload-zone">
              <button className="btn btn-outline" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleComparisonUpload(file);
                };
                input.click();
              }}>Select assessment file</button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowComparisonUpload(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Item 5: Comparison Results Panel ═══ */}
      {comparisonResults && (
        <div className="comparison-panel" role="region" aria-label="Assessment comparison">
          <div className="container-wide">
            <div className="comparison-header">
              <h2>Assessment Comparison</h2>
              <div>
                <span className="comparison-dates">
                  {comparisonProfile?.assessment_date || 'Previous'} vs {profile.assessment_date || 'Current'}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => { setComparisonResults(null); setComparisonProfile(null); }}>
                  Close comparison
                </button>
              </div>
            </div>
            <div className="comparison-grid" role="table" aria-label="Domain maturity comparison">
              <div className="comparison-grid-header" role="row">
                <span role="columnheader">Domain</span>
                <span role="columnheader">Previous</span>
                <span role="columnheader">Current</span>
                <span role="columnheader">Change</span>
              </div>
              {results.map((r) => {
                const prev = comparisonResults.find((cr) => cr.domain_id === r.domain_id);
                const prevLevel = prev?.effective_maturity || 0;
                const delta = r.effective_maturity - prevLevel;
                const d = model.domains.find((dd) => dd.id === r.domain_id);
                return (
                  <div key={r.domain_id} className="comparison-grid-row" role="row">
                    <span className="comparison-domain-name" role="cell">{d?.name || r.domain_id}</span>
                    <span role="cell">
                      <span className={`level-badge l${prevLevel}`} aria-label={`Previous level ${prevLevel}`}>
                        <span className="level-badge-icon" aria-hidden="true">{prevLevel}</span>
                        Level {prevLevel}
                      </span>
                    </span>
                    <span role="cell">
                      <span className={`level-badge l${r.effective_maturity}`} aria-label={`Current level ${r.effective_maturity}`}>
                        <span className="level-badge-icon" aria-hidden="true">{r.effective_maturity}</span>
                        Level {r.effective_maturity}
                      </span>
                    </span>
                    <span role="cell" className={`comparison-delta ${delta > 0 ? 'improved' : delta < 0 ? 'regressed' : 'unchanged'}`}>
                      {delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
