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
    const execSummary = generateExecutiveSummary(domainResults, typedModel);
    downloadPDF(profile, domainResults, typedModel, narratives, recommendations, decisionReadiness, execSummary);
  }, [profile, domainResults]);

  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(profile, domainResults, typedModel);
    const slug = profile.organisation_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadCSV(csv, `greenops-maturity-${slug}.csv`);
  }, [profile, domainResults]);

  return (
    <div className="app">
      {view === 'landing' && (
        <LandingPage
          onStartNew={handleStartNew}
          onLoadDemo={handleLoadDemo}
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
