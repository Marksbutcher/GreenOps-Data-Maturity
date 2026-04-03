import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OrganisationProfile, DomainAssessment, MaturityModel, Recommendation, DecisionAreaReadiness } from '../types';
import { DomainNarrative } from './narrativeAnalysis';
import { calculateOverallStats } from './scoring';

const BRAND = {
  teal: [90, 166, 62] as [number, number, number],       // Posetiv green
  tealDark: [45, 45, 45] as [number, number, number],    // Charcoal primary
  tealLight: [237, 247, 233] as [number, number, number], // Light green bg
  slate: [73, 80, 87] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  gray: [134, 142, 150] as [number, number, number],
  grayLight: [241, 243, 245] as [number, number, number],
};

function addPageFooter(doc: jsPDF, pageNum: number) {
  const h = doc.internal.pageSize.height;
  const w = doc.internal.pageSize.width;
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.gray);
  doc.text(`Posetiv — GreenOps Data Input Maturity Assessment`, 20, h - 10);
  doc.text(`Page ${pageNum}`, w - 30, h - 10);
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
  let pageNum = 0;

  // Cover page
  doc.setFillColor(...BRAND.teal);
  doc.rect(0, 0, w, 120, 'F');
  doc.setTextColor(...BRAND.white);
  doc.setFontSize(28);
  doc.text('GreenOps Data Input', 20, 45);
  doc.text('Maturity Assessment', 20, 60);
  doc.setFontSize(14);
  doc.text('Posetiv', 20, 80);
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.slate);
  doc.text(`Organisation: ${profile.organisation_name}`, 20, 140);
  doc.text(`Sector: ${profile.sector}${profile.sub_sector ? ' — ' + profile.sub_sector : ''}`, 20, 148);
  doc.text(`Date: ${profile.assessment_date}`, 20, 156);
  doc.text(`Assessor: ${profile.assessor_name || 'Not specified'}`, 20, 164);
  doc.text(`Model version: ${model.version}`, 20, 172);
  pageNum++;
  addPageFooter(doc, pageNum);

  // Executive summary
  doc.addPage();
  pageNum++;
  doc.setFontSize(18);
  doc.setTextColor(...BRAND.teal);
  doc.text('Executive Summary', 20, 25);
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.slate);
  const splitSummary = doc.splitTextToSize(execSummary, w - 40);
  doc.text(splitSummary, 20, 38);
  addPageFooter(doc, pageNum);

  // Domain scores table
  doc.addPage();
  pageNum++;
  doc.setFontSize(18);
  doc.setTextColor(...BRAND.teal);
  doc.text('Domain Scores', 20, 25);

  const stats = calculateOverallStats(results);

  doc.setFontSize(10);
  doc.setTextColor(...BRAND.slate);
  doc.text(`Overall weighted maturity: ${stats.weightedMaturity} / 5    Range: ${stats.minMaturity} — ${stats.maxMaturity}`, 20, 35);

  autoTable(doc, {
    startY: 42,
    head: [['Domain', 'Calculated', 'Override', 'Effective', 'Impact', 'Confidence', 'Priority', 'Decision Support']],
    body: results.map((r) => {
      const d = model.domains.find((dd) => dd.id === r.domain_id);
      return [
        d?.name || r.domain_id,
        String(r.calculated_maturity),
        r.assessor_override !== null ? String(r.assessor_override) : '—',
        String(r.effective_maturity),
        String(r.impact_score),
        String(r.confidence_score),
        r.priority,
        r.decision_support_status,
      ];
    }),
    headStyles: { fillColor: BRAND.teal, fontSize: 7, cellPadding: 2 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: BRAND.grayLight },
    margin: { left: 20, right: 20 },
  });
  addPageFooter(doc, pageNum);

  // Detailed domain sections
  for (const narrative of narratives) {
    doc.addPage();
    pageNum++;
    doc.setFontSize(14);
    doc.setTextColor(...BRAND.teal);
    doc.text(narrative.domain_name, 20, 25);

    doc.setFontSize(9);
    doc.setTextColor(...BRAND.slate);
    let y = 35;

    const result = results.find((r) => r.domain_id === narrative.domain_id);

    doc.setFontSize(10);
    doc.setFont(undefined as any, 'bold');
    doc.text(`Level ${narrative.maturity_level} — ${narrative.maturity_label}`, 20, y);
    doc.setFont(undefined as any, 'normal');
    y += 8;

    doc.setFontSize(9);
    const scoreLines = doc.splitTextToSize(narrative.score_explanation, w - 40);
    doc.text(scoreLines, 20, y);
    y += scoreLines.length * 4.5 + 4;

    if (narrative.dimension_analysis) {
      doc.setFont(undefined as any, 'bold');
      doc.text('Dimension Analysis', 20, y);
      doc.setFont(undefined as any, 'normal');
      y += 5;
      const dimLines = doc.splitTextToSize(narrative.dimension_analysis, w - 40);
      doc.text(dimLines, 20, y);
      y += dimLines.length * 4.5 + 4;
    }

    if ('operational_impact' in narrative && (narrative as any).operational_impact) {
      doc.setFont(undefined as any, 'bold');
      doc.text('Operational Impact', 20, y);
      doc.setFont(undefined as any, 'normal');
      y += 5;
      const opLines = doc.splitTextToSize((narrative as any).operational_impact, w - 40);
      doc.text(opLines, 20, y);
      y += opLines.length * 4.5 + 4;
    }

    if ('risk_statement' in narrative && (narrative as any).risk_statement) {
      doc.setFont(undefined as any, 'bold');
      doc.text('Risk Assessment', 20, y);
      doc.setFont(undefined as any, 'normal');
      y += 5;
      const riskLines = doc.splitTextToSize((narrative as any).risk_statement, w - 40);
      doc.text(riskLines, 20, y);
      y += riskLines.length * 4.5 + 4;
    }

    if (narrative.decision_support_summary) {
      doc.setFont(undefined as any, 'bold');
      doc.text('Decision Support', 20, y);
      doc.setFont(undefined as any, 'normal');
      y += 5;
      const dsLines = doc.splitTextToSize(narrative.decision_support_summary, w - 40);
      doc.text(dsLines, 20, y);
      y += dsLines.length * 4.5 + 4;
    }

    if (narrative.improvement_guidance) {
      doc.setFont(undefined as any, 'bold');
      doc.text('Improvement Guidance', 20, y);
      doc.setFont(undefined as any, 'normal');
      y += 5;
      const impLines = doc.splitTextToSize(narrative.improvement_guidance, w - 40);
      doc.text(impLines, 20, y);
      y += impLines.length * 4.5 + 4;
    }

    if (narrative.weakness_flags.length > 0) {
      doc.setFont(undefined as any, 'bold');
      doc.text('Caveats', 20, y);
      doc.setFont(undefined as any, 'normal');
      y += 5;
      for (const flag of narrative.weakness_flags) {
        const flagLines = doc.splitTextToSize(`• ${flag}`, w - 40);
        doc.text(flagLines, 20, y);
        y += flagLines.length * 4.5 + 2;
      }
    }

    addPageFooter(doc, pageNum);
  }

  // Decision readiness
  doc.addPage();
  pageNum++;
  doc.setFontSize(18);
  doc.setTextColor(...BRAND.teal);
  doc.text('Decision Readiness', 20, 25);

  autoTable(doc, {
    startY: 35,
    head: [['Decision Area', 'Readiness', 'Supporting Domains', 'Limiting Domains']],
    body: decisionReadiness.map((dr) => [
      dr.area,
      dr.label,
      dr.supporting_domains.join(', ') || '—',
      dr.limiting_domains.join(', ') || '—',
    ]),
    headStyles: { fillColor: BRAND.teal, fontSize: 7, cellPadding: 2 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: BRAND.grayLight },
    margin: { left: 20, right: 20 },
  });
  addPageFooter(doc, pageNum);

  // Recommendations
  doc.addPage();
  pageNum++;
  doc.setFontSize(18);
  doc.setTextColor(...BRAND.teal);
  doc.text('Improvement Roadmap', 20, 25);

  autoTable(doc, {
    startY: 35,
    head: [['Domain', 'Action', 'Priority', 'Phase', 'Reason']],
    body: recommendations.map((rec) => [
      rec.domain_name,
      rec.action,
      rec.priority,
      rec.phase,
      rec.reason,
    ]),
    headStyles: { fillColor: BRAND.teal, fontSize: 7, cellPadding: 2 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: BRAND.grayLight },
    margin: { left: 20, right: 20 },
    columnStyles: { 4: { cellWidth: 50 } },
  });
  addPageFooter(doc, pageNum);

  // Save
  const slug = profile.organisation_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`greenops-maturity-${slug}.pdf`);
}
