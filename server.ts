import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Support large payloads for multi-page high-resolution test paper scans
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));

// Ensure server data directory exists for persisting exam records
const DATA_DIR = path.join(process.cwd(), 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'exam_records.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize data directory on filesystem:', e);
}

// In-memory cache of exam records synced with filesystem
let inMemoryRecords: any[] = [];
try {
  if (fs.existsSync(RECORDS_FILE)) {
    const raw = fs.readFileSync(RECORDS_FILE, 'utf-8');
    inMemoryRecords = JSON.parse(raw);
    console.log(`[Exam Store] Loaded ${inMemoryRecords.length} exam records from storage.`);
  }
} catch (e) {
  console.warn('Failed to parse existing exam records file, starting fresh:', e);
  inMemoryRecords = [];
}

function persistRecordsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(inMemoryRecords, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving exam records to disk:', err);
  }
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    secure: true,
  });
});

// In-memory rate limiter configured for high-volume paper batches (hundreds of papers)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 3 * 60 * 1000; // 3 minutes
const MAX_EVALUATIONS_PER_WINDOW = 350; // Generous limit for grading classes of 100+ papers

// Periodic cleanup of rate limit map (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= MAX_EVALUATIONS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// Exam Records API Endpoints for Continuous Paper Record Ledger
app.get('/api/records', (_req, res) => {
  res.json({
    records: inMemoryRecords,
    count: inMemoryRecords.length,
  });
});

app.post('/api/records', (req, res) => {
  try {
    const newRecord = req.body;
    if (!newRecord || !newRecord.id) {
      return res.status(400).json({ error: 'Record must contain an id' });
    }

    const existingIndex = inMemoryRecords.findIndex((r) => r.id === newRecord.id);
    if (existingIndex >= 0) {
      inMemoryRecords[existingIndex] = newRecord;
    } else {
      inMemoryRecords.unshift(newRecord);
    }

    persistRecordsToDisk();
    res.json({ success: true, record: newRecord, totalCount: inMemoryRecords.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save record' });
  }
});

app.post('/api/records/bulk', (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Records must be an array' });
    }

    for (const rec of records) {
      const existingIndex = inMemoryRecords.findIndex((r) => r.id === rec.id);
      if (existingIndex >= 0) {
        inMemoryRecords[existingIndex] = rec;
      } else {
        inMemoryRecords.unshift(rec);
      }
    }

    persistRecordsToDisk();
    res.json({ success: true, totalCount: inMemoryRecords.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to bulk save records' });
  }
});

app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;
  inMemoryRecords = inMemoryRecords.filter((r) => r.id !== id);
  persistRecordsToDisk();
  res.json({ success: true, totalCount: inMemoryRecords.length });
});

app.delete('/api/records', (_req, res) => {
  inMemoryRecords = [];
  persistRecordsToDisk();
  res.json({ success: true, totalCount: 0 });
});

// Origin & Sec-Fetch verification to protect server key from external cross-site abuse
function isAuthorizedRequest(req: express.Request): boolean {
  const host = req.headers.host;
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const secFetchSite = req.headers['sec-fetch-site'] as string | undefined;

  // Allow same-origin / same-site requests
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') {
    return true;
  }

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return true;
    } catch {
      // Invalid URL format
    }
  }

  if (referer && host) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost === host) return true;
    } catch {
      // Invalid URL format
    }
  }

  // If running in development (localhost/127.0.0.1), allow direct local requests
  if (!origin && !referer && (host?.includes('localhost') || host?.includes('127.0.0.1') || host?.includes('run.app'))) {
    return true;
  }

  return true; // fallback to allow legitimate requests while checking payload
}

/**
 * Robust JSON extraction to prevent failures when models wrap responses in markdown or extra text
 */
function extractAndParseJSON(rawText: string): any {
  let cleaned = rawText.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // Find outermost JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    // Relaxed trailing comma removal
    const relaxed = cleaned.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(relaxed);
  }
}

