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

interface Props {
  model: MaturityModel;
  profile: OrganisationProfile;
  results: DomainAssessment[];
  onExportPDF: () => void;
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

  return (
    <div className="results-page">
      <div className="container-wide">
        {/* Header */}
        <div className="results-header">
          <div>
            <h1 className="results-title">Assessment Results</h1>
            <p className="results-org">{profile.organisation_name} — {profile.assessment_date}</p>
          </div>
          <div className="results-actions">
            <button className="btn btn-ghost" onClick={onBack}>Back to assessment</button>
            <button className="btn btn-ghost" onClick={onStartOver}>Start over</button>
            <button className="btn btn-outline" onClick={handleSave}>Save progress</button>
            <button className="btn btn-ghost" onClick={onExportCSV}>Export CSV</button>
            <button className="btn btn-accent" onClick={onExportPDF}>Export PDF report</button>
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

              {/* Confidence and intent banner */}
              <div className="overview-confidence-banner">
                <div className="confidence-row">
                  <div className="confidence-indicator">
                    <span className={`confidence-badge confidence-${overallConfidence}`}>
                      {overallConfidence.charAt(0).toUpperCase() + overallConfidence.slice(1)} confidence
                    </span>
                    <span className="confidence-desc">{CONFIDENCE_DESCRIPTIONS[overallConfidence]}</span>
                  </div>
                  {intentGap && (
                    <div className="intent-gap-indicator">
                      <span className="intent-gap-label">Goal: {intentGap.label}</span>
                      {intentGap.shortfall === 0 ? (
                        <span className="intent-gap-met">All domains meet the required level {intentGap.requiredLevel}</span>
                      ) : (
                        <span className="intent-gap-unmet">
                          {intentGap.shortfall} of {intentGap.total} domains fall short of level {intentGap.requiredLevel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Stat strip */}
              <div className="overview-summary-strip">
                <div className="summary-stat-grid">
                  <div className="summary-stat">
                    <span className="summary-stat-value">{stats.weightedMaturity}</span>
                    <span className="summary-stat-label">Overall maturity<br />(out of 5)</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-stat-value">{stats.minMaturity}–{stats.maxMaturity}</span>
                    <span className="summary-stat-label">Maturity range<br />across domains</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-stat-value summary-stat-alert">{belowThree}</span>
                    <span className="summary-stat-label">Domains below<br />level 3</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-stat-value summary-stat-good">{atFourPlus}</span>
                    <span className="summary-stat-label">Domains at<br />level 4+</span>
                  </div>
                </div>
              </div>

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
                What decisions can your current data credibly support? Priority reflects the gap between
                domain importance and data quality.
              </p>
              <div className="enables-list">
                {enablesData
                  .sort((a, b) => {
                    const pOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                    return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
                  })
                  .map((d) => (
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
                      <div className="enables-card-body">
                        {d.supports.length > 0 && (
                          <div className="enables-section enables-supports">
                            <span className="enables-label">Supports</span>
                            <ul className="enables-items-list">
                              {d.supports.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                        {d.does_not_support.length > 0 && !d.does_not_support[0]?.startsWith('None') && (
                          <div className="enables-section enables-gaps">
                            <span className="enables-label">Not yet sufficient for</span>
                            <ul className="enables-items-list">
                              {d.does_not_support.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                        {d.flags.length > 0 && (
                          <div className="enables-section enables-flags">
                            <span className="enables-label">Caveats</span>
                            <span className="enables-items">{d.flags.join('; ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
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
                Can your data support the decisions you need to make? Readiness is set by the weakest input —
                one weak link constrains the whole decision area.
              </p>

              {/* Summary strip */}
              <div className="readiness-summary-strip">
                <div className="readiness-summary-counts">
                  {(['optimisation_grade', 'decision_grade', 'directional', 'reporting_only'] as const).map((level) => {
                    const count = decisionReadiness.filter(dr => dr.readiness === level).length;
                    if (count === 0) return null;
                    const labels: Record<string, string> = {
                      optimisation_grade: 'Optimisation-grade',
                      decision_grade: 'Decision-grade',
                      directional: 'Directional only',
                      reporting_only: 'Reporting only',
                    };
                    return (
                      <div key={level} className="readiness-summary-item">
                        <span className="readiness-summary-count" style={{ color: READINESS_COLOURS[level] || '#94a3b8' }}>{count}</span>
                        <span className="readiness-summary-label">{labels[level]}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="readiness-summary-note">
                  {decisionReadiness.filter(dr => dr.readiness === 'reporting_only' || dr.readiness === 'directional').length} of {decisionReadiness.length} decision areas
                  are below decision-grade — data gaps are limiting what the organisation can confidently act on.
                </p>
              </div>
              <div className="readiness-grid-v2">
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

                      {dr.summary && (
                        <p className="readiness-summary-v2">{dr.summary}</p>
                      )}

                      {/* Visual bar showing readiness level */}
                      <div className="readiness-bar-wrapper">
                        <div className="readiness-bar-track">
                          <div
                            className="readiness-bar-fill"
                            style={{
                              width: `${dr.readiness === 'reporting_only' ? 15 : dr.readiness === 'directional' ? 40 : dr.readiness === 'decision_grade' ? 75 : 95}%`,
                              background: colour,
                            }}
                          />
                        </div>
                        <div className="readiness-bar-labels">
                          <span>Reporting</span>
                          <span>Directional</span>
                          <span>Decision-grade</span>
                          <span>Optimisation</span>
                        </div>
                      </div>

                      {/* Constraining and supporting domains as compact chips */}
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
                        {dr.supporting_domains.length > 0 && (
                          <div className="readiness-domain-row">
                            <span className="readiness-row-label supporting">Supporting</span>
                            <div className="readiness-chips">
                              {dr.supporting_domains.map((d) => (
                                <span key={d} className="readiness-chip supporting">{d}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* One-line remediation hint only if useful */}
                      {dr.limiting_domains.length === 1 && dr.summary.includes('improves to level 3') && (
                        <p className="readiness-hint-v2">
                          Fixing {dr.limiting_domains[0].toLowerCase()} would unlock decision-grade readiness here.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
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
    </div>
  );
}
