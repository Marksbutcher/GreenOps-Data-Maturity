import { useState, useMemo, Fragment } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ReferenceLine,
  Label,
} from 'recharts';
import { MaturityModel, OrganisationProfile, DomainAssessment } from '../types';
import { calculateOverallStats, getDecisionSupportLabel } from '../lib/scoring';
import { generateRecommendations, generateExecutiveSummary } from '../lib/recommendations';
import { generateDomainNarratives, DomainNarrative } from '../lib/narrativeAnalysis';
import { generateDecisionReadiness } from '../lib/decisionReadiness';

interface ResultsDashboardProps {
  model: MaturityModel;
  profile: OrganisationProfile;
  results: DomainAssessment[];
  onExportPDF: () => void;
  onExportCSV: () => void;
  onBack: () => void;
  onStartOver: () => void;
}

type Tab = 'summary' | 'domains' | 'detail' | 'visuals' | 'readiness' | 'roadmap';

export default function ResultsDashboard({
  model,
  profile,
  results,
  onExportPDF,
  onExportCSV,
  onBack,
  onStartOver,
}: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  const domainMap = useMemo(
    () => new Map(model.domains.map((d) => [d.id, d])),
    [model]
  );

  const stats = useMemo(() => calculateOverallStats(results), [results]);
  const execSummary = useMemo(
    () => generateExecutiveSummary(results, model),
    [results, model]
  );
  const narratives = useMemo(
    () => generateDomainNarratives(results, model),
    [results, model]
  );
  const recommendations = useMemo(
    () => generateRecommendations(results, model),
    [results, model]
  );
  const decisionReadiness = useMemo(
    () => generateDecisionReadiness(results, model),
    [results, model]
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Executive summary' },
    { id: 'domains', label: 'Domain scores' },
    { id: 'detail', label: 'Detailed analysis' },
    { id: 'visuals', label: 'Visualisations' },
    { id: 'readiness', label: 'Decision readiness' },
    { id: 'roadmap', label: 'Improvement roadmap' },
  ];

  return (
    <div className="results-page">
      <div className="container">
        <div className="results-header">
          <div>
            <p className="label" style={{ marginBottom: 4 }}>Assessment results</p>
            <h1>{profile.organisation_name}</h1>
            <p className="text-secondary text-small">
              {profile.sector}
              {profile.sub_sector ? ` — ${profile.sub_sector}` : ''}
              {profile.assessment_date ? ` — ${profile.assessment_date}` : ''}
            </p>
          </div>
          <div className="results-actions">
            <button className="btn btn-outline btn-sm" onClick={onBack}>
              Edit assessment
            </button>
            <button className="btn btn-outline btn-sm" onClick={onExportCSV}>
              Export CSV
            </button>
            <button className="btn btn-primary btn-sm" onClick={onExportPDF}>
              Export PDF
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onStartOver}>
              New assessment
            </button>
          </div>
        </div>

        <div className="results-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`results-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'summary' && (
          <SummaryTab stats={stats} summary={execSummary} />
        )}
        {activeTab === 'domains' && (
          <DomainsTab results={results} model={model} domainMap={domainMap} />
        )}
        {activeTab === 'detail' && (
          <DetailTab narratives={narratives} />
        )}
        {activeTab === 'visuals' && (
          <VisualsTab results={results} model={model} domainMap={domainMap} />
        )}
        {activeTab === 'readiness' && (
          <ReadinessTab readiness={decisionReadiness} domainMap={domainMap} />
        )}
        {activeTab === 'roadmap' && (
          <RoadmapTab recommendations={recommendations} />
        )}
      </div>
    </div>
  );
}

