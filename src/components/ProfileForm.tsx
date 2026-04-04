import { useState } from 'react';
import { OrganisationProfile, AssessmentIntent, INTENT_LABELS, INTENT_DESCRIPTIONS } from '../types';

interface ProfileFormProps {
  profile: OrganisationProfile;
  mode: 'self' | 'facilitated';
  onSubmit: (profile: OrganisationProfile) => void;
  onBack: () => void;
}

const SECTORS = [
  'Financial services',
  'Government and public sector',
  'Healthcare',
  'Telecommunications',
  'Energy and utilities',
  'Retail and consumer',
  'Manufacturing',
  'Technology',
  'Professional services',
  'Education',
  'Transport and logistics',
  'Media and entertainment',
  'Other',
];

const SIZES = [
  'Small / mid-market',
  'Large enterprise',
  'Very large enterprise',
  'Public sector body',
  'Multinational',
];

const HOSTING_PROFILES = [
  'Primarily on-premise',
  'Primarily cloud',
  'Hybrid with significant cloud',
  'Hybrid with colocation and significant cloud usage',
  'Primarily colocation',
  'Multi-cloud',
  'Mixed / complex estate',
];

export default function ProfileForm({ profile, mode, onSubmit, onBack }: ProfileFormProps) {
  const [form, setForm] = useState<OrganisationProfile>(profile);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: keyof OrganisationProfile, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: '' }));
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!form.organisation_name.trim()) newErrors.organisation_name = 'Required';
    if (!form.sector.trim()) newErrors.sector = 'Required';
    if (!form.assessment_intent) newErrors.assessment_intent = 'Please select what you need your data to support';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="profile-page">
      <div className="container-narrow">
        <div className="profile-header">
          <p className="label">
            {mode === 'facilitated' ? 'Facilitated workshop' : 'Self-assessment'} — Step 1 of 2
          </p>
          <h1>Organisation profile</h1>
          <p className="text-secondary" style={{ marginTop: 8 }}>
            Capture the key details about the organisation being assessed. These will appear in the report.
          </p>
        </div>

        <div className="card card-elevated" style={{ marginBottom: 24 }}>
          <div className="form-group">
            <label className="form-label form-required" style={{ fontSize: '1rem', marginBottom: 12 }}>
              What do you need your GreenOps data to support?
            </label>
            <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: 16, marginTop: 0 }}>
              This shapes how the assessment interprets your results — what counts as "good enough" depends on what you're trying to do with the data.
            </p>
            <div className="intent-cards">
              {(Object.keys(INTENT_LABELS) as AssessmentIntent[]).map((intent) => (
                <button
                  key={intent}
                  type="button"
                  className={`intent-card ${form.assessment_intent === intent ? 'intent-card-selected' : ''}`}
                  onClick={() => update('assessment_intent', intent)}
                >
                  <span className="intent-card-label">{INTENT_LABELS[intent]}</span>
                  <span className="intent-card-desc">{INTENT_DESCRIPTIONS[intent]}</span>
                </button>
              ))}
            </div>
            {errors.assessment_intent && (
              <span style={{ color: 'var(--color-high)', fontSize: '0.8125rem' }}>
                {errors.assessment_intent}
              </span>
            )}
          </div>
        </div>

        <div className="card card-elevated">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label form-required">Organisation name</label>
              <input
                className="form-input"
                value={form.organisation_name}
                onChange={(e) => update('organisation_name', e.target.value)}
                placeholder="e.g. Acme Holdings plc"
              />
              {errors.organisation_name && (
                <span style={{ color: 'var(--color-high)', fontSize: '0.8125rem' }}>
                  {errors.organisation_name}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label form-required">Market sector</label>
              <select
                className="form-select"
                value={form.sector}
                onChange={(e) => update('sector', e.target.value)}
              >
                <option value="">Select sector</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.sector && (
                <span style={{ color: 'var(--color-high)', fontSize: '0.8125rem' }}>
                  {errors.sector}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Sub-sector</label>
              <input
                className="form-input"
                value={form.sub_sector}
                onChange={(e) => update('sub_sector', e.target.value)}
                placeholder="e.g. Retail banking"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Organisation size</label>
              <select
                className="form-select"
                value={form.organisation_size}
                onChange={(e) => update('organisation_size', e.target.value)}
              >
                <option value="">Select size</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Hosting profile</label>
              <select
                className="form-select"
                value={form.hosting_profile}
                onChange={(e) => update('hosting_profile', e.target.value)}
              >
                <option value="">Select hosting profile</option>
                {HOSTING_PROFILES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assessment date</label>
              <input
                className="form-input"
                type="date"
                value={form.assessment_date}
                onChange={(e) => update('assessment_date', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assessor name</label>
              <input
                className="form-input"
                value={form.assessor_name}
                onChange={(e) => update('assessor_name', e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="form-group form-full-width">
              <label className="form-label">Notes or context</label>
              <textarea
                className="form-textarea"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Any relevant context about the assessment scope, limitations or purpose"
                rows={3}
              />
            </div>
          </div>

          <div className="profile-actions">
            <button className="btn btn-ghost" onClick={onBack}>Back</button>
            <button className="btn btn-primary btn-lg" onClick={handleSubmit}>
              Continue to assessment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
