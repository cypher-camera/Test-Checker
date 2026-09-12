import { ClassStatistics, ExamRecord } from '../types';
import { getGradeLetter } from './exportUtils';

/**
  * Calculates ranks and percentiles for an array of exam records based on percentage/marks
  */
export function calculateClassRanks(records: ExamRecord[]): ExamRecord[] {
  if (records.length === 0) return [];

  // Sort descending by percentage, then by marksAwarded
  const sorted = [...records].sort((a, b) => {
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    return b.marksAwarded - a.marksAwarded;
  });

  const totalStudents = sorted.length;

  // Assign standard competition ranks (1, 2, 2, 4...) and percentiles
  let currentRank = 1;
  return sorted.map((rec, index) => {
    if (index > 0) {
      const prev = sorted[index - 1];
      if (rec.percentage < prev.percentage || rec.marksAwarded < prev.marksAwarded) {
        currentRank = index + 1;
      }
    }

    // Percentile rank: percentage of scores in its frequency distribution that are less than or equal to it
    const studentsBelowOrEqual = sorted.filter((s) => s.percentage <= rec.percentage).length;
    const percentile = totalStudents > 1 ? Math.round((studentsBelowOrEqual / totalStudents) * 100) : 100;

    return {
      ...rec,
      rank: currentRank,
      percentile,
    };
  });
}

/**
  * Computes overall class statistics, averages, toppers, and question-level difficulty diagnostics
  */
