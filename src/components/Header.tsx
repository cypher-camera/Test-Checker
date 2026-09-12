import React, { useState } from 'react';
import { ShieldCheck, Sparkles, BookOpen, ChevronDown, Trophy, FileText, Zap } from 'lucide-react';
import { SAMPLE_PAPERS, SamplePaper } from '../utils/samplePapers';

interface HeaderProps {
  activeTab: 'evaluator' | 'comparison';
  onTabChange: (tab: 'evaluator' | 'comparison') => void;
  recordsCount: number;
  onLoadSample: (sample: SamplePaper) => void;
  onOpenBatchEvaluator: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  recordsCount,
  onLoadSample,
  onOpenBatchEvaluator,
}) => {
  const [showSamplesMenu, setShowSamplesMenu] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand & App Title */}
        <div className="flex items-center space-x-3 min-w-0">
          <div
            onClick={() => onTabChange('evaluator')}
            className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-200 shrink-0 cursor-pointer"
          >
            <span className="font-handwriting text-2xl font-bold leading-none select-none">A+</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                AI Auto Test Paper Evaluator
              </h1>
              <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                Visual Annotator
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden md:block truncate">
              Multimodal Vision OCR • Step-wise Grading • Continuous Class Rank Comparison
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onTabChange('evaluator')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'evaluator'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Grading Studio</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('comparison')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'comparison'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            <span>Class Rankings</span>
            {recordsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-red-600 text-white">
                {recordsCount}
              </span>
            )}
          </button>
        </div>

        {/* Action Controls & Status */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Batch Grade 100s Button */}
          <button
            type="button"
            onClick={onOpenBatchEvaluator}
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
            title="Batch evaluate 10s or 100s of papers at once"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Batch Grade</span>
          </button>

          {/* Quick Demo Samples Dropdown */}
          <div className="relative">
            <button
              id="samples-menu-button"
              type="button"
              onClick={() => setShowSamplesMenu(!showSamplesMenu)}
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline">Sample Exam</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {showSamplesMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSamplesMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-20 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Instant Realistic Tests
                    </p>
                  </div>
                  {SAMPLE_PAPERS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        onLoadSample(sample);
                        setShowSamplesMenu(false);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-start space-x-2.5 text-xs sm:text-sm text-slate-800"
                    >
                      <div className="w-6 h-6 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {sample.subject[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 truncate">{sample.title}</p>
                        <p className="text-xs text-slate-500">
                          {sample.subject} • Max Marks: {sample.totalMarks}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Server Key Security Status Badge */}
          <div
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
            title="Gemini API Key is safely encapsulated on the server and isolated from client access"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="hidden lg:inline">Secured Server Key</span>
          </div>
        </div>
      </div>
    </header>
  );
};
