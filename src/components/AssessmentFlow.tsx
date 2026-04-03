import { useState, useCallback } from 'react';
import { MaturityModel, DomainAssessment } from '../types';
import { inferMaturityFromAnswers } from '../lib/scoring';

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
      const inferred = inferMaturityFromAnswers(domain, newAnswers);
      updateResult({ question_answers: newAnswers, maturity_score: inferred });
    },
    [result, domain, updateResult]
  );

  const goNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      window.scrollTo(0, 0);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleComplete = () => {
    onComplete(results);
  };

  return (
    <div className="assessment-page">
      <div className="container-narrow">
        {/* Progress */}
        <div className="assessment-progress">
          <span className="progress-text">
            {currentIndex + 1} of {total}
          </span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
            />
          </div>
          <span className="progress-text" style={{ fontSize: '0.75rem' }}>
            {mode === 'facilitated' ? 'Workshop' : 'Self-assessment'}
          </span>
        </div>

        {/* Domain header */}
        <div className="domain-header">
          <p className="label">Domain {currentIndex + 1}</p>
          <h2>{domain.name}</h2>
          <p className="domain-definition">{domain.definition}</p>
          <p className="domain-why">Why it matters: {domain.why_it_matters}</p>
        </div>

        {/* Maturity guidance */}
        <div className="assessment-section">
          <div className="section-title">Maturity level guidance</div>
          <div className="maturity-guidance">
            {Object.entries(domain.maturity_levels).map(([level, desc]) => (
              <div
                key={level}
                className={`maturity-level-row ${
                  result.maturity_score === Number(level) ? 'active' : ''
                }`}
              >
                <span className={`level-badge l${level}`}>Level {level}</span>
                <span className="level-desc">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div className="assessment-section">
          <div className="section-title">Assessment questions</div>
          {domain.questions.map((q) => (
            <div key={q.id} className="question-block">
              <div className="question-text">{q.text}</div>
              <div className="option-list">
                {q.options.map((opt, idx) => (
                  <div
                    key={idx}
                    className={`option-item ${
                      result.question_answers[q.id] === idx ? 'selected' : ''
                    }`}
                    onClick={() => handleQuestionAnswer(q.id, idx)}
                  >
                    <div className="option-radio" />
                    <span>{opt}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Scores */}
        <div className="assessment-section">
          <div className="section-title">Scoring</div>
          <div className="score-controls">
            <div className="score-group">
              <label>Maturity score</label>
              <div className="score-slider">
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={result.maturity_score}
                  onChange={(e) =>
                    updateResult({ maturity_score: Number(e.target.value) })
                  }
                />
                <span className="score-value">{result.maturity_score}</span>
              </div>
            </div>
            <div className="score-group">
              <label>Impact score</label>
              <div className="score-slider">
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={result.impact_score}
                  onChange={(e) =>
                    updateResult({ impact_score: Number(e.target.value) })
                  }
                />
                <span className="score-value">{result.impact_score}</span>
              </div>
            </div>
            <div className="score-group">
              <label>Confidence score</label>
              <div className="score-slider">
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={result.confidence_score}
                  onChange={(e) =>
                    updateResult({ confidence_score: Number(e.target.value) })
                  }
                />
                <span className="score-value">{result.confidence_score}</span>
              </div>
            </div>
            <div className="score-group">
              <label>Target maturity</label>
              <div className="score-slider">
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={result.target_maturity}
                  onChange={(e) =>
                    updateResult({ target_maturity: Number(e.target.value) })
                  }
                />
                <span className="score-value">{result.target_maturity}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Priority */}
        <div className="assessment-section">
          <div className="section-title">Priority</div>
          <div className="priority-select">
            {(['High', 'Medium', 'Low'] as const).map((p) => (
              <button
                key={p}
                className={`priority-btn ${
                  result.priority === p ? `active-${p.toLowerCase()}` : ''
                }`}
                onClick={() => updateResult({ priority: p })}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Evidence */}
        <div className="assessment-section">
          <div className="section-title">Evidence and rationale</div>
          <div className="form-group">
            <label className="form-label">Evidence</label>
            <textarea
              className="form-textarea"
              value={result.evidence}
              onChange={(e) => updateResult({ evidence: e.target.value })}
              placeholder="What evidence supports this score?"
              rows={3}
            />
            <div className="evidence-examples">
              Examples: {domain.evidence_examples.join(', ')}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Rationale / notes</label>
            <textarea
              className="form-textarea"
              value={result.rationale}
              onChange={(e) => updateResult({ rationale: e.target.value })}
              placeholder="Key rationale or observations for this domain"
              rows={3}
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
          <div className="flex gap-sm">
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
