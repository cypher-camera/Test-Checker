import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Award,
  TrendingUp,
  Users,
  Search,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  RotateCcw,
  Sparkles,
  ChevronRight,
  BarChart3,
  Percent,
} from 'lucide-react';
import { ClassStatistics, ExamRecord } from '../types';
import { calculateClassRanks, computeClassStatistics, getSampleClassDemoRecords } from '../utils/rankingUtils';
import { downloadClassRankingPDF, exportClassRankingCSV } from '../utils/exportUtils';

interface ClassComparisonReportProps {
  records: ExamRecord[];
  onSelectRecord: (record: ExamRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAllRecords: () => void;
  onAddSampleRecords: (samples: ExamRecord[]) => void;
  onOpenBatchEvaluator: () => void;
  onBackToEvaluator: () => void;
}

export const ClassComparisonReport: React.FC<ClassComparisonReportProps> = ({
  records,
  onSelectRecord,
  onDeleteRecord,
  onClearAllRecords,
  onAddSampleRecords,
  onOpenBatchEvaluator,
  onBackToEvaluator,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rank-asc' | 'rank-desc' | 'name-asc' | 'date-desc'>('rank-asc');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Compute ranks and class statistics
  const rankedRecords = useMemo(() => {
    return calculateClassRanks(records);
  }, [records]);

  const classStats: ClassStatistics = useMemo(() => {
    return computeClassStatistics(rankedRecords);
  }, [rankedRecords]);

  // Filter and sort records for table display
  const filteredRecords = useMemo(() => {
    let result = [...rankedRecords];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          (r.studentName && r.studentName.toLowerCase().includes(q)) ||
          (r.rollNumber && r.rollNumber.toLowerCase().includes(q)) ||
          (r.subject && r.subject.toLowerCase().includes(q))
      );
    }

    if (gradeFilter !== 'all') {
      result = result.filter((r) => r.grade === gradeFilter);
    }

    result.sort((a, b) => {
      if (sortBy === 'rank-asc') {
        return (a.rank || 0) - (b.rank || 0);
      }
      if (sortBy === 'rank-desc') {
        return (b.rank || 0) - (a.rank || 0);
      }
      if (sortBy === 'name-asc') {
        return (a.studentName || '').localeCompare(b.studentName || '');
      }
      if (sortBy === 'date-desc') {
        return new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime();
      }
      return 0;
    });

    return result;
  }, [rankedRecords, searchQuery, gradeFilter, sortBy]);

