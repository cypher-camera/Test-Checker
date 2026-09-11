import React, { useRef, useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  X,
  MessageSquare,
  Eye,
  Award,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { AnnotationItem, EvaluationResult, TestPaperPage } from '../types';
import { getGradeLetter } from '../utils/exportUtils';

interface PaperViewerProps {
  page: TestPaperPage | null;
  selectedAnnotation: AnnotationItem | null;
  onSelectAnnotation: (ann: AnnotationItem | null) => void;
  isEvaluating: boolean;
  pageIndex?: number;
  totalPages?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  globalEvaluation?: EvaluationResult | null;
}

export const PaperViewer: React.FC<PaperViewerProps> = ({
  page,
  selectedAnnotation,
  onSelectAnnotation,
  isEvaluating,
  pageIndex = 0,
  totalPages = 1,
  onPrevPage,
  onNextPage,
  globalEvaluation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [scale, setScale] = useState<number>(1);
  const [showPenMarks, setShowPenMarks] = useState<boolean>(true);
  const [showMarginNotes, setShowMarginNotes] = useState<boolean>(true);
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [showScoreStamp, setShowScoreStamp] = useState<boolean>(true);

  // Reset zoom when active page changes
  useEffect(() => {
    setScale(1);
  }, [page?.id]);

  if (!page) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-100/50">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Test Paper Loaded</h3>
          <p className="text-xs text-slate-500 mt-1">
            Upload student exam scans above or click &ldquo;Load Sample Exam&rdquo; in the header to get started.
          </p>
        </div>
      </div>
    );
  }

  const evaluation = page.evaluation;
  // Annotations belonging specifically to this page
  const currentPageNum = page.pageNumber || (pageIndex + 1);
  const annotations = (evaluation?.annotations || []).filter(
    (ann) => !ann.page_number || ann.page_number === currentPageNum
  );

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.15, 0.5));
  const handleResetZoom = () => setScale(1);

  const isMultiPage = totalPages > 1;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-200/60 overflow-hidden relative select-none">
      {/* Viewer Toolbar */}
      <div className="bg-white/90 backdrop-blur-xs border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 z-20 shadow-xs">
        {/* Layer Visibility Toggles */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase mr-1 hidden sm:inline">
            Overlay:
          </span>

          <button
            type="button"
            onClick={() => setShowPenMarks(!showPenMarks)}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
              showPenMarks
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-white text-slate-500 border-slate-200 opacity-60'
            }`}
            title="Toggle red/green teacher pen checkmarks and crosses"
          >
            <Check className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Pen Marks</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMarginNotes(!showMarginNotes)}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
              showMarginNotes
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-white text-slate-500 border-slate-200 opacity-60'
            }`}
            title="Toggle handwritten teacher margin notes and score callouts"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Margin Notes</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBoxes(!showBoxes)}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
              showBoxes
                ? 'bg-purple-50 text-purple-700 border-purple-300'
                : 'bg-white text-slate-500 border-slate-200 opacity-60'
            }`}
            title="Toggle bounding boxes and highlighters"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Highlights</span>
          </button>

          {evaluation && (
            <button
              type="button"
              onClick={() => setShowScoreStamp(!showScoreStamp)}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                showScoreStamp
                  ? 'bg-red-50 text-red-700 border-red-300'
                  : 'bg-white text-slate-500 border-slate-200 opacity-60'
              }`}
              title="Toggle examiner official score stamp"
            >
              <Award className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Official Stamp</span>
            </button>
          )}
        </div>

        {/* Page Navigation Indicator for Multi-Page submissions */}
        {isMultiPage && (
          <div className="flex items-center space-x-1.5 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={onPrevPage}
              disabled={pageIndex === 0}
              className="p-1 rounded text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none hover:bg-white transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-1.5 whitespace-nowrap flex items-center space-x-1">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Page {pageIndex + 1} of {totalPages}
              </span>
            </span>
            <button
              type="button"
              onClick={onNextPage}
              disabled={pageIndex >= totalPages - 1}
              className="p-1 rounded text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none hover:bg-white transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Zoom & View Controls */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-semibold text-slate-700 px-2 min-w-[44px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition-colors ml-1 cursor-pointer"
            title="Reset Zoom (100%)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 sm:p-8 flex items-start justify-center paper-workspace-bg"
        onClick={() => onSelectAnnotation(null)}
      >
        <div
          className="relative inline-block bg-white shadow-2xl rounded-sm transition-transform duration-100 ease-out border border-slate-300 origin-top"
          style={{
            transform: `scale(${scale})`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Base Paper Image */}
          <img
            ref={imageRef}
            src={page.dataUrl}
            alt={page.name}
            className="max-w-none block pointer-events-none select-none"
            style={{ width: '900px', height: 'auto' }}
          />

          {/* Loading Evaluation Overlay */}
          {isEvaluating && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center z-30 animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-full border-4 border-red-200 border-t-red-600 animate-spin mb-4" />
              <div className="text-center px-6">
                <h4 className="text-base font-bold text-slate-900">
                  Evaluating {isMultiPage ? `All ${totalPages} Exam Pages` : 'Student Paper'} as a Single Cohesive Unit...
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-md">
                  Analyzing student handwriting, verifying continuous multi-page calculations/ledgers, and rendering visual examiner annotations.
                </p>
              </div>
            </div>
          )}

          {/* Official Teacher Score Stamp (Top Right) */}
          {evaluation && showScoreStamp && (
            <div
              className="absolute top-4 right-4 z-20 pointer-events-auto cursor-default animate-in zoom-in-90 duration-300 select-none"
              style={{
                transform: 'rotate(-2.5deg)',
              }}
            >
              <div className="bg-red-50/95 backdrop-blur-xs border-2 border-red-600 rounded-xl p-3 shadow-lg shadow-red-500/10 text-center min-w-[210px] relative overflow-hidden">
                {/* Vintage stamp inner border */}
                <div className="absolute inset-1 border border-dashed border-red-400/80 rounded-lg pointer-events-none" />

                <div className="relative z-10">
                  <span className="text-[10px] font-black tracking-widest text-red-700 uppercase block mb-0.5">
                    {isMultiPage ? `PAGE ${currentPageNum} OF ${totalPages} EVALUATION` : 'OFFICIAL BOARD EVALUATION'}
                  </span>
                  <div className="text-3xl font-black text-red-600 tracking-tight my-0.5">
                    {evaluation.total_score_awarded}
                    <span className="text-lg font-bold text-red-400">
                      {' '}
                      / {evaluation.max_possible_score}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-red-800 flex items-center justify-center space-x-1.5 pt-0.5">
                    {isMultiPage && globalEvaluation ? (
                      <span>
                        TOTAL EXAM: {globalEvaluation.total_score_awarded}/{globalEvaluation.max_possible_score}
                      </span>
                    ) : (
                      <>
                        <span>
                          GRADE:{' '}
                          {getGradeLetter(
                            Math.round(
                              (evaluation.total_score_awarded / evaluation.max_possible_score) * 100
                            )
                          )}
                        </span>
                        <span>•</span>
                        <span>
                          {Math.round(
                            (evaluation.total_score_awarded / evaluation.max_possible_score) * 100
                          )}
                          %
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dynamic SVG / HTML Annotations Overlay */}
          {evaluation && annotations.length > 0 && (
            <div className="absolute inset-0 pointer-events-none z-10">
              {annotations.map((ann, idx) => {
                const [ymin, xmin, ymax, xmax] = ann.box_2d;

                // Normalized 0..1000 converted to percentages
                const topPct = (ymin / 1000) * 100;
                const leftPct = (xmin / 1000) * 100;
                const widthPct = Math.max(2, ((xmax - xmin) / 1000) * 100);
                const heightPct = Math.max(1.8, ((ymax - ymin) / 1000) * 100);

                const isSelected =
                  selectedAnnotation?.box_2d.join(',') === ann.box_2d.join(',') &&
                  selectedAnnotation?.feedback_text === ann.feedback_text;

                const isCorrect = ann.type === 'correct';
                const isPartial = ann.type === 'partial';
                const isIncorrect = ann.type === 'incorrect';

                const strokeColor = isCorrect
                  ? '#16a34a'
                  : isPartial
                  ? '#d97706'
                  : '#dc2626';

                const bgColor = isCorrect
                  ? 'bg-emerald-500/10'
                  : isPartial
                  ? 'bg-amber-500/10'
                  : 'bg-red-500/10';

                const borderColor = isCorrect
                  ? 'border-emerald-500'
                  : isPartial
                  ? 'border-amber-500'
                  : 'border-red-500';

                const textColor = isCorrect
                  ? 'text-emerald-700'
                  : isPartial
                  ? 'text-amber-700'
                  : 'text-red-700';

                const badgeBg = isCorrect
                  ? 'bg-emerald-600'
                  : isPartial
                  ? 'bg-amber-600'
                  : 'bg-red-600';

                return (
                  <div
                    key={`ann-${idx}`}
                    className="absolute pointer-events-auto cursor-pointer group"
                    style={{
                      top: `${topPct}%`,
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAnnotation(ann);
                    }}
                  >
                    {/* Bounding Box Highlight */}
                    {showBoxes && (
                      <div
                        className={`w-full h-full rounded transition-all ${bgColor} border-2 ${
                          isSelected
                            ? 'border-blue-600 ring-4 ring-blue-400/40 shadow-lg'
                            : `${borderColor} border-opacity-70 group-hover:border-opacity-100 group-hover:ring-2 group-hover:ring-red-300`
                        }`}
                        style={{
                          borderStyle: isPartial ? 'dashed' : isIncorrect ? 'dotted' : 'solid',
                        }}
                      />
                    )}

                    {/* Teacher Pen Symbol (Checkmark, Cross, Squiggle) */}
                    {showPenMarks && (
                      <div
                        className="absolute -left-7 top-0 text-xl font-bold select-none drop-shadow-xs"
                        style={{ color: strokeColor }}
                      >
                        {isCorrect && <span className="font-handwriting text-3xl font-extrabold text-emerald-600">✓</span>}
                        {isIncorrect && <span className="font-handwriting text-3xl font-extrabold text-red-600">✗</span>}
                        {isPartial && <span className="font-handwriting text-3xl font-extrabold text-amber-600">~</span>}
                      </div>
                    )}

                    {/* Teacher Handwritten Margin Sticky Callout */}
                    {showMarginNotes && (
                      <div
                        className="absolute left-full ml-3 top-0 flex items-center space-x-1.5 whitespace-nowrap z-20 pointer-events-auto"
                        style={{
                          transform: 'translateY(-20%)',
                        }}
                      >
                        {/* Score Chip */}
                        <span
                          className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded shadow-xs shrink-0 ${badgeBg}`}
                        >
                          {ann.marks_awarded === ann.max_marks
                            ? `+${ann.marks_awarded}`
                            : `${ann.marks_awarded}/${ann.max_marks}`}
                        </span>

                        {/* Handwriting Note */}
                        <span
                          className={`font-handwriting text-lg font-bold tracking-tight px-1 rounded transition-colors group-hover:bg-white/90 ${textColor}`}
                        >
                          {ann.feedback_text}
                        </span>
                      </div>
                    )}

                    {/* Click Indicator pulse when selected */}
                    {isSelected && (
                      <span className="absolute -top-2 -right-2 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600 text-white text-[9px] items-center justify-center font-bold">
                          i
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Detailed Annotation Inspection Popover */}
      {selectedAnnotation && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-300 p-4 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  selectedAnnotation.type === 'correct'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedAnnotation.type === 'partial'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {selectedAnnotation.type}
              </span>
              <span className="text-xs font-bold text-slate-700">
                Score: {selectedAnnotation.marks_awarded} / {selectedAnnotation.max_marks} marks
              </span>
              {selectedAnnotation.page_number && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                  Page {selectedAnnotation.page_number}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelectAnnotation(null)}
              className="text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2.5 space-y-2">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase">Examiner Margin Note</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 font-handwriting text-xl text-red-600">
                {selectedAnnotation.feedback_text}
              </p>
            </div>

            {selectedAnnotation.improvement_tip && (
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-2.5">
                <p className="text-[11px] font-bold text-amber-900 uppercase flex items-center space-x-1">
                  <span>Student Improvement Tip</span>
                </p>
                <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                  {selectedAnnotation.improvement_tip}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
