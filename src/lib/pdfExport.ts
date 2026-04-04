import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  OrganisationProfile,
  DomainAssessment,
  MaturityModel,
  Recommendation,
  DecisionAreaReadiness,
  MATURITY_LABELS,
  MATURITY_LABELS_SHORT,
  INTENT_LABELS,
  INTENT_MINIMUM_LEVEL,
  confidenceLabel,
  CONFIDENCE_DESCRIPTIONS,
} from '../types';
import { DomainNarrative } from './narrativeAnalysis';
import { calculateOverallStats } from './scoring';
import { getTopLimitingFactors, analyseCascadeRisks } from './dependencyChain';

const BRAND = {
  green: [90, 166, 62] as [number, number, number], // Posetiv leaf green
  charcoal: [45, 45, 45] as [number, number, number], // Charcoal primary
  greenLight: [237, 247, 233] as [number, number, number], // Light green bg
  slate: [73, 80, 87] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  gray: [134, 142, 150] as [number, number, number],
  grayLight: [241, 243, 245] as [number, number, number],
  red: [200, 60, 60] as [number, number, number],
  amber: [200, 150, 40] as [number, number, number],
  greenDk: [60, 140, 40] as [number, number, number],
};

const LEVEL_LABELS = MATURITY_LABELS;

function levelColour(level: number): [number, number, number] {
  if (level <= 1) return BRAND.red;
  if (level <= 2) return BRAND.amber;
  if (level <= 3) return [100, 130, 170];
  if (level <= 4) return BRAND.greenDk;
  return BRAND.green;
}

function addPageHeader(doc: jsPDF) {
  const w = doc.internal.pageSize.width;
  doc.setFillColor(...BRAND.green);
  doc.rect(20, 8, w - 40, 0.5, 'F');
}

function addPageFooter(doc: jsPDF, pageNum: number) {
  const h = doc.internal.pageSize.height;
  const w = doc.internal.pageSize.width;
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.gray);
  doc.text('Posetiv — GreenOps Data Input Maturity Assessment', 20, h - 10);
  doc.text(`Page ${pageNum}`, w - 30, h - 10);
}

/** Write a section heading in green */
function sectionHeading(doc: jsPDF, text: string, y: number, size = 14): number {
  doc.setFontSize(size);
  doc.setTextColor(...BRAND.green);
  doc.setFont(undefined as any, 'bold');
  doc.text(text, 20, y);
  doc.setFont(undefined as any, 'normal');
  return y + (size > 12 ? 10 : 7);
}

/** Write body text and return new Y position, handling page overflow */
function writeBody(
  doc: jsPDF,
  text: string,
  y: number,
  pageNum: { value: number },
  opts?: { indent?: number; bold?: boolean; fontSize?: number; maxWidth?: number }
): number {
  const w = doc.internal.pageSize.width;
  const h = doc.internal.pageSize.height;
  const indent = opts?.indent ?? 20;
  const fontSize = opts?.fontSize ?? 9;
  const maxWidth = opts?.maxWidth ?? w - indent - 20;

  doc.setFontSize(fontSize);
  doc.setTextColor(...BRAND.slate);
  if (opts?.bold) doc.setFont(undefined as any, 'bold');
  else doc.setFont(undefined as any, 'normal');

  const lines = doc.splitTextToSize(text, maxWidth);
  const lineHeight = fontSize * 0.45;
  const blockHeight = lines.length * lineHeight;

  // If it won't fit on this page, start a new one
  if (y + blockHeight > h - 20) {
    addPageFooter(doc, pageNum.value);
    doc.addPage();
    pageNum.value++;
    addPageHeader(doc);
    y = 25;
  }

  doc.text(lines, indent, y);
  return y + blockHeight + 3;
}

/** Add a coloured accent bar */
function accentBar(doc: jsPDF, y: number, colour: [number, number, number]): number {
  const w = doc.internal.pageSize.width;
  doc.setFillColor(...colour);
  doc.rect(20, y, w - 40, 0.5, 'F');
  return y + 4;
}

/** Draw a metric box (used for key metrics on page 2) */
function drawMetricBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  colour: [number, number, number]
) {
  // Border
  doc.setDrawColor(...colour);
  doc.setLineWidth(0.5);
  doc.rect(x, y, width, height);

  // Label
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.text(label, x + 3, y + 4);

  // Value
  doc.setFontSize(16);
  doc.setTextColor(...colour);
  doc.setFont(undefined as any, 'bold');
  doc.text(value, x + width / 2, y + height / 2 + 4, { align: 'center' });
  doc.setFont(undefined as any, 'normal');
}