  const handleExportPDF = async () => {
    if (rankedRecords.length === 0) return;
    try {
      setIsExportingPDF(true);
      downloadClassRankingPDF(rankedRecords, classStats);
    } catch (e) {
      console.error(e);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportCSV = () => {
    if (rankedRecords.length === 0) return;
    exportClassRankingCSV(rankedRecords);
  };

  const handleLoadDemoClass = () => {
    const demos = getSampleClassDemoRecords();
    onAddSampleRecords(demos);
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Control Navigation Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
                <Trophy className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Class Performance & Ranking Report
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Continuous comparative grading ledger across 100s of student exam papers
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="back-to-evaluator-btn"
              type="button"
              onClick={onBackToEvaluator}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 flex items-center space-x-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect Paper Studio</span>
            </button>

            <button
              id="batch-evaluator-open-btn"
              type="button"
              onClick={onOpenBatchEvaluator}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Batch Grade Papers</span>
            </button>

            {records.length > 0 && (
              <>
                <button
                  id="export-ranking-pdf-btn"
                  type="button"
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 transition-colors flex items-center space-x-1.5 cursor-pointer"
                  title="Export Official PDF Report"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isExportingPDF ? 'Generating...' : 'PDF Report'}</span>
                </button>

                <button
                  id="export-ranking-csv-btn"
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 transition-colors flex items-center space-x-1.5 cursor-pointer"
                  title="Export Excel/CSV Merit List"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>CSV Merit</span>
                </button>
              </>
            )}

            {records.length === 0 && (
              <button
                id="load-demo-class-btn"
                type="button"
                onClick={handleLoadDemoClass}
                className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Load Demo Class (5 Students)</span>
              </button>
            )}
          </div>
        </div>

        {/* Empty State Showcase */}
        {records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-2xl mx-auto shadow-xs">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <Trophy className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Exam Papers Recorded Yet</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              When you evaluate student exam papers (e.g. checking Student A, then Student B, Student C...), each paper is automatically archived with marks, visual annotations, and ranked on the class leaderboard.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleLoadDemoClass}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Load Demo Class (Students A, B, C, D, E)</span>
              </button>
              <button
                type="button"
                onClick={onBackToEvaluator}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer"
              >
                Go to Paper Evaluator
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Top KPI Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Card 1: Total Papers */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total Checked
                  </div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">
                    {classStats.totalPapers} <span className="text-xs font-normal text-slate-500">Papers</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Class Average */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Class Average
                  </div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">
                    {classStats.classAveragePercentage}%{' '}
                    <span className="text-xs font-normal text-slate-500">({classStats.classAverageMarks} pts)</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Top Rank (Topper) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Rank #1 Score
                  </div>
                  <div className="text-xl font-bold text-amber-700 mt-0.5 truncate">
                    {classStats.highestMarks} pts
                  </div>
                  <div className="text-[11px] text-slate-500 truncate font-medium">
                    {classStats.highestScorer}
                  </div>
                </div>
              </div>

              {/* Card 4: Lowest Score */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg shrink-0">
                  <ArrowUpDown className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Lowest Score
                  </div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">
                    {classStats.lowestMarks} pts
                  </div>
                  <div className="text-[11px] text-slate-500">Minimum recorded</div>
                </div>
              </div>

              {/* Card 5: Passing Rate */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3 col-span-2 sm:col-span-2 lg:col-span-1">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Pass Rate (≥40%)
                  </div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">
                    {classStats.passRate}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {classStats.passCount} passed / {classStats.failCount} failed
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Analytics Grid: Grade Distribution & Question Difficulty */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Grade Distribution Bar */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-1">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Grade Distribution
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {classStats.totalPapers} Total
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(['A+', 'A', 'B', 'C', 'D', 'F'] as const).map((g) => {
                    const count = classStats.gradeCounts[g] || 0;
                    const pct = classStats.totalPapers > 0 ? Math.round((count / classStats.totalPapers) * 100) : 0;
                    const barColor =
                      g === 'A+'
                        ? 'bg-emerald-500'
                        : g === 'A'
                        ? 'bg-emerald-400'
                        : g === 'B'
                        ? 'bg-blue-500'
                        : g === 'C'
                        ? 'bg-amber-400'
                        : 'bg-rose-500';

                    return (
                      <div key={g} className="flex items-center text-xs">
                        <span className="w-7 font-bold text-slate-700">{g}</span>
                        <div className="flex-1 h-3.5 bg-slate-100 rounded-full mx-2 overflow-hidden flex">
                          <div
                            className={`h-full ${barColor} transition-all duration-300 rounded-full`}
                            style={{ width: `${Math.max(pct, count > 0 ? 6 : 0)}%` }}
                          />
                        </div>
                        <span className="w-14 text-right text-slate-600 font-medium">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Question Performance Diagnostics */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Percent className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Question-Level Class Mastery Matrix
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Average score achieved by class per question
                  </span>
                </div>

                {classStats.questionStats && classStats.questionStats.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {classStats.questionStats.map((q) => {
                      const isHigh = q.percentage >= 75;
                      const isLow = q.percentage < 50;

                      return (
                        <div
                          key={q.questionNumber}
                          className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-xs text-slate-800">
                              {q.questionNumber}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isHigh
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isLow
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {q.percentage}% avg
                            </span>
                          </div>

                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-1">
                            <div
                              className={`h-full rounded-full ${
                                isHigh ? 'bg-emerald-500' : isLow ? 'bg-rose-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${q.percentage}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Avg {q.averageMarks} pts</span>
                            <span>Max {q.maxMarks} pts</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-slate-500">
                    Question breakdown will appear once papers with questions are evaluated.
                  </div>
                )}
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student name, roll no..."
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                {/* Grade Filter */}
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-700 outline-none"
                >
                  <option value="all">All Grades</option>
                  <option value="A+">Grade A+</option>
                  <option value="A">Grade A</option>
                  <option value="B">Grade B</option>
                  <option value="C">Grade C</option>
                  <option value="F">Grade F</option>
                </select>

                {/* Sort Order */}
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-700 outline-none"
                >
                  <option value="rank-asc">Rank: High to Low (1st...)</option>
                  <option value="rank-desc">Rank: Low to High</option>
                  <option value="name-asc">Name: A to Z</option>
                  <option value="date-desc">Most Recently Checked</option>
                </select>

                {records.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear all exam paper records?')) {
                        onClearAllRecords();
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Clear All Records"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Class Rank Leaderboard Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4 text-center w-16">Rank</th>
                      <th className="py-3.5 px-4">Student Name & Roll No</th>
                      <th className="py-3.5 px-4">Marks Awarded</th>
                      <th className="py-3.5 px-4">Percentage</th>
                      <th className="py-3.5 px-4">Grade</th>
                      <th className="py-3.5 px-4">Percentile</th>
                      <th className="py-3.5 px-4 hidden md:table-cell">Key Strengths & Feedback</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          No student exam records match your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((rec) => {
                        const isTopThree = (rec.rank || 0) <= 3;
                        const rankBadge =
                          rec.rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-extrabold text-xs shadow-xs border border-amber-300">
                              🥇 1
                            </span>
                          ) : rec.rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-800 font-extrabold text-xs shadow-xs border border-slate-300">
                              🥈 2
                            </span>
                          ) : rec.rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-900 font-extrabold text-xs shadow-xs border border-amber-200">
                              🥉 3
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
                              #{rec.rank}
                            </span>
                          );

                        const gradeBadge =
                          rec.grade === 'A+' ? (
                            <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              A+
                            </span>
                          ) : rec.grade === 'A' ? (
                            <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              A
                            </span>
                          ) : rec.grade === 'B' ? (
                            <span className="px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              B
                            </span>
                          ) : rec.grade === 'C' ? (
                            <span className="px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              C
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              {rec.grade || 'F'}
                            </span>
                          );

                        return (
                          <tr
                            key={rec.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              rec.rank === 1 ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            {/* Rank */}
                            <td className="py-3 px-4 text-center">{rankBadge}</td>

                            {/* Student Details */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                                <span>{rec.studentName || 'Student'}</span>
                                {rec.rank === 1 && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                                    Topper
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                                {rec.rollNumber && <span>Roll: {rec.rollNumber}</span>}
                                {rec.subject && <span>• {rec.subject}</span>}
                                <span>• {new Date(rec.evaluatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </td>

                            {/* Marks Awarded */}
                            <td className="py-3 px-4">
                              <div className="font-extrabold text-sm text-slate-900">
                                {rec.marksAwarded} <span className="text-slate-400 font-normal">/ {rec.maxMarks}</span>
                              </div>
                              <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    rec.percentage >= 80
                                      ? 'bg-emerald-500'
                                      : rec.percentage >= 60
                                      ? 'bg-blue-500'
                                      : rec.percentage >= 40
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(100, rec.percentage)}%` }}
                                />
                              </div>
                            </td>

                            {/* Percentage */}
                            <td className="py-3 px-4 font-bold text-slate-800">
                              {rec.percentage}%
                            </td>

                            {/* Grade */}
                            <td className="py-3 px-4">{gradeBadge}</td>

                            {/* Percentile */}
                            <td className="py-3 px-4 font-medium text-slate-600">
                              {rec.percentile ? `${rec.percentile}th %ile` : '-'}
                            </td>

                            {/* Feedback & Strengths */}
                            <td className="py-3 px-4 hidden md:table-cell max-w-xs">
                              <div className="text-[11px] text-slate-600 truncate" title={rec.overallFeedback}>
                                {rec.overallFeedback}
                              </div>
                              {rec.strengths && rec.strengths.length > 0 && (
                                <div className="text-[10px] text-emerald-700 truncate mt-0.5">
                                  ✓ {rec.strengths[0]}
                                </div>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  type="button"
                                  onClick={() => onSelectRecord(rec)}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 rounded-lg text-xs font-medium transition-colors border border-slate-200 flex items-center space-x-1 cursor-pointer"
                                  title="Inspect Graded Paper in Studio"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Inspect Paper</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onDeleteRecord(rec.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
