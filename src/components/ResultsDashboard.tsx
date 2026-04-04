import { Fragment, useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  Cell, Legend,
} from 'recharts';
import { MaturityModel, DomainAssessment, OrganisationProfile } from '../types';
import { calculateOverallStats, getAnswerPatternSummary } from '../lib/scoring';
import { generateDomainNarratives, DomainNarrative } from '../lib/narrativeAnalysis';
import { generateRecommendations, generateExecutiveSummary } from '../lib/recommendations';
import { generateDecisionReadiness } from '../lib/decisionReadiness';

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
const LEVEL_LABELS: Record<number, string> = {
  1: 'Ad hoc', 2: 'Repeatable', 3: 'Defined', 4: 'Managed', 5: 'Optimising',
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
  const execSummary = useMemo(() => generateExecutiveSummary(results, model), [results, model]);

  // Bar chart data — sorted weakest first
  const barData = useMemo(() => {
    return [...results]
      .sort((a, b) => a.effective_maturity - b.effective_maturity)
      .map((r) => {
        const d = model.domains.find((dd) => dd.id === r.domain_id);
        return {
          name: d?.name || r.domain_id,
          maturity: r.effective_maturity,
          target: r.target_maturity,
          gap: r.target_maturity - r.effective_maturity,
        };
      });
  }, [results, model]);

  // Radar data
  const radarData = useMemo(() => {
    return results.map((r) => {
      const d = model.domains.find((dd) => dd.id === r.domain_id);
      const label = d?.name || r.domain_id;
      return {
        domain: label.length > 25 ? label.slice(0, 23) + '…' : label,
        maturity: r.effective_maturity,
        target: r.target_maturity,
      };
    });
  }, [results, model]);

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

  // Roadmap grouped by phase
  const groupedRecs = useMemo(() => {
    const groups: Record<string, typeof recommendations> = {
      'Foundation': [],
      'Quick win': [],
      'Transformation': [],
    };
    for (const rec of recommendations) {
      if (groups[rec.phase]) groups[rec.phase].push(rec);
    }
    return groups;
  }, [recommendations]);

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
            <button className="btn btn-outline" onClick={handleSave}>Save assessment</button>
            <button className="btn btn-primary" onClick={onExportCSV}>Export CSV</button>
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
              {/* Maturity bar chart — weakest domains first */}
              <div className="overview-chart-section">
                <h3 className="section-heading">Data maturity by domain</h3>
                <p className="section-subtext">
                  Each bar shows the assessed data maturity level (1–5) for that domain.
                  Domains are ordered from weakest to strongest. The dashed line shows the target level.
                </p>
                <ResponsiveContainer width="100%" height={Math.max(barData.length * 44, 400)}>
                  <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" horizontal={false} />
                    <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={240}
                      tick={{ fontSize: 12, fill: '#495057' }}
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
                    <Bar dataKey="maturity" radius={[0, 4, 4, 0]} barSize={24}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={LEVEL_COLOURS[entry.maturity] || '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Radar — current vs target */}
              <div className="overview-chart-section">
                <h3 className="section-heading">Maturity profile</h3>
                <p className="section-subtext">
                  The green area shows your current maturity. The grey outline shows the target maturity for each domain.
                  The gap between the two shows where improvement is most needed.
                </p>
                <ResponsiveContainer width="100%" height={420}>
                  <RadarChart data={radarData} outerRadius="70%">
                    <PolarGrid stroke="#e9ecef" />
                    <PolarAngleAxis dataKey="domain" tick={{ fontSize: 9, fill: '#495057' }} />
                    <Radar name="Current maturity" dataKey="maturity" stroke="#5AA63E" fill="#5AA63E" fillOpacity={0.3} />
                    <Radar name="Target" dataKey="target" stroke="#94a3b8" fill="none" strokeDasharray="4 4" />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Narrative summary */}
              <div className="overview-narrative">
                <h3 className="section-heading">Summary</h3>
                <div className="summary-text">
                  {execSummary.split('\n\n').map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ WHAT YOUR DATA ENABLES ═══ */}
          {activeTab === 'enables' && (
            <div className="enables-panel">
              <p className="section-subtext" style={{ marginBottom: 'var(--space-lg)' }}>
                Based on the data quality assessed in each domain, this table shows what decisions your current data
                can support and what it cannot yet support. Priority reflects the gap between how important the domain
                is and how mature the data is.
              </p>
              <div className="enables-list">
                {enablesData
                  .sort((a, b) => {
                    const pOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
                    return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
                  })
                  .map((d) => (
                    <div key={d.domain_id} className="enables-card">
                      <div className="enables-card-header">
                        <div className="enables-domain-name">{d.name}</div>
                        <div className="enables-badges">
                          <span className={`level-badge l${d.level}`}>{levelLabel(d.level)}</span>
                          <span className={`priority-tag ${d.priority.toLowerCase()}`}>{d.priority} priority</span>
                        </div>
                      </div>
                      <div className="enables-card-body">
                        {d.supports.length > 0 && (
                          <div className="enables-section enables-supports">
                            <span className="enables-label">Your data supports:</span>
                            <span className="enables-items">{d.supports.join('; ')}</span>
                          </div>
                        )}
                        {d.does_not_support.length > 0 && !d.does_not_support[0]?.startsWith('None') && (
                          <div className="enables-section enables-gaps">
                            <span className="enables-label">Not yet sufficient for:</span>
                            <span className="enables-items">{d.does_not_support.join('; ')}</span>
                          </div>
                        )}
                        {d.flags.length > 0 && (
                          <div className="enables-section enables-flags">
                            <span className="enables-label">Caveats:</span>
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
              <p className="section-subtext" style={{ marginBottom: 'var(--space-lg)' }}>
                Improvement actions are grouped into three phases. <strong>Foundation</strong> actions build
                basic data capability where it is missing. <strong>Quick wins</strong> are targeted improvements
                that unlock specific decisions. <strong>Transformation</strong> actions embed data into operational
                governance and continuous improvement.
              </p>
              {(['Foundation', 'Quick win', 'Transformation'] as const).map((phase) => {
                const recs = groupedRecs[phase];
                if (!recs || recs.length === 0) return null;
                return (
                  <div key={phase} className="focus-phase-group">
                    <h3 className="focus-phase-heading">
                      <span className="phase-tag">{phase}</span>
                      <span className="focus-phase-count">{recs.length} action{recs.length !== 1 ? 's' : ''}</span>
                    </h3>
                    <div className="focus-cards">
                      {recs.map((rec, i) => (
                        <div key={i} className="focus-card">
                          <div className="focus-card-top">
                            <span className={`priority-tag ${rec.priority.toLowerCase()}`}>{rec.priority}</span>
                            <span className="focus-domain">{rec.domain_name}</span>
                          </div>
                          <div className="focus-action">{rec.action}</div>
                          <div className="focus-reason">{rec.reason}</div>
                          {rec.benefit && (
                            <div className="focus-benefit">{rec.benefit}</div>
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
              <p className="section-subtext" style={{ marginBottom: 'var(--space-lg)' }}>
                Each row represents a type of decision your organisation might want to make.
                Readiness is determined by the weakest supporting domain — one weak link constrains what
                you can do, regardless of how strong other data is.
              </p>
              <div className="readiness-cards">
                {decisionReadiness.map((dr) => (
                  <div key={dr.area} className="readiness-card">
                    <div className="readiness-card-header">
                      <span className="readiness-area-name">{dr.area}</span>
                      <span className={`readiness-badge ${dr.readiness}`}>{dr.label}</span>
                    </div>
                    <p className="readiness-summary">{dr.summary}</p>
                    {dr.limiting_domains.length > 0 && (
                      <div className="readiness-limiters">
                        <span className="readiness-limiter-label">Constrained by:</span> {dr.limiting_domains.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ DOMAIN DETAIL ═══ */}
          {activeTab === 'detail' && (
            <div className="analysis-list">
              {narratives.map((n) => {
                const result = results.find((r) => r.domain_id === n.domain_id);
                const domain = model.domains.find((d) => d.id === n.domain_id);
                const patterns = result && domain ? getAnswerPatternSummary(domain, result.question_answers) : null;
                return (
                  <div key={n.domain_id} className="analysis-card">
                    <div className="analysis-header">
                      <h3>{n.domain_name}</h3>
                      <span className={`level-badge l${n.maturity_level}`}>{levelLabel(Number(n.maturity_level))}</span>
                    </div>
                    <div className="analysis-body">
                      {n.operational_impact && (
                        <div className="analysis-section">
                          <h4>What this means</h4>
                          <p>{n.operational_impact}</p>
                        </div>
                      )}
                      {n.dimension_analysis && (
                        <div className="analysis-section">
                          <h4>Dimension breakdown</h4>
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
                      {n.risk_statement && (
                        <div className="analysis-section risk-section">
                          <h4>Risk</h4>
                          <p>{n.risk_statement}</p>
                        </div>
                      )}
                      {n.decision_support_summary && (
                        <div className="analysis-section">
                          <h4>Decision support</h4>
                          <p>{n.decision_support_summary}</p>
                        </div>
                      )}
                      {n.improvement_guidance && (
                        <div className="analysis-section">
                          <h4>What to improve</h4>
                          <p>{n.improvement_guidance}</p>
                        </div>
                      )}
                      {n.weakness_flags.length > 0 && (
                        <div className="analysis-section caveats">
                          <h4>Caveats</h4>
                          {n.weakness_flags.map((f, i) => <p key={i} className="caveat-flag">{f}</p>)}
                        </div>
                      )}
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
