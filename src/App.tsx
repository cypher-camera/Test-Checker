import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { PaperViewer } from './components/PaperViewer';
import { SummaryPanel } from './components/SummaryPanel';
import { ClassComparisonReport } from './components/ClassComparisonReport';
import { BatchEvaluatorModal } from './components/BatchEvaluatorModal';
import { AnnotationItem, EvaluationResult, ExamRecord, GradingConfig, TestPaperPage } from './types';
import { SAMPLE_PAPERS, SamplePaper } from './utils/samplePapers';
import { calculateClassRanks } from './utils/rankingUtils';
import { getGradeLetter } from './utils/exportUtils';
import { AlertCircle, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'evaluator' | 'comparison'>('evaluator');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const [gradingConfig, setGradingConfig] = useState<GradingConfig>({
    strictness: 'standard',
    rubricText: '',
    totalMarksOverride: undefined,
    questionPaper: null,
    answerKey: null,
  });

  const [pages, setPages] = useState<TestPaperPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [globalEvaluation, setGlobalEvaluation] = useState<EvaluationResult | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<AnnotationItem | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Student identification state for current paper
  const [currentStudentName, setCurrentStudentName] = useState<string>('Student A');
  const [currentRollNumber, setCurrentRollNumber] = useState<string>('12-B-42');
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);

  // Exam Records History Ledger
  const [records, setRecords] = useState<ExamRecord[]>([]);

  // Compute live ranks across all recorded exams
  const rankedRecords = useMemo(() => {
    return calculateClassRanks(records);
  }, [records]);

  // Current student rank in class
  const currentStudentRank = useMemo(() => {
    if (!currentRecordId) return undefined;
    const match = rankedRecords.find((r) => r.id === currentRecordId);
    return match?.rank;
  }, [rankedRecords, currentRecordId]);

  // Fetch persisted exam records from server on mount
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await fetch('/api/records');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.records) && data.records.length > 0) {
            setRecords(data.records);
          }
        }
      } catch (err) {
        console.warn('Could not retrieve existing records from server:', err);
      }
    };
    fetchRecords();
  }, []);

  // Save record helper
  const saveOrUpdateRecord = useCallback(
    async (record: ExamRecord) => {
      setRecords((prev) => {
        const existingIdx = prev.findIndex((r) => r.id === record.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = record;
          return updated;
        }
        return [record, ...prev];
      });

      try {
        await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        });
      } catch (err) {
        console.error('Failed to sync record with server:', err);
      }
    },
    []
  );

  // Load a sample paper
  const loadSamplePaper = useCallback((sample: SamplePaper) => {
    let newPages: TestPaperPage[] = [];

    if (sample.generatePages) {
      const generated = sample.generatePages();
      newPages = generated.map((gen, idx) => {
        const pageNum = idx + 1;
        const pageAnns = (sample.defaultEvaluation.annotations || []).filter(
          (a) => (a.page_number || 1) === pageNum
        );
        const pageScoreInfo = sample.defaultEvaluation.page_scores?.find(
          (ps) => ps.page_number === pageNum
        );
        const pageScore =
          pageScoreInfo?.marks_awarded ??
          pageAnns.reduce((sum, a) => sum + (a.marks_awarded || 0), 0);
        const pageMax =
          pageScoreInfo?.max_marks ??
          pageAnns.reduce((sum, a) => sum + (a.max_marks || 0), 0);

        return {
          id: `sample-${Date.now()}-p${pageNum}`,
          name: gen.name,
          dataUrl: gen.dataUrl,
          mimeType: 'image/jpeg',
          width: 1200,
          height: 1600,
          pageNumber: pageNum,
          evaluation: {
            ...sample.defaultEvaluation,
            total_score_awarded: pageScore,
            max_possible_score: pageMax > 0 ? pageMax : sample.defaultEvaluation.max_possible_score,
            annotations: pageAnns,
          },
        };
      });
    } else {
      const dataUrl = sample.generateImage();
      newPages = [
        {
          id: `sample-${Date.now()}`,
          name: `${sample.subject}-Test-Paper.jpg`,
          dataUrl,
          mimeType: 'image/jpeg',
          width: 1200,
          height: 1600,
          pageNumber: 1,
          evaluation: sample.defaultEvaluation,
        },
      ];
    }

    setPages(newPages);
    setActivePageIndex(0);
    setGlobalEvaluation(sample.defaultEvaluation);
    setSelectedAnnotation(null);
    setGradingConfig((prev) => ({
      ...prev,
      rubricText: sample.rubric,
      totalMarksOverride: sample.totalMarks,
      questionPaper: sample.questionPaperDoc || null,
      answerKey: sample.answerKeyDoc || null,
    }));
    setErrorMessage(null);

    // Set sample student info
    const sName = sample.defaultEvaluation.student_name || 'Student A';
    const sRoll = sample.defaultEvaluation.student_roll_no || '12-B-42';
    setCurrentStudentName(sName);
    setCurrentRollNumber(sRoll);

    // Save as active record in exam history
    const recId = `sample-rec-${sample.id}`;
    setCurrentRecordId(recId);

    const newRecord: ExamRecord = {
      id: recId,
      studentName: sName,
      rollNumber: sRoll,
      subject: sample.subject,
      evaluatedAt: new Date().toISOString(),
      marksAwarded: sample.defaultEvaluation.total_score_awarded,
      maxMarks: sample.defaultEvaluation.max_possible_score,
      percentage: Math.round(
        (sample.defaultEvaluation.total_score_awarded / sample.defaultEvaluation.max_possible_score) * 100
      ),
      grade: getGradeLetter(
        Math.round(
          (sample.defaultEvaluation.total_score_awarded / sample.defaultEvaluation.max_possible_score) * 100
        )
      ),
      overallFeedback: sample.defaultEvaluation.overall_feedback,
      strengths: sample.defaultEvaluation.strengths || [],
      weaknesses: sample.defaultEvaluation.weaknesses || [],
      pageCount: newPages.length,
      pages: newPages.map((p) => ({
        id: p.id,
        name: p.name,
        dataUrl: p.dataUrl,
        mimeType: p.mimeType,
        pageNumber: p.pageNumber || 1,
      })),
      evaluation: sample.defaultEvaluation,
    };

    saveOrUpdateRecord(newRecord);
  }, [saveOrUpdateRecord]);

  // Initialize with Sample 1 on first load
  useEffect(() => {
    if (SAMPLE_PAPERS.length > 0 && pages.length === 0) {
      loadSamplePaper(SAMPLE_PAPERS[0]);
    }
  }, [loadSamplePaper, pages.length]);

  // Handler for replacing existing pages (e.g. when uploading a full PDF exam booklet)
  const handleReplacePages = (newPages: TestPaperPage[], candidateStudentName?: string) => {
    const indexed = newPages.map((np, i) => ({
      ...np,
      pageNumber: i + 1,
    }));
    setPages(indexed);
    setActivePageIndex(0);
    setGlobalEvaluation(null);
    setSelectedAnnotation(null);
    setCurrentRecordId(null);
    if (candidateStudentName) {
      setCurrentStudentName(candidateStudentName);
    }
    setErrorMessage(null);
  };

  // Handler for adding uploaded pages
  const handleAddPages = (newPages: TestPaperPage[]) => {
    setPages((prev) => {
      const startNum = prev.length + 1;
      const indexed = newPages.map((np, i) => ({
        ...np,
        pageNumber: startNum + i,
      }));
      return [...prev, ...indexed];
    });

    if (pages.length === 0 && newPages.length > 0) {
      setActivePageIndex(0);
      // Derive candidate student name from file
      const firstFileName = newPages[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setCurrentStudentName(firstFileName || 'Student Paper');
    }
    setErrorMessage(null);
  };

  // Handler for removing a page
  const handleRemovePage = (index: number) => {
    setPages((prev) => {
      const updated = prev.filter((_, i) => i !== index).map((p, i) => ({
        ...p,
        pageNumber: i + 1,
      }));
      if (activePageIndex >= updated.length) {
        setActivePageIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
    setSelectedAnnotation(null);
  };

  // Evaluate all test paper pages with Gemini as a single cohesive unit
  const handleEvaluatePaper = async () => {
    if (pages.length === 0) return;

    setIsEvaluating(true);
    setErrorMessage(null);

    try {
      // Payload contains ALL pages in sequence
      const imagesPayload = pages.map((p, idx) => ({
        dataUrl: p.dataUrl,
        mimeType: p.mimeType,
        name: p.name || `Page ${idx + 1}`,
      }));

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: imagesPayload,
          image: pages[0].dataUrl,
          mimeType: pages[0].mimeType,
          questionPaper: gradingConfig.questionPaper
            ? {
                dataUrl: gradingConfig.questionPaper.dataUrl,
                mimeType: gradingConfig.questionPaper.mimeType,
                textContent: gradingConfig.questionPaper.textContent,
              }
            : undefined,
          answerKey: gradingConfig.answerKey
            ? {
                dataUrl: gradingConfig.answerKey.dataUrl,
                mimeType: gradingConfig.answerKey.mimeType,
                textContent: gradingConfig.answerKey.textContent,
              }
            : undefined,
          rubricText: gradingConfig.rubricText,
          totalMarks: gradingConfig.totalMarksOverride,
          strictness: gradingConfig.strictness,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Evaluation request failed with status ${response.status}`
        );
      }

      const evaluation: EvaluationResult = await response.json();
      setGlobalEvaluation(evaluation);

      // Extract detected student name if found
      const resolvedName = evaluation.student_name && evaluation.student_name.trim().length > 0
        ? evaluation.student_name.trim()
        : currentStudentName;
      const resolvedRoll = evaluation.student_roll_no || currentRollNumber;
      const resolvedSubject = evaluation.subject || 'Academic Exam';

      setCurrentStudentName(resolvedName);
      if (evaluation.student_roll_no) setCurrentRollNumber(evaluation.student_roll_no);

      // Distribute annotations and page scores to each individual page
      const updatedPages = pages.map((p, idx) => {
        const pageNum = idx + 1;
        const pageAnns = evaluation.annotations.filter(
          (a) => (a.page_number || 1) === pageNum
        );
        const pageScoreInfo = evaluation.page_scores?.find(
          (ps) => ps.page_number === pageNum
        );
        const pageScore =
          pageScoreInfo?.marks_awarded ??
          (pageAnns.length > 0
            ? pageAnns.reduce((sum, a) => sum + (a.marks_awarded || 0), 0)
            : evaluation.total_score_awarded);
        const pageMax =
          pageScoreInfo?.max_marks ??
          (pageAnns.length > 0
            ? pageAnns.reduce((sum, a) => sum + (a.max_marks || 0), 0)
            : evaluation.max_possible_score);

        const pageEvaluation: EvaluationResult = {
          ...evaluation,
          total_score_awarded: pageScore,
          max_possible_score: pageMax > 0 ? pageMax : evaluation.max_possible_score,
          annotations: pageAnns,
        };

        return {
          ...p,
          pageNumber: pageNum,
          evaluation: pageEvaluation,
        };
      });

      setPages(updatedPages);
      setSelectedAnnotation(null);

      // Save into Continuous Class Exam Records Ledger
      const recordId = currentRecordId || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setCurrentRecordId(recordId);

      const percentage = Math.round((evaluation.total_score_awarded / evaluation.max_possible_score) * 100);
      const grade = getGradeLetter(percentage);

      const newRecord: ExamRecord = {
        id: recordId,
        studentName: resolvedName,
        rollNumber: resolvedRoll,
        subject: resolvedSubject,
        evaluatedAt: new Date().toISOString(),
        marksAwarded: evaluation.total_score_awarded,
        maxMarks: evaluation.max_possible_score,
        percentage,
        grade,
        overallFeedback: evaluation.overall_feedback,
        strengths: evaluation.strengths || [],
        weaknesses: evaluation.weaknesses || [],
        pageCount: updatedPages.length,
        pages: updatedPages.map((p) => ({
          id: p.id,
          name: p.name,
          dataUrl: p.dataUrl,
          mimeType: p.mimeType,
          pageNumber: p.pageNumber || 1,
        })),
        evaluation,
      };

      saveOrUpdateRecord(newRecord);
    } catch (err: any) {
      console.error('Paper evaluation failed:', err);
      setErrorMessage(
        err.message ||
          'Failed to evaluate paper with Gemini. Please check your connection or try again.'
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  // Inspect student record from Class Comparison Report
  const handleInspectRecord = (record: ExamRecord) => {
    if (record.pages && record.pages.length > 0) {
      const restoredPages: TestPaperPage[] = record.pages.map((p) => ({
        id: p.id,
        name: p.name,
        dataUrl: p.dataUrl,
        mimeType: p.mimeType,
        width: 1200,
        height: 1600,
        pageNumber: p.pageNumber,
        evaluation: record.evaluation,
      }));
      setPages(restoredPages);
    }
    setGlobalEvaluation(record.evaluation);
    setCurrentStudentName(record.studentName);
    setCurrentRollNumber(record.rollNumber || '');
    setCurrentRecordId(record.id);
    setActivePageIndex(0);
    setActiveTab('evaluator');
  };

  // Delete an individual record
  const handleDeleteRecord = async (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (currentRecordId === id) {
      setCurrentRecordId(null);
    }
    try {
      await fetch(`/api/records/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete record on server:', e);
    }
  };

  // Clear all exam records
  const handleClearAllRecords = async () => {
    setRecords([]);
    setCurrentRecordId(null);
    try {
      await fetch('/api/records', { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to clear records on server:', e);
    }
  };

  // Add bulk sample demo records
  const handleAddSampleRecords = async (samples: ExamRecord[]) => {
    setRecords((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      const filtered = samples.filter((s) => !existingIds.has(s.id));
      return [...filtered, ...prev];
    });

    try {
      await fetch('/api/records/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: samples }),
      });
    } catch (e) {
      console.error('Failed to save demo records on server:', e);
    }
  };

  // Batch evaluation callback
  const handleBatchPaperGraded = ({
    studentName,
    rollNumber,
    subject,
    pages: gradedPages,
    evaluation,
  }: any) => {
    const percentage = Math.round((evaluation.total_score_awarded / evaluation.max_possible_score) * 100);
    const grade = getGradeLetter(percentage);
    const recId = `batch-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newRecord: ExamRecord = {
      id: recId,
      studentName,
      rollNumber,
      subject,
      evaluatedAt: new Date().toISOString(),
      marksAwarded: evaluation.total_score_awarded,
      maxMarks: evaluation.max_possible_score,
      percentage,
      grade,
      overallFeedback: evaluation.overall_feedback,
      strengths: evaluation.strengths || [],
      weaknesses: evaluation.weaknesses || [],
      pageCount: gradedPages.length,
      pages: gradedPages.map((p: any) => ({
        id: p.id,
        name: p.name,
        dataUrl: p.dataUrl,
        mimeType: p.mimeType,
        pageNumber: p.pageNumber || 1,
      })),
      evaluation,
    };

    saveOrUpdateRecord(newRecord);
  };

  const handleUpdateQuestionMarks = (qIndex: number, newMarks: number) => {
    if (!globalEvaluation || !globalEvaluation.question_breakdown) return;
    const updatedBreakdown = [...globalEvaluation.question_breakdown];
    const target = updatedBreakdown[qIndex];
    if (!target) return;

    const validMarks = Math.max(0, Math.min(target.max_marks, Number(newMarks) || 0));
    const roundedMarks = Math.round(validMarks * 10) / 10;
    
    updatedBreakdown[qIndex] = {
      ...target,
      marks_obtained: roundedMarks,
      status:
        roundedMarks === target.max_marks
          ? 'Full Marks'
          : roundedMarks > 0
          ? 'Partial Marks'
          : target.status?.includes('Omit')
          ? 'Omitted / Not Attempted'
          : 'Incorrect',
    };

    const newTotal = Math.round(updatedBreakdown.reduce((sum, q) => sum + q.marks_obtained, 0) * 10) / 10;
    const newMax = Math.round(updatedBreakdown.reduce((sum, q) => sum + q.max_marks, 0) * 10) / 10;
    const formulaStr = updatedBreakdown.map((q) => `${q.question_number}(${q.marks_obtained}/${q.max_marks})`).join(' + ') + ` = ${newTotal}/${Math.max(globalEvaluation.max_possible_score, newMax)} marks (Reconciled)`;

    const updatedEvaluation: EvaluationResult = {
      ...globalEvaluation,
      total_score_awarded: newTotal,
      max_possible_score: Math.max(globalEvaluation.max_possible_score, newMax),
      question_breakdown: updatedBreakdown,
      math_verification: {
        is_verified: true,
        sum_of_questions: newTotal,
        total_awarded: newTotal,
        breakdown_formula: formulaStr,
      },
    };

    setGlobalEvaluation(updatedEvaluation);
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        evaluation: p.evaluation ? { ...p.evaluation, ...updatedEvaluation } : undefined,
      }))
    );

    if (currentRecordId) {
      const match = records.find((r) => r.id === currentRecordId);
      if (match) {
        const pct = Math.round((newTotal / updatedEvaluation.max_possible_score) * 100);
        saveOrUpdateRecord({
          ...match,
          marksAwarded: newTotal,
          maxMarks: updatedEvaluation.max_possible_score,
          percentage: pct,
          grade: getGradeLetter(pct),
          evaluation: updatedEvaluation,
        });
      }
    }
  };

  const activePage = pages[activePageIndex] || null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans-ui text-slate-800 antialiased">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        recordsCount={records.length}
        onLoadSample={loadSamplePaper}
        onOpenBatchEvaluator={() => setIsBatchModalOpen(true)}
      />

      {/* Error Alert Banner if any */}
      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-xs sm:text-sm text-red-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 max-w-4xl">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View Switcher: Grading Studio vs Class Comparison Report */}
      {activeTab === 'comparison' ? (
        <ClassComparisonReport
          records={records}
          onSelectRecord={handleInspectRecord}
          onDeleteRecord={handleDeleteRecord}
          onClearAllRecords={handleClearAllRecords}
          onAddSampleRecords={handleAddSampleRecords}
          onOpenBatchEvaluator={() => setIsBatchModalOpen(true)}
          onBackToEvaluator={() => setActiveTab('evaluator')}
        />
      ) : (
        <>
          {/* Upload and Rubric Bar */}
          <UploadSection
            pages={pages}
            activePageIndex={activePageIndex}
            onSelectPage={setActivePageIndex}
            onAddPages={handleAddPages}
            onReplacePages={handleReplacePages}
            onRemovePage={handleRemovePage}
            config={gradingConfig}
            onConfigChange={setGradingConfig}
            onEvaluate={handleEvaluatePaper}
            isEvaluating={isEvaluating}
            studentName={currentStudentName}
            onUpdateStudentName={(name) => setCurrentStudentName(name)}
          />

          {/* Main Workspace (Paper Viewer + Summary Panel) */}
          <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            <PaperViewer
              page={activePage}
              selectedAnnotation={selectedAnnotation}
              onSelectAnnotation={setSelectedAnnotation}
              isEvaluating={isEvaluating}
              pageIndex={activePageIndex}
              totalPages={pages.length}
              onPrevPage={() => setActivePageIndex((prev) => Math.max(0, prev - 1))}
              onNextPage={() => setActivePageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
              globalEvaluation={globalEvaluation}
            />

            <SummaryPanel
              page={activePage}
              pages={pages}
              activePageIndex={activePageIndex}
              onSelectPage={setActivePageIndex}
              globalEvaluation={globalEvaluation}
              selectedAnnotation={selectedAnnotation}
              onSelectAnnotation={setSelectedAnnotation}
              studentName={currentStudentName}
              rollNumber={currentRollNumber}
              classRank={currentStudentRank}
              totalClassStudents={records.length}
              onGoToComparison={() => setActiveTab('comparison')}
              onUpdateQuestionMarks={handleUpdateQuestionMarks}
              onUpdateStudentInfo={(name, roll) => {
                setCurrentStudentName(name);
                setCurrentRollNumber(roll);
                if (currentRecordId) {
                  const match = records.find((r) => r.id === currentRecordId);
                  if (match) {
                    saveOrUpdateRecord({ ...match, studentName: name, rollNumber: roll });
                  }
                }
              }}
            />
          </main>
        </>
      )}

      {/* Batch Evaluator Modal for evaluating 100s of papers */}
      <BatchEvaluatorModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        config={gradingConfig}
        onPaperGraded={handleBatchPaperGraded}
        onGoToComparison={() => {
          setIsBatchModalOpen(false);
          setActiveTab('comparison');
        }}
      />
    </div>
  );
}