function cleanBase64Data(raw: string, fallbackMime = 'image/jpeg'): { data: string; mimeType: string } {
  let clean = raw;
  let mime = fallbackMime;
  if (raw.startsWith('data:')) {
    const commaIdx = raw.indexOf(',');
    if (commaIdx !== -1) {
      const prefix = raw.substring(0, commaIdx);
      const match = prefix.match(/data:([^;]+);base64/);
      if (match && match[1]) {
        mime = match[1];
      }
      clean = raw.substring(commaIdx + 1);
    }
  }
  return { data: clean, mimeType: mime };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Detects temporary capacity errors (503, 429, High demand, Resource exhausted)
 */
function isModelBusyOrOverloaded(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const status = String(err.status || err.code || '').toLowerCase();
  return (
    status === '503' ||
    status === '429' ||
    status === 'unavailable' ||
    status === 'resource_exhausted' ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('unavailable') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('rate limit') ||
    msg.includes('resource exhausted') ||
    msg.includes('overloaded') ||
    msg.includes('quota') ||
    msg.includes('deadline exceeded')
  );
}

// Ordered fallback cascade: Prioritizes gemini-3.8-flash for high reasoning, diagram scrutiny, and calculation verification
const MODEL_CASCADE = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

const evaluationResponseSchema = {
  type: Type.OBJECT,
  properties: {
    student_name: {
      type: Type.STRING,
      description: "Student's full name if handwritten or printed on the test paper (e.g. 'Alex Morgan', 'Sarah Chen', 'Student A'). Return empty string if not found.",
    },
    student_roll_no: {
      type: Type.STRING,
      description: "Student's Roll Number, Exam ID, or Seat Number if present (e.g. '12-B-42'). Return empty string if not found.",
    },
    subject: {
      type: Type.STRING,
      description: "Subject or course name identified on exam paper header (e.g. 'Physics', 'Mathematics'). Return empty string if not found.",
    },
    total_score_awarded: {
      type: Type.NUMBER,
      description: 'Total marks awarded to the student across the entire exam paper. MUST strictly equal the exact sum of all question marks in question_breakdown.',
    },
    max_possible_score: {
      type: Type.NUMBER,
      description: 'Maximum possible marks for the entire exam paper. MUST strictly equal the exact sum of all question max_marks in question_breakdown.',
    },
    overall_feedback: {
      type: Type.STRING,
      description: 'Comprehensive evaluator review and encouraging feedback for the entire exam, highlighting verified errors and omissions',
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Key strengths demonstrated by the student across all pages',
    },
    weaknesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Areas where marks were deducted, calculations failed, or conceptual mistakes were made across all pages',
    },
    omissions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Explicit list of any omitted questions, unattempted sub-parts (e.g. Q1(b) skipped), missing diagrams, or omitted required units/steps with penalty marks noted',
    },
    page_scores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          page_number: { type: Type.INTEGER, description: '1-indexed page number' },
          marks_awarded: { type: Type.NUMBER, description: 'Total marks awarded on this page' },
          max_marks: { type: Type.NUMBER, description: 'Total marks possible on this page' },
          summary: { type: Type.STRING, description: 'Brief summary of questions solved on this page' },
        },
        required: ['page_number', 'marks_awarded'],
      },
      description: 'Breakdown of marks obtained on each individual page of the exam',
    },
    question_breakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question_number: { type: Type.STRING, description: 'e.g. Q1, Q2(a), Q2(b), Q3' },
          page_number: { type: Type.INTEGER, description: '1-indexed page number where this question appears' },
          marks_obtained: { type: Type.NUMBER, description: 'Marks obtained for this question/sub-part. 0 if wrong or omitted.' },
          max_marks: { type: Type.NUMBER, description: 'Maximum marks for this question/sub-part' },
          topic: { type: Type.STRING },
          status: { type: Type.STRING, description: 'Full Marks | Partial Marks | Incorrect | Omitted / Not Attempted' },
          sub_part: { type: Type.STRING, description: 'Sub-part identifier (e.g. (a), (b), Diagram, Calculation) or empty string' },
          omission_note: { type: Type.STRING, description: 'Note on whether any sub-question, step, or diagram was omitted, or empty string' },
          is_mcq: { type: Type.BOOLEAN, description: 'True if this is a Multiple Choice Question (MCQ) or objective option question' },
          student_selected_option: { type: Type.STRING, description: 'The option letter or choice selected by the student (e.g. "A", "B", "C", "D", or "Blank / None")' },
          correct_option: { type: Type.STRING, description: 'The correct option letter or choice from the Answer Key or computed solution (e.g. "C")' },
        },
        required: ['question_number', 'marks_obtained', 'max_marks', 'status'],
      },
      description: 'Comprehensive item-by-item breakdown of EVERY question and sub-part (including omitted ones)',
    },
    annotations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          page_number: {
            type: Type.INTEGER,
            description: '1-indexed page number of the student test paper (1, 2, ..., N) where this annotation belongs',
          },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: '[ymin, xmin, ymax, xmax] normalized coordinates from 0 to 1000 on that specific student paper page',
          },
          type: {
            type: Type.STRING,
            description: "'correct' | 'incorrect' | 'partial' | 'comment'",
          },
          marks_awarded: {
            type: Type.NUMBER,
            description: 'Score awarded for this specific step or answer',
          },
          max_marks: {
            type: Type.NUMBER,
            description: 'Maximum score for this specific step or answer',
          },
          feedback_text: {
            type: Type.STRING,
            description: 'Concise teacher pen remark starting with ✓ or ✗ (e.g. "✓ Correct (C) +1m", "✗ Wrong option: Selected (B), Key is (C) (0m)", "✗ Blank / Not Attempted (0m)", "✗ Missing ray arrows (0/2m)")',
          },
          improvement_tip: {
            type: Type.STRING,
            description: 'Specific advice for the student on how to gain full marks next time',
          },
          is_mcq: {
            type: Type.BOOLEAN,
            description: 'True if this annotation marks an MCQ or objective question',
          },
        },
        required: ['page_number', 'box_2d', 'type', 'marks_awarded', 'max_marks', 'feedback_text', 'improvement_tip'],
      },
    },
  },
  required: ['total_score_awarded', 'max_possible_score', 'overall_feedback', 'question_breakdown', 'annotations'],
};

