import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OrganisationProfile, DomainAssessment, MaturityModel, Recommendation, DecisionAreaReadiness, MATURITY_LABELS } from '../types';
import { DomainNarrative } from './narrativeAnalysis';
import { calculateOverallStats } from './scoring';

const BRAND = {
  green: [90, 166, 62] as [number, number, number],       // Posetiv leaf green
  charcoal: [45, 45, 45] as [number, number, number],     // Charcoal primary
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
  const maxWidth = opts?.maxWidth ?? (w - indent - 20);

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
  const pageNum = { value: 0 };

  const stats = calculateOverallStats(results);
  const sorted = [...results].sort((a, b) => a.effective_maturity - b.effective_maturity);

  // ═══════════════════════════════════════════════
  // PAGE 1: Cover
  // ═══════════════════════════════════════════════
  doc.setFillColor(...BRAND.green);
  doc.rect(0, 0, w, 120, 'F');
  doc.setTextColor(...BRAND.white);
  doc.setFontSize(28);
  doc.text('GreenOps Data Input', 20, 45);
  doc.text('Maturity Assessment', 20, 60);
  doc.setFontSize(14);
  doc.text('Posetiv', 20, 80);
  doc.setFontSize(9);
  doc.setTextColor(220, 240, 215);
  doc.text('Operational efficiency through evidence-based sustainability', 20, 90);

  doc.setFontSize(11);
  doc.setTextColor(...BRAND.slate);
  doc.text(`Organisation: ${profile.organisation_name}`, 20, 140);
  doc.text(`Sector: ${profile.sector}${profile.sub_sector ? ' — ' + profile.sub_sector : ''}`, 20, 148);
  doc.text(`Date: ${profile.assessment_date}`, 20, 156);
  doc.text(`Assessor: ${profile.assessor_name || 'Not specified'}`, 20, 164);

  doc.setFontSize(9);
  doc.setTextColor(...BRAND.gray);
  let cy = 185;
  cy = writeBody(doc, 'This report presents the findings of a structured assessment of GreenOps data inputs across the technology estate. It evaluates the quality, coverage, and decision-readiness of the data that underpins environmental, efficiency, and cost calculations — and identifies where improvement will deliver the most value.', cy, pageNum, { fontSize: 9 });
  cy = writeBody(doc, 'The assessment covers 13 data domains, from asset inventory and power measurement through to allocation, carbon factors, and decision integration. Each domain is scored on a 1-5 maturity scale, with results interpreted in terms of what decisions the data can and cannot credibly support.', cy, pageNum, { fontSize: 9 });

  pageNum.value++;
  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // PAGE 2: Executive Summary — the story
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;

  let ey = sectionHeading(doc, 'Executive Summary', 25, 18);

  // Opening narrative paragraph — set the scene
  ey = writeBody(doc,
    `This assessment evaluated ${stats.domainCount} data domains across the technology estate of ${profile.organisation_name}. The overall weighted maturity is ${stats.weightedMaturity} out of 5, with individual domains ranging from level ${stats.minMaturity} to level ${stats.maxMaturity}.`,
    ey, pageNum, { fontSize: 10 }
  );

  // What does that score actually mean?
  let interpretation = '';
  if (stats.weightedMaturity < 2.5) {
    interpretation = 'At this level, the data foundation is immature. Most inputs are partial, inconsistent, or absent — the estate is running on estimates rather than evidence. This limits you to basic compliance reporting and means efficiency gains, cost savings, and carbon reductions are being missed. External disclosure based on current data should be caveated.';
  } else if (stats.weightedMaturity < 3.5) {
    interpretation = 'A basic data foundation exists in several areas, but significant gaps remain. Data works for periodic reporting and directional analysis, but is not consistently decision-grade. The priority is closing the weakest gaps — because they represent hidden risk, unquantified waste, and missed cost and carbon reduction.';
  } else if (stats.weightedMaturity < 4.5) {
    interpretation = 'Most domains are at or near decision-grade quality. The focus should shift from establishing data to using it — embedding GreenOps metrics into governance, investment decisions, procurement, and continuous improvement.';
  } else {
    interpretation = 'The data capability is mature and comprehensive. Focus on sustaining quality, extending automation, and ensuring governance keeps pace with estate changes and regulatory expectations.';
  }
  ey = writeBody(doc, interpretation, ey, pageNum, { fontSize: 10 });

  ey += 2;

  // Key findings — structured but narrative
  ey = writeBody(doc, 'Key findings:', ey, pageNum, { bold: true, fontSize: 10 });

  const belowThree = results.filter(r => r.effective_maturity < 3).length;
  const atFourPlus = results.filter(r => r.effective_maturity >= 4).length;
  const highImpactWeak = results
    .filter(r => r.effective_maturity <= 2 && r.impact_score >= 4)
    .map(r => model.domains.find(d => d.id === r.domain_id)?.name || r.domain_id);

  if (belowThree > 0) {
    ey = writeBody(doc,
      `\u2022  ${belowThree} of ${stats.domainCount} domains are below level 3. Data in those areas is not yet reliable enough to support confident operational or investment decisions.`,
      ey, pageNum, { indent: 24, fontSize: 9 }
    );
  }
  if (atFourPlus > 0) {
    ey = writeBody(doc,
      `\u2022  ${atFourPlus} domain${atFourPlus > 1 ? 's are' : ' is'} at level 4 or above, providing decision-grade or optimisation-grade evidence that can support active management.`,
      ey, pageNum, { indent: 24, fontSize: 9 }
    );
  }

  const spread = stats.maxMaturity - stats.minMaturity;
  if (spread >= 3) {
    ey = writeBody(doc,
      `\u2022  There is a ${spread}-level spread between the strongest and weakest domains. This unevenness limits the organisation's ability to make joined-up decisions — strong data in one area is undermined by weak data in related areas.`,
      ey, pageNum, { indent: 24, fontSize: 9 }
    );
  }

  if (highImpactWeak.length > 0) {
    ey = writeBody(doc,
      `\u2022  Priority attention needed: ${highImpactWeak.join(', ')} ${highImpactWeak.length === 1 ? 'is' : 'are'} both high-impact and low-maturity. These represent the largest gap between domain importance and evidence quality.`,
      ey, pageNum, { indent: 24, fontSize: 9 }
    );
  }

  // Strongest and weakest
  const weakest3 = sorted.slice(0, 3).map(r => {
    const d = model.domains.find(dd => dd.id === r.domain_id);
    return `${d?.name || r.domain_id} (level ${r.effective_maturity})`;
  });
  const strongest3 = sorted.slice(-3).reverse().map(r => {
    const d = model.domains.find(dd => dd.id === r.domain_id);
    return `${d?.name || r.domain_id} (level ${r.effective_maturity})`;
  });

  ey += 3;
  ey = writeBody(doc, `Strongest areas: ${strongest3.join('; ')}.`, ey, pageNum, { fontSize: 9 });
  ey = writeBody(doc, `Weakest areas: ${weakest3.join('; ')}.`, ey, pageNum, { fontSize: 9 });

  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // PAGE 3: Maturity at a Glance
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;

  let gy = sectionHeading(doc, 'Maturity at a Glance', 25, 18);

  gy = writeBody(doc,
    'The table below summarises the assessed maturity for each data domain. The maturity level reflects the quality and coverage of data inputs — what the organisation measures, tracks, and can evidence — not its sustainability ambition.',
    gy, pageNum, { fontSize: 9 }
  );

  autoTable(doc, {
    startY: gy + 2,
    head: [['Domain', 'Level', 'Maturity', 'Impact', 'Priority', 'What this means']],
    body: sorted.map((r) => {
      const d = model.domains.find((dd) => dd.id === r.domain_id);
      const levelText = LEVEL_LABELS[r.effective_maturity] || `Level ${r.effective_maturity}`;
      // Short interpretation based on level
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
      // Colour the level column
      if (data.section === 'body' && data.column.index === 1) {
        const val = parseInt(data.cell.raw as string, 10);
        if (!isNaN(val)) {
          data.cell.styles.textColor = levelColour(val);
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // PAGES: What Your Data Enables
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;

  let dy = sectionHeading(doc, 'What Your Data Enables', 25, 18);
  dy = writeBody(doc,
    'For each domain, this section describes what decisions your current data quality can credibly support, and where gaps prevent confident action. This is the core question: not just what score you achieved, but what it means for the decisions you need to make.',
    dy, pageNum, { fontSize: 9 }
  );
  dy += 2;

  for (const narrative of narratives) {
    const result = results.find(r => r.domain_id === narrative.domain_id);
    if (!result) continue;

    const blockHeight = 55; // approximate minimum height needed
    const h = doc.internal.pageSize.height;
    if (dy + blockHeight > h - 20) {
      addPageFooter(doc, pageNum.value);
      doc.addPage();
      pageNum.value++;
      dy = 25;
    }

    // Domain header with level badge
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.charcoal);
    doc.setFont(undefined as any, 'bold');
    doc.text(narrative.domain_name, 20, dy);

    // Level indicator
    const lvl = result.effective_maturity;
    const levelText = `Level ${lvl} — ${LEVEL_LABELS[lvl] || ''}`;
    doc.setFontSize(8);
    doc.setTextColor(...levelColour(lvl));
    doc.text(levelText, w - 20 - doc.getTextWidth(levelText), dy);
    doc.setFont(undefined as any, 'normal');
    dy += 6;

    // Operational impact — what this actually means
    if (narrative.operational_impact) {
      dy = writeBody(doc, narrative.operational_impact, dy, pageNum, { fontSize: 8.5 });
    }

    // Decision support
    if (narrative.decision_support_summary) {
      dy = writeBody(doc, narrative.decision_support_summary, dy, pageNum, { fontSize: 8.5 });
    }

    dy = accentBar(doc, dy + 1, BRAND.grayLight);
    dy += 2;
  }

  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // PAGES: Detailed Domain Analysis
  // ═══════════════════════════════════════════════
  for (const narrative of narratives) {
    doc.addPage();
    pageNum.value++;

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

    // Risk
    if (narrative.risk_statement) {
      ny += 1;
      ny = writeBody(doc, 'Risk and exposure', ny, pageNum, { bold: true, fontSize: 9 });
      ny = writeBody(doc, narrative.risk_statement, ny, pageNum, { fontSize: 9 });
    }

    // Decision support
    if (narrative.decision_support_summary) {
      ny += 1;
      ny = writeBody(doc, 'Decision support', ny, pageNum, { bold: true, fontSize: 9 });
      ny = writeBody(doc, narrative.decision_support_summary, ny, pageNum, { fontSize: 9 });
    }

    // Improvement guidance
    if (narrative.improvement_guidance) {
      ny += 1;
      ny = writeBody(doc, 'What to improve', ny, pageNum, { bold: true, fontSize: 9 });
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
  // PAGE: Decision Readiness
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;

  let dry = sectionHeading(doc, 'Decision Readiness', 25, 18);
  dry = writeBody(doc,
    'This section assesses whether your data is good enough to support the key decisions that GreenOps, FinOps, and sustainability programmes need to make. Readiness is determined by the weakest data input — a chain is only as strong as its weakest link.',
    dry, pageNum, { fontSize: 9 }
  );
  dry += 3;

  for (const dr of decisionReadiness) {
    const h = doc.internal.pageSize.height;
    if (dry + 30 > h - 20) {
      addPageFooter(doc, pageNum.value);
      doc.addPage();
      pageNum.value++;
      dry = 25;
    }

    // Decision area heading with readiness badge
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.charcoal);
    doc.setFont(undefined as any, 'bold');
    doc.text(dr.area, 20, dry);

    // Readiness label colour
    let badgeColour = BRAND.red;
    if (dr.readiness === 'directional') badgeColour = BRAND.amber;
    if (dr.readiness === 'decision_grade') badgeColour = BRAND.greenDk;
    if (dr.readiness === 'optimisation_grade') badgeColour = BRAND.green;

    doc.setFontSize(8);
    doc.setTextColor(...badgeColour);
    doc.setFont(undefined as any, 'bold');
    doc.text(dr.label, w - 20 - doc.getTextWidth(dr.label), dry);
    doc.setFont(undefined as any, 'normal');
    dry += 5;

    // Summary
    dry = writeBody(doc, dr.summary, dry, pageNum, { fontSize: 8.5 });

    // Limiting/supporting
    if (dr.limiting_domains.length > 0) {
      dry = writeBody(doc,
        `Limited by: ${dr.limiting_domains.join(', ')}`,
        dry, pageNum, { fontSize: 8, indent: 24 }
      );
    }
    if (dr.supporting_domains.length > 0) {
      dry = writeBody(doc,
        `Supported by: ${dr.supporting_domains.join(', ')}`,
        dry, pageNum, { fontSize: 8, indent: 24 }
      );
    }

    dry = accentBar(doc, dry + 1, BRAND.grayLight);
    dry += 2;
  }

  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // PAGES: Improvement Roadmap
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;

  let ry = sectionHeading(doc, 'Improvement Roadmap', 25, 18);

  // Overarching recommendation — narrative framing
  const foundationRecs = recommendations.filter(r => r.phase === 'Foundation');
  const quickWinRecs = recommendations.filter(r => r.phase === 'Quick win');
  const transformRecs = recommendations.filter(r => r.phase === 'Transformation');

  ry = writeBody(doc,
    `The improvement roadmap is structured in three phases. Foundational gaps must be closed before targeted improvements can deliver value, and transformation depends on the basics being in place.`,
    ry, pageNum, { fontSize: 9.5 }
  );

  // Summary counts
  const highCount = recommendations.filter(r => r.priority === 'High').length;
  if (highCount > 0) {
    ry = writeBody(doc,
      `${highCount} action${highCount > 1 ? 's are' : ' is'} high priority — the gap between domain importance and data quality is large enough to need immediate attention. These need named ownership and clear timelines.`,
      ry, pageNum, { fontSize: 9 }
    );
  }

  ry += 3;

  // PHASE 1: Foundation
  if (foundationRecs.length > 0) {
    ry = sectionHeading(doc, 'Phase 1: Foundation', ry, 12);
    ry = writeBody(doc,
      'Foundation actions address domains where data is absent, unreliable, or too incomplete for any meaningful decisions. The goal is not sophistication — it is establishing basic, measurable, traceable data where none exists.',
      ry, pageNum, { fontSize: 9 }
    );
    ry += 1;
    ry = renderRoadmapPhase(doc, foundationRecs, model, ry, pageNum);
    ry += 4;
  }

  // PHASE 2: Quick wins
  if (quickWinRecs.length > 0) {
    const h = doc.internal.pageSize.height;
    if (ry + 30 > h - 20) {
      addPageFooter(doc, pageNum.value);
      doc.addPage();
      pageNum.value++;
      ry = 25;
    }
    ry = sectionHeading(doc, 'Phase 2: Quick Wins', ry, 12);
    ry = writeBody(doc,
      'Quick win actions target domains where a basic foundation exists but focused improvement — better coverage, granularity, or attribution — can move data from directional to decision-grade.',
      ry, pageNum, { fontSize: 9 }
    );
    ry += 1;
    ry = renderRoadmapPhase(doc, quickWinRecs, model, ry, pageNum);
    ry += 4;
  }

  // PHASE 3: Transformation
  if (transformRecs.length > 0) {
    const h = doc.internal.pageSize.height;
    if (ry + 30 > h - 20) {
      addPageFooter(doc, pageNum.value);
      doc.addPage();
      pageNum.value++;
      ry = 25;
    }
    ry = sectionHeading(doc, 'Phase 3: Transformation', ry, 12);
    ry = writeBody(doc,
      'Transformation actions focus on domains with a reasonable data foundation. The goal is embedding data into operational governance — moving from periodic reporting to continuous management, automation, and optimisation.',
      ry, pageNum, { fontSize: 9 }
    );
    ry += 1;
    ry = renderRoadmapPhase(doc, transformRecs, model, ry, pageNum);
  }

  addPageFooter(doc, pageNum.value);

  // ═══════════════════════════════════════════════
  // FINAL PAGE: Next Steps + Posetiv
  // ═══════════════════════════════════════════════
  doc.addPage();
  pageNum.value++;

  let nsY = sectionHeading(doc, 'Next Steps', 25, 18);

  nsY = writeBody(doc,
    'This report provides an evidence-based view of data maturity across the technology estate. The scores, narratives, and recommendations are designed to support practical decision-making — identifying where data quality is strong enough to act on, where gaps need closing, and what the priorities should be.',
    nsY, pageNum, { fontSize: 10 }
  );

  nsY = writeBody(doc, 'To move from assessment to action, we recommend the following:', nsY, pageNum, { fontSize: 10 });

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

  nsY = writeBody(doc,
    'Posetiv specialises in GreenOps strategy, data maturity, and operational efficiency across enterprise technology estates. We help infrastructure, sustainability, finance, and leadership teams turn assessment findings into practical improvement — connecting better data to better decisions, lower costs, reduced carbon, and stronger governance.',
    nsY, pageNum, { fontSize: 9.5 }
  );

  nsY = writeBody(doc,
    'If you would like support in interpreting these results, building an improvement roadmap, or embedding GreenOps into your operating model, please get in touch.',
    nsY, pageNum, { fontSize: 9.5 }
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
