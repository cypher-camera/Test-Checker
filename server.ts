import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Support large payloads for multi-page high-resolution test paper scans
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasEnvKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

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

// Ordered fallback cascade: Starts with standard gemini-3.8-flash, then gemini-3.6-flash, gemini-3.1-flash-lite, and gemini-flash-latest
const MODEL_CASCADE = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

const evaluationResponseSchema = {
  type: Type.OBJECT,
  properties: {
    total_score_awarded: {
      type: Type.NUMBER,
      description: 'Total marks awarded to the student across the entire exam paper',
    },
    max_possible_score: {
      type: Type.NUMBER,
      description: 'Maximum possible marks for the entire exam paper',
    },
    overall_feedback: {
      type: Type.STRING,
      description: 'Comprehensive evaluator review and encouraging feedback for the entire exam',
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Key strengths demonstrated by the student across all pages',
    },
    weaknesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Areas where marks were deducted or conceptual mistakes were made across all pages',
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
          question_number: { type: Type.STRING, description: 'e.g. Q1, Q2(a)' },
          page_number: { type: Type.INTEGER, description: '1-indexed page number where this question appears' },
          marks_obtained: { type: Type.NUMBER },
          max_marks: { type: Type.NUMBER },
          topic: { type: Type.STRING },
          status: { type: Type.STRING, description: 'Full Marks | Partial Marks | Incorrect | Blank' },
        },
        required: ['question_number', 'marks_obtained', 'max_marks'],
      },
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
            description: 'Concise teacher pen remark (e.g. "+3/3 Complete derivation", "✗ Incomplete formula")',
          },
          improvement_tip: {
            type: Type.STRING,
            description: 'Specific advice for the student on how to gain full marks next time',
          },
        },
        required: ['page_number', 'box_2d', 'type', 'marks_awarded', 'max_marks', 'feedback_text', 'improvement_tip'],
      },
    },
  },
  required: ['total_score_awarded', 'max_possible_score', 'overall_feedback', 'annotations'],
};

