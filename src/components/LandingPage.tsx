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
      <div className="landing-hero">
        <div className="container">
          <div className="landing-hero-brand">
            <PosetivLogo variant="light" height={44} />
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

          {/* Resume / Load section — prominent */}
          <div className="resume-section">
            <h2>Resume a previous assessment</h2>
            <p className="landing-actions-subtitle">
              Load a previously saved assessment to review results or continue where you left off.
            </p>
            <div
              className={`upload-zone ${dragOver ? 'upload-zone-active' : ''}`}
              onClick={handleFileLoad}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="upload-zone-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="upload-zone-text">
                <strong>Click to browse</strong> or drag and drop your saved assessment file
              </p>
              <p className="upload-zone-hint">Accepts .json files saved from a previous assessment</p>
            </div>
          </div>

          <div className="demo-link">
            <button className="btn btn-ghost" onClick={onLoadDemo}>
              Or view a demo assessment with sample data
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
