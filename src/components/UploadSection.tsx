import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  Plus,
  Sparkles,
  Sliders,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  FileQuestion,
  CheckSquare,
  Image as ImageIcon,
  Eye,
  X,
} from 'lucide-react';
import { GradingConfig, GradingStrictness, SupportingDocument, TestPaperPage } from '../types';
import { optimizeImageForEvaluation } from '../utils/imageOptimizer';

interface UploadSectionProps {
  pages: TestPaperPage[];
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  onAddPages: (newPages: TestPaperPage[]) => void;
  onRemovePage: (index: number) => void;
  config: GradingConfig;
  onConfigChange: (config: GradingConfig) => void;
  onEvaluate: () => void;
  isEvaluating: boolean;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  pages,
  activePageIndex,
  onSelectPage,
  onAddPages,
  onRemovePage,
  config,
  onConfigChange,
  onEvaluate,
  isEvaluating,
}) => {
  const studentFileInputRef = useRef<HTMLInputElement>(null);
  const qpFileInputRef = useRef<HTMLInputElement>(null);
  const akFileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOverStudent, setIsDragOverStudent] = useState(false);
  const [activeTab, setActiveTab] = useState<'student' | 'documents' | 'settings'>('student');
  const [previewDoc, setPreviewDoc] = useState<SupportingDocument | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  // Handle student test paper uploads with automatic optimization
  const handleStudentFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);
    const newPages: TestPaperPage[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;

        const optimized = await optimizeImageForEvaluation(file, 1800, 0.92);
        newPages.push({
          id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          dataUrl: optimized.dataUrl,
          mimeType: optimized.mimeType,
          width: optimized.width,
          height: optimized.height,
        });
      }

      if (newPages.length > 0) {
        onAddPages(newPages);
      }
    } catch (err) {
      console.error('Error processing image:', err);
      alert('Failed to process image. Please try another file.');
    } finally {
      setIsProcessingFiles(false);
    }
  };

  // Handle Question Paper upload
  const handleQuestionPaperFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const optimized = await optimizeImageForEvaluation(file, 1600, 0.9);
      onConfigChange({
        ...config,
        questionPaper: {
          id: `qp-${Date.now()}`,
          name: file.name,
          type: 'image',
          dataUrl: optimized.dataUrl,
          mimeType: optimized.mimeType,
        },
      });
    } catch (err) {
      console.error(err);
      alert('Failed to load question paper image');
    }
  };

  // Handle Answer Key upload
  const handleAnswerKeyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const optimized = await optimizeImageForEvaluation(file, 1600, 0.9);
      onConfigChange({
        ...config,
        answerKey: {
          id: `ak-${Date.now()}`,
          name: file.name,
          type: 'image',
          dataUrl: optimized.dataUrl,
          mimeType: optimized.mimeType,
        },
      });
    } catch (err) {
      console.error(err);
      alert('Failed to load answer key image');
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 p-4 sm:p-5 shadow-2xs">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Top Workflow Steps Navigation */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Tabs for Upload Areas */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('student')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'student'
                  ? 'bg-white text-red-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>1. Solved Paper</span>
              <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] flex items-center justify-center font-bold">
                {pages.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'documents'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>2. Question Paper &amp; Answer Key</span>
              {(config.questionPaper || config.answerKey) && (
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>3. Grading Settings</span>
            </button>
          </div>

          {/* Evaluate Button */}
          <div className="flex items-center space-x-2">
            <button
              id="evaluate-paper-button"
              type="button"
              onClick={onEvaluate}
              disabled={isEvaluating || pages.length === 0 || isProcessingFiles}
              className={`w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm cursor-pointer ${
                isEvaluating || pages.length === 0 || isProcessingFiles
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-red-600 hover:bg-red-700 active:scale-[0.98] shadow-red-200'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isEvaluating ? 'animate-spin' : ''}`} />
              <span>
                {isEvaluating
                  ? pages.length > 1
                    ? `Evaluating All ${pages.length} Pages as Single Unit...`
                    : 'Evaluating with Gemini...'
                  : isProcessingFiles
                  ? 'Optimizing Scans...'
                  : pages.length > 1
                  ? `Evaluate All ${pages.length} Pages (Single Unit)`
                  : 'Evaluate Paper'}
              </span>
            </button>
          </div>
        </div>

        {/* Multi-page Notice Banner */}
        {pages.length > 1 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center space-x-2">
              <span className="font-bold bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                Multi-Page Exam
              </span>
              <span>
                All <strong>{pages.length} pages</strong> will be evaluated together as a single continuous exam submission (ideal for Accounts, Math, and Economics multi-page calculations).
              </span>
            </div>
            <span className="text-[11px] font-semibold text-blue-700 hidden sm:inline">
              Cohesive unit grading
            </span>
          </div>
        )}

        {/* Tab 1: Student Solved Paper Thumbnails & Upload */}
        {activeTab === 'student' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Student Solved Test Paper Pages (Answer Sheets)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Upload all continuous pages of the student&apos;s answer sheet. Annotations and marks will be distributed across each specific page.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {pages.length} page{pages.length !== 1 ? 's' : ''} loaded
              </span>
            </div>

            {/* Thumbnail Strip */}
            <div className="flex items-center space-x-3 overflow-x-auto py-1">
              {pages.map((page, idx) => (
                <div
                  key={page.id}
                  className={`relative group shrink-0 rounded-xl p-1.5 transition-all cursor-pointer border ${
                    idx === activePageIndex
                      ? 'border-red-500 bg-red-50/60 ring-2 ring-red-300'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                  }`}
                  onClick={() => onSelectPage(idx)}
                >
                  <div className="w-16 h-20 sm:w-20 sm:h-26 rounded-lg overflow-hidden bg-white border border-slate-200 relative">
                    <img
                      src={page.dataUrl}
                      alt={page.name}
                      className="w-full h-full object-cover"
                    />
                    {page.evaluation && (
                      <div className="absolute top-1 right-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                        {page.evaluation.total_score_awarded}m
                      </div>
                    )}
                  </div>
                  <div className="text-center mt-1">
                    <span className="text-[11px] font-semibold text-slate-700 block truncate max-w-[80px]">
                      Page {idx + 1}
                    </span>
                  </div>
                  {pages.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePage(idx);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-700 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs hover:bg-red-600 transition-opacity"
                      title="Remove page"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {/* Add More Student Pages */}
              <button
                type="button"
                onClick={() => studentFileInputRef.current?.click()}
                disabled={isProcessingFiles}
                className="shrink-0 w-16 h-20 sm:w-20 sm:h-26 rounded-xl border-2 border-dashed border-slate-300 hover:border-red-400 hover:bg-red-50/30 flex flex-col items-center justify-center text-slate-500 hover:text-red-600 transition-colors p-2 text-center cursor-pointer"
              >
                <Plus className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold">Add Page</span>
              </button>

              <input
                ref={studentFileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={(e) => handleStudentFiles(e.target.files)}
                className="hidden"
              />
            </div>

            {/* Empty state drag & drop zone */}
            {pages.length === 0 && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOverStudent(true);
                }}
                onDragLeave={() => setIsDragOverStudent(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOverStudent(false);
                  handleStudentFiles(e.dataTransfer.files);
                }}
                onClick={() => studentFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                  isDragOverStudent
                    ? 'border-red-500 bg-red-50/50'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <UploadCloud className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                <h3 className="text-sm font-bold text-slate-800">
                  Drop Student Solved Test Paper Scans Here
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Supports high-resolution phone camera photos or scans (PNG, JPG, WebP).
                </p>
                <p className="text-xs text-red-600 font-semibold mt-2">
                  Click to choose files
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Separate Question Paper & Answer Key */}
        {activeTab === 'documents' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-150">
            {/* Section A: Question Paper */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <FileQuestion className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Question Paper
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Upload scan or paste the questions asked
                    </p>
                  </div>
                </div>

                {config.questionPaper && (
                  <button
                    type="button"
                    onClick={() =>
                      onConfigChange({
                        ...config,
                        questionPaper: null,
                      })
                    }
                    className="text-xs text-red-600 hover:text-red-700 flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Uploaded Question Paper Image Preview */}
              {config.questionPaper?.dataUrl ? (
                <div className="flex items-center space-x-3 bg-white border border-slate-200 rounded-lg p-2.5">
                  <img
                    src={config.questionPaper.dataUrl}
                    alt="Question Paper Preview"
                    className="w-14 h-18 object-cover rounded border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {config.questionPaper.name}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                      ✓ Scanned Image Attached
                    </span>
                    <div className="mt-1 flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(config.questionPaper || null)}
                        className="text-xs text-blue-600 hover:underline flex items-center space-x-1 font-medium"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect Full Image</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => qpFileInputRef.current?.click()}
                    className="w-full py-3 px-4 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl text-center transition-colors flex items-center justify-center space-x-2 text-xs font-semibold text-slate-600 cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>Upload Question Paper (Photo / Scan)</span>
                  </button>
                  <input
                    ref={qpFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQuestionPaperFile}
                    className="hidden"
                  />
                </div>
              )}

              {/* Or Paste Question Text */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Or Paste Question Paper Text:
                </label>
                <textarea
                  rows={3}
                  value={config.questionPaper?.textContent || ''}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      questionPaper: {
                        ...(config.questionPaper || {
                          id: `qp-text-${Date.now()}`,
                          name: 'Question-Paper.txt',
                          type: 'text',
                        }),
                        textContent: e.target.value,
                      },
                    })
                  }
                  placeholder="Paste question numbers, problem statements, and marks distribution (e.g. Q1. Solve 2x + 5 = 15 [3 Marks])..."
                  className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none resize-none text-slate-800"
                />
              </div>
            </div>

            {/* Section B: Answer Key / Model Solution */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Official Answer Key / Solution
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Upload model answers or marking scheme
                    </p>
                  </div>
                </div>

                {config.answerKey && (
                  <button
                    type="button"
                    onClick={() =>
                      onConfigChange({
                        ...config,
                        answerKey: null,
                      })
                    }
                    className="text-xs text-red-600 hover:text-red-700 flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Uploaded Answer Key Image Preview */}
              {config.answerKey?.dataUrl ? (
                <div className="flex items-center space-x-3 bg-white border border-slate-200 rounded-lg p-2.5">
                  <img
                    src={config.answerKey.dataUrl}
                    alt="Answer Key Preview"
                    className="w-14 h-18 object-cover rounded border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {config.answerKey.name}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                      ✓ Answer Key Image Attached
                    </span>
                    <div className="mt-1 flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(config.answerKey || null)}
                        className="text-xs text-emerald-600 hover:underline flex items-center space-x-1 font-medium"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect Full Image</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => akFileInputRef.current?.click()}
                    className="w-full py-3 px-4 border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40 rounded-xl text-center transition-colors flex items-center justify-center space-x-2 text-xs font-semibold text-slate-600 cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Upload Answer Key (Photo / Scan)</span>
                  </button>
                  <input
                    ref={akFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAnswerKeyFile}
                    className="hidden"
                  />
                </div>
              )}

              {/* Or Paste Answer Key Text */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Or Paste Answer Key / Marking Rubric Text:
                </label>
                <textarea
                  rows={3}
                  value={config.answerKey?.textContent || ''}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      answerKey: {
                        ...(config.answerKey || {
                          id: `ak-text-${Date.now()}`,
                          name: 'Answer-Key.txt',
                          type: 'text',
                        }),
                        textContent: e.target.value,
                      },
                    })
                  }
                  placeholder="Paste model steps, correct equations, numerical answers, and point allocations (e.g. Q1: x=5 (2m), formula (1m))..."
                  className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none resize-none text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Grading Strictness & Score Settings */}
        {activeTab === 'settings' && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 animate-in fade-in duration-150 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Grading Strictness &amp; Examiner Criteria
                </label>
                <select
                  id="strictness-selector"
                  value={config.strictness}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      strictness: e.target.value as GradingStrictness,
                    })
                  }
                  className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-red-500 focus:border-red-500 text-slate-800"
                >
                  <option value="standard">Standard Board Exam (Moderate step-wise scoring)</option>
                  <option value="strict">Strict Competency (Rigorous deductions for missing units/steps)</option>
                  <option value="lenient">Lenient Formative (Encouraging, rewards good attempts)</option>
                  <option value="board_exam">Official Senior Examiner (Strict adherence to rubric)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Controls how strictly the evaluator penalizes minor omissions vs rewarding intermediate reasoning.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Total Maximum Marks (Optional)
                </label>
                <input
                  id="total-marks-input"
                  type="number"
                  placeholder="e.g. 20 (Auto-deduced if blank)"
                  value={config.totalMarksOverride || ''}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      totalMarksOverride: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-red-500 outline-none text-slate-800"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Set the total maximum mark cap if not specified on the test paper header.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Modal for Inspecting Question Paper or Answer Key Full Image */}
        {previewDoc && previewDoc.dataUrl && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">
                  {previewDoc.name}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-slate-100 flex items-center justify-center">
                <img
                  src={previewDoc.dataUrl}
                  alt={previewDoc.name}
                  className="max-w-full max-h-[75vh] object-contain rounded shadow"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
