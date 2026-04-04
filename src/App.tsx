import { useState, useCallback } from 'react';
import model from './data/greenops_maturity_model.json';
import { MaturityModel, OrganisationProfile, DomainAssessment, AppView } from './types';
import { createBlankAssessment, scoreDomainAssessment } from './lib/scoring';
import { loadDemoData } from './lib/seedData';
import { generateRecommendations, generateExecutiveSummary } from './lib/recommendations';
import { generateDomainNarratives } from './lib/narrativeAnalysis';
import { generateDecisionReadiness } from './lib/decisionReadiness';
import { generateCSV, downloadCSV } from './lib/csvExport';
import { downloadPDF } from './lib/pdfExport';
import LandingPage from './components/LandingPage';
import ProfileForm from './components/ProfileForm';
import AssessmentFlow from './components/AssessmentFlow';
import ResultsDashboard from './components/ResultsDashboard';
import './styles.css';

const typedModel = model as unknown as MaturityModel;

function App() {
  const [view, setView] = useState<AppView>('landing');
  const [assessmentMode, setAssessmentMode] = useState<'self' | 'facilitated'>('self');
  const [profile, setProfile] = useState<OrganisationProfile>({
    organisation_name: '',
    sector: '',
    sub_sector: '',
    organisation_size: '',
    hosting_profile: '',
    assessment_date: new Date().toISOString().split('T')[0],
    assessor_name: '',
    notes: '',
    assessment_intent: 'directional_insight',
  });
  const [domainResults, setDomainResults] = useState<DomainAssessment[]>(
    typedModel.domains.map((d) => createBlankAssessment(d))
  );

  const handleStartNew = useCallback((mode: 'self' | 'facilitated') => {
    setAssessmentMode(mode);
    setDomainResults(typedModel.domains.map((d) => createBlankAssessment(d)));
    setProfile({
      organisation_name: '',
      sector: '',
      sub_sector: '',
      organisation_size: '',
      hosting_profile: '',
      assessment_date: new Date().toISOString().split('T')[0],
      assessor_name: '',
      notes: '',
      assessment_intent: 'directional_insight',
    });
    setView('profile');
  }, []);

  const handleLoadDemo = useCallback(() => {
    const demo = loadDemoData();
    setProfile(demo.profile);
    // Score all demo results
    const scored = demo.results.map((r) => {
      const domain = typedModel.domains.find((d) => d.id === r.domain_id)!;
      return scoreDomainAssessment(domain, r);
    });
    setDomainResults(scored);
    setAssessmentMode(demo.mode);
    setView('results');
  }, []);

  const handleProfileSubmit = useCallback((p: OrganisationProfile) => {
    setProfile(p);
    setView('assessment');
  }, []);

  const handleAssessmentComplete = useCallback((results: DomainAssessment[]) => {
    // Score all domains after assessment completion
    const scored = results.map((r) => {
      const domain = typedModel.domains.find((d) => d.id === r.domain_id)!;
      return scoreDomainAssessment(domain, r);
    });
    setDomainResults(scored);
    setView('results');
  }, []);

  const handleExportPDF = useCallback(() => {
    const narratives = generateDomainNarratives(domainResults, typedModel);
    const recommendations = generateRecommendations(domainResults, typedModel);
    const decisionReadiness = generateDecisionReadiness(domainResults, typedModel);
    const execSummary = generateExecutiveSummary(domainResults, typedModel, profile.assessment_intent);
    downloadPDF(profile, domainResults, typedModel, narratives, recommendations, decisionReadiness, execSummary);
  }, [profile, domainResults]);

  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(profile, domainResults, typedModel);
    const slug = profile.organisation_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadCSV(csv, `greenops-maturity-${slug}.csv`);
  }, [profile, domainResults]);

  const handleLoadSaved = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.profile && data.results) {
          setProfile({
            ...data.profile,
            assessment_intent: data.profile.assessment_intent || 'directional_insight',
          });
          setAssessmentMode(data.mode || 'facilitated');

          // Re-score to ensure consistency with current model
          const scored = data.results.map((r: DomainAssessment) => {
            const domain = typedModel.domains.find((d) => d.id === r.domain_id);
            return domain ? scoreDomainAssessment(domain, r) : r;
          });
          setDomainResults(scored);

          // Check if assessment is complete — if any domain has no answers, go to assessment view
          const totalAnswered = scored.reduce((sum: number, r: DomainAssessment) =>
            sum + Object.keys(r.question_answers).length, 0);
          const totalQuestions = typedModel.domains.reduce((sum, d) => sum + d.questions.length, 0);

          if (totalAnswered < totalQuestions * 0.5) {
            // Less than half answered — resume in assessment flow
            setView('assessment');
          } else {
            // Mostly or fully complete — go to results
            setView('results');
          }
        } else {
          alert('This file does not appear to be a valid GreenOps assessment. Expected profile and results data.');
        }
      } catch {
        alert('Could not load assessment file. Please check the file is a valid GreenOps assessment JSON.');
      }
    };
    reader.readAsText(file);
  }, []);

  return (
    <div className="app">
      {view === 'landing' && (
        <LandingPage
          onStartNew={handleStartNew}
          onLoadDemo={handleLoadDemo}
          onLoadSaved={handleLoadSaved}
        />
      )}
      {view === 'profile' && (
        <ProfileForm
          profile={profile}
          mode={assessmentMode}
          onSubmit={handleProfileSubmit}
          onBack={() => setView('landing')}
        />
      )}
      {view === 'assessment' && (
        <AssessmentFlow
          model={typedModel}
          mode={assessmentMode}
          profile={profile}
          results={domainResults}
          onComplete={handleAssessmentComplete}
          onBack={() => setView('profile')}
        />
      )}
      {view === 'results' && (
        <ResultsDashboard
          model={typedModel}
          profile={profile}
          results={domainResults}
          onExportPDF={handleExportPDF}
          onExportCSV={handleExportCSV}
          onBack={() => setView('assessment')}
          onStartOver={() => setView('landing')}
        />
      )}
    </div>
  );
}

export default App;