/** Draw horizontal bar chart for all domains */
function drawDomainBars(
  doc: jsPDF,
  results: DomainAssessment[],
  model: MaturityModel,
  profile: OrganisationProfile,
  startY: number
): number {
  const sorted = [...results].sort((a, b) => b.effective_maturity - a.effective_maturity);
  const w = doc.internal.pageSize.width;
  const barHeight = 4;
  const barSpacing = 5;
  const labelWidth = 40;
  const barStartX = 70;
  const barMaxWidth = w - barStartX - 30;

  const intentLevel = INTENT_MINIMUM_LEVEL[profile.assessment_intent] || 3;

  let y = startY;

  // Title
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.charcoal);
  doc.setFont(undefined as any, 'bold');
  doc.text('Maturity Across All Domains', 20, y);
  doc.setFont(undefined as any, 'normal');
  y += 7;

  // Draw each domain bar
  for (const result of sorted) {
    const domain = model.domains.find(d => d.id === result.domain_id);
    const domainName = domain?.name || result.domain_id;
    const score = result.effective_maturity;
    const barWidth = (score / 5) * barMaxWidth;

    // Domain name (left)
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.slate);
    doc.text(domainName, 20, y + barHeight / 2 + 1.5, { maxWidth: labelWidth - 5 });

    // Coloured bar
    doc.setFillColor(...levelColour(score));
    doc.rect(barStartX, y, barWidth, barHeight, 'F');

    // Intent target line (dashed vertical line)
    const intentX = barStartX + (intentLevel / 5) * barMaxWidth;
    doc.setDrawColor(...BRAND.gray);
    // Draw dashed intent target line using small segments
    for (let dy = y - 0.5; dy < y + barHeight + 0.5; dy += 2) {
      doc.line(intentX, dy, intentX, Math.min(dy + 1, y + barHeight + 0.5));
    }

    // Score label (right)
    doc.setFontSize(7);
    doc.setTextColor(...levelColour(score));
    doc.setFont(undefined as any, 'bold');
    doc.text(score.toFixed(1), barStartX + barMaxWidth + 3, y + barHeight / 2 + 1.5);
    doc.setFont(undefined as any, 'normal');

    y += barSpacing;
  }

  // Legend for intent line
  y += 2;
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.gray);
  // Dashed legend line
  for (let dx = barStartX; dx < barStartX + 8; dx += 2) {
    doc.line(dx, y, dx + 1, y);
  }
  doc.text(`Intent target: Level ${intentLevel}`, barStartX + 10, y + 1);

  return y + 6;
}

/** Draw radar/spider chart for all domains */
function drawRadarChart(
  doc: jsPDF,
  results: DomainAssessment[],
  model: MaturityModel,
  profile: OrganisationProfile,
  startX: number,
  startY: number,
  size: number
): number {
  const cx = startX + size / 2;
  const cy = startY + size / 2;
  const maxRadius = size / 2.5;
  const domainCount = results.length;
  const intentLevel = INTENT_MINIMUM_LEVEL[profile.assessment_intent] || 3;

  // Title
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.charcoal);
  doc.setFont(undefined as any, 'bold');
  doc.text('Maturity Profile', startX, startY - 5);
  doc.setFont(undefined as any, 'normal');

  // Draw concentric circles (grid for levels 1-5)
  doc.setDrawColor(...BRAND.grayLight);
  doc.setLineWidth(0.3);
  for (let level = 1; level <= 5; level++) {
    const r = (level / 5) * maxRadius;
    doc.circle(cx, cy, r);
  }

  // Draw grid lines (axes)
  doc.setDrawColor(...BRAND.grayLight);
  doc.setLineWidth(0.2);
  for (let i = 0; i < domainCount; i++) {
    const angle = (i / domainCount) * Math.PI * 2 - Math.PI / 2;
    const x = cx + maxRadius * Math.cos(angle);
    const y = cy + maxRadius * Math.sin(angle);
    doc.line(cx, cy, x, y);
  }

  // Calculate actual maturity polygon points
  const actualPoints: [number, number][] = [];
  for (let i = 0; i < domainCount; i++) {
    const result = results[i];
    const angle = (i / domainCount) * Math.PI * 2 - Math.PI / 2;
    const r = (result.effective_maturity / 5) * maxRadius;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    actualPoints.push([x, y]);
  }

  // Draw actual maturity polygon (filled)
  doc.setFillColor(...BRAND.greenLight);
  doc.setDrawColor(...BRAND.green);
  doc.setLineWidth(1);
  if (actualPoints.length > 0) {
    // Draw filled polygon for actual scores
    doc.setFillColor(90, 166, 62);
    doc.setDrawColor(60, 140, 40);
    doc.setLineWidth(0.6);
    // Build polygon path using triangle fan
    for (let i = 0; i < actualPoints.length; i++) {
      const next = (i + 1) % actualPoints.length;
      doc.triangle(
        cx, cy,
        actualPoints[i][0], actualPoints[i][1],
        actualPoints[next][0], actualPoints[next][1],
        'F'
      );
    }
    // Draw outline
    for (let i = 0; i < actualPoints.length; i++) {
      const next = (i + 1) % actualPoints.length;
      doc.line(actualPoints[i][0], actualPoints[i][1], actualPoints[next][0], actualPoints[next][1]);
    }
  }

  // Calculate intent target polygon points (dashed outline)
  const intentPoints: [number, number][] = [];
  for (let i = 0; i < domainCount; i++) {
    const angle = (i / domainCount) * Math.PI * 2 - Math.PI / 2;
    const r = (intentLevel / 5) * maxRadius;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    intentPoints.push([x, y]);
  }

  // Draw intent target polygon (dashed segments)
  doc.setDrawColor(...BRAND.amber);
  doc.setLineWidth(0.8);
  if (intentPoints.length > 0) {
    for (let i = 0; i < intentPoints.length; i++) {
      const next = (i + 1) % intentPoints.length;
      const [x1, y1] = intentPoints[i];
      const [x2, y2] = intentPoints[next];
      // Draw dashed line between two points
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const dashLen = 2;
      const gapLen = 2;
      let d = 0;
      while (d < len) {
        const t1 = d / len;
        const t2 = Math.min((d + dashLen) / len, 1);
        doc.line(x1 + dx * t1, y1 + dy * t1, x1 + dx * t2, y1 + dy * t2);
        d += dashLen + gapLen;
      }
    }
  }

  // Label each axis (domain names around the circle)
  doc.setFontSize(6);
  doc.setTextColor(...BRAND.slate);
  for (let i = 0; i < domainCount; i++) {
    const result = results[i];
    const domain = model.domains.find(d => d.id === result.domain_id);
    const domainName = domain?.name || result.domain_id;
    const angle = (i / domainCount) * Math.PI * 2 - Math.PI / 2;
    const labelDist = maxRadius + 8;
    const x = cx + labelDist * Math.cos(angle);
    const y = cy + labelDist * Math.sin(angle);
    doc.text(domainName, x, y, { align: 'center', maxWidth: 20 });
  }

  return startY + size + 8;
}

