import { jsPDF } from 'jspdf';
import { AnnotationItem, ClassStatistics, EvaluationResult, ExamRecord, TestPaperPage } from '../types';

/**
 * Draws teacher annotations on top of an image onto a target canvas at original full resolution.
 */
export async function renderGradedCanvas(
  page: TestPaperPage,
  options?: {
    showPenMarks?: boolean;
    showMarginNotes?: boolean;
    showScoreStamp?: boolean;
    showBoxes?: boolean;
    pageNumber?: number;
    totalPages?: number;
    globalScoreAwarded?: number;
    globalMaxScore?: number;
  }
): Promise<HTMLCanvasElement> {
  const {
    showPenMarks = true,
    showMarginNotes = true,
    showScoreStamp = true,
    showBoxes = true,
    pageNumber = page.pageNumber,
    totalPages,
    globalScoreAwarded,
    globalMaxScore,
  } = options || {};

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const width = img.naturalWidth || img.width || 1200;
      const height = img.naturalHeight || img.height || 1600;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // 1. Draw base test paper image
      ctx.drawImage(img, 0, 0, width, height);

      const evaluation = page.evaluation;
      if (!evaluation) {
        resolve(canvas);
        return;
      }

      // Filter annotations specifically for this page if multi-page
      const allAnnotations = evaluation.annotations || [];
      const annotations = pageNumber
        ? allAnnotations.filter((ann) => !ann.page_number || ann.page_number === pageNumber)
        : allAnnotations;

      // 2. Draw annotations
      annotations.forEach((ann) => {
        const [ymin, xmin, ymax, xmax] = ann.box_2d;
        // Map 0..1000 coordinates to actual pixel coordinates
        const x = (xmin / 1000) * width;
        const y = (ymin / 1000) * height;
        const boxW = Math.max(20, ((xmax - xmin) / 1000) * width);
        const boxH = Math.max(16, ((ymax - ymin) / 1000) * height);

        const isCorrect = ann.type === 'correct';
        const isPartial = ann.type === 'partial';
        const isIncorrect = ann.type === 'incorrect';

        const strokeColor = isCorrect
          ? '#16a34a' // emerald-600
          : isPartial
          ? '#d97706' // amber-600
          : '#dc2626'; // red-600

        const fillColor = isCorrect
          ? 'rgba(34, 197, 94, 0.08)'
          : isPartial
          ? 'rgba(245, 158, 11, 0.08)'
          : 'rgba(239, 68, 68, 0.08)';

        // Draw highlight bounding box if enabled
        if (showBoxes) {
          ctx.save();
          ctx.fillStyle = fillColor;
          ctx.fillRect(x, y, boxW, boxH);

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 2.5;
          ctx.setLineDash(isPartial ? [6, 4] : isIncorrect ? [4, 4] : []);
          ctx.strokeRect(x, y, boxW, boxH);
          ctx.restore();
        }

        // Draw teacher pen symbol (Checkmark or Cross)
        if (showPenMarks) {
          ctx.save();
          ctx.strokeStyle = strokeColor;
          ctx.fillStyle = strokeColor;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          const markX = x < 35 ? Math.max(8, x + 4) : Math.max(8, x - 32);
          const markY = Math.max(22, y + 16);

          if (isCorrect) {
            // Draw authentic teacher checkmark
            ctx.beginPath();
            ctx.moveTo(markX, markY - 6);
            ctx.lineTo(markX + 8, markY + 6);
            ctx.lineTo(markX + 24, markY - 14);
            ctx.stroke();

            // Small score stamp underneath
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`+${ann.marks_awarded}`, markX + 4, markY + 20);
          } else if (isIncorrect) {
            // Draw cross mark (X)
            ctx.beginPath();
            ctx.moveTo(markX, markY - 12);
            ctx.lineTo(markX + 18, markY + 6);
            ctx.moveTo(markX + 18, markY - 12);
            ctx.lineTo(markX, markY + 6);
            ctx.stroke();

            // Small score stamp underneath
            ctx.font = 'bold 12px monospace';
            ctx.fillText('0', markX + 6, markY + 20);
          } else if (isPartial) {
            // Draw Tilde or partial mark
            ctx.font = 'bold 26px "Caveat", cursive, sans-serif';
            ctx.fillText('~', markX + 4, markY);
            ctx.font = 'bold 11px monospace';
            ctx.fillText(`${ann.marks_awarded}/${ann.max_marks}`, markX, markY + 16);
          }
          ctx.restore();
        }

        // Draw teacher handwritten margin note & marks badge
        if (showMarginNotes && ann.feedback_text) {
          ctx.save();
          const noteX = Math.min(width - 260, Math.max(10, x + boxW + 16));
          const noteY = Math.max(30, y);

          // Marks chip (e.g. +2, -1, 4.5/5)
          const markText =
            ann.marks_awarded === ann.max_marks
              ? `+${ann.marks_awarded}`
              : `${ann.marks_awarded}/${ann.max_marks}`;

          // Draw note pill / badge
          ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
          const badgeWidth = ctx.measureText(markText).width + 18;
          ctx.fillStyle = strokeColor;
          roundRect(ctx, noteX, noteY - 18, badgeWidth, 24, 6);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(markText, noteX + 9, noteY);

          // Handwritten text note
          ctx.font = 'bold 22px "Caveat", cursive, sans-serif';
          ctx.fillStyle = strokeColor;
          ctx.fillText(ann.feedback_text, noteX + badgeWidth + 10, noteY + 2);
          ctx.restore();
        }
      });

      // 3. Draw Authentic Official Examiner Score Stamp (Top Right)
      if (showScoreStamp) {
        ctx.save();
        const stampX = width - 290;
        const stampY = 35;
        const stampW = 255;
        const stampH = 115;

        ctx.translate(stampX + stampW / 2, stampY + stampH / 2);
        ctx.rotate(-0.05); // subtle realistic tilt
        ctx.translate(-(stampX + stampW / 2), -(stampY + stampH / 2));

        // Outer double border
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3.5;
        roundRect(ctx, stampX, stampY, stampW, stampH, 12);
        ctx.stroke();

        ctx.lineWidth = 1.2;
        roundRect(ctx, stampX + 4, stampY + 4, stampW - 8, stampH - 8, 9);
        ctx.stroke();

        // Inner stamp fill
        ctx.fillStyle = 'rgba(254, 242, 242, 0.88)';
        ctx.fill();

        ctx.fillStyle = '#991b1b';
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';

        const isMulti = Boolean(totalPages && totalPages > 1);
        const headerText = isMulti
          ? `PAGE ${pageNumber || 1} OF ${totalPages} EVALUATION`
          : 'OFFICIAL EVALUATION STAMP';
        ctx.fillText(headerText, stampX + stampW / 2, stampY + 24);

        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
        const displayScore = `${evaluation.total_score_awarded} / ${evaluation.max_possible_score}`;
        ctx.fillText(displayScore, stampX + stampW / 2, stampY + 62);

        const pct = Math.round((evaluation.total_score_awarded / evaluation.max_possible_score) * 100);
        ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#b91c1c';
        const subText = isMulti && globalScoreAwarded !== undefined && globalMaxScore !== undefined
          ? `TOTAL EXAM: ${globalScoreAwarded}/${globalMaxScore}  •  VERIFIED`
          : `GRADE: ${getGradeLetter(pct)} (${pct}%)  •  VERIFIED`;
        ctx.fillText(subText, stampX + stampW / 2, stampY + 92);

        ctx.restore();
      }

      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Failed to load image for canvas export'));
    img.src = page.dataUrl;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function getGradeLetter(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

/**
 * Downloads the graded test paper as a high-resolution PNG image.
 */
export async function downloadGradedPNG(page: TestPaperPage, filename = 'graded-test-paper.png') {
  const canvas = await renderGradedCanvas(page);
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads the graded test paper as a PDF report.
 * Supports both single page and multi-page test paper submissions.
 * Generates an annotated page for each student page, followed by a formal Evaluation Report Card.
 */
export async function downloadGradedPDF(
  pagesOrPage: TestPaperPage | TestPaperPage[],
  filename = 'graded-evaluation-report.pdf',
  globalEvaluation?: EvaluationResult
) {
  const pagesList: TestPaperPage[] = Array.isArray(pagesOrPage) ? pagesOrPage : [pagesOrPage];
  if (pagesList.length === 0) return;

  const totalPages = pagesList.length;
  const primaryEval = globalEvaluation || pagesList[0]?.evaluation;

  let pdf: jsPDF | null = null;

  // Add each student page with annotations to PDF
  for (let idx = 0; idx < totalPages; idx++) {
    const page = pagesList[idx];
    const pageNum = idx + 1;
    const canvas = await renderGradedCanvas(page, {
      pageNumber: pageNum,
      totalPages,
      globalScoreAwarded: primaryEval?.total_score_awarded,
      globalMaxScore: primaryEval?.max_possible_score,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';

    if (idx === 0) {
      pdf = new jsPDF({
        orientation,
        unit: 'pt',
        format: 'a4',
      });
    } else {
      pdf!.addPage('a4', orientation);
    }

    const pageWidth = pdf!.internal.pageSize.getWidth();
    const pageHeight = pdf!.internal.pageSize.getHeight();

    const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const renderW = canvas.width * scale;
    const renderH = canvas.height * scale;
    const offsetX = (pageWidth - renderW) / 2;
    const offsetY = (pageHeight - renderH) / 2;

    pdf!.addImage(imgData, 'JPEG', offsetX, offsetY, renderW, renderH);
  }

  if (!pdf) return;

  // Append Final Assessment Summary Report Card
  const evaluation = primaryEval;
  if (evaluation) {
    pdf.addPage('a4', 'portrait');
    const pageWidth = pdf.internal.pageSize.getWidth();

    // Header bar
    pdf.setFillColor(30, 41, 59); // slate-800
    pdf.rect(0, 0, pageWidth, 70, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(17);
    pdf.setFont('helvetica', 'bold');
    pdf.text('AI Auto Test Paper Evaluator - Official Grading Report', 30, 42);

    // Score Summary Box
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(30, 90, pageWidth - 60, 95, 6, 6, 'F');
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(30, 90, pageWidth - 60, 95, 6, 6, 'D');

    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(
      totalPages > 1
        ? `Overall Exam Score Awarded (${totalPages} Pages Submission):`
        : 'Overall Score Awarded:',
      45,
      120
    );

    const pct = Math.round((evaluation.total_score_awarded / evaluation.max_possible_score) * 100);
    pdf.setFontSize(26);
    pdf.setTextColor(220, 38, 38);
    pdf.text(`${evaluation.total_score_awarded} / ${evaluation.max_possible_score}`, 45, 155);

    pdf.setFontSize(13);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Percentage: ${pct}%   |   Grade: ${getGradeLetter(pct)}`, 230, 155);

    // Page-by-page score table if multi-page
    let curY = 205;
    if (evaluation.page_scores && evaluation.page_scores.length > 1) {
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Page-by-Page Scores Breakdown:', 30, curY);
      curY += 15;

      pdf.setFillColor(241, 245, 249);
      pdf.rect(30, curY, pageWidth - 60, 18, 'F');
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Page #', 45, curY + 13);
      pdf.text('Marks Awarded', 120, curY + 13);
      pdf.text('Notes / Content', 250, curY + 13);
      curY += 20;

      pdf.setFont('helvetica', 'normal');
      evaluation.page_scores.forEach((ps) => {
        pdf.setTextColor(51, 65, 85);
        pdf.text(`Page ${ps.page_number}`, 45, curY + 11);
        pdf.text(
          ps.max_marks ? `${ps.marks_awarded} / ${ps.max_marks} marks` : `${ps.marks_awarded} marks`,
          120,
          curY + 11
        );
        pdf.text(ps.summary || `Page ${ps.page_number} workings`, 250, curY + 11);

        pdf.setDrawColor(241, 245, 249);
        pdf.line(30, curY + 16, pageWidth - 30, curY + 16);
        curY += 18;
      });
      curY += 10;
    }

    // Evaluator Overall Feedback
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Evaluator Overall Feedback & Academic Observations', 30, curY);

    curY += 16;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    const splitFeedback = pdf.splitTextToSize(evaluation.overall_feedback, pageWidth - 60);
    pdf.text(splitFeedback, 30, curY);
    curY += splitFeedback.length * 13 + 16;

    // Strengths & Weaknesses
    if (evaluation.strengths && evaluation.strengths.length > 0) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(22, 163, 74);
      pdf.text('Demonstrated Strengths:', 30, curY);
      curY += 14;
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(51, 65, 85);
      evaluation.strengths.forEach((str) => {
        pdf.text(`• ${str}`, 40, curY);
        curY += 12;
      });
      curY += 8;
    }

    if (evaluation.weaknesses && evaluation.weaknesses.length > 0) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(220, 38, 38);
      pdf.text('Areas for Improvement / Deductions:', 30, curY);
      curY += 14;
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(51, 65, 85);
      evaluation.weaknesses.forEach((weak) => {
        pdf.text(`• ${weak}`, 40, curY);
        curY += 12;
      });
      curY += 10;
    }

    // Question Breakdown Table
    if (evaluation.question_breakdown && evaluation.question_breakdown.length > 0) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text('Question-Wise Scoring Breakdown:', 30, curY);
      curY += 14;

      // Table Header
      pdf.setFillColor(241, 245, 249);
      pdf.rect(30, curY, pageWidth - 60, 18, 'F');
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Question', 40, curY + 12);
      pdf.text('Page #', 100, curY + 12);
      pdf.text('Topic / Skill', 150, curY + 12);
      pdf.text('Marks', 360, curY + 12);
      pdf.text('Max', 430, curY + 12);
      pdf.text('Status', 490, curY + 12);
      curY += 20;

      pdf.setFont('helvetica', 'normal');
      evaluation.question_breakdown.forEach((q) => {
        if (curY > 780) {
          pdf!.addPage('a4', 'portrait');
          curY = 40;
        }
        pdf!.setTextColor(51, 65, 85);
        pdf!.text(q.question_number, 40, curY + 11);
        pdf!.text(q.page_number ? `P${q.page_number}` : '-', 100, curY + 11);
        pdf!.text(q.topic || 'General', 150, curY + 11);
        pdf!.text(String(q.marks_obtained), 360, curY + 11);
        pdf!.text(String(q.max_marks), 430, curY + 11);
        pdf!.text(q.status || '-', 490, curY + 11);

        pdf!.setDrawColor(241, 245, 249);
        pdf!.line(30, curY + 15, pageWidth - 30, curY + 15);
        curY += 18;
      });
    }
  }

  pdf.save(filename);
}

/**
 * Downloads evaluation JSON data.
 */
export function downloadEvaluationJSON(evaluation: EvaluationResult, filename = 'evaluation-data.json') {
  const jsonStr = JSON.stringify(evaluation, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports class merit list and exam comparison ranking as CSV
 */
export function exportClassRankingCSV(records: ExamRecord[], filename = 'class-merit-ranking.csv') {
  const headers = ['Rank', 'Student Name', 'Roll Number', 'Subject', 'Marks Awarded', 'Max Marks', 'Percentage (%)', 'Grade', 'Percentile', 'Key Strengths', 'Areas to Improve', 'Date Evaluated'];
  
  const rows = records.map((r) => [
    r.rank ?? '',
    `"${(r.studentName || '').replace(/"/g, '""')}"`,
    `"${(r.rollNumber || '').replace(/"/g, '""')}"`,
    `"${(r.subject || '').replace(/"/g, '""')}"`,
    r.marksAwarded,
    r.maxMarks,
    `${r.percentage}%`,
    r.grade,
    r.percentile ? `${r.percentile}th` : '',
    `"${(r.strengths || []).join('; ').replace(/"/g, '""')}"`,
    `"${(r.weaknesses || []).join('; ').replace(/"/g, '""')}"`,
    new Date(r.evaluatedAt).toLocaleDateString(),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads formatted Class Comparison & Ranking Report PDF
 */
export function downloadClassRankingPDF(records: ExamRecord[], stats: ClassStatistics, title = 'Class Examination Comparison Report') {
  const pdf = new jsPDF('p', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  let curY = 40;

  // Header Banner
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(0, 0, pageWidth, 75, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text('ACADEMIC ASSESSMENT & CLASS MERIT RANKING', 35, 38);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(148, 163, 184);
  pdf.text(`Generated on ${new Date().toLocaleDateString()} | Total Papers Checked: ${stats.totalPapers}`, 35, 58);

  curY = 95;

  // Statistics Summary Cards
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(35, curY, pageWidth - 70, 65, 6, 6, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text('CLASS AVERAGE', 55, curY + 20);
  pdf.text('TOP SCORE (1ST RANK)', 180, curY + 20);
  pdf.text('PASSING RATE', 340, curY + 20);
  pdf.text('LOWEST SCORE', 450, curY + 20);

  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`${stats.classAveragePercentage}%`, 55, curY + 45);
  pdf.text(`${stats.highestMarks} pts`, 180, curY + 45);
  pdf.text(`${stats.passRate}%`, 340, curY + 45);
  pdf.text(`${stats.lowestMarks} pts`, 450, curY + 45);

  curY += 85;

  // Table Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Student Merit Leaderboard & Score Breakdown', 35, curY);
  curY += 15;

  // Table Headers
  pdf.setFillColor(241, 245, 249);
  pdf.rect(35, curY, pageWidth - 70, 20, 'F');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(71, 85, 105);
  pdf.text('Rank', 45, curY + 13);
  pdf.text('Student Name', 90, curY + 13);
  pdf.text('Roll / ID', 230, curY + 13);
  pdf.text('Score', 320, curY + 13);
  pdf.text('Percentage', 390, curY + 13);
  pdf.text('Grade', 460, curY + 13);
  pdf.text('Percentile', 505, curY + 13);

  curY += 24;

  pdf.setFont('helvetica', 'normal');
  records.forEach((rec, idx) => {
    if (curY > 780) {
      pdf.addPage('a4', 'portrait');
      curY = 40;
    }

    if (idx % 2 === 1) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(35, curY - 2, pageWidth - 70, 18, 'F');
    }

    pdf.setTextColor(15, 23, 42);
    // Rank
    pdf.setFont('helvetica', 'bold');
    const rankStr = rec.rank === 1 ? '#1 (Top)' : `#${rec.rank || idx + 1}`;
    pdf.text(rankStr, 45, curY + 10);

    pdf.setFont('helvetica', 'normal');
    // Name
    const nameStr = (rec.studentName || 'Student').substring(0, 24);
    pdf.text(nameStr, 90, curY + 10);
    // Roll
    pdf.text(rec.rollNumber || '-', 230, curY + 10);
    // Score
    pdf.text(`${rec.marksAwarded} / ${rec.maxMarks}`, 320, curY + 10);
    // Percentage
    pdf.text(`${rec.percentage}%`, 390, curY + 10);
    // Grade
    pdf.setFont('helvetica', 'bold');
    pdf.text(rec.grade, 465, curY + 10);
    pdf.setFont('helvetica', 'normal');
    // Percentile
    pdf.text(rec.percentile ? `${rec.percentile}%` : '-', 510, curY + 10);

    pdf.setDrawColor(241, 245, 249);
    pdf.line(35, curY + 16, pageWidth - 35, curY + 16);

    curY += 20;
  });

  pdf.save('class-merit-ranking-report.pdf');
}
