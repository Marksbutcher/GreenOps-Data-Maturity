# GreenOps Data Input Maturity Assessment Tool

A professional, enterprise-grade web application for assessing the maturity of data inputs used in GreenOps calculations across cloud, on-premise and colocation environments.

Built for [Posetiv](https://posetiv.co.uk).

## What it does

This tool assesses 13 domains of GreenOps data input maturity, from asset inventory through to decision integration. For each domain it captures maturity scores, impact scores, evidence, rationale and confidence levels, then generates:

- **Executive summary** with headline findings, strongest and weakest domains, key risks and recommendations
- **Domain score table** with maturity, impact, confidence, decision support status, target and gap
- **Detailed narrative analysis** for each domain covering current state, consequences, supported and unsupported decisions, what better maturity would unlock, and improvement actions
- **Priority matrix** (scatter chart) showing maturity vs impact to identify where to act first
- **Heatmap** showing maturity at a glance across all domains
- **Radar chart** comparing maturity, impact and target across domains
- **Decision readiness summary** explicitly stating which GreenOps decisions the organisation can and cannot credibly make with its current data
- **Improvement roadmap** with prioritised, domain-specific, decision-aware recommendations
- **PDF report** suitable for presentation and stakeholder distribution
- **CSV export** for further analysis and integration

## Target audience

- Enterprise IT leaders (CIO, CTO, VP Infrastructure)
- GreenOps and digital sustainability practitioners
- FinOps and TBM practitioners
- Infrastructure and operations teams
- Cloud platform teams
- Data centre and colocation stakeholders
- Consulting teams running client assessments
- Government and regulated-sector stakeholders

## Maturity model

The assessment uses a structured 1-5 maturity scale:

| Level | Label | Meaning |
|-------|-------|---------|
| 1 | Initial / Ad hoc | Fragmented, estimate-heavy, unreliable |
| 2 | Managed / Repeatable | Repeatable but inconsistent in coverage and precision |
| 3 | Defined / Standardised | Documented, standardised across key areas |
| 4 | Quantitatively Managed | Measured and controlled using evidence |
| 5 | Optimising | Continuously improved, automated, embedded in decisions |

## Domains assessed

1. Asset inventory and configuration data
2. Operational power and energy data
3. Water data
4. Infrastructure efficiency metric quality (PUE, WUE, CUE, CER, CLF)
5. Embodied emissions data
6. Carbon intensity and emissions factors
7. Asset, workload, application and service usage maturity
8. Allocation and attribution logic
9. Cloud service telemetry and workload data
10. Colocation and third-party provider data quality
11. Temporal granularity and timeliness
12. Data lineage, transparency and assurance
13. Decision integration and optimisation workflow

## Scoring approach

For each domain:

- **Maturity score** (1-5): Inferred from guided question answers, with manual override available
- **Impact score** (1-5): Pre-populated from the model with manual adjustment
- **Confidence score** (1-5): Assessor's confidence in the scoring
- **Target maturity** (1-5): Where the organisation wants to be
- **Priority**: High / Medium / Low, auto-suggested from maturity-impact gap

## Decision readiness logic

The tool maps domain maturity to decision-support statuses:

- **Reporting only** - suitable for broad reporting and awareness
- **Directional decision support** - useful for indicative prioritisation
- **Decision-grade** - strong enough for controlled operational decisions
- **Optimisation-grade** - strong enough for continuous optimisation

Twelve GreenOps decision areas are assessed against their domain dependencies, including footprint reporting, rightsizing, supplier challenge, cloud optimisation, AI demand governance, and target setting.

## Output logic

Recommendations are generated from the model's recommendation themes, tailored to the current maturity score and decision-readiness status. They are grouped into:

- **Quick wins** - low-maturity, high-impact domains with straightforward actions
- **Foundation** - building core capabilities where gaps are large
- **Transformation** - extending already-strong domains into optimisation

Each recommendation includes the action, reason, expected benefit and priority.

## Technology stack

- React 19 with TypeScript
- Vite for build tooling
- Recharts for data visualisation (scatter, radar, heatmap)
- jsPDF + jspdf-autotable for PDF generation
- DM Sans + DM Serif Display typography
- No backend required - runs entirely client-side

## Design decisions

- **Model is externalised**: All domain definitions, questions, maturity levels, decision-support mappings and recommendation themes are loaded from `greenops_maturity_model.json`. The model can be updated without changing application code.
- **Demo data is externalised**: The seeded demo assessment is loaded from `demo_assessment_seed.json`.
- **Decision readiness is a first-class output**: Not buried in footnotes - it has its own tab and PDF section.
- **Narrative analysis is generated, not templated**: The tool assembles domain-specific analysis from the model's structure rather than using fixed text blocks.
- **No backend**: Everything runs in the browser. Assessment state lives in React state. No login, no database, no API.
- **Maturity is never hidden behind one average**: The weighted and unweighted averages are shown, but every domain is individually visible.

## How to run

```bash
npm install
npm run dev
```

The development server runs on `http://localhost:5173` by default.

```bash
npm run build      # Production build
npm run preview    # Preview production build
```

## Demo mode

Click "View demo assessment with sample data" on the landing page to load a pre-populated assessment for a fictional enterprise bank. This shows the full output screens with realistic, uneven maturity data across all 13 domains.

## Project structure

```
src/
  data/                  # Externalised model and seed data
    greenops_maturity_model.json
    demo_assessment_seed.json
  types/                 # TypeScript type definitions
    index.ts
  lib/                   # Core logic
    scoring.ts           # Maturity inference, decision support, priority
    recommendations.ts   # Recommendation engine and executive summary
    narrativeAnalysis.ts # Per-domain narrative generation
    decisionReadiness.ts # Decision-area readiness assessment
    seedData.ts          # Demo data loader
    csvExport.ts         # CSV generation
    pdfExport.ts         # PDF report generation
  components/            # React components
    LandingPage.tsx
    ProfileForm.tsx
    AssessmentFlow.tsx
    ResultsDashboard.tsx
  App.tsx                # Main application shell
  styles.css             # Global stylesheet
  main.tsx               # Entry point
```

## Licence

Proprietary - Posetiv. All rights reserved.