export function downloadPDF(
  profile: OrganisationProfile,
  results: DomainAssessment[],
  model: MaturityModel,
  narratives: DomainNarrative[],
  recommendations: Recommendation[],
  decisionReadiness: DecisionAreaReadiness[],
  execSummary: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.width;
  const h = doc.internal.pageSize.height;
  const pageNum = { value: 0 };

  const stats = calculateOverallStats(results);
  // Build domain name lookup
  const domainNames: Record<string, string> = {};
  for (const d of model.domains) {
    domainNames[d.id] = d.name;
  }
  const limitingFactors = getTopLimitingFactors(results, domainNames);
  const cascadeRisks = analyseCascadeRisks(results, domainNames);
  const intentLevel = INTENT_MINIMUM_LEVEL[profile.assessment_intent] || 3;
  const intentLabel = INTENT_LABELS[profile.assessment_intent] || 'Assessment';
  const belowIntentCount = results.filter(r => r.effective_maturity < intentLevel).length;

  // ═══════════════════════════════════════════════
  // PAGE 1: COVER
  // ═══════════════════════════════════════════════
  doc.setFillColor(...BRAND.green);
  doc.rect(0, 0, w, 120, 'F');
  doc.setTextColor(...BRAND.white);
  doc.setFontSize(28);
  doc.setFont(undefined as any, 'bold');
  doc.text('GreenOps Data Input', 20, 45);
  doc.text('Maturity Assessment', 20, 60);
  doc.setFont(undefined as any, 'normal');
  doc.setFontSize(14);
  doc.text('Posetiv', 20, 80);
  doc.setFontSize(9);
  doc.setTextColor(220, 240, 215);
  doc.text('Operational efficiency through evidence-based sustainability', 20, 90);

  doc.setFontSize(11);
  doc.setTextColor(...BRAND.slate);
  doc.text(`Organisation: ${profile.organisation_name}`, 20, 140);
  doc.text(`Sector: ${profile.sector}${profile.sub_sector ? ' — ' + profile.sub_sector : ''}`, 20, 148);
  doc.text(`Assessment Intent: ${intentLabel}`, 20, 156);
  doc.text(`Date: ${profile.assessment_date}`, 20, 164);
  doc.text(`Assessor: ${profile.assessor_name || 'Not specified'}`, 20, 172);

  doc.setFontSize(9);
  doc.setTextColor(...BRAND.gray);
  let cy = 190;
  cy = writeBody(
    doc,
    'This report presents the findings of a structured assessment of GreenOps data inputs across the technology estate. It evaluates the quality, coverage, and decision-readiness of the data that underpins environmental, efficiency, and cost calculations — and identifies where improvement will deliver the most value.',
    cy,
    pageNum,
    { fontSize: 9 }
  );
  cy = writeBody(
    doc,
    'The assessment covers 13 data domains, from asset inventory and power measurement through to allocation, carbon factors, and decision integration. Each domain is scored on a 1-5 maturity scale, with results interpreted in terms of what decisions the data can and cannot credibly support.',
    cy,
    pageNum,
    { fontSize: 9 }
  );

  cy += 5;
  cy = sectionHeading(doc, 'How to read this report', cy, 11);
  cy = writeBody(
    doc,
    'The report is structured in two layers. Pages 2–5 provide a leadership summary: visual dashboard, executive findings, and decision readiness by stakeholder group. Pages 6 onwards provide technical detail for domain owners and practitioners: per-domain analysis, data credibility assessment, and a phased improvement roadmap.',
    cy,
    pageNum,
    { fontSize: 9 }
  );

  pageNum.value++;
  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // PAGE 2: VISUAL DASHBOARD
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;
  addPageHeader(doc);

  let dY = 18;

  dY = writeBody(
    doc,
    'The following dashboard summarises the maturity profile across all 13 data domains, measured against your stated assessment goal.',
    dY,
    pageNum,
    { fontSize: 9 }
  );

  dY += 4;

  // KEY METRICS BOXES
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.charcoal);
  doc.setFont(undefined as any, 'bold');
  doc.text('Key Metrics', 20, dY);
  doc.setFont(undefined as any, 'normal');
  dY += 8;

  const metricWidth = 45;
  const metricHeight = 20;
  const metricSpacing = 8;

  // Metric 1: Overall weighted maturity
  drawMetricBox(
    doc,
    20,
    dY,
    metricWidth,
    metricHeight,
    'Overall Maturity',
    `${stats.weightedMaturity.toFixed(1)}/5.0`,
    BRAND.green
  );

  // Metric 2: Confidence level
  const confLabel = confidenceLabel(stats.avgImpact);
  const confDescr = CONFIDENCE_DESCRIPTIONS[confLabel] || 'Unknown';
  drawMetricBox(
    doc,
    20 + metricWidth + metricSpacing,
    dY,
    metricWidth,
    metricHeight,
    'Confidence',
    confLabel.toUpperCase(),
    confLabel === 'high' ? BRAND.green : confLabel === 'moderate' ? BRAND.amber : BRAND.red
  );

  // Metric 3: Domains below intent
  drawMetricBox(
    doc,
    20 + 2 * (metricWidth + metricSpacing),
    dY,
    metricWidth,
    metricHeight,
    'Below Intent Target',
    `${belowIntentCount} of ${results.length}`,
    belowIntentCount > 0 ? BRAND.amber : BRAND.green
  );

  dY += metricHeight + 8;

  // HORIZONTAL BAR CHART
  dY = drawDomainBars(doc, results, model, profile, dY);

  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // PAGE 3: VISUAL DASHBOARD (CONTINUED) - RADAR CHART
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;
  addPageHeader(doc);

  const radarY = drawRadarChart(doc, results, model, profile, 20, 18, 100);

  // Legend below radar
  let legendY = radarY;
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.slate);
  doc.text('Solid green polygon: Current maturity', 25, legendY);
  doc.setDrawColor(...BRAND.amber);
  for (let dx = 25; dx < 35; dx += 3) {
    doc.line(dx, legendY + 3, dx + 1.5, legendY + 3);
  }
  doc.text('Dashed amber polygon: Intent target', 40, legendY + 3);

  legendY += 12;

  // Grid explanation
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.gray);
  doc.text('Concentric circles represent maturity levels 1 (center) to 5 (edge)', 25, legendY);

  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // PAGE 4: EXECUTIVE SUMMARY
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;
  addPageHeader(doc);

  let esY = sectionHeading(doc, 'Executive Summary', 25, 18);

  esY = writeBody(
    doc,
    'This summary highlights the most important findings from the assessment — where the organisation stands, what the data can and cannot support, and where the largest gaps exist.',
    esY,
    pageNum,
    { fontSize: 9 }
  );

  esY += 2;

  // Assessment intent context
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.charcoal);
  doc.setFont(undefined as any, 'bold');
  doc.text(`Assessment Goal: ${intentLabel}`, 20, esY);
  doc.setFont(undefined as any, 'normal');
  esY += 7;

  // Pre-generated executive summary
  const summaryParagraphs = execSummary.split('\n\n');
  for (const para of summaryParagraphs) {
    esY = writeBody(doc, para, esY, pageNum, { fontSize: 9 });
    esY += 1;
  }

  esY += 3;

  // Top limiting factors highlighted box
  if (limitingFactors.length > 0) {
    doc.setFillColor(...BRAND.greenLight);
    doc.rect(20, esY, w - 40, 35, 'F');

    doc.setFontSize(9);
    doc.setTextColor(...BRAND.charcoal);
    doc.setFont(undefined as any, 'bold');
    doc.text('Top Limiting Factors', 23, esY + 4);
    doc.setFont(undefined as any, 'normal');

    doc.setFontSize(8);
    doc.setTextColor(...BRAND.slate);
    for (let i = 0; i < Math.min(3, limitingFactors.length); i++) {
      const factor = limitingFactors[i];
      const text = `${factor.domain_name} (Level ${factor.maturity}) — affects ${factor.downstream_count} downstream areas`;
      doc.text(`• ${text}`, 25, esY + 10 + i * 6);
    }

    esY += 38;
  }

  esY += 2;
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.slate);
  const readinessPhrase = belowIntentCount === 0
    ? `All ${results.length} domains meet the intent target level (${intentLevel}).`
    : belowIntentCount === 1
      ? `1 of ${results.length} domains falls below the intent target level (${intentLevel}).`
      : `${belowIntentCount} of ${results.length} domains fall below the intent target level (${intentLevel}).`;
  doc.text(readinessPhrase, 20, esY, { maxWidth: w - 40 });

  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // PAGE 5: DECISION READINESS
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;
  addPageHeader(doc);

  let drY = sectionHeading(doc, 'Decision Readiness by Persona', 25, 18);

  drY = writeBody(
    doc,
    'The following section maps data readiness to key decision personas across the organisation. Each domain readiness is determined by the weakest supporting data input — a chain is only as strong as its weakest link. Readiness levels range from "reporting only" (retrospective, not actionable) through "decision-grade" (credible for confident action) to "optimisation-grade" (supporting continuous improvement).',
    drY,
    pageNum,
    { fontSize: 9 }
  );

  drY += 3;

  // Add explanation about weakest link
  drY = writeBody(
    doc,
    'Each question below asks whether current data quality is sufficient to support a specific decision. The answer is determined by the weakest data domain that feeds into that decision — because an answer is only as reliable as its weakest input.',
    drY,
    pageNum,
    { fontSize: 9 }
  );

  drY += 4;

  // Mapping of question text to areas (from web UI logic)
  const questionMappings = [
    { question: 'Can we credibly report our carbon footprint?', area: 'footprint reporting' },
    { question: 'Can we set and track environmental targets?', area: 'target setting and governance' },
    { question: 'Can we find where energy and resources are being wasted?', area: 'hotspot identification' },
    { question: 'Can we rightsize or decommission with confidence?', area: 'rightsizing and decommissioning' },
    { question: 'Can we make evidence-based refresh and lifecycle decisions?', area: 'refresh and lifecycle decisions' },
    { question: 'Can we optimise workload placement by cost, carbon, or efficiency?', area: 'workload placement' },
    { question: 'Can we drive service-level efficiency improvements?', area: 'service-level optimisation' },
    { question: 'Can we track whether operational improvements are working?', area: 'operational improvement tracking' },
    { question: 'Can we challenge supplier efficiency and sustainability claims?', area: 'supplier challenge' },
    { question: 'Can we attribute consumption to services, teams, or business units?', area: 'non-IT load allocation' },
    { question: 'Can we optimise cloud cost and carbon together?', area: 'cloud optimisation' },
    { question: 'Can we govern AI infrastructure demand and efficiency?', area: 'AI demand governance and optimisation' },
  ];

  // Group decision readiness by persona (4 groups from web UI)
  const personas = [
    {
      name: 'Sustainability & Reporting',
      areas: decisionReadiness.filter(dr =>
        ['footprint reporting', 'target setting and governance'].includes(dr.area)
      ),
      questions: questionMappings.filter(q =>
        ['footprint reporting', 'target setting and governance'].includes(q.area)
      ),
    },
    {
      name: 'Infrastructure & Operations',
      areas: decisionReadiness.filter(dr =>
        [
          'hotspot identification',
          'rightsizing and decommissioning',
          'refresh and lifecycle decisions',
          'workload placement',
          'service-level optimisation',
          'operational improvement tracking',
        ].includes(dr.area)
      ),
      questions: questionMappings.filter(q =>
        [
          'hotspot identification',
          'rightsizing and decommissioning',
          'refresh and lifecycle decisions',
          'workload placement',
          'service-level optimisation',
          'operational improvement tracking',
        ].includes(q.area)
      ),
    },
    {
      name: 'Procurement & Finance',
      areas: decisionReadiness.filter(dr =>
        ['supplier challenge', 'non-IT load allocation'].includes(dr.area)
      ),
      questions: questionMappings.filter(q =>
        ['supplier challenge', 'non-IT load allocation'].includes(q.area)
      ),
    },
    {
      name: 'Cloud & AI Governance',
      areas: decisionReadiness.filter(dr =>
        ['cloud optimisation', 'AI demand governance and optimisation'].includes(dr.area)
      ),
      questions: questionMappings.filter(q =>
        ['cloud optimisation', 'AI demand governance and optimisation'].includes(q.area)
      ),
    },
  ];

  // Summary counts at top
  const decisionGradeCount = decisionReadiness.filter(dr => dr.readiness === 'decision_grade').length;
  const directionalCount = decisionReadiness.filter(dr => dr.readiness === 'directional').length;
  const reportingOnlyCount = decisionReadiness.filter(dr => dr.readiness === 'reporting_only').length;

  drY = writeBody(
    doc,
    `Summary: ${decisionGradeCount} decision-grade, ${directionalCount} directional, ${reportingOnlyCount} reporting only.`,
    drY,
    pageNum,
    { fontSize: 9, bold: true }
  );

  drY += 3;

  // Render each persona group
  for (const persona of personas) {
    if (persona.areas.length === 0) continue;

    const space = drY + 30;
    if (space > h - 20) {
      addPageFooter(doc, pageNum.value);
      doc.addPage();
      pageNum.value++;
      addPageHeader(doc);
      drY = 25;
    }

    drY = sectionHeading(doc, persona.name, drY, 12);

    // Render by question (using plain-language questions)
    for (const question of persona.questions) {
      // Find the corresponding decision readiness item
      const dr = persona.areas.find(a => a.area === question.area);
      if (!dr) continue;

      let badgeColour = BRAND.red;
      if (dr.readiness === 'directional') badgeColour = BRAND.amber;
      if (dr.readiness === 'decision_grade') badgeColour = BRAND.greenDk;
      if (dr.readiness === 'optimisation_grade') badgeColour = BRAND.green;

      // Question text in bold
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.charcoal);
      doc.setFont(undefined as any, 'bold');
      doc.text(question.question, 20, drY);

      // Badge label on the right
      doc.setFontSize(8);
      doc.setTextColor(...badgeColour);
      doc.text(dr.label, w - 20 - doc.getTextWidth(dr.label), drY);
      doc.setFont(undefined as any, 'normal');
      drY += 5;

      // Summary text
      drY = writeBody(doc, dr.summary, drY, pageNum, { fontSize: 8 });

      // Limiting domains if any
      if (dr.limiting_domains.length > 0) {
        drY = writeBody(
          doc,
          `Constrained by: ${dr.limiting_domains.join(', ')}`,
          drY,
          pageNum,
          { fontSize: 7.5, indent: 24 }
        );
      }

      drY += 2;
    }

    drY += 2;
  }

  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // PAGE: MATURITY AT A GLANCE TABLE
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;
  addPageHeader(doc);

  let tY = sectionHeading(doc, 'Maturity at a Glance', 25, 18);

  tY = writeBody(
    doc,
    'The table below summarises the assessed maturity for each data domain. The maturity level reflects the quality and coverage of data inputs — what the organisation measures, tracks, and can evidence — not its sustainability ambition.',
    tY,
    pageNum,
    { fontSize: 9 }
  );

  const sorted = [...results].sort((a, b) => a.effective_maturity - b.effective_maturity);

  autoTable(doc, {
    startY: tY + 2,
    head: [['Domain', 'Level', 'Maturity', 'Impact', 'Priority', 'What this means']],
    body: sorted.map(r => {
      const d = model.domains.find(dd => dd.id === r.domain_id);
      const levelText = LEVEL_LABELS[r.effective_maturity] || `Level ${r.effective_maturity}`;

      let meaning = '';
      if (r.effective_maturity <= 1) meaning = 'Data absent or unreliable — decisions are uninformed';
      else if (r.effective_maturity <= 2) meaning = 'Partial data — sufficient for basic reporting only';
      else if (r.effective_maturity <= 3) meaning = 'Structured data — supports periodic reporting';
      else if (r.effective_maturity <= 4) meaning = 'Decision-grade — supports confident action';
      else meaning = 'Optimisation-grade — supports continuous improvement';

      return [
        d?.name || r.domain_id,
        String(r.effective_maturity),
        levelText,
        String(r.impact_score),
        r.priority || '—',
        meaning,
      ];
    }),
    headStyles: { fillColor: BRAND.charcoal, fontSize: 7, cellPadding: 2 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: BRAND.grayLight },
    margin: { left: 20, right: 20 },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 28 },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 14 },
      5: { cellWidth: 55 },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 1) {
        const val = parseInt(data.cell.raw as string, 10);
        if (!isNaN(val)) {
          data.cell.styles.textColor = levelColour(val);
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Get final Y position from autoTable and add maturity level explanations
  let mlY = (doc as any).lastAutoTable.finalY + 5;

  // Check if we need a new page
  if (mlY + 60 > h - 20) {
    addPageFooter(doc, pageNum.value);
    doc.addPage();
    pageNum.value++;
    addPageHeader(doc);
    mlY = 25;
  }

  mlY = sectionHeading(doc, 'Maturity Level Explanations', mlY, 11);

  const maturityExplanations = [
    {
      level: 1,
      label: LEVEL_LABELS[1],
      meaning:
        'Data is absent, ad hoc, or anecdotal. No reliable basis for any operational or reporting decision.',
    },
    {
      level: 2,
      label: LEVEL_LABELS[2],
      meaning:
        'Some data exists but coverage is incomplete and collection is inconsistent. Sufficient for basic disclosure only.',
    },
    {
      level: 3,
      label: LEVEL_LABELS[3],
      meaning:
        'Data is structured and routinely collected. Supports periodic reporting and identifies broad patterns, but not granular enough for confident action.',
    },
    {
      level: 4,
      label: LEVEL_LABELS[4],
      meaning:
        'Data is measured, attributed, and traceable. Supports confident operational and investment decisions.',
    },
    {
      level: 5,
      label: LEVEL_LABELS[5],
      meaning:
        'Data is continuously collected, automated, and integrated into governance. Supports real-time optimisation and dynamic management.',
    },
  ];

  for (const exp of maturityExplanations) {
    if (mlY + 12 > h - 20) {
      addPageFooter(doc, pageNum.value);
      doc.addPage();
      pageNum.value++;
      addPageHeader(doc);
      mlY = 25;
    }

    doc.setFontSize(9);
    doc.setTextColor(...levelColour(exp.level));
    doc.setFont(undefined as any, 'bold');
    doc.text(`Level ${exp.level}: ${exp.label}`, 20, mlY);
    doc.setFont(undefined as any, 'normal');
    mlY += 4;

    mlY = writeBody(doc, exp.meaning, mlY, pageNum, { fontSize: 8.5, indent: 20 });
    mlY += 1;
  }

  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // PAGES: DETAILED DOMAIN ANALYSIS
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;
  addPageHeader(doc);

  let domainIntroY = sectionHeading(
    doc,
    'Domain Detail Analysis',
    25,
    18
  );

  domainIntroY = writeBody(
    doc,
    'The following pages provide detailed analysis for each of the 13 data domains. For each domain, the report covers: what the current data quality means operationally, what decisions it can and cannot support, where misinterpretation risks exist, how upstream data constraints cascade through calculations, and what needs to change.',
    domainIntroY,
    pageNum,
    { fontSize: 9 }
  );

  addPageFooter(doc, pageNum.value);

  for (const narrative of narratives) {
    doc.addPage();
    pageNum.value++;
    addPageHeader(doc);

    let ny = sectionHeading(doc, narrative.domain_name, 25, 14);

    const result = results.find(r => r.domain_id === narrative.domain_id);
    const lvl = result?.effective_maturity || 1;

    // Level and label
    doc.setFontSize(10);
    doc.setTextColor(...levelColour(lvl));
    doc.setFont(undefined as any, 'bold');
    doc.text(`Level ${lvl} — ${narrative.maturity_label}`, 20, ny);
    doc.setFont(undefined as any, 'normal');
    ny += 7;

    // Score explanation
    ny = writeBody(doc, narrative.score_explanation, ny, pageNum, { fontSize: 9 });

    // Operational impact
    if (narrative.operational_impact) {
      ny += 1;
      ny = writeBody(doc, 'What this means operationally', ny, pageNum, { bold: true, fontSize: 9 });
      ny = writeBody(doc, narrative.operational_impact, ny, pageNum, { fontSize: 9 });
    }

    // Dimension breakdown
    if (narrative.dimension_analysis) {
      ny += 1;
      ny = writeBody(doc, 'Dimension breakdown', ny, pageNum, { bold: true, fontSize: 9 });
      ny = writeBody(doc, narrative.dimension_analysis, ny, pageNum, { fontSize: 9 });
    }

    // Data credibility
    if (narrative.risk_statement) {
      ny += 1;
      ny = writeBody(doc, 'Data credibility', ny, pageNum, { bold: true, fontSize: 9 });
      ny = writeBody(doc, narrative.risk_statement, ny, pageNum, { fontSize: 9 });
    }

    // Misinterpretation risk
    if (narrative.misinterpretation_risk) {
      ny += 1;
      ny = writeBody(doc, 'Misinterpretation risk', ny, pageNum, { bold: true, fontSize: 9 });
      ny = writeBody(doc, narrative.misinterpretation_risk, ny, pageNum, { fontSize: 9 });
    }

    // Calculation dependencies
    if (narrative.cascade_note) {
      ny += 1;
      ny = writeBody(doc, 'Calculation dependencies', ny, pageNum, { bold: true, fontSize: 9 });
      ny = writeBody(doc, narrative.cascade_note, ny, pageNum, { fontSize: 9 });
    }

    // What this data supports
    if (narrative.decision_support_summary) {
      ny += 1;
      ny = writeBody(doc, 'What this data supports', ny, pageNum, { bold: true, fontSize: 9 });
      ny = writeBody(doc, narrative.decision_support_summary, ny, pageNum, { fontSize: 9 });
    }

    // Path forward
    if (narrative.improvement_guidance) {
      ny += 1;
      ny = writeBody(doc, 'Path forward', ny, pageNum, { bold: true, fontSize: 9 });
      ny = writeBody(doc, narrative.improvement_guidance, ny, pageNum, { fontSize: 9 });
    }

    // Caveats
    if (narrative.weakness_flags.length > 0) {
      ny += 1;
      ny = writeBody(doc, 'Scoring caveats', ny, pageNum, { bold: true, fontSize: 9 });
      for (const flag of narrative.weakness_flags) {
        ny = writeBody(doc, `\u2022  ${flag}`, ny, pageNum, { indent: 24, fontSize: 8.5 });
      }
    }

    addPageFooter(doc, pageNum.value);
  }

  // ═══════════════════════════════════════════════
  // PAGE: IMPROVEMENT ROADMAP
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;
  addPageHeader(doc);

  let ry = sectionHeading(doc, 'Improvement Roadmap', 25, 18);

  const foundationRecs = recommendations.filter(r => r.phase === 'Foundation');
  const quickWinRecs = recommendations.filter(r => r.phase === 'Quick win');
  const transformRecs = recommendations.filter(r => r.phase === 'Transformation');

  ry = writeBody(
    doc,
    'The roadmap below translates assessment findings into prioritised action. It is structured in three phases that reflect implementation reality: foundational gaps must be closed before targeted improvements can deliver value, and transformation depends on the basics being in place. Each recommendation identifies what needs to change, why it matters, and what improves if the action is taken.',
    ry,
    pageNum,
    { fontSize: 9.5 }
  );

  // Summary counts
  const highCount = recommendations.filter(r => r.priority === 'High').length;
  if (highCount > 0) {
    ry = writeBody(
      doc,
      `${highCount} action${highCount > 1 ? 's are' : ' is'} high priority — the gap between domain importance and data quality is large enough to need immediate attention. These need named ownership and clear timelines.`,
      ry,
      pageNum,
      { fontSize: 9 }
    );
  }

  ry += 3;

  // PHASE 1: Foundation
  if (foundationRecs.length > 0) {
    ry = sectionHeading(doc, 'Phase 1: Foundation', ry, 12);
    ry = writeBody(
      doc,
      'Foundation actions address domains where data is absent, unreliable, or too incomplete for any meaningful decisions. The goal is not sophistication — it is establishing basic, measurable, traceable data where none exists.',
      ry,
      pageNum,
      { fontSize: 9 }
    );
    ry += 1;
    ry = renderRoadmapPhase(doc, foundationRecs, model, ry, pageNum);
    ry += 4;
  }

  // PHASE 2: Quick wins
  if (quickWinRecs.length > 0) {
    if (ry + 30 > h - 20) {
      addPageFooter(doc, pageNum.value);
      doc.addPage();
      pageNum.value++;
      addPageHeader(doc);
      ry = 25;
    }
    ry = sectionHeading(doc, 'Phase 2: Quick Wins', ry, 12);
    ry = writeBody(
      doc,
      'Quick win actions target domains where a basic foundation exists but focused improvement — better coverage, granularity, or attribution — can move data from directional to decision-grade.',
      ry,
      pageNum,
      { fontSize: 9 }
    );
    ry += 1;
    ry = renderRoadmapPhase(doc, quickWinRecs, model, ry, pageNum);
    ry += 4;
  }

  // PHASE 3: Transformation
  if (transformRecs.length > 0) {
    if (ry + 30 > h - 20) {
      addPageFooter(doc, pageNum.value);
      doc.addPage();
      pageNum.value++;
      addPageHeader(doc);
      ry = 25;
    }
    ry = sectionHeading(doc, 'Phase 3: Transformation', ry, 12);
    ry = writeBody(
      doc,
      'Transformation actions focus on domains with a reasonable data foundation. The goal is embedding data into operational governance — moving from periodic reporting to continuous management, automation, and optimisation.',
      ry,
      pageNum,
      { fontSize: 9 }
    );
    ry += 1;
    ry = renderRoadmapPhase(doc, transformRecs, model, ry, pageNum);
  }

  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // FINAL PAGE: NEXT STEPS + POSETIV CTA
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;
  addPageHeader(doc);

  let nsY = sectionHeading(doc, 'Next Steps', 25, 18);

  nsY = writeBody(
    doc,
    'This report provides an evidence-based view of data maturity across the technology estate. The scores, narratives, and recommendations are designed to support practical decision-making — identifying where data quality is strong enough to act on, where gaps need closing, and what the priorities should be.',
    nsY,
    pageNum,
    { fontSize: 10 }
  );

  nsY = writeBody(doc, 'To move from assessment to action, we recommend the following:', nsY, pageNum, {
    fontSize: 10,
  });

  const steps = [
    'Review and validate — Walk through domain findings with technical and operational stakeholders. Do the scores match operational reality?',
    'Prioritise by impact — Focus on domains with the largest gap between impact and maturity. That is where better data quality delivers the most value.',
    'Assign ownership — Each priority domain needs a named owner. Data quality is a management issue, not a backlog item.',
    'Define evidence requirements — For each priority domain, specify what "good enough" data looks like: what to measure, how often, with what traceability.',
    'Build a phased plan — Sequence actions into Foundation, Quick Wins, and Transformation as outlined in the roadmap.',
    'Reassess periodically — Repeat the assessment every 6–12 months to track progress and adjust priorities as the estate evolves.',
  ];

  for (const step of steps) {
    nsY = writeBody(doc, `\u2022  ${step}`, nsY, pageNum, { indent: 24, fontSize: 9 });
  }

  nsY += 6;
  nsY = accentBar(doc, nsY, BRAND.green);
  nsY += 4;

  nsY = writeBody(doc, 'How Posetiv can help', nsY, pageNum, { bold: true, fontSize: 11 });

  nsY = writeBody(
    doc,
    'Posetiv specialises in GreenOps strategy, data maturity, and operational efficiency across enterprise technology estates. We help infrastructure, sustainability, finance, and leadership teams turn assessment findings into practical improvement — connecting better data to better decisions, lower costs, reduced carbon, and stronger governance.',
    nsY,
    pageNum,
    { fontSize: 9.5 }
  );

  nsY = writeBody(
    doc,
    'If you would like support in interpreting these results, building an improvement roadmap, or embedding GreenOps into your operating model, please get in touch.',
    nsY,
    pageNum,
    { fontSize: 9.5 }
  );

  nsY += 4;
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.green);
  doc.setFont(undefined as any, 'bold');
  doc.text('hello@posetiv.co.uk', 20, nsY);
  doc.setFont(undefined as any, 'normal');
  nsY += 5;
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.text('www.posetiv.co.uk', 20, nsY);

  addPageFooter(doc, pageNum.value);

  // Save
  const slug = profile.organisation_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`greenops-maturity-${slug}.pdf`);
}