// Evaluation endpoint
app.post('/api/evaluate', async (req, res) => {
  try {
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

    const totalStudentPages = studentPages.length;

    // Determine API key: prefer header key (from user UI), fallback to environment
    const userApiKey = req.headers['x-gemini-api-key'] as string | undefined;
    const apiKey = (userApiKey && userApiKey.trim().length > 0) ? userApiKey.trim() : process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(401).json({
        error: 'Gemini API key is required. Please provide your Google AI Studio API key in the header input field or configure GEMINI_API_KEY in Settings > Secrets.',
      });
    }

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
    const systemInstruction = `Role: Act as a master board exam evaluator, senior academic examiner, and professional teacher.
You are evaluating a real student's handwritten or printed solved test paper.

CRITICAL INSTRUCTIONS ON MULTI-PAGE EXAM PAPERS:
The student's solved test paper consists of ${totalStudentPages} page(s) (Images 1 to ${totalStudentPages}).
${totalStudentPages > 1 ? `IMPORTANT: This is a SINGLE COHESIVE EXAM SUBMISSION spanning ${totalStudentPages} pages (e.g. in Mathematics, Accounting ledgers/journals, or Economics analysis, working and solutions span across several pages).
- EVALUATE ALL ${totalStudentPages} PAGES TOGETHER AS A SINGLE COHESIVE UNIT.
- Do NOT treat them as isolated tests. For example, if Question 1 begins on Page 1 and concludes on Page 2, treat it as one continuous solution.
- The 'total_score_awarded' and 'max_possible_score' MUST be for the entire submission across all ${totalStudentPages} pages.
- For EVERY annotation in 'annotations', you MUST specify 'page_number' (1, 2, ..., ${totalStudentPages}) indicating EXACTLY which student page that annotation is drawn on.
- The 'box_2d' coordinates [ymin, xmin, ymax, xmax] (0 to 1000) MUST correspond to the image of that specific 'page_number'.` : `Image 1 is the student's solved paper. Visual bounding box coordinates [ymin, xmin, ymax, xmax] (0 to 1000) MUST BE DRAWN ON IMAGE 1 with page_number = 1.`}
${hasQuestionPaperImage ? `- Image ${qpImageIndex} is the OFFICIAL QUESTION PAPER containing questions and marks allocations.` : ''}
${hasAnswerKeyImage ? `- Image ${akImageIndex} is the OFFICIAL ANSWER KEY / MODEL SOLUTIONS / MARKING RUBRIC.` : ''}

EVALUATION METHODOLOGY:
1. OCR and read student answers across all pages with high tolerance for messy handwriting, calculations, scratch-outs, margin notes, and ink colors.
2. Match student answers to the corresponding questions from the Question Paper (or questions present on the test sheet).
3. Evaluate correctness against the provided Answer Key / Model Solution (or standard academic concepts).
4. Assign step-wise marks: award partial marks for correct formulas, ledger formats, and intermediate steps, deduct for arithmetic errors, missing units, or incorrect conclusions.
5. Provide precise normalized 2D bounding boxes [ymin, xmin, ymax, xmax] scaled strictly 0 to 1000 on the student's paper for each annotation, tagged with the corresponding page_number.
6. Provide 'page_scores' with the marks obtained on each page (page_number: 1..${totalStudentPages}).
7. Feedback texts should look like authentic teacher pen remarks (e.g. "+3/3 Complete ledger balance", "-1 Missing SI units (m/s²)", "✓ Clean derivation step").`;

    let userPromptText = `Please evaluate this student test paper submission carefully as a single unified exam.
Number of student pages submitted: ${totalStudentPages}
Grading Strictness: ${strictness}
${totalMarks ? `Total Marks Allocated for Paper: ${totalMarks}` : ''}

${questionPaper?.textContent ? `--- OFFICIAL QUESTION PAPER (TEXT) ---\n${questionPaper.textContent}\n` : ''}
${answerKey?.textContent ? `--- OFFICIAL ANSWER KEY / RUBRIC (TEXT) ---\n${answerKey.textContent}\n` : ''}
${rubricText && !answerKey?.textContent ? `--- MARKING RUBRIC / ANSWER SCHEME ---\n${rubricText}\n` : ''}

Tasks:
1. Analyze student handwriting, calculations, diagrams, and answers visible across all ${totalStudentPages} page(s).
2. Cross-reference with the Question Paper and Answer Key provided.
3. Compute total score awarded out of maximum possible marks for the entire exam.
4. Output page_scores, questions breakdown (with page_number), overall feedback, strengths, and weaknesses.
5. Produce visual annotations with page_number and normalized [ymin, xmin, ymax, xmax] (0-1000) coordinates located on each student page.`;

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

          // thinkingConfig is only valid on 3.x models
          if (candidateModel.includes('3.')) {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
          }

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
        friendlyError = 'Gemini models are currently experiencing temporary high demand spikes. Please wait 5-10 seconds and click Evaluate again, or provide your personal Gemini API key in the top bar.';
      } else if (lastError?.message) {
        friendlyError = lastError.message;
      }
      throw new Error(friendlyError);
    }

    const parsedData = extractAndParseJSON(successfulResponseText);
    parsedData.model_used = usedModel;

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

        return {
          id: `ann-${idx}-${Date.now()}`,
          page_number: pageNum,
          box_2d: box,
          type: annType,
          marks_awarded: typeof ann.marks_awarded === 'number' ? ann.marks_awarded : 0,
          max_marks: typeof ann.max_marks === 'number' ? ann.max_marks : 1,
          feedback_text: ann.feedback_text || 'Teacher note',
          improvement_tip: ann.improvement_tip || 'Review steps and formulas.',
        };
      });
    } else {
      parsedData.annotations = [];
    }

    // Ensure or synthesize page_scores
    if (!Array.isArray(parsedData.page_scores) || parsedData.page_scores.length === 0) {
      parsedData.page_scores = [];
      for (let p = 1; p <= totalStudentPages; p++) {
        const pAnns = parsedData.annotations.filter((a: any) => a.page_number === p);
        const pScore = pAnns.reduce((sum: number, a: any) => sum + (a.marks_awarded || 0), 0);
        const pMax = pAnns.reduce((sum: number, a: any) => sum + (a.max_marks || 0), 0);
        parsedData.page_scores.push({
          page_number: p,
          marks_awarded: pScore,
          max_marks: pMax > 0 ? pMax : undefined,
          summary: `Page ${p} answers`,
        });
      }
    } else {
      // Validate page_scores
      parsedData.page_scores = parsedData.page_scores.map((ps: any, idx: number) => ({
        page_number: Number(ps.page_number) || (idx + 1),
        marks_awarded: typeof ps.marks_awarded === 'number' ? ps.marks_awarded : 0,
        max_marks: typeof ps.max_marks === 'number' ? ps.max_marks : undefined,
        summary: ps.summary || `Page ${idx + 1}`,
      }));
    }

    // Ensure score numbers are valid
    if (typeof parsedData.total_score_awarded !== 'number') {
      parsedData.total_score_awarded = parsedData.annotations.reduce(
        (sum: number, a: any) => sum + (a.marks_awarded || 0),
        0
      );
    }
    if (typeof parsedData.max_possible_score !== 'number') {
      parsedData.max_possible_score = Math.max(
        totalMarks || 20,
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
