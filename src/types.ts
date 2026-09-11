export type AnnotationType = 'correct' | 'incorrect' | 'partial' | 'comment';

export interface AnnotationItem {
  id?: string;
  page_number?: number; // 1-indexed page number (1, 2, 3...)
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] in 0..1000 coordinates
  type: AnnotationType;
  marks_awarded: number;
  max_marks: number;
  feedback_text: string;
  improvement_tip: string;
}

export interface QuestionBreakdownItem {
  question_number: string;
  page_number?: number; // 1-indexed page where this question is answered
  marks_obtained: number;
  max_marks: number;
  topic?: string;
  status?: 'Full Marks' | 'Partial Marks' | 'Incorrect' | 'Not Attempted' | string;
}

export interface PageScoreItem {
  page_number: number;
  marks_awarded: number;
  max_marks?: number;
  summary?: string;
}

export interface EvaluationResult {
  total_score_awarded: number;
  max_possible_score: number;
  overall_feedback: string;
  strengths?: string[];
  weaknesses?: string[];
  question_breakdown?: QuestionBreakdownItem[];
  page_scores?: PageScoreItem[];
  annotations: AnnotationItem[];
  model_used?: string;
}

export interface TestPaperPage {
  id: string;
  name: string;
  dataUrl: string; // base64 or blob URL for rendering
  mimeType: string;
  width: number;
  height: number;
  pageNumber?: number; // 1-indexed page number
  evaluation?: EvaluationResult;
  isEvaluating?: boolean;
  error?: string | null;
}

export type GradingStrictness = 'lenient' | 'standard' | 'strict' | 'board_exam';

export interface SupportingDocument {
  id: string;
  name: string;
  type: 'image' | 'text';
  dataUrl?: string; // image base64 if uploaded as scan/photo
  mimeType?: string;
  textContent?: string; // text content if entered or pasted
}

export interface GradingConfig {
  strictness: GradingStrictness;
  rubricText?: string;
  totalMarksOverride?: number;
  model?: string;
  questionPaper?: SupportingDocument | null;
  answerKey?: SupportingDocument | null;
}

