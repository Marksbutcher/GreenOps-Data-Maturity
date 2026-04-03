import PosetivLogo from './PosetivLogo';

interface LandingPageProps {
  onStartNew: (mode: 'self' | 'facilitated') => void;
  onLoadDemo: () => void;
}

export default function LandingPage({ onStartNew, onLoadDemo }: LandingPageProps) {
  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="container">
          <div className="landing-hero-brand">
            <PosetivLogo variant="light" height={28} />
          </div>
          <h1>GreenOps Data Input Maturity Assessment</h1>
          <p className="subtitle">
            Assess the maturity of data inputs used in GreenOps calculations across your technology estate.
            Understand what decisions your current data supports, where the gaps are, and what to improve next.
          </p>
        </div>
      </div>

      <div className="landing-actions">
        <div className="container">
          <h2>Start an assessment</h2>
          <p className="landing-actions-subtitle">
            Choose how you want to work through the assessment.
          </p>
          <div className="action-cards">
            <div className="card action-card" onClick={() => onStartNew('self')}>
              <h3>Self-assessment</h3>
              <p>
                Work through the assessment independently, scoring each domain based on your own knowledge
                and available evidence.
              </p>
              <button className="btn btn-primary">Begin self-assessment</button>
            </div>
            <div className="card action-card" onClick={() => onStartNew('facilitated')}>
              <h3>Facilitated workshop</h3>
              <p>
                Use the assessment to structure a facilitated conversation with stakeholders,
                capturing collective judgement and evidence.
              </p>
              <button className="btn btn-outline">Begin workshop assessment</button>
            </div>
          </div>
          <div className="demo-link">
            <button className="btn btn-ghost" onClick={onLoadDemo}>
              View demo assessment with sample data
            </button>
          </div>
        </div>
      </div>

      <div className="landing-features">
        <div className="container">
          <h2>What this tool produces</h2>
          <div className="features-grid">
            <div className="feature-item">
              <h4>Maturity scores</h4>
              <p>
                Structured 1-5 maturity scoring across 13 data input domains, from asset inventory
                through to decision integration.
              </p>
            </div>
            <div className="feature-item">
              <h4>Decision readiness</h4>
              <p>
                Clear assessment of which GreenOps decisions your current data can and cannot credibly support,
                from footprint reporting through to AI demand governance.
              </p>
            </div>
            <div className="feature-item">
              <h4>Prioritised recommendations</h4>
              <p>
                Domain-specific, maturity-aware improvement actions with clear sequencing,
                linked to the decisions they would unlock.
              </p>
            </div>
            <div className="feature-item">
              <h4>Narrative analysis</h4>
              <p>
                Detailed per-domain analysis explaining what the current maturity means operationally,
                what it supports, and what it limits.
              </p>
            </div>
            <div className="feature-item">
              <h4>Visual outputs</h4>
              <p>
                Priority matrix, heatmap and radar chart showing maturity and impact at a glance,
                suitable for leadership reporting.
              </p>
            </div>
            <div className="feature-item">
              <h4>Export ready</h4>
              <p>
                Download a presentation-ready PDF report or raw CSV data for further analysis
                and integration.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-footer">
        <div className="container">
          <p>GreenOps Data Input Maturity Assessment — Posetiv</p>
        </div>
      </div>
    </div>
  );
}
