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
  is_mcq?: boolean;
}

export interface QuestionBreakdownItem {
  question_number: string;
  page_number?: number; // 1-indexed page where this question is answered
  marks_obtained: number;
  max_marks: number;
  topic?: string;
  status?: 'Full Marks' | 'Partial Marks' | 'Incorrect' | 'Not Attempted' | 'Omitted' | string;
  sub_part?: string;
  omission_note?: string;
  is_mcq?: boolean;
  student_selected_option?: string;
  correct_option?: string;
}

export interface PageScoreItem {
  page_number: number;
  marks_awarded: number;
  max_marks?: number;
  summary?: string;
}

export interface MathVerification {
  is_verified: boolean;
  sum_of_questions: number;
  total_awarded: number;
  breakdown_formula: string;
}

export interface EvaluationResult {
  student_name?: string;
  student_roll_no?: string;
  subject?: string;
  total_score_awarded: number;
  max_possible_score: number;
  overall_feedback: string;
  strengths?: string[];
  weaknesses?: string[];
  omissions?: string[]; // Specifically tracks omitted questions, sub-parts, or missing diagrams
  question_breakdown?: QuestionBreakdownItem[];
  page_scores?: PageScoreItem[];
  annotations: AnnotationItem[];
  math_verification?: MathVerification;
  model_used?: string;
}

export interface ExamRecord {
  id: string;
  studentName: string;
  rollNumber?: string;
  subject: string;
  evaluatedAt: string; // ISO date string
  marksAwarded: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  rank?: number;
  percentile?: number;
  overallFeedback: string;
  strengths: string[];
  weaknesses: string[];
  pageCount: number;
  pages: {
    id: string;
    name: string;
    dataUrl: string;
    mimeType: string;
    pageNumber: number;
  }[];
  evaluation: EvaluationResult;
}

export interface ClassStatistics {
  totalPapers: number;
  classAverageMarks: number;
  classAveragePercentage: number;
  highestMarks: number;
  lowestMarks: number;
  highestScorer: string;
  passCount: number;
  failCount: number;
  passRate: number;
  gradeCounts: Record<string, number>;
  questionStats?: {
    questionNumber: string;
    averageMarks: number;
    maxMarks: number;
    percentage: number;
  }[];
}

export interface BatchQueueItem {
  id: string;
  studentName: string;
  rollNumber?: string;
  fileName: string;
  isPdf?: boolean;
  pageCount?: number;
  files: {
    name: string;
    dataUrl: string;
    mimeType: string;
  }[];
  status: 'pending' | 'evaluating' | 'completed' | 'failed';
  marksAwarded?: number;
  maxMarks?: number;
  grade?: string;
  rank?: number;
  error?: string;
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
  type: 'image' | 'text' | 'pdf';
  dataUrl?: string; // image base64 if uploaded as scan/photo or rendered PDF
  mimeType?: string;
  textContent?: string; // text content if entered or pasted
  pageCount?: number;
}

export interface GradingConfig {
  strictness: GradingStrictness;
  rubricText?: string;
  totalMarksOverride?: number;
  model?: string;
  questionPaper?: SupportingDocument | null;
  answerKey?: SupportingDocument | null;
}

