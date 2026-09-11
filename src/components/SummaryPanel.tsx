import React, { useState } from 'react';
import {
  Award,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Download,
  FileSpreadsheet,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Layers,
  FileText,
} from 'lucide-react';
import { AnnotationItem, EvaluationResult, TestPaperPage } from '../types';
import { downloadGradedPDF, downloadGradedPNG, downloadEvaluationJSON, getGradeLetter } from '../utils/exportUtils';

interface SummaryPanelProps {
  page: TestPaperPage | null;
  pages?: TestPaperPage[];
  activePageIndex?: number;
  onSelectPage?: (index: number) => void;
  globalEvaluation?: EvaluationResult | null;
  selectedAnnotation: AnnotationItem | null;
  onSelectAnnotation: (ann: AnnotationItem) => void;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  page,
  pages = [],
  activePageIndex = 0,
  onSelectPage,
  globalEvaluation,
  selectedAnnotation,
  onSelectAnnotation,
}) => {
  const [isExportingPNG, setIsExportingPNG] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [filterCurrentPageOnly, setFilterCurrentPageOnly] = useState(false);

  // The primary evaluation to show across the whole exam
  const evaluation = globalEvaluation || page?.evaluation;

  if (!page || !evaluation) {
    return (
      <aside className="w-full lg:w-96 bg-white border-l border-slate-200 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <FileSpreadsheet className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">No Evaluation Yet</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Click &ldquo;Evaluate All Pages&rdquo; or load a sample exam to view detailed marks, feedback, strengths, and step-wise question breakdown.
        </p>
      </aside>
    );
  }

  const isMultiPage = pages.length > 1;
  const pct = Math.round((evaluation.total_score_awarded / evaluation.max_possible_score) * 100);
  const grade = getGradeLetter(pct);

  const handleExportPNG = async () => {
    try {
      setIsExportingPNG(true);
      await downloadGradedPNG(page, `graded-${page.name.replace(/\.[^/.]+$/, '')}.png`);
    } catch (err) {
      console.error(err);
      alert('Failed to export PNG. Please try again.');
    } finally {
      setIsExportingPNG(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      // If multi-page, export all pages in sequence + report card!
      await downloadGradedPDF(
        pages.length > 1 ? pages : page,
        `graded-exam-report-${(page.name || 'exam').replace(/\.[^/.]+$/, '')}.pdf`,
        evaluation
      );
    } catch (err) {
      console.error(err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleCopyFeedback = () => {
    navigator.clipboard.writeText(evaluation.overall_feedback);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  };

  // Annotations list for display
  const allAnnotations = evaluation.annotations || [];
  const currentPageNum = activePageIndex + 1;
  const displayedAnnotations = filterCurrentPageOnly
    ? allAnnotations.filter((ann) => (ann.page_number || 1) === currentPageNum)
    : allAnnotations;

  const handleAnnotationClick = (ann: AnnotationItem) => {
    // If annotation is on another page, automatically switch to that page
    if (ann.page_number && onSelectPage && ann.page_number !== currentPageNum) {
      onSelectPage(ann.page_number - 1);
    }
    onSelectAnnotation(ann);
  };

  return (
    <aside className="w-full lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-xs">
      {/* Panel Header & Score Badge */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
            <Award className="w-3.5 h-3.5 text-red-600" />
            <span>{isMultiPage ? 'Unified Exam Report' : 'Evaluation Report'}</span>
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-red-100 text-red-700 flex items-center space-x-1">
            {isMultiPage ? (
              <>
                <Layers className="w-3 h-3" />
                <span>{pages.length} Pages</span>
              </>
            ) : (
              <span>{page.name}</span>
            )}
          </span>
        </div>

        {/* Unified Score Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              {isMultiPage ? 'Overall Exam Score (All Pages)' : 'Total Marks Awarded'}
            </span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {evaluation.total_score_awarded}
              </span>
              <span className="text-sm font-bold text-slate-400">
                / {evaluation.max_possible_score}
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-xs font-bold text-emerald-600">
                {pct}% Performance
              </span>
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">
                Grade {grade}
              </span>
            </div>
          </div>

          {/* Stamp Circle */}
          <div className="w-16 h-16 rounded-full border-4 border-red-600 bg-red-50 flex flex-col items-center justify-center text-red-600 shadow-sm rotate-6 shrink-0">
            <span className="font-handwriting text-2xl font-bold leading-none">{grade}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Verified</span>
          </div>
        </div>

        {/* Page-by-Page Scores Strip for Multi-Page papers */}
        {isMultiPage && (
          <div className="mt-3 pt-3 border-t border-slate-200/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1">
                <Layers className="w-3 h-3 text-blue-600" />
                <span>Page Breakdown</span>
              </span>
              <span className="text-[10px] text-slate-400">Click to switch page</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {pages.map((p, idx) => {
                const pageNum = idx + 1;
                const pageScore =
                  evaluation.page_scores?.find((ps) => ps.page_number === pageNum)?.marks_awarded ??
                  (p.evaluation?.total_score_awarded || 0);
                const isActive = activePageIndex === idx;

                return (
                  <button
                    key={`page-score-${idx}`}
                    type="button"
                    onClick={() => onSelectPage && onSelectPage(idx)}
                    className={`px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`font-bold ${isActive ? 'text-blue-700' : 'text-slate-600'}`}>
                        P{pageNum}
                      </span>
                      <span className="font-mono font-bold text-slate-800">{pageScore}m</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Export Bar */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
            title={isMultiPage ? `Download complete ${pages.length}-page PDF evaluation report` : 'Download PDF report'}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPDF ? 'Exporting...' : isMultiPage ? 'Export Exam PDF' : 'Export PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPNG}
            disabled={isExportingPNG}
            className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            title="Download annotated current page as PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPNG ? 'Exporting...' : 'Export PNG'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Details Section */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
        {/* Evaluator Overall Feedback */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Evaluator Observations
            </h4>
            <button
              type="button"
              onClick={handleCopyFeedback}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-900 inline-flex items-center space-x-1 cursor-pointer"
            >
              {copiedFeedback ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 leading-relaxed font-sans">
            {evaluation.overall_feedback}
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="space-y-3">
          {evaluation.strengths && evaluation.strengths.length > 0 && (
            <div>
              <div className="flex items-center space-x-1.5 mb-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Demonstrated Strengths</span>
              </div>
              <ul className="space-y-1.5">
                {evaluation.strengths.map((str, idx) => (
                  <li
                    key={`str-${idx}`}
                    className="text-xs text-slate-700 bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2 flex items-start space-x-2"
                  >
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
            <div>
              <div className="flex items-center space-x-1.5 mb-1.5 text-xs font-bold text-red-700 uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Areas for Improvement</span>
              </div>
              <ul className="space-y-1.5">
                {evaluation.weaknesses.map((weak, idx) => (
                  <li
                    key={`weak-${idx}`}
                    className="text-xs text-slate-700 bg-red-50/70 border border-red-200/80 rounded-lg p-2 flex items-start space-x-2"
                  >
                    <span className="text-red-500 font-bold">•</span>
                    <span>{weak}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Question-wise Breakdown */}
        {evaluation.question_breakdown && evaluation.question_breakdown.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Question Breakdown
              </h4>
              <span className="text-[10px] text-slate-400">
                {evaluation.question_breakdown.length} questions
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Q#</th>
                    <th className="py-2 px-2">Topic</th>
                    <th className="py-2 px-3 text-right">Marks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evaluation.question_breakdown.map((q, idx) => (
                    <tr
                      key={`qb-${idx}`}
                      onClick={() => {
                        if (q.page_number && onSelectPage) {
                          onSelectPage(q.page_number - 1);
                        }
                      }}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      title={q.page_number ? `Click to view Page ${q.page_number}` : undefined}
                    >
                      <td className="py-2 px-3 font-bold text-slate-800">
                        <div className="flex items-center space-x-1">
                          <span>{q.question_number}</span>
                          {q.page_number && isMultiPage && (
                            <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1 py-0.2 rounded">
                              P{q.page_number}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-slate-600 truncate max-w-[120px]">
                        {q.topic || 'General'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        <span
                          className={
                            q.marks_obtained === q.max_marks
                              ? 'text-emerald-600'
                              : q.marks_obtained > 0
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }
                        >
                          {q.marks_obtained}
                        </span>
                        <span className="text-slate-400">/{q.max_marks}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Annotations List (Click to jump & highlight) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Teacher Annotations ({displayedAnnotations.length})
            </h4>
            {isMultiPage && (
              <button
                type="button"
                onClick={() => setFilterCurrentPageOnly(!filterCurrentPageOnly)}
                className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                {filterCurrentPageOnly ? `Show All (${allAnnotations.length})` : `Page ${currentPageNum} Only`}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {displayedAnnotations.map((ann, idx) => {
              const isSelected =
                selectedAnnotation?.box_2d.join(',') === ann.box_2d.join(',') &&
                selectedAnnotation?.feedback_text === ann.feedback_text;

              return (
                <button
                  key={`ann-card-${idx}`}
                  type="button"
                  onClick={() => handleAnnotationClick(ann)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-200'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          ann.type === 'correct'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ann.type === 'partial'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {ann.type}
                      </span>
                      {ann.page_number && isMultiPage && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          Page {ann.page_number}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      {ann.marks_awarded === ann.max_marks
                        ? `+${ann.marks_awarded} marks`
                        : `${ann.marks_awarded}/${ann.max_marks} marks`}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 font-handwriting text-base">
                    {ann.feedback_text}
                  </p>
                  {ann.improvement_tip && (
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      Tip: {ann.improvement_tip}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* JSON Export Option */}
        <div className="pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={() => downloadEvaluationJSON(evaluation)}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-800 py-1.5 flex items-center justify-center space-x-1.5 font-medium transition-colors cursor-pointer"
          >
            <span>Export Raw JSON Data</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </aside>
  );
};