export function computeClassStatistics(records: ExamRecord[]): ClassStatistics {
  const totalPapers = records.length;
  if (totalPapers === 0) {
    return {
      totalPapers: 0,
      classAverageMarks: 0,
      classAveragePercentage: 0,
      highestMarks: 0,
      lowestMarks: 0,
      highestScorer: 'N/A',
      passCount: 0,
      failCount: 0,
      passRate: 0,
      gradeCounts: { 'A+': 0, A: 0, B: 0, C: 0, D: 0, F: 0 },
      questionStats: [],
    };
  }

  const totalMarksSum = records.reduce((sum, r) => sum + r.marksAwarded, 0);
  const totalPctSum = records.reduce((sum, r) => sum + r.percentage, 0);

  const highestRecord = records.reduce((max, r) => (r.percentage > max.percentage ? r : max), records[0]);
  const lowestRecord = records.reduce((min, r) => (r.percentage < min.percentage ? r : min), records[0]);

  const passCount = records.filter((r) => r.percentage >= 40).length;
  const failCount = totalPapers - passCount;
  const passRate = Math.round((passCount / totalPapers) * 100);

  // Grade distributions
  const gradeCounts: Record<string, number> = { 'A+': 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
  records.forEach((r) => {
    const letter = r.grade || getGradeLetter(r.percentage);
    if (gradeCounts[letter] !== undefined) {
      gradeCounts[letter] += 1;
    } else {
      gradeCounts[letter] = 1;
    }
  });

  // Question-by-question class performance breakdown
  const questionMap = new Map<string, { totalAwarded: number; maxMarks: number; count: number }>();
  records.forEach((rec) => {
    const qb = rec.evaluation?.question_breakdown || [];
    qb.forEach((q) => {
      const key = q.question_number;
      if (!questionMap.has(key)) {
        questionMap.set(key, { totalAwarded: 0, maxMarks: q.max_marks || 1, count: 0 });
      }
      const entry = questionMap.get(key)!;
      entry.totalAwarded += q.marks_obtained || 0;
      entry.maxMarks = Math.max(entry.maxMarks, q.max_marks || 1);
      entry.count += 1;
    });
  });

  const questionStats = Array.from(questionMap.entries()).map(([qNum, val]) => {
    const avg = val.count > 0 ? val.totalAwarded / val.count : 0;
    const pct = val.maxMarks > 0 ? Math.round((avg / val.maxMarks) * 100) : 0;
    return {
      questionNumber: qNum,
      averageMarks: Math.round(avg * 10) / 10,
      maxMarks: val.maxMarks,
      percentage: pct,
    };
  });

  return {
    totalPapers,
    classAverageMarks: Math.round((totalMarksSum / totalPapers) * 10) / 10,
    classAveragePercentage: Math.round((totalPctSum / totalPapers) * 10) / 10,
    highestMarks: highestRecord.marksAwarded,
    lowestMarks: lowestRecord.marksAwarded,
    highestScorer: highestRecord.studentName,
    passCount,
    failCount,
    passRate,
    gradeCounts,
    questionStats,
  };
}

/**
 * Creates sample records for demo testing and comparison showcase
 */
export function getSampleClassDemoRecords(): ExamRecord[] {
  const baseDate = new Date();
  
  return [
    {
      id: 'rec-sample-1',
      studentName: 'Student A (Alex Morgan)',
      rollNumber: '12-B-42',
      subject: 'Physics',
      evaluatedAt: new Date(baseDate.getTime() - 40 * 60 * 1000).toISOString(),
      marksAwarded: 18.5,
      maxMarks: 20,
      percentage: 92.5,
      grade: 'A+',
      overallFeedback: 'Exceptional work. Accurate friction and kinematic calculations with clear step derivations.',
      strengths: ['Accurate normal force computation', 'Spot-on kinematic calculations', 'Clear diagrams'],
      weaknesses: ['Missed SI units (m/s²) in acceleration in Q1 final step'],
      pageCount: 1,
      pages: [],
      evaluation: {
        total_score_awarded: 18.5,
        max_possible_score: 20,
        overall_feedback: 'Exceptional work with clear step derivations.',
        strengths: ['Accurate normal force', 'Spot-on kinematics'],
        weaknesses: ['Missing acceleration units'],
        annotations: [],
        question_breakdown: [
          { question_number: 'Q1', marks_obtained: 4.5, max_marks: 5, topic: 'Friction & Net Force', status: 'Partial Marks' },
          { question_number: 'Q2', marks_obtained: 4.0, max_marks: 5, topic: 'Conservation of Momentum', status: 'Partial Marks' },
          { question_number: 'Q3', marks_obtained: 5.0, max_marks: 5, topic: 'Kinematics & Gravity', status: 'Full Marks' },
          { question_number: 'Q4', marks_obtained: 5.0, max_marks: 5, topic: 'Work-Energy Theorem', status: 'Full Marks' },
        ],
      },
    },
    {
      id: 'rec-sample-2',
      studentName: 'Student B (Sarah Chen)',
      rollNumber: '12-B-18',
      subject: 'Physics',
      evaluatedAt: new Date(baseDate.getTime() - 30 * 60 * 1000).toISOString(),
      marksAwarded: 16.0,
      maxMarks: 20,
      percentage: 80.0,
      grade: 'A',
      overallFeedback: 'Strong overall performance. Excellent theoretical comprehension with minor arithmetic slip in Q1.',
      strengths: ['Flawless explanation of momentum conservation', 'Methodical diagram labeling'],
      weaknesses: ['Calculation error in normal force', 'Incomplete formula statement in Q3'],
      pageCount: 1,
      pages: [],
      evaluation: {
        total_score_awarded: 16.0,
        max_possible_score: 20,
        overall_feedback: 'Strong overall performance with good conceptual understanding.',
        strengths: ['Theoretical comprehension', 'Clean presentation'],
        weaknesses: ['Minor calculation error'],
        annotations: [],
        question_breakdown: [
          { question_number: 'Q1', marks_obtained: 3.5, max_marks: 5, topic: 'Friction & Net Force', status: 'Partial Marks' },
          { question_number: 'Q2', marks_obtained: 5.0, max_marks: 5, topic: 'Conservation of Momentum', status: 'Full Marks' },
          { question_number: 'Q3', marks_obtained: 4.0, max_marks: 5, topic: 'Kinematics & Gravity', status: 'Partial Marks' },
          { question_number: 'Q4', marks_obtained: 3.5, max_marks: 5, topic: 'Work-Energy Theorem', status: 'Partial Marks' },
        ],
      },
    },
    {
      id: 'rec-sample-3',
      studentName: 'Student C (Marcus Brody)',
      rollNumber: '12-B-07',
      subject: 'Physics',
      evaluatedAt: new Date(baseDate.getTime() - 20 * 60 * 1000).toISOString(),
      marksAwarded: 14.5,
      maxMarks: 20,
      percentage: 72.5,
      grade: 'B',
      overallFeedback: 'Good conceptual foundation. Needs to write explicit mathematical formulas before substituting values.',
      strengths: ['Identified correct principles of conservation', 'Good handwriting legibility'],
      weaknesses: ['Skipped intermediate algebraic steps', 'Struggled on multi-part kinematics'],
      pageCount: 1,
      pages: [],
      evaluation: {
        total_score_awarded: 14.5,
        max_possible_score: 20,
        overall_feedback: 'Good conceptual foundation.',
        strengths: ['Core principles identified'],
        weaknesses: ['Skipped steps in algebra'],
        annotations: [],
        question_breakdown: [
          { question_number: 'Q1', marks_obtained: 3.0, max_marks: 5, topic: 'Friction & Net Force', status: 'Partial Marks' },
          { question_number: 'Q2', marks_obtained: 4.0, max_marks: 5, topic: 'Conservation of Momentum', status: 'Partial Marks' },
          { question_number: 'Q3', marks_obtained: 3.5, max_marks: 5, topic: 'Kinematics & Gravity', status: 'Partial Marks' },
          { question_number: 'Q4', marks_obtained: 4.0, max_marks: 5, topic: 'Work-Energy Theorem', status: 'Partial Marks' },
        ],
      },
    },
    {
      id: 'rec-sample-4',
      studentName: 'Student D (Elena Rostova)',
      rollNumber: '12-B-31',
      subject: 'Physics',
      evaluatedAt: new Date(baseDate.getTime() - 10 * 60 * 1000).toISOString(),
      marksAwarded: 19.5,
      maxMarks: 20,
      percentage: 97.5,
      grade: 'A+',
      overallFeedback: 'Flawless test paper. Perfect derivations, impeccable diagrams, and fully stated units throughout.',
      strengths: ['Complete mathematical rigor', 'Beautiful handwriting & diagrams', 'Stated all boundary conditions'],
      weaknesses: ['Tiny formatting note: boxed final answers are recommended for board exams'],
      pageCount: 1,
      pages: [],
      evaluation: {
        total_score_awarded: 19.5,
        max_possible_score: 20,
        overall_feedback: 'Flawless test paper and perfect derivations.',
        strengths: ['Complete mathematical rigor', 'Beautiful diagrams'],
        weaknesses: ['Box final answers'],
        annotations: [],
        question_breakdown: [
          { question_number: 'Q1', marks_obtained: 5.0, max_marks: 5, topic: 'Friction & Net Force', status: 'Full Marks' },
          { question_number: 'Q2', marks_obtained: 5.0, max_marks: 5, topic: 'Conservation of Momentum', status: 'Full Marks' },
          { question_number: 'Q3', marks_obtained: 4.5, max_marks: 5, topic: 'Kinematics & Gravity', status: 'Partial Marks' },
          { question_number: 'Q4', marks_obtained: 5.0, max_marks: 5, topic: 'Work-Energy Theorem', status: 'Full Marks' },
        ],
      },
    },
    {
      id: 'rec-sample-5',
      studentName: 'Student E (David Kim)',
      rollNumber: '12-B-23',
      subject: 'Physics',
      evaluatedAt: new Date(baseDate.getTime() - 5 * 60 * 1000).toISOString(),
      marksAwarded: 11.0,
      maxMarks: 20,
      percentage: 55.0,
      grade: 'C',
      overallFeedback: 'Satisfactory attempt, but shows conceptual confusion between static and kinetic friction coefficients.',
      strengths: ['Correct initial equation formulation in Q3', 'Attempted all questions'],
      weaknesses: ['Conflated static vs kinetic friction', 'Did not consider sign of acceleration under gravity'],
      pageCount: 1,
      pages: [],
      evaluation: {
        total_score_awarded: 11.0,
        max_possible_score: 20,
        overall_feedback: 'Satisfactory attempt but needs revision on friction laws.',
        strengths: ['Attempted all questions'],
        weaknesses: ['Static vs kinetic friction confusion'],
        annotations: [],
        question_breakdown: [
          { question_number: 'Q1', marks_obtained: 2.0, max_marks: 5, topic: 'Friction & Net Force', status: 'Partial Marks' },
          { question_number: 'Q2', marks_obtained: 3.0, max_marks: 5, topic: 'Conservation of Momentum', status: 'Partial Marks' },
          { question_number: 'Q3', marks_obtained: 3.0, max_marks: 5, topic: 'Kinematics & Gravity', status: 'Partial Marks' },
          { question_number: 'Q4', marks_obtained: 3.0, max_marks: 5, topic: 'Work-Energy Theorem', status: 'Partial Marks' },
        ],
      },
    },
  ];
}