// ===== Summary tab =====
function SummaryTab({
  stats,
  summary,
}: {
  stats: ReturnType<typeof calculateOverallStats>;
  summary: ReturnType<typeof generateExecutiveSummary>;
}) {
  return (
    <div className="exec-summary">
      <div className="exec-metric-row">
        <div className="exec-metric">
          <div className="metric-value">{stats.weightedMaturity}</div>
          <div className="metric-label">Weighted maturity</div>
        </div>
        <div className="exec-metric">
          <div className="metric-value">{stats.avgMaturity}</div>
          <div className="metric-label">Average maturity</div>
        </div>
        <div className="exec-metric">
          <div className="metric-value">
            {stats.minMaturity}–{stats.maxMaturity}
          </div>
          <div className="metric-label">Maturity range</div>
        </div>
        <div className="exec-metric">
          <div className="metric-value">{stats.domainCount}</div>
          <div className="metric-label">Domains assessed</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Overall assessment</h3>
        <p className="summary-narrative">{summary.overallSummary}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>Strongest domains</h3>
          <div className="summary-list">
            {summary.strongestDomains.map((d, i) => (
              <div key={i} className="summary-list-item">{d}</div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>Weakest domains</h3>
          <div className="summary-list">
            {summary.weakestDomains.map((d, i) => (
              <div key={i} className="summary-list-item">{d}</div>
            ))}
          </div>
        </div>
      </div>

      {summary.topGaps.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>
            Critical gaps — high impact, low maturity
          </h3>
          <div className="summary-list">
            {summary.topGaps.map((g, i) => (
              <div key={i} className="summary-list-item">{g}</div>
            ))}
          </div>
        </div>
      )}

      {summary.keyRisks.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>Key risks if unchanged</h3>
          <div className="summary-list">
            {summary.keyRisks.map((r, i) => (
              <div key={i} className="summary-list-item">{r}</div>
            ))}
          </div>
        </div>
      )}

      {summary.headlineRecommendations.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>Headline recommendations</h3>
          <div className="summary-list">
            {summary.headlineRecommendations.map((r, i) => (
              <div key={i} className="summary-list-item">{r}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Domains table tab =====
function DomainsTab({
  results,
  model,
  domainMap,
}: {
  results: DomainAssessment[];
  model: MaturityModel;
  domainMap: Map<string, (typeof model.domains)[0]>;
}) {
  return (
    <div className="domain-table-wrapper">
      <table className="domain-table">
        <thead>
          <tr>
            <th>Domain</th>
            <th style={{ textAlign: 'center' }}>Maturity</th>
            <th style={{ textAlign: 'center' }}>Impact</th>
            <th style={{ textAlign: 'center' }}>Confidence</th>
            <th>Decision support</th>
            <th style={{ textAlign: 'center' }}>Target</th>
            <th style={{ textAlign: 'center' }}>Gap</th>
            <th>Priority</th>
            <th>Rationale</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const domain = domainMap.get(r.domain_id);
            const gap = r.target_maturity - r.maturity_score;
            return (
              <tr key={r.domain_id}>
                <td style={{ fontWeight: 500, minWidth: 200 }}>
                  {domain?.name || r.domain_id}
                </td>
                <td className="score-cell">
                  <span className={`score-pill s${r.maturity_score}`}>
                    {r.maturity_score}
                  </span>
                </td>
                <td className="score-cell">
                  <span className={`score-pill s${r.impact_score}`}>
                    {r.impact_score}
                  </span>
                </td>
                <td className="score-cell" style={{ color: 'var(--color-text-secondary)' }}>
                  {r.confidence_score}
                </td>
                <td>
                  <span className={`status-tag ${r.decision_support_status}`}>
                    {getDecisionSupportLabel(model, r.decision_support_status)}
                  </span>
                </td>
                <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {r.target_maturity}
                </td>
                <td style={{ textAlign: 'center', fontWeight: gap > 0 ? 600 : 400, color: gap >= 2 ? 'var(--color-high)' : 'var(--color-text-secondary)' }}>
                  {gap > 0 ? `+${gap}` : '—'}
                </td>
                <td>
                  {r.priority && (
                    <span className={`priority-tag ${r.priority.toLowerCase()}`}>
                      {r.priority}
                    </span>
                  )}
                </td>
                <td style={{ maxWidth: 240, color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                  {r.rationale || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===== Detail tab =====
function DetailTab({ narratives }: { narratives: DomainNarrative[] }) {
  return (
    <div>
      {narratives.map((n) => (
        <div key={n.domain_id} className="domain-detail">
          <div className="domain-detail-header">
            <h3>{n.domain_name}</h3>
            <div className="domain-detail-scores">
              <div className="detail-score-badge">
                <span className="badge-label">Maturity</span>
                <span className={`score-pill s${n.maturityScore}`}>
                  {n.maturityScore}
                </span>
              </div>
              <div className="detail-score-badge">
                <span className="badge-label">Impact</span>
                <span className={`score-pill s${n.impactScore}`}>
                  {n.impactScore}
                </span>
              </div>
              <div className="detail-score-badge">
                <span className="badge-label">Confidence</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  {n.confidenceScore}
                </span>
              </div>
              {n.priority && (
                <span className={`priority-tag ${n.priority.toLowerCase()}`}>
                  {n.priority}
                </span>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h4>Current maturity</h4>
            <p>
              <strong>{n.currentLevel}.</strong> {n.currentLevelDescription}
            </p>
          </div>

          <div className="detail-section">
            <h4>Evidence and rationale</h4>
            <p>{n.evidenceSummary}</p>
          </div>

          <div className="detail-section">
            <h4>Operational consequences</h4>
            <p>{n.consequences}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
            <div className="detail-section">
              <h4>Currently supports</h4>
              <ul>
                {n.supportedDecisions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
            <div className="detail-section">
              <h4>Does not yet support</h4>
              <ul>
                {n.unsupportedDecisions.length > 0 ? (
                  n.unsupportedDecisions.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))
                ) : (
                  <li>No significant limitations at this level</li>
                )}
              </ul>
            </div>
          </div>

          <div className="detail-section">
            <h4>What better maturity would unlock</h4>
            <p>{n.whatBetterUnlocks}</p>
          </div>

          <div className="detail-section">
            <h4>Improvement actions</h4>
            <ul>
              {n.improvementActions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>

          {n.targetGap !== null && n.targetGap > 0 && (
            <div className="detail-section">
              <h4>Gap to target</h4>
              <p>
                Current: Level {n.maturityScore} — Target: Level{' '}
                {n.maturityScore + n.targetGap} — Gap: {n.targetGap}{' '}
                {n.targetGap === 1 ? 'level' : 'levels'}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===== Visuals tab =====
function VisualsTab({
  results,
  model,
  domainMap,
}: {
  results: DomainAssessment[];
  model: MaturityModel;
  domainMap: Map<string, (typeof model.domains)[0]>;
}) {
  const scatterData = results.map((r) => ({
    x: r.maturity_score,
    y: r.impact_score,
    name: domainMap.get(r.domain_id)?.name || r.domain_id,
    confidence: r.confidence_score,
  }));

  const radarData = results.map((r) => ({
    domain: (domainMap.get(r.domain_id)?.name || r.domain_id).split(' ').slice(0, 3).join(' '),
    maturity: r.maturity_score,
    impact: r.impact_score,
    target: r.target_maturity,
  }));

  const matColors: Record<number, string> = {
    1: '#c83a2a',
    2: '#d67830',
    3: '#c09c30',
    4: '#3a9c6a',
    5: '#267848',
  };

  return (
    <div>
      {/* Priority matrix */}
      <div className="chart-container">
        <div className="chart-title">Priority matrix — maturity vs impact</div>
        <div className="chart-subtitle">
          Domains in the upper-left (high impact, low maturity) should be addressed first.
          Quadrants: Transform now (upper-left), Exploit and extend (upper-right),
          Stabilise (lower-left), Maintain (lower-right).
        </div>
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 20, right: 40, bottom: 40, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eaecf0" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0.5, 5.5]}
              ticks={[1, 2, 3, 4, 5]}
              name="Maturity"
              label={{ value: 'Maturity score', position: 'bottom', offset: 20, style: { fill: '#8a9199', fontSize: 12 } }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[0.5, 5.5]}
              ticks={[1, 2, 3, 4, 5]}
              name="Impact"
              label={{ value: 'Impact score', angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#8a9199', fontSize: 12 } }}
            />
            <ReferenceLine x={3} stroke="#dfe3e8" strokeDasharray="6 4" />
            <ReferenceLine y={3.5} stroke="#dfe3e8" strokeDasharray="6 4" />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: 'white', padding: '8px 12px', border: '1px solid #dfe3e8', borderRadius: 6, fontSize: 13 }}>
                    <strong>{d.name}</strong>
                    <br />
                    Maturity: {d.x} — Impact: {d.y}
                  </div>
                );
              }}
            />
            <Scatter
              data={scatterData}
              fill="#267878"
              shape={({ cx, cy, payload }: { cx: number; cy: number; payload: typeof scatterData[0] }) => {
                const r = Math.max((payload.confidence || 3) * 4, 12);
                const label = payload.name.length > 22
                  ? payload.name.slice(0, 20) + '…'
                  : payload.name;
                return (
                  <g>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={matColors[payload.x] || '#267878'}
                      opacity={0.75}
                      stroke="white"
                      strokeWidth={2}
                    />
                    <text
                      x={cx}
                      y={cy + r + 13}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#5a6270"
                    >
                      {label}
                    </text>
                  </g>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap */}
      <div className="chart-container">
        <div className="chart-title">Maturity heatmap</div>
        <div className="chart-subtitle">
          Each row shows a domain. The highlighted cell indicates the current maturity level.
        </div>
        <div className="heatmap-grid">
          <div className="heatmap-header" />
          {[1, 2, 3, 4, 5].map((l) => (
            <div key={l} className="heatmap-header">
              Level {l}
            </div>
          ))}
          {results.map((r) => {
            const domain = domainMap.get(r.domain_id);
            return (
              <Fragment key={r.domain_id}>
                <div className="heatmap-label">
                  {domain?.name || r.domain_id}
                </div>
                {[1, 2, 3, 4, 5].map((l) => (
                  <div
                    key={`${r.domain_id}-${l}`}
                    className={`heatmap-cell ${
                      r.maturity_score === l ? 'active' : 'inactive'
                    }`}
                    style={
                      r.maturity_score === l
                        ? { background: matColors[l] }
                        : undefined
                    }
                  >
                    {r.maturity_score === l ? l : ''}
                  </div>
                ))}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Radar chart */}
      <div className="chart-container">
        <div className="chart-title">Radar — maturity, impact and target</div>
        <ResponsiveContainer width="100%" height={480}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#eaecf0" />
            <PolarAngleAxis dataKey="domain" tick={{ fontSize: 10, fill: '#5a6270' }} />
            <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
            <Radar
              name="Maturity"
              dataKey="maturity"
              stroke="#267878"
              fill="#267878"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Radar
              name="Impact"
              dataKey="impact"
              stroke="#c09c30"
              fill="#c09c30"
              fillOpacity={0.05}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <Radar
              name="Target"
              dataKey="target"
              stroke="#3a9c6a"
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ===== Decision readiness tab =====
function ReadinessTab({
  readiness,
  domainMap,
}: {
  readiness: ReturnType<typeof generateDecisionReadiness>;
  domainMap: Map<string, any>;
}) {
  return (
    <div>
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ marginBottom: 8, fontSize: '1rem' }}>
          GreenOps decision readiness summary
        </h3>
        <p className="text-secondary text-small" style={{ lineHeight: 1.7 }}>
          This summary assesses whether the organisation's current data inputs are sufficient
          to support specific GreenOps decisions with confidence. Where data is weak, the
          assessment is explicit that certain decisions should not yet be treated as decision-grade.
        </p>
      </div>

      <div className="readiness-grid">
        {readiness.map((dr) => (
          <div key={dr.area} className="readiness-card">
            <div className="readiness-area">{dr.area}</div>
            <div>
              <span className={`status-tag ${dr.readiness}`}>{dr.label}</span>
              {dr.limiting_domains.length > 0 && (
                <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Limited by:{' '}
                  {dr.limiting_domains
                    .map((d) => domainMap.get(d)?.name || d)
                    .join(', ')}
                </div>
              )}
            </div>
            <div className="readiness-summary">{dr.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Roadmap tab =====
function RoadmapTab({
  recommendations,
}: {
  recommendations: ReturnType<typeof generateRecommendations>;
}) {
  return (
    <div>
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ marginBottom: 8, fontSize: '1rem' }}>
          Improvement roadmap
        </h3>
        <p className="text-secondary text-small" style={{ lineHeight: 1.7 }}>
          Prioritised improvement actions based on the assessment results.
          Recommendations are domain-specific and linked to the decisions they would
          unlock or strengthen.
        </p>
      </div>

      <div className="roadmap-list">
        {recommendations.map((r, i) => (
          <div key={i} className="roadmap-item">
            <div>
              <div className="roadmap-domain">{r.domain_name}</div>
              <span className="phase-tag">{r.phase}</span>
            </div>
            <div>
              <div className="roadmap-action">{r.action}</div>
              <div className="roadmap-benefit">{r.benefit}</div>
            </div>
            <div>
              <span className={`priority-tag ${r.priority.toLowerCase()}`}>
                {r.priority}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {r.reason.length > 80 ? r.reason.slice(0, 78) + '…' : r.reason}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