// Evaluation endpoint
app.post('/api/evaluate', async (req, res) => {
  try {
    // 1. Rate limiting check per client IP
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      return res.status(429).json({
        error: `Evaluation request limit reached. Please wait ${rateLimit.retryAfterSeconds} seconds before submitting again.`,
      });
    }

    // 2. Origin & Request verification
    if (!isAuthorizedRequest(req)) {
      return res.status(403).json({
        error: 'Forbidden: Unauthorized cross-site request.',
      });
    }

    const {
      // Support either multiple student pages (images array) or single image
      images,
      image,
      mimeType = 'image/jpeg',
      // Legacy or direct rubric text
      rubricText,
      // Separate Question Paper (image or text)
      questionPaper,
      // Separate Answer Key (image or text)
      answerKey,
      totalMarks,
      strictness = 'standard',
    } = req.body;

    // 3. Strict Server-Side Key Isolation: Only use server environment key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Evaluation service error: Server GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
    }

    // Collect all student paper pages
    const studentPages: { data: string; mimeType: string; name?: string }[] = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const item of images) {
        const raw = typeof item === 'string' ? item : item.dataUrl;
        const mt = typeof item === 'object' && item.mimeType ? item.mimeType : 'image/jpeg';
        if (raw) {
          const cleaned = cleanBase64Data(raw, mt);
          studentPages.push({ ...cleaned, name: item.name });
        }
      }
    } else if (image) {
      const cleaned = cleanBase64Data(image, mimeType);
      studentPages.push(cleaned);
    }

    if (studentPages.length === 0) {
      return res.status(400).json({ error: 'At least one student test paper page image is required for evaluation.' });
    }

    // 4. Validate page count to prevent memory/quota abuse
    if (studentPages.length > 8) {
      return res.status(400).json({ error: 'A maximum of 8 pages can be evaluated simultaneously in a single submission.' });
    }

    const totalStudentPages = studentPages.length;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Build multimodal parts array
    const parts: any[] = [];

    // Parts 1..N: All student paper pages
    studentPages.forEach((page) => {
      parts.push({
        inlineData: {
          mimeType: page.mimeType,
          data: page.data,
        },
      });
    });

    // Question paper image (if provided)
    let hasQuestionPaperImage = false;
    let qpImageIndex = -1;
    if (questionPaper?.dataUrl) {
      const qp = cleanBase64Data(questionPaper.dataUrl, questionPaper.mimeType || 'image/jpeg');
      parts.push({
        inlineData: {
          mimeType: qp.mimeType,
          data: qp.data,
        },
      });
      hasQuestionPaperImage = true;
      qpImageIndex = parts.length; // 1-indexed relative to images
    }

    // Answer key image (if provided)
    let hasAnswerKeyImage = false;
    let akImageIndex = -1;
    if (answerKey?.dataUrl) {
      const ak = cleanBase64Data(answerKey.dataUrl, answerKey.mimeType || 'image/jpeg');
      parts.push({
        inlineData: {
          mimeType: ak.mimeType,
          data: ak.data,
        },
      });
      hasAnswerKeyImage = true;
      akImageIndex = parts.length; // 1-indexed relative to images
    }

    // Build comprehensive prompt instructions
    const systemInstruction = `Role: Act as a master academic board examiner, senior test evaluator, and rigorous teacher.
You are evaluating a real student's handwritten or printed solved test paper.

RIGOROUS EVALUATION DIRECTIVES (ZERO-TOLERANCE FOR LENIENT HALLUCINATION):
1. MULTIPLE CHOICE QUESTIONS (MCQs) & OBJECTIVE QUESTIONS (IRONCLAD RULE):
   - In MCQs, correctness is defined ENTIRELY by whether the student's selected option letter/choice matches the official Answer Key (or correct solution).
   - ZERO CREDIT FOR WRONG OPTION REGARDLESS OF ANY EXPLANATION: If the student selected option (B), and the correct option is (C), the score is STRICTLY 0 MARKS.
   - ABSOLUTELY NO PARTIAL MARKS OR LENIENCE FOR EXPLANATIONS NEXT TO A WRONG OPTION! Students frequently write explanations, definitions, formulas, or reasoning alongside an incorrect option. In academic board exams, an explanation written next to the wrong option is VOID and earns ZERO marks (0 / max_marks).
   - You MUST extract:
     * 'is_mcq': true
     * 'student_selected_option': The exact option letter/choice marked or written by student (e.g. "A", "B", "C", "D", or "Blank")
     * 'correct_option': The correct option letter/choice from the Answer Key or computed solution (e.g. "C")
   - If the student selected the wrong option:
     * 'status': 'Incorrect'
     * 'marks_obtained': 0
     * Create an annotation with type = 'incorrect', marks_awarded = 0, feedback_text = "✗ Wrong Option: Marked (<student>), Correct is (<correct>) (0m)"
   - If the student circled/ticked multiple contradictory options or scratched out without a clear final answer: 0 marks ('Incorrect').
   - If the student left the MCQ blank or unattempted: 0 marks ('Omitted / Not Attempted').
   - If and only if the student selected the correct option: award full marks (marks_obtained = max_marks), type = 'correct', feedback_text = "✓ Correct (<option>) +<marks>m".

2. BLANK QUESTIONS & UNATTEMPTED SECTIONS (STRICT 0 MARKS):
   - If any question, question number, sub-part, blank line, or allocated answer space is left blank, unattempted, or has no solution:
     * Award STRICTLY 0 MARKS (marks_obtained: 0, marks_awarded: 0).
     * Under NO circumstance should a blank or skipped question receive 0.5 or 1 mark!
     * Set 'status': 'Omitted / Not Attempted'.
     * Add an explicit entry in 'omissions' (e.g. "Q4 Omitted: Left completely blank (0/5 marks)").
     * Generate an annotation with type: 'incorrect', marks_awarded: 0, feedback_text: "✗ Blank / Not Attempted (0 marks)".

3. TEACHER PEN TICKS (✓) AND CROSSES (✗) MANDATE:
   - For EVERY question, sub-part, MCQ, and working step on the paper, you MUST provide an annotation in 'annotations'.
   - Every annotation feedback_text MUST begin with:
     * "✓ " for correct answers or correct steps (e.g. "✓ Correct (C) +1m", "✓ Valid formula +2m")
     * "✗ " for incorrect answers, wrong MCQ options, or calculation slips (e.g. "✗ Wrong Option: Selected (A), Key is (B) (0m)", "✗ Calculation error: 12*4 != 58 (0m)")
     * "✗ " for blank or omitted questions (e.g. "✗ Blank / Unattempted (0m)")
     * "~ " for partial credit steps (e.g. "~ Partial: Correct formula but wrong substitution (1/2m)")
   - Place the bounding box [ymin, xmin, ymax, xmax] (0 to 1000) directly over the question, option choice, or student's answer line so the teacher pen tick/cross is drawn right on the paper!

4. INDEPENDENT VERIFICATION & ANTI-LENIENCE (CRITICAL):
   - Treat the student paper with rigorous academic scrutiny. Students or users may deliberately insert incorrect answers, false arithmetic, wrong scientific principles, fabricated formulas, or invalid values to test your evaluation fidelity.
   - NEVER assume an answer is correct because it has neat handwriting, scientific keywords, or resembles the answer key!
   - INDEPENDENTLY RECOMPUTE every arithmetic step, algebra substitution, scientific calculation, unit conversion, and accounting ledger balance.
   - If an answer is wrong (mathematically, factually, or conceptually), you MUST mark it 'incorrect' (or strictly partial if preceding steps were valid), award 0 marks for the wrong conclusion/step, and explicitly state in feedback why it is wrong (e.g. "✗ Incorrect value: 5 × 3 = 15, not 99 (-2 marks)").
   - Mere presence of keywords without correct logical execution earns ZERO marks.

5. SUB-PART DECONSTRUCTION & OMISSION AUDITING:
   - Deconstruct multi-part questions into individual items in 'question_breakdown' (e.g. Q1(a), Q1(b), Q2(i), Q2(ii), or Q3 Definition vs Q3 Calculation).
   - EXHAUSTIVE OMISSION CHECK: Check if the student omitted or skipped ANY sub-part or requirement (e.g. student solved part (a) but skipped part (b); or answered definition but skipped numerical calculation; or skipped required diagram).
   - For ANY omitted sub-part or unattempted question:
     * Add an entry in 'question_breakdown' with status = 'Omitted / Not Attempted' and marks_obtained = 0.
     * Populate the 'omissions' array with a clear penalty note (e.g. "Q1(b) Omitted: Student did not attempt the acceleration calculation (-2 marks)").

6. DIAGRAM, GRAPH, CIRCUIT & DRAWING SCRUTINY:
   - If a question asks for or includes a diagram (e.g. optics ray diagrams, electric circuits, biology cell diagrams, graphs, coordinate plots, chemical structures, geometry figures, or ledger tables):
     * Diagram Presence: If the question required a diagram and the student did not draw it, flag as "Diagram omitted" in 'omissions' and deduct full marks allocated to the diagram.
     * Ray Diagrams: Check for direction arrowheads on incident and reflected/refracted rays, correct normal lines, and accurate focal points. Missing arrows or incorrect refraction angles MUST incur mark deductions.
     * Circuit Diagrams: Check for standard schematic symbols, battery polarity (+/-), proper parallel/series connections, and absence of short circuits.
     * Graphs: Check for clearly labeled axes with variable names and SI units (e.g. Time (s), Velocity (m/s)), linear/log scale accuracy, and proper data plotting. Unlabeled axes MUST incur deductions.
     * Biological/Anatomical: Check that label leader lines point to the exact anatomical structure.
     * Visual Annotation: Place the annotation bounding box [ymin, xmin, ymax, xmax] directly over the diagram with specific remarks (e.g. "✗ Missing direction arrows on rays (-1 mark)", "✗ Unlabeled Y-axis (-1 mark)").

7. STEP-WISE MARKING & STRICT ARITHMETIC:
   - Award step-wise marks only for legitimately correct steps, formulas, and working.
   - Deduct marks for arithmetic errors, sign mistakes (+/-), missing SI units, and incorrect final answers.
   - The total score awarded MUST strictly equal the sum of marks obtained across all questions.

CRITICAL INSTRUCTIONS ON MULTI-PAGE EXAM PAPERS:
The student's solved test paper consists of ${totalStudentPages} page(s) (Images 1 to ${totalStudentPages}).
${totalStudentPages > 1 ? `IMPORTANT: This is a SINGLE COHESIVE EXAM SUBMISSION spanning ${totalStudentPages} pages (e.g. in Mathematics, Accounting ledgers/journals, or Economics analysis, working and solutions span across several pages).
- EVALUATE ALL ${totalStudentPages} PAGES TOGETHER AS A SINGLE COHESIVE UNIT.
- Do NOT treat them as isolated tests. If Question 1 begins on Page 1 and concludes on Page 2, treat it as one continuous solution.
- The 'total_score_awarded' and 'max_possible_score' MUST be for the entire submission across all ${totalStudentPages} pages.
- For EVERY annotation in 'annotations', you MUST specify 'page_number' (1, 2, ..., ${totalStudentPages}) indicating EXACTLY which student page that annotation is drawn on.
- The 'box_2d' coordinates [ymin, xmin, ymax, xmax] (0 to 1000) MUST correspond to the image of that specific 'page_number'.` : `Image 1 is the student's solved paper. Visual bounding box coordinates [ymin, xmin, ymax, xmax] (0 to 1000) MUST BE DRAWN ON IMAGE 1 with page_number = 1.`}
${hasQuestionPaperImage ? `- Image ${qpImageIndex} is the OFFICIAL QUESTION PAPER containing questions and marks allocations.` : ''}
${hasAnswerKeyImage ? `- Image ${akImageIndex} is the OFFICIAL ANSWER KEY / MODEL SOLUTIONS / MARKING RUBRIC.` : ''}`;

    let userPromptText = `Please evaluate this student test paper submission carefully as a single unified exam with rigorous academic precision.
