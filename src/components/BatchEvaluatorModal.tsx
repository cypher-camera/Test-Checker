import React, { useState, useRef } from 'react';
import {
  X,
  Zap,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Play,
  Pause,
  ArrowRight,
  FileText,
  Sparkles,
  Layers,
  Link2,
  Unlink,
  Edit2,
  Check,
  CheckSquare,
  Square,
  Image as ImageIcon,
  ChevronDown,
  Info,
} from 'lucide-react';
import { BatchQueueItem, GradingConfig, TestPaperPage } from '../types';
import { optimizeImageForEvaluation } from '../utils/imageOptimizer';
import {
  extractPagesFromPdf,
  isPdfFile,
  groupFilesIntoStudentBooklets,
  cleanStudentName,
} from '../utils/pdfExtractor';

interface BatchEvaluatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GradingConfig;
  onPaperGraded: (data: {
    studentName: string;
    rollNumber?: string;
    subject: string;
    pages: TestPaperPage[];
    evaluation: any;
  }) => void;
  onGoToComparison: () => void;
}

type PngGroupingMode = 'prefix' | 'fixed-1' | 'fixed-2' | 'fixed-3' | 'fixed-4';

export const BatchEvaluatorModal: React.FC<BatchEvaluatorModalProps> = ({
  isOpen,
  onClose,
  config,
  onPaperGraded,
  onGoToComparison,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<BatchQueueItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const stopRequestedRef = useRef(false);

  // Grouping configuration for PNG / image scans
  const [pngGroupingMode, setPngGroupingMode] = useState<PngGroupingMode>('prefix');

  // Multi-selection state for manual merge/split
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Editing student name inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  if (!isOpen) return null;

  // Handle multi-file uploads: supports both PDFs and PNGs/Images
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessingFiles(true);
    setProcessingStatus('Analyzing uploaded exam files...');

    try {
      const fileList = Array.from(files);
      const pdfFiles = fileList.filter((f) => isPdfFile(f));
      const imageFiles = fileList.filter(
        (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name)
      );

      const newItems: BatchQueueItem[] = [];

      // 1. Process PDF files: each PDF represents 1 complete multi-page student exam submission
      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        setProcessingStatus(`Rendering pages for PDF ${i + 1}/${pdfFiles.length}: ${file.name}...`);
        const extracted = await extractPagesFromPdf(file);

        if (extracted.length > 0) {
          const studentName = cleanStudentName(file.name);
          newItems.push({
            id: `batch-pdf-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            studentName: studentName || `Student ${queue.length + newItems.length + 1}`,
            fileName: file.name,
            isPdf: true,
            pageCount: extracted.length,
            files: extracted.map((p) => ({
              name: `${file.name} (Page ${p.pageNumber})`,
              dataUrl: p.dataUrl,
              mimeType: 'image/jpeg',
            })),
            status: 'pending',
          });
        }
      }

      // 2. Process PNG / Image files: use chosen grouping strategy
      if (imageFiles.length > 0) {
        setProcessingStatus(`Optimizing and grouping ${imageFiles.length} image scans...`);

        // Sort image files by natural name so Page 1, Page 2 are in order
        imageFiles.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        if (pngGroupingMode === 'prefix') {
          // Automatic prefix matching (e.g. "Rahul_Page1.png", "Rahul_Page2.png" -> 1 Student "Rahul")
          const grouped = groupFilesIntoStudentBooklets(imageFiles);

          for (let i = 0; i < grouped.length; i++) {
            const group = grouped[i];
            const processedPages = [];

            for (const file of group.files) {
              const opt = await optimizeImageForEvaluation(file, 1600, 0.9);
              processedPages.push({
                name: file.name,
                dataUrl: opt.dataUrl,
                mimeType: opt.mimeType,
              });
            }

            newItems.push({
              id: `batch-img-pfx-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
              studentName: group.studentName || `Student ${queue.length + newItems.length + 1}`,
              fileName:
                group.files.length > 1
                  ? `${group.files[0].name} (+${group.files.length - 1} pages)`
                  : group.files[0].name,
              isPdf: false,
              pageCount: group.files.length,
              files: processedPages,
              status: 'pending',
            });
          }
        } else {
          // Fixed pages per student (1, 2, 3, or 4 pages)
          const pagesPerStudent =
            pngGroupingMode === 'fixed-2'
              ? 2
              : pngGroupingMode === 'fixed-3'
              ? 3
              : pngGroupingMode === 'fixed-4'
              ? 4
              : 1;

          for (let i = 0; i < imageFiles.length; i += pagesPerStudent) {
            const chunk = imageFiles.slice(i, i + pagesPerStudent);
            const processedPages = [];

            for (const file of chunk) {
              const opt = await optimizeImageForEvaluation(file, 1600, 0.9);
              processedPages.push({
                name: file.name,
                dataUrl: opt.dataUrl,
                mimeType: opt.mimeType,
              });
            }

            const candidateName = cleanStudentName(chunk[0].name);
            newItems.push({
              id: `batch-img-fixed-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
              studentName: candidateName || `Student ${queue.length + newItems.length + 1}`,
              fileName:
                chunk.length > 1
                  ? `${chunk[0].name} (+${chunk.length - 1} pages)`
                  : chunk[0].name,
              isPdf: false,
              pageCount: chunk.length,
              files: processedPages,
              status: 'pending',
            });
          }
        }
      }

      setQueue((prev) => [...prev, ...newItems]);
    } catch (err) {
      console.error('Error importing batch files:', err);
      alert('Failed to process some files. Please check file formats.');
    } finally {
      setIsProcessingFiles(false);
      setProcessingStatus(null);
    }
  };

  // Add quick demo queue of students (Student A, Student B, Student C...)
  const handleAddDemoQueue = () => {
    const demoStudents = [
      { name: 'Student A (Rohan)', file: 'Exam_Paper_A.pdf', pages: 2 },
      { name: 'Student B (Priya)', file: 'Exam_Paper_B.pdf', pages: 2 },
      { name: 'Student C (Amit)', file: 'Exam_Paper_C.jpg', pages: 1 },
      { name: 'Student D (Sara)', file: 'Exam_Paper_D.jpg', pages: 1 },
      { name: 'Student E (Vikram)', file: 'Exam_Paper_E.pdf', pages: 3 },
    ];

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#faf9f6';
    ctx.fillRect(0, 0, 1200, 1600);
    const placeholderUrl = canvas.toDataURL('image/jpeg', 0.8);

    const demoItems: BatchQueueItem[] = demoStudents.map((ds, idx) => ({
      id: `demo-batch-${Date.now()}-${idx}`,
      studentName: ds.name,
      fileName: ds.file,
      isPdf: ds.file.endsWith('.pdf'),
      pageCount: ds.pages,
      files: Array.from({ length: ds.pages }).map((_, pIdx) => ({
        name: `${ds.file} - Page ${pIdx + 1}`,
        dataUrl: placeholderUrl,
        mimeType: 'image/jpeg',
      })),
      status: 'pending',
    }));

    setQueue((prev) => [...prev, ...demoItems]);
  };

  // Manual Merge: Merges all selected queue items into a single student booklet
  const handleMergeSelected = () => {
    if (selectedIds.size < 2) return;

    const itemsToMerge = queue.filter((item) => selectedIds.has(item.id));
    const remainingItems = queue.filter((item) => !selectedIds.has(item.id));

    // Combine files from all selected items in order
    const mergedFiles = itemsToMerge.flatMap((item) => item.files);
    const primaryItem = itemsToMerge[0];

    const mergedItem: BatchQueueItem = {
      id: `merged-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      studentName: primaryItem.studentName,
      fileName: `${primaryItem.studentName} (${mergedFiles.length} Pages Combined)`,
      isPdf: itemsToMerge.some((item) => item.isPdf),
      pageCount: mergedFiles.length,
      files: mergedFiles,
      status: 'pending',
    };

    // Replace items at the position of the first selected item
    const firstIndex = queue.findIndex((item) => selectedIds.has(item.id));
    const newQueue = [...remainingItems];
    newQueue.splice(firstIndex, 0, mergedItem);

    setQueue(newQueue);
    setSelectedIds(new Set());
  };

  // Manual Split: Splits a multi-page student booklet into individual 1-page items
  const handleSplitItem = (itemId: string) => {
    const item = queue.find((q) => q.id === itemId);
    if (!item || item.files.length <= 1) return;

    const splitItems: BatchQueueItem[] = item.files.map((file, pIdx) => ({
      id: `split-${Date.now()}-${pIdx}-${Math.random().toString(36).substring(2, 6)}`,
      studentName: `${item.studentName} (Page ${pIdx + 1})`,
      fileName: file.name,
      isPdf: false,
      pageCount: 1,
      files: [file],
      status: 'pending',
    }));

    const itemIndex = queue.findIndex((q) => q.id === itemId);
    const newQueue = [...queue];
    newQueue.splice(itemIndex, 1, ...splitItems);

    setQueue(newQueue);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  // Toggle selection for a queue item
  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/Deselect All
  const handleSelectAll = () => {
    if (selectedIds.size === queue.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(queue.map((q) => q.id)));
    }
  };

  // Save student name inline
  const saveStudentName = (id: string) => {
    if (editingNameValue.trim()) {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, studentName: editingNameValue.trim() } : item
        )
      );
    }
    setEditingId(null);
  };

  // Start sequential batch grading loop
  const startBatchGrading = async () => {
    if (queue.length === 0) return;
    setIsRunning(true);
    stopRequestedRef.current = false;

    for (let i = 0; i < queue.length; i++) {
      if (stopRequestedRef.current) break;
      if (queue[i].status === 'completed') continue;

      setCurrentIndex(i);

      // Update status to evaluating
      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'evaluating', error: undefined } : item
        )
      );

      const target = queue[i];
      try {
        // Prepare request body with all continuous pages of this student
        const body: any = {
          images: target.files.map((f) => ({
            dataUrl: f.dataUrl,
            mimeType: f.mimeType,
            name: f.name,
          })),
          strictness: config.strictness,
          rubricText: config.rubricText,
          questionPaper: config.questionPaper,
          answerKey: config.answerKey,
          totalMarks: config.totalMarksOverride,
        };

        const response = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${response.status}`);
        }

        const evaluation = await response.json();

        // Check if student name was detected by AI OCR
        const detectedName =
          evaluation.student_name && evaluation.student_name.trim().length > 0
            ? evaluation.student_name.trim()
            : target.studentName;

        const detectedRoll = evaluation.student_roll_no || target.rollNumber;
        const subject = evaluation.subject || 'Academic Exam';

        // Notify parent to record the paper and update comparison ranking
        const pages: TestPaperPage[] = target.files.map((f, pageIdx) => ({
          id: `page-${Date.now()}-${pageIdx}-${Math.random().toString(36).substring(2, 6)}`,
          name: f.name,
          dataUrl: f.dataUrl,
          mimeType: f.mimeType,
          width: 1200,
          height: 1600,
          pageNumber: pageIdx + 1,
        }));

        onPaperGraded({
          studentName: detectedName,
          rollNumber: detectedRoll,
          subject,
          pages,
          evaluation,
        });

        // Mark this item completed
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  studentName: detectedName,
                  rollNumber: detectedRoll,
                  status: 'completed',
                  marksAwarded: evaluation.total_score_awarded,
                  maxMarks: evaluation.max_possible_score,
                }
              : item
          )
        );

        // Small 1.5s delay to keep quota smooth and predictable
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err: any) {
        console.error(`Error grading item ${i}:`, err);
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: 'failed',
                  error: err.message || 'Evaluation failed',
                }
              : item
          )
        );
      }
    }

    setIsRunning(false);
    setCurrentIndex(-1);
  };

  const stopBatchGrading = () => {
    stopRequestedRef.current = true;
    setIsRunning(false);
    setCurrentIndex(-1);
  };

  const completedCount = queue.filter((q) => q.status === 'completed').length;
  const progressPercent = queue.length > 0 ? Math.round((completedCount / queue.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-red-100 text-red-700 rounded-xl">
              <Zap className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span>Batch Exam Evaluator</span>
                <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  PDF &amp; Scans
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Grade 10s or 100s of student papers. Each PDF or grouped set of PNGs is treated as one cohesive student exam.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Dropzone & Grouping Settings Banner */}
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-red-400 bg-slate-50 hover:bg-red-50/20 rounded-2xl p-5 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,.pdf,image/png,image/jpeg,image/webp,image/jpg"
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
              <div className="w-11 h-11 bg-white rounded-full shadow-xs flex items-center justify-center mx-auto mb-2 text-red-600 border border-slate-200">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                Click to select Student Papers (PDF Booklets or Image Scans) or Drag &amp; Drop
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                Select 5, 20, or 100+ files. <strong>PDFs:</strong> Multi-page PDFs are automatically parsed into cohesive student booklets. <strong>PNGs/JPGs:</strong> Grouped cleanly by the mode selected below.
              </p>
            </div>

            {/* PNG Grouping Strategy Selector */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-bold text-slate-700">PNG / Image Grouping Rule:</span>
              </div>
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setPngGroupingMode('prefix')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer text-nowrap ${
                    pngGroupingMode === 'prefix'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                  title="Groups files by common prefix, e.g. Alex_Page1.png + Alex_Page2.png -> 1 Alex submission"
                >
                  Auto-Detect by Name Prefix
                </button>
                <button
                  type="button"
                  onClick={() => setPngGroupingMode('fixed-1')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer text-nowrap ${
                    pngGroupingMode === 'fixed-1'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  1 Sheet / Student
                </button>
                <button
                  type="button"
                  onClick={() => setPngGroupingMode('fixed-2')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer text-nowrap ${
                    pngGroupingMode === 'fixed-2'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                  title="Pairs every 2 consecutive sheets into 1 student exam"
                >
                  2 Sheets / Student
                </button>
                <button
                  type="button"
                  onClick={() => setPngGroupingMode('fixed-3')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer text-nowrap ${
                    pngGroupingMode === 'fixed-3'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                  title="Groups every 3 consecutive sheets into 1 student exam"
                >
                  3 Sheets / Student
                </button>
              </div>
            </div>

            {/* Processing State Feedback */}
            {isProcessingFiles && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center space-x-2 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-blue-600" />
                <span className="font-semibold">{processingStatus || 'Processing exam files...'}</span>
              </div>
            )}
          </div>

          {/* Controls & Progress Summary */}
          {queue.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    Queue Status: {completedCount} / {queue.length} Exams Graded ({progressPercent}%)
                  </div>
                  {isRunning && (
                    <div className="text-[11px] text-red-600 font-medium flex items-center space-x-1 mt-0.5 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Grading {queue[currentIndex]?.studentName || 'Student'} ({queue[currentIndex]?.files.length || 1} pages)...</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {!isRunning ? (
                    <button
                      type="button"
                      onClick={startBatchGrading}
                      disabled={completedCount === queue.length}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Batch Grading</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopBatchGrading}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause Grading</span>
                    </button>
                  )}

                  {completedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onGoToComparison();
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      <span>View Live Rankings</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-red-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Student Papers Queue List with Multi-Merge Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1">
              <div className="flex items-center space-x-2">
                {queue.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-slate-500 hover:text-slate-800 p-0.5 cursor-pointer"
                    title="Select/Deselect All"
                  >
                    {selectedIds.size === queue.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                )}
                <span>Student Exam Submissions ({queue.length})</span>
              </div>

              <div className="flex items-center space-x-3">
                {selectedIds.size >= 2 && !isRunning && (
                  <button
                    type="button"
                    onClick={handleMergeSelected}
                    className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                    title="Merge selected papers into 1 student exam submission"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Merge Selected ({selectedIds.size}) into 1 Student</span>
                  </button>
                )}

                {queue.length > 0 && !isRunning && (
                  <button
                    type="button"
                    onClick={() => {
                      setQueue([]);
                      setSelectedIds(new Set());
                    }}
                    className="text-xs text-rose-600 hover:underline cursor-pointer"
                  >
                    Clear Queue
                  </button>
                )}
              </div>
            </div>

            {queue.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 border border-slate-200 rounded-xl bg-slate-50/50">
                No papers in batch queue yet. Upload PDFs or scans above or{' '}
                <button
                  type="button"
                  onClick={handleAddDemoQueue}
                  className="text-red-600 hover:underline font-bold cursor-pointer"
                >
                  Add Demo Batch (5 Students)
                </button>
                .
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {queue.map((item, index) => {
                  const isCurrent = index === currentIndex;
                  const isSelected = selectedIds.has(item.id);
                  const isEditing = editingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 transition-colors ${
                        isCurrent
                          ? 'bg-red-50/70 border-red-300 ring-2 ring-red-300'
                          : item.status === 'completed'
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : item.status === 'failed'
                          ? 'bg-rose-50/40 border-rose-200'
                          : isSelected
                          ? 'bg-blue-50/40 border-blue-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      {/* Left: Checkbox + Student Name + Badge */}
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        {!isRunning && (
                          <button
                            type="button"
                            onClick={() => toggleSelectItem(item.id)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        <span className="w-5 text-slate-400 font-mono text-[11px] text-center shrink-0">
                          #{index + 1}
                        </span>

                        {/* Page Preview Thumbnail Strip */}
                        <div className="flex items-center -space-x-2 shrink-0">
                          {item.files.slice(0, 3).map((f, pIdx) => (
                            <div
                              key={pIdx}
                              className="w-7 h-9 rounded bg-slate-100 border border-slate-300 overflow-hidden shadow-2xs shrink-0"
                              title={`Page ${pIdx + 1}`}
                            >
                              <img src={f.dataUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {item.files.length > 3 && (
                            <div className="w-7 h-9 rounded bg-slate-800 text-white font-bold text-[9px] flex items-center justify-center border border-white shrink-0">
                              +{item.files.length - 3}
                            </div>
                          )}
                        </div>

                        {/* Student Name & Meta */}
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex items-center space-x-1">
                              <input
                                type="text"
                                value={editingNameValue}
                                onChange={(e) => setEditingNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveStudentName(item.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                autoFocus
                                className="px-2 py-0.5 text-xs font-bold border border-blue-400 rounded outline-none bg-white text-slate-900 w-44"
                              />
                              <button
                                type="button"
                                onClick={() => saveStudentName(item.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="font-bold text-slate-800 truncate flex items-center space-x-2">
                              <span className="truncate">{item.studentName}</span>
                              {!isRunning && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(item.id);
                                    setEditingNameValue(item.studentName);
                                  }}
                                  className="text-slate-400 hover:text-slate-600 p-0.5"
                                  title="Rename student"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}

                          <div className="flex items-center space-x-2 text-[10px] text-slate-500 truncate mt-0.5">
                            {item.isPdf ? (
                              <span className="bg-red-50 text-red-700 font-semibold px-1.5 py-0.2 rounded border border-red-200">
                                📄 PDF Booklet ({item.files.length} Pages)
                              </span>
                            ) : (
                              <span className="bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.2 rounded border border-blue-200">
                                🖼️ Image Scan ({item.files.length} Page{item.files.length !== 1 ? 's' : ''})
                              </span>
                            )}
                            <span className="truncate">{item.fileName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions and Status */}
                      <div className="flex items-center space-x-2.5 shrink-0 justify-end">
                        {/* Split Button if item has multiple pages */}
                        {item.files.length > 1 && !isRunning && (
                          <button
                            type="button"
                            onClick={() => handleSplitItem(item.id)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold rounded flex items-center space-x-1 cursor-pointer"
                            title="Split into separate 1-page student sheets"
                          >
                            <Unlink className="w-3 h-3" />
                            <span>Split</span>
                          </button>
                        )}

                        {item.status === 'evaluating' && (
                          <span className="inline-flex items-center space-x-1 text-red-600 font-semibold text-[11px]">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Grading...</span>
                          </span>
                        )}

                        {item.status === 'completed' && (
                          <div className="text-right">
                            <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>
                                {item.marksAwarded} / {item.maxMarks}
                              </span>
                            </span>
                          </div>
                        )}

                        {item.status === 'failed' && (
                          <span className="inline-flex items-center space-x-1 text-rose-600 font-medium text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[120px]">{item.error || 'Failed'}</span>
                          </span>
                        )}

                        {item.status === 'pending' && (
                          <span className="text-slate-400 text-[11px]">Queued</span>
                        )}

                        {!isRunning && (
                          <button
                            type="button"
                            onClick={() => setQueue((prev) => prev.filter((_, idx) => idx !== index))}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Remove from batch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Multi-page submissions are graded as one cohesive exam. Marks &amp; ranking record automatically.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
