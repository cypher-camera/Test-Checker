import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { PaperViewer } from './components/PaperViewer';
import { SummaryPanel } from './components/SummaryPanel';
import { AnnotationItem, EvaluationResult, GradingConfig, TestPaperPage } from './types';
import { SAMPLE_PAPERS, SamplePaper } from './utils/samplePapers';
import { AlertCircle, X } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });

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

  // Sync apiKey to localStorage
  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    if (newKey.trim()) {
      localStorage.setItem('gemini_api_key', newKey.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  };

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
  }, []);

  // Initialize with Sample 1 on first load
  useEffect(() => {
    if (SAMPLE_PAPERS.length > 0) {
      loadSamplePaper(SAMPLE_PAPERS[0]);
    }
  }, [loadSamplePaper]);

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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey.trim()) {
        headers['x-gemini-api-key'] = apiKey.trim();
      }

      // Payload contains ALL pages in sequence
      const imagesPayload = pages.map((p, idx) => ({
        dataUrl: p.dataUrl,
        mimeType: p.mimeType,
        name: p.name || `Page ${idx + 1}`,
      }));

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          images: imagesPayload,
          image: pages[0].dataUrl, // backwards compatibility
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

  const activePage = pages[activePageIndex] || null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans-ui text-slate-800 antialiased">
      {/* Top Header */}
      <Header
        apiKey={apiKey}
        onApiKeyChange={handleApiKeyChange}
        onLoadSample={loadSamplePaper}
      />

      {/* Upload and Rubric Bar */}
      <UploadSection
        pages={pages}
        activePageIndex={activePageIndex}
        onSelectPage={setActivePageIndex}
        onAddPages={handleAddPages}
        onRemovePage={handleRemovePage}
        config={gradingConfig}
        onConfigChange={setGradingConfig}
        onEvaluate={handleEvaluatePaper}
        isEvaluating={isEvaluating}
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
        />
      </main>
    </div>
  );
}
