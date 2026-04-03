import { useState, useCallback } from 'react';
import { MaturityModel, DomainAssessment } from '../types';

interface AssessmentFlowProps {
  model: MaturityModel;
  mode: 'self' | 'facilitated';
  results: DomainAssessment[];
  onComplete: (results: DomainAssessment[]) => void;
  onBack: () => void;
}

export default function AssessmentFlow({
  model,
  mode,
  results: initialResults,
  onComplete,
  onBack,
}: AssessmentFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<DomainAssessment[]>(initialResults);
  const domain = model.domains[currentIndex];
  const result = results[currentIndex];
  const total = model.domains.length;
  const [showIncomplete, setShowIncomplete] = useState(false);

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
    // Check all domains have all questions answered
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

  // Jump to domain
  const jumpToDomain = (index: number) => {
    setShowIncomplete(false);
    setCurrentIndex(index);
    window.scrollTo(0, 0);
  };

  return (
    <div className="assessment-page">
      <div className="container-wide">
        {/* Top bar: progress + domain navigator */}
        <div className="assessment-topbar">
          <div className="assessment-progress-bar">
            <div className="progress-label">
              <span className="progress-text-bold">Domain {currentIndex + 1}</span>
              <span className="progress-text-light"> of {total}</span>
              <span className="progress-mode">{mode === 'facilitated' ? 'Workshop' : 'Self-assessment'}</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
              />
            </div>
          </div>
          <div className="domain-nav-pills">
            {model.domains.map((d, i) => {
              const r = results[i];
              const answered = Object.keys(r.question_answers).length;
              const total_q = d.questions.length;
              const complete = answered === total_q;
              const partial = answered > 0 && !complete;
              return (
                <button
                  key={d.id}
                  className={`domain-pill ${i === currentIndex ? 'active' : ''} ${complete ? 'complete' : ''} ${partial ? 'partial' : ''}`}
                  onClick={() => jumpToDomain(i)}
                  title={d.name}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Domain context intro */}
        <div className="domain-intro">
          <h2 className="domain-title">{domain.name}</h2>
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

        {/* Evidence and notes — compact */}
        <div className="evidence-row">
          <div className="evidence-col">
            <label className="field-label">Evidence and sources</label>
            <textarea
              className="field-textarea"
              value={result.evidence}
              onChange={(e) => updateResult({ evidence: e.target.value })}
              placeholder="What evidence supports the answers given?"
              rows={2}
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
              placeholder="Key observations or caveats for this domain"
              rows={2}
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
      </div>
    </div>
  );
}
