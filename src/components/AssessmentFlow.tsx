import { useState, useCallback, useMemo } from 'react';
import { MaturityModel, DomainAssessment, OrganisationProfile, AssessmentIntent, INTENT_LABELS, INTENT_DESCRIPTIONS } from '../types';
import PosetivLogo from './PosetivLogo';

interface AssessmentFlowProps {
  model: MaturityModel;
  mode: 'self' | 'facilitated';
  profile: OrganisationProfile;
  results: DomainAssessment[];
  onComplete: (results: DomainAssessment[]) => void;
  onBack: () => void;
  onUpdateProfile?: (updates: Partial<OrganisationProfile>) => void;
}

type DomainStatus = 'not_started' | 'in_progress' | 'complete';

export default function AssessmentFlow({
  model,
  mode,
  profile,
  results: initialResults,
  onComplete,
  onBack,
  onUpdateProfile,
}: AssessmentFlowProps) {
  // -1 = assessment goal section, 0+ = domain index
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [results, setResults] = useState<DomainAssessment[]>(initialResults);
  const [showIncomplete, setShowIncomplete] = useState(false);

  const total = model.domains.length;
  const isGoalSection = currentIndex === -1;
  const domain = isGoalSection ? null : model.domains[currentIndex];
  const result = isGoalSection ? null : results[currentIndex];

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
      if (currentIndex < 0) return;
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
      if (!result) return;
      const newAnswers = { ...result.question_answers, [questionId]: optionIndex };
      updateResult({ question_answers: newAnswers });
    },
    [result, updateResult]
  );

  const answeredCount = result ? Object.keys(result.question_answers).length : 0;
  const totalQuestions = domain ? domain.questions.length : 0;
  const allAnswered = answeredCount === totalQuestions && totalQuestions > 0;

  const goNext = () => {
    if (isGoalSection) {
      // Move from goal section to first domain
      setCurrentIndex(0);
      window.scrollTo(0, 0);
      return;
    }
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
    if (isGoalSection) return;
    if (currentIndex === 0) {
      // Go back to goal section
      setCurrentIndex(-1);
      window.scrollTo(0, 0);
    } else {
      setCurrentIndex((i) => i - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleComplete = () => {
    const answeredDomains = results.filter((r) => {
      return Object.keys(r.question_answers).length > 0;
    }).length;
    if (answeredDomains === 0) {
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
          <button
            className={`sidebar-domain-item sidebar-goal-item ${isGoalSection ? 'current' : ''} status-complete`}
            onClick={() => jumpToDomain(-1)}
          >
            <span className="sidebar-status-dot complete" />
            <span className="sidebar-domain-name">Assessment Goal</span>
            <span className="sidebar-domain-count">{INTENT_LABELS[profile.assessment_intent].split(' ')[0]}</span>
          </button>
          <div className="sidebar-domain-divider" />
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
          <button
            className="btn btn-accent btn-sm sidebar-save-btn"
            onClick={handleComplete}
            title={completedCount === 0 ? 'Answer at least one domain first' : 'View results based on answers so far'}
          >
            View results
          </button>
          <span className="sidebar-mode">{mode === 'facilitated' ? 'Workshop mode' : 'Self-assessment'}</span>
        </div>
      </aside>

      {/* Main content area */}
      <main className="assessment-main">
        {/* ═══ ASSESSMENT GOAL SECTION ═══ */}
        {isGoalSection && (
          <div className="assessment-goal-page">
            <h2 className="assessment-goal-page-title">What do you need your data to support?</h2>
            <p className="assessment-goal-page-intro">
              This is the most important question in the assessment. Your answer shapes how every domain score is interpreted — what counts as "good enough" depends entirely on what you are trying to do with the data. An organisation that only needs compliance reporting has a very different bar from one that wants to make evidence-based investment decisions.
            </p>
            <p className="assessment-goal-page-intro">
              Select the option that best describes your ambition. You can change this at any point during the assessment — your results will update to reflect the new target.
            </p>

            <div className="assessment-goal-cards">
              {(Object.keys(INTENT_LABELS) as AssessmentIntent[]).map((intent) => {
                const explanations: Record<string, string> = {
                  compliance_reporting: 'You need to produce high-level carbon reports, meet basic disclosure requirements such as SECR or CSRD, and report aggregate consumption figures. This is the minimum bar — your data needs to be broadly directional but does not need to be granular or real-time. Most organisations start here.',
                  directional_insight: 'You want to go beyond basic reporting. You need to identify trends, compare sites or services, benchmark performance against peers, and prioritise where to investigate further. This requires better coverage and consistency across your data domains, but does not yet demand full attribution or real-time feeds.',
                  evidence_based_decisions: 'You need your data to support investment cases, procurement challenges, rightsizing decisions, and operational accountability with defensible evidence. This is a significant step up — it requires attributed, traceable data that can withstand scrutiny in business cases and governance forums.',
                  automated_governance: 'You want data embedded into continuous governance — automated controls, real-time optimisation, policy-driven thresholds, and dynamic management. This is the highest bar and requires near-complete automation, integration with operational tooling, and continuous assurance.',
                };
                return (
                  <button
                    key={intent}
                    type="button"
                    className={`assessment-goal-card ${profile.assessment_intent === intent ? 'selected' : ''}`}
                    onClick={() => onUpdateProfile?.({ assessment_intent: intent })}
                  >
                    <span className="assessment-goal-card-label">{INTENT_LABELS[intent]}</span>
                    <span className="assessment-goal-card-desc">{explanations[intent]}</span>
                  </button>
                );
              })}
            </div>

            <div className="assessment-goal-actions">
              <button className="btn btn-primary btn-lg" onClick={goNext}>
                Continue to assessment
              </button>
            </div>
          </div>
        )}

        {/* ═══ DOMAIN SECTIONS ═══ */}
        {!isGoalSection && domain && result && (<>

        {/* Assessment introduction — shown on the first domain */}
        {currentIndex === 0 && (
          <div className="assessment-intro">
            <h2 className="assessment-intro-title">GreenOps Data Maturity Assessment</h2>
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
            onClick={currentIndex === 0 ? goPrev : goPrev}
          >
            {currentIndex === 0 ? 'Back to assessment goal' : 'Previous domain'}
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

        </>)}
      </main>
    </div>
  );
}
