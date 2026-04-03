import { Fragment, useState, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ReferenceLine,
} from 'recharts';
import { MaturityModel, DomainAssessment, OrganisationProfile } from '../types';
import { calculateOverallStats, getQuadrant, getAnswerPatternSummary } from '../lib/scoring';
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

type Tab = 'summary' | 'scores' | 'analysis' | 'visualizations' | 'readiness' | 'roadmap';

const TAB_LABELS: Record<Tab, string> = {
  summary: 'Executive Summary',
  scores: 'Domain Scores',
  analysis: 'Detailed Analysis',
  visualizations: 'Visualisations',
  readiness: 'Decision Readiness',
  roadmap: 'Improvement Roadmap',
};

export default function ResultsDashboard({
  model, profile, results, onExportPDF, onExportCSV, onBack, onStartOver,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  const stats = useMemo(() => calculateOverallStats(results), [results]);
  const narratives = useMemo(() => generateDomainNarratives(results, model), [results, model]);
  const recommendations = useMemo(() => generateRecommendations(results, model), [results, model]);
  const decisionReadiness = useMemo(() => generateDecisionReadiness(results, model), [results, model]);
  const execSummary = useMemo(() => generateExecutiveSummary(results, model), [results, model]);

  // Scatter data
  const scatterData = results.map((r) => {
    const d = model.domains.find((dd) => dd.id === r.domain_id);
    return {
      name: d?.name || r.domain_id,
      x: r.effective_maturity,
      y: r.impact_score,
      confidence: r.confidence_score,
      quadrant: getQuadrant(r.effective_maturity, r.impact_score),
    };
  });

  // Radar data
  const radarData = results.map((r) => {
    const d = model.domains.find((dd) => dd.id === r.domain_id);
    const label = d?.name || r.domain_id;
    return {
      domain: label.length > 20 ? label.slice(0, 18) + '…' : label,
      maturity: r.effective_maturity,
      impact: r.impact_score,
      target: r.target_maturity,
    };
  });

  // Heatmap data
  const heatmapData = results.map((r) => {
    const d = model.domains.find((dd) => dd.id === r.domain_id);
    return {
      domain_id: r.domain_id,
      name: d?.name || r.domain_id,
      maturity: r.effective_maturity,
      impact: r.impact_score,
      confidence: r.confidence_score,
      gap: r.target_maturity - r.effective_maturity,
    };
  });

  return (
    <div className="results-page">
      <div className="container-wide">
        {/* Header */}
        <div className="results-header">
          <div>
            <h1 className="results-title">Assessment Results</h1>
            <p className="results-org">{profile.organisation_name}</p>
          </div>
          <div className="results-actions">
            <button className="btn btn-ghost" onClick={onBack}>Back to assessment</button>
            <button className="btn btn-ghost" onClick={onStartOver}>Start over</button>
            <button className="btn btn-primary" onClick={onExportCSV}>Export CSV</button>
            <button className="btn btn-accent" onClick={onExportPDF}>Export PDF</button>
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
          {/* EXECUTIVE SUMMARY */}
          {activeTab === 'summary' && (
            <div className="summary-panel">
              <div className="stat-cards">
                <div className="stat-card">
                  <div className="stat-value">{stats.weightedMaturity}</div>
                  <div className="stat-label">Weighted maturity</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.minMaturity} — {stats.maxMaturity}</div>
                  <div className="stat-label">Range</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{results.filter(r => r.priority === 'High').length}</div>
                  <div className="stat-label">High priority domains</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{results.filter(r => r.effective_maturity < 3).length}</div>
                  <div className="stat-label">Below decision-grade</div>
                </div>
              </div>
              <div className="summary-text">
                {execSummary.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
          )}

          {/* DOMAIN SCORES TABLE */}
          {activeTab === 'scores' && (
            <div className="domain-table-wrapper">
              <table className="domain-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Calculated</th>
                    <th>Override</th>
                    <th>Effective</th>
                    <th>Impact</th>
                    <th>Confidence</th>
                    <th>Priority</th>
                    <th>Decision Support</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const d = model.domains.find((dd) => dd.id === r.domain_id);
                    return (
                      <tr key={r.domain_id}>
                        <td className="domain-name-cell">{d?.name || r.domain_id}</td>
                        <td><span className={`level-badge l${r.calculated_maturity}`}>{r.calculated_maturity}</span></td>
                        <td>{r.assessor_override !== null ? <span className={`level-badge l${r.assessor_override}`}>{r.assessor_override}</span> : '—'}</td>
                        <td><span className={`level-badge l${r.effective_maturity}`}>{r.effective_maturity}</span></td>
                        <td>{r.impact_score}</td>
                        <td>{r.confidence_score}</td>
                        <td><span className={`priority-tag ${r.priority.toLowerCase()}`}>{r.priority}</span></td>
                        <td className="ds-cell">{r.decision_support_status}</td>
                        <td className="flags-cell">{r.weakness_flags.length > 0 ? r.weakness_flags.join('; ') : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* DETAILED ANALYSIS */}
          {activeTab === 'analysis' && (
            <div className="analysis-list">
              {narratives.map((n) => {
                const result = results.find((r) => r.domain_id === n.domain_id);
                const domain = model.domains.find((d) => d.id === n.domain_id);
                const patterns = result && domain ? getAnswerPatternSummary(domain, result.question_answers) : null;
                return (
                  <div key={n.domain_id} className="analysis-card">
                    <div className="analysis-header">
                      <h3>{n.domain_name}</h3>
                      <span className={`level-badge l${n.maturity_level}`}>Level {n.maturity_level} — {n.maturity_label}</span>
                    </div>
                    <div className="analysis-body">
                      <div className="analysis-section">
                        <h4>Score Explanation</h4>
                        <p>{n.score_explanation}</p>
                      </div>
                      {n.dimension_analysis && (
                        <div className="analysis-section">
                          <h4>Dimension Analysis</h4>
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
                      {patterns && (patterns.weakAreas.length > 0 || patterns.strongAreas.length > 0) && (
                        <div className="analysis-section">
                          <h4>Answer Patterns</h4>
                          {patterns.strongAreas.length > 0 && <p><strong>Strong:</strong> {patterns.strongAreas.map(a => a.replace(/_/g, ' ')).join(', ')}</p>}
                          {patterns.weakAreas.length > 0 && <p><strong>Weak:</strong> {patterns.weakAreas.map(a => a.replace(/_/g, ' ')).join(', ')}</p>}
                        </div>
                      )}
                      {'operational_impact' in n && (n as any).operational_impact && (
                        <div className="analysis-section">
                          <h4>Operational Impact</h4>
                          <p>{(n as any).operational_impact}</p>
                        </div>
                      )}
                      {'risk_statement' in n && (n as any).risk_statement && (
                        <div className="analysis-section risk-section">
                          <h4>Risk Assessment</h4>
                          <p>{(n as any).risk_statement}</p>
                        </div>
                      )}
                      {n.decision_support_summary && (
                        <div className="analysis-section">
                          <h4>Decision Support</h4>
                          <p>{n.decision_support_summary}</p>
                        </div>
                      )}
                      {n.improvement_guidance && (
                        <div className="analysis-section">
                          <h4>Improvement Guidance</h4>
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

          {/* VISUALIZATIONS */}
          {activeTab === 'visualizations' && (
            <div className="viz-grid">
              {/* Priority Matrix */}
              <div className="viz-panel">
                <h3>Priority Matrix</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                    <XAxis type="number" dataKey="x" name="Maturity" domain={[0.5, 5.5]} label={{ value: 'Maturity', position: 'bottom' }} />
                    <YAxis type="number" dataKey="y" name="Impact" domain={[0.5, 5.5]} label={{ value: 'Impact', angle: -90, position: 'left' }} />
                    <ReferenceLine x={2.75} stroke="#94a3b8" strokeDasharray="4 4" />
                    <ReferenceLine y={3.25} stroke="#94a3b8" strokeDasharray="4 4" />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="chart-tooltip">
                            <strong>{d.name}</strong><br />
                            Maturity: {d.x} — Impact: {d.y}<br />
                            Quadrant: {d.quadrant}
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      data={scatterData}
                      fill="#5AA63E"
                      shape={(props: any) => {
                        const { cx, cy, payload } = props as { cx: number; cy: number; payload: typeof scatterData[0] };
                        const r = Math.max((payload.confidence || 3) * 4, 12);
                        const label = payload.name.length > 22 ? payload.name.slice(0, 20) + '…' : payload.name;
                        return (
                          <g>
                            <circle cx={cx} cy={cy} r={r} fill="#5AA63E" fillOpacity={0.6} stroke="#4A9132" strokeWidth={1.5} />
                            <text x={cx} y={cy - r - 4} textAnchor="middle" fontSize={9} fill="#495057">{label}</text>
                          </g>
                        );
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Radar */}
              <div className="viz-panel">
                <h3>Maturity Radar</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={radarData} outerRadius="75%">
                    <PolarGrid stroke="#e9ecef" />
                    <PolarAngleAxis dataKey="domain" tick={{ fontSize: 9 }} />
                    <Radar name="Maturity" dataKey="maturity" stroke="#5AA63E" fill="#5AA63E" fillOpacity={0.3} />
                    <Radar name="Impact" dataKey="impact" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                    <Radar name="Target" dataKey="target" stroke="#94a3b8" fill="none" strokeDasharray="4 4" />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Heatmap */}
              <div className="viz-panel full-width">
                <h3>Domain Heatmap</h3>
                <div className="heatmap-grid">
                  <div className="heatmap-header">
                    <div className="heatmap-label">Domain</div>
                    <div className="heatmap-cell-header">Maturity</div>
                    <div className="heatmap-cell-header">Impact</div>
                    <div className="heatmap-cell-header">Confidence</div>
                    <div className="heatmap-cell-header">Gap to target</div>
                  </div>
                  {heatmapData.map((r) => (
                    <Fragment key={r.domain_id}>
                      <div className="heatmap-label">{r.name}</div>
                      <div className={`heatmap-cell hl${r.maturity}`}>{r.maturity}</div>
                      <div className={`heatmap-cell hl${r.impact}`}>{r.impact}</div>
                      <div className={`heatmap-cell hl${r.confidence}`}>{r.confidence}</div>
                      <div className={`heatmap-cell ${r.gap >= 3 ? 'hl1' : r.gap >= 2 ? 'hl2' : r.gap >= 1 ? 'hl3' : 'hl5'}`}>{r.gap > 0 ? `+${r.gap}` : '0'}</div>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DECISION READINESS */}
          {activeTab === 'readiness' && (
            <div className="readiness-panel">
              <p className="readiness-intro">
                Decision readiness is determined by the weakest supporting domain for each GreenOps decision area.
              </p>
              <div className="domain-table-wrapper">
                <table className="domain-table">
                  <thead>
                    <tr>
                      <th>Decision Area</th>
                      <th>Readiness</th>
                      <th>Supporting Domains</th>
                      <th>Limiting Domains</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisionReadiness.map((dr) => (
                      <tr key={dr.area}>
                        <td className="domain-name-cell">{dr.area}</td>
                        <td><span className={`readiness-badge ${dr.readiness}`}>{dr.label}</span></td>
                        <td>{dr.supporting_domains.join(', ') || '—'}</td>
                        <td>{dr.limiting_domains.join(', ') || '—'}</td>
                        <td className="summary-cell">{dr.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* IMPROVEMENT ROADMAP */}
          {activeTab === 'roadmap' && (
            <div className="roadmap-panel">
              <div className="domain-table-wrapper">
                <table className="domain-table">
                  <thead>
                    <tr>
                      <th>Priority</th>
                      <th>Domain</th>
                      <th>Action</th>
                      <th>Phase</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.map((rec, i) => (
                      <tr key={i}>
                        <td><span className={`priority-tag ${rec.priority.toLowerCase()}`}>{rec.priority}</span></td>
                        <td className="domain-name-cell">{rec.domain_name}</td>
                        <td>{rec.action}</td>
                        <td><span className="phase-tag">{rec.phase}</span></td>
                        <td className="summary-cell">{rec.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