/**
 * Render a roadmap phase — groups recommendations by domain
 * with a narrative per domain, not just table rows.
 */
function renderRoadmapPhase(
  doc: jsPDF,
  recs: Recommendation[],
  model: MaturityModel,
  startY: number,
  pageNum: { value: number }
): number {
  let y = startY;
  const h = doc.internal.pageSize.height;

  // Group by domain
  const byDomain = new Map<string, Recommendation[]>();
  for (const rec of recs) {
    const key = rec.domain_name;
    if (!byDomain.has(key)) byDomain.set(key, []);
    byDomain.get(key)!.push(rec);
  }

  for (const [domainName, domainRecs] of byDomain) {
    // Check space
    if (y + 25 > h - 20) {
      addPageFooter(doc, pageNum.value);
      doc.addPage();
      pageNum.value++;
      addPageHeader(doc);
      y = 25;
    }

    // Domain heading within phase
    doc.setFontSize(9.5);
    doc.setTextColor(...BRAND.charcoal);
    doc.setFont(undefined as any, 'bold');
    const priorityTag = domainRecs[0].priority === 'High' ? '  [HIGH PRIORITY]' : '';
    doc.text(`${domainName}${priorityTag}`, 20, y);
    doc.setFont(undefined as any, 'normal');
    y += 5;

    // Reason — why this domain needs attention
    y = writeBody(doc, domainRecs[0].reason, y, pageNum, { fontSize: 8.5 });

    // Actions
    for (const rec of domainRecs) {
      y = writeBody(doc, `\u2022  ${rec.action}`, y, pageNum, { indent: 24, fontSize: 8.5 });
    }

    // Benefit — what improves if they do this
    if (domainRecs[0].benefit) {
      y = writeBody(doc, domainRecs[0].benefit, y, pageNum, { fontSize: 8.5 });
    }

    y += 2;
  }

  return y;
}
