import { useState } from 'react';
import PosetivLogo from './PosetivLogo';

interface LandingPageProps {
  onStartNew: (mode: 'self' | 'facilitated') => void;
  onLoadDemo: () => void;
  onLoadSaved: (file: File) => void;
}

export default function LandingPage({ onStartNew, onLoadDemo, onLoadSaved }: LandingPageProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFileLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) onLoadSaved(file);
    };
    input.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      onLoadSaved(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  return (
    <div className="landing">
      {/* Hero */}
      <div className="landing-hero">
        <div className="container">
          <div className="landing-hero-brand">
            <PosetivLogo variant="light" height={44} />
          </div>
          <h1>GreenOps Data Input<br />Maturity Assessment</h1>
          <p className="subtitle">
            Assess the maturity of data inputs used in GreenOps calculations across your
            technology estate. Understand what decisions your data supports, where the gaps
            are, and what to improve next.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="landing-body">
        <div className="container">

          {/* Start section */}
          <section className="landing-section">
            <div className="landing-section-header">
              <h2>Start an assessment</h2>
              <p>Choose how you want to work through the assessment.</p>
            </div>
            <div className="action-cards">
              <div className="card action-card" onClick={() => onStartNew('self')}>
                <div className="action-card-content">
                  <div className="action-card-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <h3>Self-assessment</h3>
                  <p>
                    Work through the assessment independently, scoring each domain
                    based on your own knowledge and available evidence.
                  </p>
                </div>
                <button className="btn btn-primary">Begin self-assessment</button>
              </div>
              <div className="card action-card" onClick={() => onStartNew('facilitated')}>
                <div className="action-card-content">
                  <div className="action-card-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h3>Facilitated workshop</h3>
                  <p>
                    Use the assessment to structure a facilitated conversation with
                    stakeholders, capturing collective judgement and evidence.
                  </p>
                </div>
                <button className="btn btn-outline">Begin workshop assessment</button>
              </div>
            </div>
          </section>

          {/* Resume section */}
          <section className="landing-section landing-section-resume">
            <div className="resume-row">
              <div className="resume-text">
                <h3>Resume a previous assessment</h3>
                <p>
                  Load a previously saved assessment to review results
                  or continue where you left off.
                </p>
                <button className="btn btn-outline btn-demo" onClick={onLoadDemo}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  View demo with sample data
                </button>
              </div>
              <div
                className={`upload-zone ${dragOver ? 'upload-zone-active' : ''}`}
                onClick={handleFileLoad}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="upload-zone-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="upload-zone-text">
                  <strong>Click to browse</strong> or drag and drop
                </p>
                <p className="upload-zone-hint">Accepts .json files saved from a previous assessment</p>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Features */}
      <div className="landing-features">
        <div className="container">
          <h2>What this tool produces</h2>
          <div className="features-grid">
            <div className="feature-item">
              <h4>Maturity scores</h4>
              <p>
                Structured 1–5 maturity scoring across 13 data input domains, from asset
                inventory through to decision integration.
              </p>
            </div>
            <div className="feature-item">
              <h4>Decision readiness</h4>
              <p>
                Clear view of which GreenOps decisions your data can credibly support,
                from footprint reporting through to AI demand governance.
              </p>
            </div>
            <div className="feature-item">
              <h4>Prioritised recommendations</h4>
              <p>
                Domain-specific improvement actions with clear sequencing,
                linked to the decisions they would unlock.
              </p>
            </div>
            <div className="feature-item">
              <h4>Narrative analysis</h4>
              <p>
                Per-domain analysis explaining what the current maturity means
                operationally, what it supports, and what it limits.
              </p>
            </div>
            <div className="feature-item">
              <h4>Visual outputs</h4>
              <p>
                Maturity charts and radar profiles showing performance at a glance,
                suitable for leadership reporting.
              </p>
            </div>
            <div className="feature-item">
              <h4>Export ready</h4>
              <p>
                Download a presentation-ready PDF report or raw CSV data
                for further analysis and integration.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container landing-footer-inner">
          <div className="landing-footer-brand">
            <PosetivLogo variant="dark" height={24} />
          </div>
          <p className="landing-footer-copy">
            &copy; {new Date().getFullYear()} Posetiv Cloud Ltd. All rights reserved.
          </p>
          <p className="landing-footer-tagline">
            Operational efficiency through evidence-based sustainability
          </p>
        </div>
      </footer>
    </div>
  );
}
