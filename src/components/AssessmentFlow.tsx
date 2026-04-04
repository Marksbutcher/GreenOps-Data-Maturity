import { useState, useCallback, useMemo } from 'react';
import { MaturityModel, DomainAssessment, OrganisationProfile } from '../types';
import PosetivLogo from './PosetivLogo';

interface AssessmentFlowProps {
  model: MaturityModel;
  mode: 'self' | 'facilitated';
  profile: OrganisationProfile;
  results: DomainAssessment[];
  onComplete: (results: DomainAssessment[]) => void;
  onBack: () => void;
}

type DomainStatus = 'not_started' | 'in_progress' | 'complete';

export default function AssessmentFlow({
  model,
  mode,
  profile,
  results: initialResults,
  onComplete,
  onBack,
}: AssessmentFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<DomainAssessment[]>(initialResults);
  const [showIncomplete, setShowIncomplete] = useState(false);

  const domain = model.domains[currentIndex];
  const result = results[currentIndex];
  const total = model.domains.length;

  // Compute domain statuses for sidebar
  const domainStatuses = useMemo((): { status: DomainStatus; answered: number; total: number }[] => {
    return model.domains.map((d, i) => {
      const r = results[i];
      const answered = Object.keys(r.question_answers).length;
      const totalQ = d.questions.length;
      let status: DomainStatus = 'not_started';
      if (answered === totalQ) status = 'complete';
      else if (answered > 0) status = 'in_progress';
      return { status, answered, total: totalQ };
    });
  }, [model.domains, results]);

  const completedCount = domainStatuses.filter((s) => s.status === 'complete').length;

  const updateResult = useCallback(
    (updates: Partial<DomainAssessment>) => {
      setResults((prev) => {
        const next = [...prev];
        next[currentIndex] = { ...next[currentIndex], ...updates };
        return next;
      });
    },
    [currentIndex]
  );

  const handleQuestionAnswer = useCallback(
    (questionId: string, optionIndex: number) => {
      const newAnswers = { ...result.question_answers, [questionId]: optionIndex };
      updateResult({ question_answers: newAnswers });
    },
    [result, updateResult]
  );

  const answeredCount = Object.keys(result.question_answers).length;
  const totalQuestions = domain.questions.length;
  const allAnswered = answeredCount === totalQuestions;

  const goNext = () => {
    if (!allAnswered) {
      setShowIncomplete(true);
      return;
    }
    setShowIncomplete(false);
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      window.scrollTo(0, 0);
    }
  };

  const goPrev = () => {
    setShowIncomplete(false);
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleComplete = () => {
    const incomplete = results.filter((r, i) => {
      const d = model.domains[i];
      return Object.keys(r.question_answers).length < d.questions.length;
    });
    if (incomplete.length > 0) {
      setShowIncomplete(true);
      return;
    }
    onComplete(results);
  };

  const jumpToDomain = (index: number) => {
    setShowIncomplete(false);
    setCurrentIndex(index);
    window.scrollTo(0, 0);
  };

  return (
    <div className="assessment-layout">
      {/* Left sidebar — domain progress panel */}
      <aside className="assessment-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <PosetivLogo variant="dark" height={32} />
          </div>
          <div className="sidebar-title">Assessment progress</div>
          <div className="sidebar-summary">
            {completedCount} of {total} domains complete
          </div>
          <div className="sidebar-progress-bar">
            <div
              className="sidebar-progress-fill"
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>
        </div>
        <nav className="sidebar-domain-list">
          {model.domains.map((d, i) => {
            const ds = domainStatuses[i];
            const isCurrent = i === currentIndex;
            return (
              <button
                key={d.id}
                className={`sidebar-domain-item ${isCurrent ? 'current' : ''} status-${ds.status}`}
                onClick={() => jumpToDomain(i)}
              >
                <span className={`sidebar-status-dot ${ds.status}`} />
                <span className="sidebar-domain-name">{d.name}</span>
                <span className="sidebar-domain-count">{ds.answered}/{ds.total}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button
            className="btn btn-outline btn-sm sidebar-save-btn"
            onClick={() => {
              const payload = {
                version: '2.0',
                saved_at: new Date().toISOString(),
                mode,
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
            }}
          >
            Save progress
          </button>
          <span className="sidebar-mode">{mode === 'facilitated' ? 'Workshop mode' : 'Self-assessment'}</span>
        </div>
      </aside>

      {/* Main content area */}
      <main className="assessment-main">
        {/* Assessment introduction — shown on the first domain */}
        {currentIndex === 0 && (
          <div className="assessment-intro">
            <h2 className="assessment-intro-title">GreenOps Data Input Maturity Assessment</h2>
            <p className="assessment-intro-text">
              This assessment evaluates your organisation's data maturity across {total} domains
              that underpin effective GreenOps decision-making — from energy and carbon measurement
              through to AI workload governance and lifecycle management.
            </p>
            <div className="assessment-intro-details">
              <div className="intro-detail">
                <strong>How it works</strong>
                <span>Answer the questions in each domain using the dropdown selectors (typically 8–11 questions per domain). Your maturity scores are calculated automatically from the answers — there is no manual self-scoring.</span>
              </div>
              <div className="intro-detail">
                <strong>Navigation</strong>
                <span>Use the panel on the left to track progress and jump between domains. You can revisit and change answers at any point before completing.</span>
              </div>
              <div className="intro-detail">
                <strong>What you'll receive</strong>
                <span>A scored maturity profile across all {total} domains, decision-readiness analysis, dimension-level breakdowns, and a prioritised improvement roadmap — available on-screen and as PDF or CSV export.</span>
              </div>
            </div>
          </div>
        )}

        {/* Domain context intro */}
        <div className="domain-intro">
          <div className="domain-intro-header">
            <span className="domain-number">Domain {currentIndex + 1} of {total}</span>
            <h2 className="domain-title">{domain.name}</h2>
          </div>
          <p className="domain-definition">{domain.definition}</p>
          <p className="domain-why"><strong>Why it matters:</strong> {domain.why_it_matters}</p>
        </div>

        {/* Questions — dense two-column layout with dropdowns */}
        <div className="questions-grid">
          {domain.questions.map((q, qIdx) => {
            const selectedIdx = result.question_answers[q.id];
            const isUnanswered = selectedIdx === undefined;
            return (
              <div
                key={q.id}
                className={`question-row ${isUnanswered && showIncomplete ? 'unanswered' : ''}`}
              >
                <div className="question-left">
                  <span className="question-number">Q{qIdx + 1}</span>
                  <span className="question-text">{q.text}</span>
                  {q.evidence_hint && (
                    <span className="question-hint">{q.evidence_hint}</span>
                  )}
                </div>
                <div className="question-right">
                  <select
                    className={`question-select ${isUnanswered ? '' : 'answered'}`}
                    value={selectedIdx !== undefined ? String(selectedIdx) : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== '') handleQuestionAnswer(q.id, Number(val));
                    }}
                  >
                    <option value="" disabled>Select an answer…</option>
                    {q.options.map((opt, optIdx) => (
                      <option key={optIdx} value={String(optIdx)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion status */}
        <div className="domain-status">
          <span className={`status-count ${allAnswered ? 'complete' : ''}`}>
            {answeredCount} of {totalQuestions} questions answered
          </span>
          {showIncomplete && !allAnswered && (
            <span className="status-warning">Please answer all questions before proceeding</span>
          )}
        </div>

        {/* Evidence and notes */}
        <div className="evidence-row">
          <div className="evidence-col">
            <label className="field-label">Evidence and sources</label>
            <textarea
              className="field-textarea"
              value={result.evidence}
              onChange={(e) => updateResult({ evidence: e.target.value })}
              placeholder="What evidence supports the answers given? List data sources, tools, reports, or systems that informed your responses."
              rows={5}
            />
            {domain.common_evidence_examples.length > 0 && (
              <div className="evidence-examples">
                e.g. {domain.common_evidence_examples.slice(0, 4).join(', ')}
              </div>
            )}
          </div>
          <div className="evidence-col">
            <label className="field-label">Rationale and notes</label>
            <textarea
              className="field-textarea"
              value={result.rationale}
              onChange={(e) => updateResult({ rationale: e.target.value })}
              placeholder="Key observations, caveats, or context for this domain. Note any known gaps, planned improvements, or dependencies on other teams."
              rows={5}
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="assessment-nav">
          <button
            className="btn btn-ghost"
            onClick={currentIndex === 0 ? onBack : goPrev}
          >
            {currentIndex === 0 ? 'Back to profile' : 'Previous domain'}
          </button>
          <div className="nav-right">
            {currentIndex < total - 1 ? (
              <button className="btn btn-primary" onClick={goNext}>
                Next domain
              </button>
            ) : (
              <button className="btn btn-accent btn-lg" onClick={handleComplete}>
                Complete assessment
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