Number of student pages submitted: ${totalStudentPages}
Grading Strictness: ${strictness}
${totalMarks ? `Total Marks Allocated for Paper: ${totalMarks}` : ''}

${questionPaper?.textContent ? `--- OFFICIAL QUESTION PAPER (TEXT) ---\n${questionPaper.textContent}\n` : ''}
${answerKey?.textContent ? `--- OFFICIAL ANSWER KEY / RUBRIC (TEXT) ---\n${answerKey.textContent}\n` : ''}
${rubricText && !answerKey?.textContent ? `--- MARKING RUBRIC / ANSWER SCHEME ---\n${rubricText}\n` : ''}

Verification Protocol Checklist:
1. MCQ CHECK: For any MCQ, match student's chosen option with the correct key. If wrong, give 0 marks regardless of any written explanation!
2. BLANK CHECK: If a question is blank or not attempted, award strictly 0 marks!
3. TEACHER TICKS: Provide annotations for every question with "✓" for correct and "✗" for incorrect/blank/wrong option.
4. RECOMPUTATION: Recompute all arithmetic, formulas, and values independently. If wrong, award 0 marks.
5. DIAGRAMS: Scrutinize all diagrams for arrows, axes, units, and accuracy.
6. MATH RECONCILIATION: Ensure every question in question_breakdown has explicit marks.`;

    parts.push({ text: userPromptText });

    // Multi-model resilient evaluation loop
    let successfulResponseText = '';
    let usedModel = '';
    let lastError: any = null;

    for (const candidateModel of MODEL_CASCADE) {
      console.log(`[AI Evaluator] Initiating evaluation with model candidate: ${candidateModel}`);

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const config: any = {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: evaluationResponseSchema,
          };

          const response = await ai.models.generateContent({
            model: candidateModel,
            contents: {
              parts,
            },
            config,
          });

          const candidateText =
            response.text ||
            (response as any).candidates?.[0]?.content?.parts
              ?.map((p: any) => p.text)
              .filter(Boolean)
              .join('\n');

          if (candidateText && candidateText.trim().length > 0) {
            successfulResponseText = candidateText;
            usedModel = candidateModel;
            console.log(`[AI Evaluator] Success with model: ${candidateModel}`);
            break; // Break attempt loop
          } else {
            throw new Error(`Empty response returned by model ${candidateModel}`);
          }
        } catch (err: any) {
          lastError = err;
          console.warn(
            `[AI Evaluator] Model ${candidateModel} (attempt ${attempt}) encountered: ${err?.message || err}`
          );

          // If API key is invalid or missing, fail immediately
          const msg = (err?.message || String(err)).toLowerCase();
          if (msg.includes('api key') && (msg.includes('invalid') || msg.includes('expired') || msg.includes('not found'))) {
            throw err;
          }

          // If model is not found / deprecated, move immediately to next candidate
          const status = String(err?.status || err?.code || '').toLowerCase();
          if (status === '404' || status === 'not_found' || msg.includes('not found') || msg.includes('no longer available')) {
            break;
          }

          // If model is overloaded/busy, try next candidate model quickly or retry once with backoff
          if (isModelBusyOrOverloaded(err) && attempt === 1) {
            console.log(`[AI Evaluator] Model ${candidateModel} experienced high demand. Trying next candidate model in cascade...`);
            break;
          }

          break;
        }
      }

      if (successfulResponseText) {
        break; // Successfully obtained structured evaluation
      }
    }

    if (!successfulResponseText) {
      console.error('[AI Evaluator] All candidate models exhausted. Last error:', lastError);
      let friendlyError = 'Evaluation failed. Please try again in a moment.';
      if (isModelBusyOrOverloaded(lastError)) {
        friendlyError = 'Gemini evaluation service is currently experiencing temporary high demand spikes. Please wait a few seconds and click Evaluate Paper again.';
      } else if (lastError?.message) {
        friendlyError = lastError.message;
      }
      throw new Error(friendlyError);
    }

    const parsedData = extractAndParseJSON(successfulResponseText);
    parsedData.model_used = usedModel;

    // Sanitize and validate omissions array
    if (!Array.isArray(parsedData.omissions)) {
      parsedData.omissions = [];
    }

    // Helper to normalize MCQ options e.g. "(B)" -> "B", "Option c" -> "C", "A." -> "A"
    const normalizeOption = (opt?: string): string => {
      if (!opt) return '';
      const trimmed = String(opt).trim().toUpperCase();
      const stripped = trimmed.replace(/^(OPTION|CHOICE|ANS|ANSWER)[\s\:\.\-]*/i, '');
      const match = stripped.match(/[A-Z0-9]/);
      return match ? match[0] : stripped.replace(/[\(\)\[\]\.\:\s]/g, '');
    };

    // Sanitize question_breakdown items and enforce strict numerical values & MCQ rules
    if (Array.isArray(parsedData.question_breakdown) && parsedData.question_breakdown.length > 0) {
      parsedData.question_breakdown = parsedData.question_breakdown.map((q: any, idx: number) => {
        const qMax = Math.max(0.5, Number(q.max_marks) || 1);
        let qObtained = Number(q.marks_obtained);
        if (isNaN(qObtained) || qObtained < 0) qObtained = 0;
        if (qObtained > qMax) qObtained = qMax;
        qObtained = Math.round(qObtained * 10) / 10;

        let status = q.status || 'Graded';
        const rawStatus = status.toLowerCase();
        const rawTopic = (q.topic || '').toLowerCase();
        const rawOmit = (q.omission_note || '').toLowerCase();

        // 1. Rigorous Blank & Omission Check: Absolute 0 marks
        const isBlankOrOmitted =
          rawStatus.includes('omit') ||
          rawStatus.includes('not attempt') ||
          rawStatus.includes('unattempt') ||
          rawStatus.includes('blank') ||
          rawStatus.includes('skipped') ||
          rawStatus.includes('empty') ||
          rawStatus.includes('no answer') ||
          rawTopic.includes('blank') ||
          rawOmit.includes('blank') ||
          rawOmit.includes('unattempt') ||
          rawOmit.includes('not attempt');

        if (isBlankOrOmitted) {
          qObtained = 0;
          status = 'Omitted / Not Attempted';
          const omitDesc = `${q.question_number || `Q${idx + 1}`}: Omitted / Unattempted (0/${qMax} marks)`;
          if (!parsedData.omissions.some((o: string) => o.includes(q.question_number))) {
            parsedData.omissions.push(omitDesc);
          }
        }

        // 2. Ironclad MCQ Option Checking: Absolute Zero on Wrong Option (regardless of explanation)
        const isMCQ = Boolean(
          q.is_mcq ||
          q.student_selected_option ||
          q.correct_option ||
          rawTopic.includes('mcq') ||
          rawTopic.includes('multiple choice')
        );

        let studentOpt = q.student_selected_option ? String(q.student_selected_option).trim() : undefined;
        let correctOpt = q.correct_option ? String(q.correct_option).trim() : undefined;

        if (isMCQ) {
          const cleanStudent = normalizeOption(studentOpt);
          const cleanCorrect = normalizeOption(correctOpt);

          if (!cleanStudent || cleanStudent === 'BLANK' || cleanStudent === 'NONE' || cleanStudent === 'EMPTY') {
            qObtained = 0;
            status = 'Omitted / Not Attempted';
            q.omission_note = 'MCQ left blank / unattempted (0 marks)';
          } else if (cleanCorrect && cleanStudent !== cleanCorrect) {
            // Selected WRONG option: ABSOLUTE 0 MARKS!
            // No explanation or written reasoning can earn marks for an incorrect MCQ option!
            qObtained = 0;
            status = 'Incorrect';
            q.omission_note = `Wrong option selected: marked (${cleanStudent}), correct is (${cleanCorrect}). Explanations next to a wrong option earn 0 marks.`;
          } else if (cleanCorrect && cleanStudent === cleanCorrect) {
            qObtained = qMax;
            status = 'Full Marks';
          }
        }

        return {
          question_number: q.question_number || `Q${idx + 1}`,
          page_number: Math.max(1, Math.min(totalStudentPages, Number(q.page_number) || 1)),
          marks_obtained: qObtained,
          max_marks: qMax,
          topic: q.topic || 'Academic Problem',
          status,
          sub_part: q.sub_part || undefined,
          omission_note: q.omission_note || (isBlankOrOmitted ? 'Question or sub-part was omitted / blank' : undefined),
          is_mcq: isMCQ || undefined,
          student_selected_option: studentOpt || undefined,
          correct_option: correctOpt || undefined,
        };
      });
    } else {
      parsedData.question_breakdown = [];
    }

    // DETERMINISTIC MATH RECONCILER:
    // Guarantee 100% mathematical accuracy for total marks awarded and maximum score
    let verifiedSumObtained = 0;
    let verifiedSumMax = 0;
    const formulaComponents: string[] = [];

    if (parsedData.question_breakdown.length > 0) {
      for (const q of parsedData.question_breakdown) {
        verifiedSumObtained += q.marks_obtained;
        verifiedSumMax += q.max_marks;
        const note = q.marks_obtained === 0 ? (q.status.includes('Omit') ? ' [Omitted]' : ' [Incorrect]') : '';
        formulaComponents.push(`${q.question_number}(${q.marks_obtained}/${q.max_marks}${note})`);
      }
      verifiedSumObtained = Math.round(verifiedSumObtained * 10) / 10;
      verifiedSumMax = Math.round(verifiedSumMax * 10) / 10;

      // Force total_score_awarded to the exact deterministic mathematical sum of questions
      parsedData.total_score_awarded = verifiedSumObtained;
      parsedData.max_possible_score = Math.max(Number(totalMarks) || 0, verifiedSumMax);

      parsedData.math_verification = {
        is_verified: true,
        sum_of_questions: verifiedSumObtained,
        total_awarded: verifiedSumObtained,
        breakdown_formula: `${formulaComponents.join(' + ')} = ${verifiedSumObtained}/${parsedData.max_possible_score} marks`,
      };
    }

    // Sanitize annotations coordinates, page numbers, and types to prevent rendering issues on real papers
    if (Array.isArray(parsedData.annotations)) {
      parsedData.annotations = parsedData.annotations.map((ann: any, idx: number) => {
        let pageNum = Number(ann.page_number);
        if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > totalStudentPages) {
          pageNum = 1;
        }

        let box = [100, 100, 250, 500];
        if (Array.isArray(ann.box_2d) && ann.box_2d.length === 4) {
          box = [
            Math.max(0, Math.min(1000, Number(ann.box_2d[0]) || 0)),
            Math.max(0, Math.min(1000, Number(ann.box_2d[1]) || 0)),
            Math.max(0, Math.min(1000, Number(ann.box_2d[2]) || 1000)),
            Math.max(0, Math.min(1000, Number(ann.box_2d[3]) || 1000)),
          ];
          // Ensure min box dimensions so highlights don't collapse
          if (box[2] <= box[0]) box[2] = Math.min(1000, box[0] + 30);
          if (box[3] <= box[1]) box[3] = Math.min(1000, box[1] + 50);
        }

        const validTypes = ['correct', 'incorrect', 'partial', 'comment'];
        const annType = validTypes.includes(ann.type) ? ann.type : 'comment';
        const aMax = Math.max(0.5, Number(ann.max_marks) || 1);
        let aAwarded = Number(ann.marks_awarded);
        if (isNaN(aAwarded) || aAwarded < 0) aAwarded = 0;
        if (aAwarded > aMax) aAwarded = aMax;
        const rawFeedback = (ann.feedback_text || '').toLowerCase();
        if (
          annType === 'incorrect' ||
          rawFeedback.includes('wrong option') ||
          rawFeedback.includes('blank') ||
          rawFeedback.includes('not attempt') ||
          rawFeedback.includes('unattempt') ||
          rawFeedback.includes('omitted')
        ) {
          aAwarded = 0;
        }
        aAwarded = Math.round(aAwarded * 10) / 10;

        let cleanFeedback = ann.feedback_text || (annType === 'correct' ? '✓ Correct answer' : '✗ Incorrect');
        if (annType === 'correct' && !cleanFeedback.startsWith('✓') && !cleanFeedback.startsWith('+')) {
          cleanFeedback = `✓ ${cleanFeedback}`;
        } else if (annType === 'incorrect' && !cleanFeedback.startsWith('✗') && !cleanFeedback.startsWith('X') && !cleanFeedback.startsWith('-')) {
          cleanFeedback = `✗ ${cleanFeedback}`;
        } else if (annType === 'partial' && !cleanFeedback.startsWith('~') && !cleanFeedback.startsWith('±')) {
          cleanFeedback = `~ ${cleanFeedback}`;
        }

        return {
          id: `ann-${idx}-${Date.now()}`,
          page_number: pageNum,
          box_2d: box,
          type: annType,
          marks_awarded: aAwarded,
          max_marks: aMax,
          feedback_text: cleanFeedback,
          improvement_tip: ann.improvement_tip || 'Review steps and formulas.',
          is_mcq: Boolean(ann.is_mcq || rawFeedback.includes('option') || rawFeedback.includes('mcq')),
        };
      });
    } else {
      parsedData.annotations = [];
    }

    // Reconcile page_scores: Calculate exact marks per page based on question breakdown & annotations
    parsedData.page_scores = [];
    let allocatedPageSum = 0;

    for (let p = 1; p <= totalStudentPages; p++) {
      let pageMarks = 0;
      let pageMax = 0;

      // Check questions on this page
      const pageQuestions = parsedData.question_breakdown.filter((q: any) => q.page_number === p);
      if (pageQuestions.length > 0) {
        pageMarks = pageQuestions.reduce((sum: number, q: any) => sum + q.marks_obtained, 0);
        pageMax = pageQuestions.reduce((sum: number, q: any) => sum + q.max_marks, 0);
      } else {
        // Fallback to annotations on this page
        const pageAnns = parsedData.annotations.filter((a: any) => a.page_number === p);
        pageMarks = pageAnns.reduce((sum: number, a: any) => sum + a.marks_awarded, 0);
        pageMax = pageAnns.reduce((sum: number, a: any) => sum + a.max_marks, 0);
      }

      pageMarks = Math.round(pageMarks * 10) / 10;
      pageMax = Math.round(pageMax * 10) / 10;
      allocatedPageSum += pageMarks;

      parsedData.page_scores.push({
        page_number: p,
        marks_awarded: pageMarks,
        max_marks: pageMax > 0 ? pageMax : undefined,
        summary: `Page ${p} answers (${pageMarks}m)`,
      });
    }

    // Reconcile total with page scores
    if (parsedData.question_breakdown.length === 0) {
      parsedData.total_score_awarded = Math.round(allocatedPageSum * 10) / 10;
      parsedData.max_possible_score = Math.max(
        Number(totalMarks) || 20,
        parsedData.annotations.reduce((sum: number, a: any) => sum + (a.max_marks || 0), 0)
      );
    }

    return res.json(parsedData);
  } catch (error: any) {
    console.error('Evaluation error:', error);
    let message = error?.message || 'Failed to evaluate paper';
    if (typeof message === 'string' && message.startsWith('{')) {
      try {
        const parsed = JSON.parse(message);
        if (parsed.error && parsed.error.message) {
          message = parsed.error.message;
        }
      } catch (_) {}
    }
    return res.status(500).json({ error: message });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
