import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { PaperViewer } from './components/PaperViewer';
import { SummaryPanel } from './components/SummaryPanel';
import { AnnotationItem, EvaluationResult, GradingConfig, TestPaperPage } from './types';
import { SAMPLE_PAPERS, SamplePaper } from './utils/samplePapers';
import { AlertCircle, X } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

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

  // Evaluate all test paper pages directly in the browser with Gemini API
  const handleEvaluatePaper = async () => {
    if (pages.length === 0) return;

    if (!apiKey.trim()) {
      setErrorMessage('Please enter your Gemini API Key in the top header before evaluating.');
      return;
    }

    setIsEvaluating(true);
    setErrorMessage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

      // Construct the multimodal contents payload
      const parts: any[] = [];

      let promptText = `Act as an expert, rigorous, and encouraging academic exam evaluator.
Evaluate the student's submitted test paper pages thoroughly.
Strictness setting: ${gradingConfig.strictness || 'standard'}.
${gradingConfig.totalMarksOverride ? `Total Maximum Marks: ${gradingConfig.totalMarksOverride}` : ''}
${gradingConfig.rubricText ? `Grading Rubric / Instructions:\n${gradingConfig.rubricText}\n` : ''}

Instructions:
1. Check answers step-by-step against standard correctness and standard curriculum keys.
2. Award realistic marks for each correct step and penalize inaccuracies.
3. Generate detailed visual annotations. Provide accurate 2D bounding boxes in normalized coordinates [ymin, xmin, ymax, xmax] scaled 0 to 1000 for each evaluated response.
4. Specify the "page_number" (1-indexed starting at 1) for every single annotation.
5. Provide overall summary strengths, weaknesses, and key improvement recommendations.`;

      parts.push({ text: promptText });

      // Include optional Question Paper if attached
      if (gradingConfig.questionPaper?.dataUrl) {
        const qpData = gradingConfig.questionPaper.dataUrl.split(',')[1] || gradingConfig.questionPaper.dataUrl;
        parts.push({
          text: '--- QUESTION PAPER ATTACHMENT ---',
        });
        parts.push({
          inlineData: {
            mimeType: gradingConfig.questionPaper.mimeType || 'image/jpeg',
            data: qpData,
          },
        });
      }

      // Include optional Answer Key if attached
      if (gradingConfig.answerKey?.dataUrl) {
        const akData = gradingConfig.answerKey.dataUrl.split(',')[1] || gradingConfig.answerKey.dataUrl;
        parts.push({
          text: '--- OFFICIAL ANSWER KEY / SOLUTION ATTACHMENT ---',
        });
        parts.push({
          inlineData: {
            mimeType: gradingConfig.answerKey.mimeType || 'image/jpeg',
            data: akData,
          },
        });
      }

      // Include all student answer paper pages
      pages.forEach((p, idx) => {
        const pageData = p.dataUrl.split(',')[1] || p.dataUrl;
        parts.push({
          text: `--- STUDENT ANSWER PAPER: PAGE ${idx + 1} (${p.name || 'Page ' + (idx + 1)}) ---`,
        });
        parts.push({
          inlineData: {
            mimeType: p.mimeType || 'image/jpeg',
            data: pageData,
          },
        });
      });

      // Call Gemini 2.5 Flash with structured JSON response
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              total_score_awarded: { type: Type.NUMBER },
              max_possible_score: { type: Type.NUMBER },
              percentage: { type: Type.NUMBER },
              overall_feedback: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              improvement_tips: { type: Type.ARRAY, items: { type: Type.STRING } },
              page_scores: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    page_number: { type: Type.NUMBER },
                    marks_awarded: { type: Type.NUMBER },
                    max_marks: { type: Type.NUMBER },
                  },
                  required: ['page_number', 'marks_awarded', 'max_marks'],
                },
              },
              annotations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    page_number: { type: Type.NUMBER },
                    box_2d: {
                      type: Type.ARRAY,
                      items: { type: Type.NUMBER },
                      description: '[ymin, xmin, ymax, xmax] coordinates normalized 0-1000',
                    },
                    type: {
                      type: Type.STRING,
                      description: 'One of: correct, incorrect, partial, comment, formula, grammar',
                    },
                    question_number: { type: Type.STRING },
                    marks_awarded: { type: Type.NUMBER },
                    max_marks: { type: Type.NUMBER },
                    feedback_text: { type: Type.STRING },
                    improvement_tip: { type: Type.STRING },
                  },
                  required: ['page_number', 'box_2d', 'type', 'feedback_text'],
                },
              },
            },
            required: ['total_score_awarded', 'max_possible_score', 'annotations'],
          },
        },
      });

      const responseText = response.text || '{}';
      const evaluation: EvaluationResult = JSON.parse(responseText);

      setGlobalEvaluation(evaluation);

      // Distribute annotations and page scores to each individual page
      const updatedPages = pages.map((p, idx) => {
        const pageNum = idx + 1;
        const pageAnns = (evaluation.annotations || []).filter(
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
          'Failed to evaluate paper with Gemini. Please check your API key and try again.'
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
