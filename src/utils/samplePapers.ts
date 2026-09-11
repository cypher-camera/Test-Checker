import { EvaluationResult, SupportingDocument } from '../types';

export interface SamplePaper {
  id: string;
  title: string;
  subject: string;
  totalMarks: number;
  rubric: string;
  questionPaperDoc?: SupportingDocument;
  answerKeyDoc?: SupportingDocument;
  defaultEvaluation: EvaluationResult;
  generateImage: () => string; // returns base64 data URL
  generatePages?: () => { name: string; dataUrl: string }[];
}

/**
 * Creates a high-res realistic student exam paper canvas and returns dataUrl
 */
function createPhysicsExamCanvas(): string {
  const width = 1200;
  const height = 1600;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Paper background (slightly warm off-white parchment/notebook)
  ctx.fillStyle = '#faf9f6';
  ctx.fillRect(0, 0, width, height);

  // 2. Ruled notebook lines
  const lineHeight = 42;
  const topMargin = 220;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.2;
  for (let y = topMargin; y < height - 50; y += lineHeight) {
    ctx.beginPath();
    ctx.moveTo(70, y);
    ctx.lineTo(width - 70, y);
    ctx.stroke();
  }

  // Left red margin line
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(170, 70);
  ctx.lineTo(170, height - 50);
  ctx.stroke();

  // 3. Exam Header (Printed typography)
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CENTRAL BOARD EXAMINATION - TERM II (2026)', width / 2, 75);

  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('SUBJECT: PHYSICS (THEORY)  |  MAX MARKS: 20  |  TIME: 45 MINS', width / 2, 110);

  // Student Details box
  ctx.textAlign = 'left';
  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('Student Name: Alex Morgan', 190, 160);
  ctx.fillText('Roll No: 12-B-42', 650, 160);
  ctx.fillText('Date: 08-Sept-2026', 950, 160);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(170, 130, width - 240, 45);

  // 4. Student Handwritten Answers in Fountain Pen Blue (#1e3a8a / #1d4ed8)
  ctx.fillStyle = '#1e3a8a';

  // --- QUESTION 1 ---
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Q1.', 100, 255);
  ctx.fillText('A 5 kg block rests on a rough horizontal floor (μ = 0.2). A force of 20 N is applied.', 190, 255);
  ctx.fillText('Calculate: (a) Frictional Force, (b) Net Acceleration of the block. [5 Marks]', 190, 285);

  // Student answer
  ctx.font = '700 24px "Caveat", cursive';
  ctx.fillStyle = '#1d4ed8';

  // Step 1: Normal force
  ctx.fillText('Sol: Given m = 5 kg, F = 20 N, μ = 0.2', 195, 340);
  ctx.fillText('Normal force N = m × g = 5 × 9.8 = 49 N', 195, 382);

  // Step 2: Frictional force
  ctx.fillText('(a) Maximum static friction f_s = μ × N', 195, 424);
  ctx.fillText('    f_k = 0.2 × 49 = 9.8 N', 195, 466);
  ctx.fillText('    Hence frictional force opposing motion = 9.8 N', 195, 508);

  // Step 3: Net acceleration
  ctx.fillText('(b) Net force F_net = F_applied - f_k', 195, 550);
  ctx.fillText('    F_net = 20 - 9.8 = 10.2 N', 195, 592);
  ctx.fillText('    Acceleration a = F_net / m = 10.2 / 5 = 2.04', 195, 634); // NOTE: Missing unit m/s^2 !

  // Diagram drawn by student
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 2;
  // Floor
  ctx.beginPath();
  ctx.moveTo(760, 480);
  ctx.lineTo(1050, 480);
  ctx.stroke();
  // Block
  ctx.strokeRect(840, 410, 100, 70);
  ctx.fillStyle = '#1e293b';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('5 kg', 872, 452);

  // Arrows
  ctx.fillStyle = '#1d4ed8';
  ctx.font = '700 18px "Caveat", cursive';
  ctx.fillText('F = 20N →', 955, 440);
  ctx.fillText('← f_k', 790, 470);
  ctx.fillText('N ↑', 885, 395);
  ctx.fillText('↓ mg', 880, 510);

  // --- QUESTION 2 ---
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Q2.', 100, 725);
  ctx.fillText('State the Principle of Conservation of Linear Momentum. Under what condition is it valid?', 190, 725);
  ctx.fillText('Give one real-life example. [5 Marks]', 190, 755);

  ctx.font = '700 24px "Caveat", cursive';
  ctx.fillStyle = '#1d4ed8';
  ctx.fillText('Ans: The law of conservation of linear momentum states that the total momentum', 195, 810);
  ctx.fillText('of a system before collision is equal to total momentum after collision.', 195, 852);
  ctx.fillText('Condition: It holds true whenever energy is conserved in the universe.', 195, 894); // INCORRECT condition! Should be zero external force!
  ctx.fillText('Example: Recoil of a heavy gun when a bullet is fired from it.', 195, 936);

  // --- QUESTION 3 ---
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Q3.', 100, 1030);
  ctx.fillText('A ball of mass 0.5 kg is thrown vertically upward with speed 20 m/s.', 190, 1030);
  ctx.fillText('Find: (a) Maximum height reached, (b) Time taken to return to ground. (Take g = 10 m/s²) [5 Marks]', 190, 1060);

  ctx.font = '700 24px "Caveat", cursive';
  ctx.fillStyle = '#1d4ed8';
  ctx.fillText('Sol: Initial velocity u = 20 m/s, final velocity at top v = 0, g = -10 m/s²', 195, 1115);
  ctx.fillText('(a) Using 3rd equation of motion: v² = u² + 2gh', 195, 1157);
  ctx.fillText('    0 = (20)² - 2 × 10 × h', 195, 1199);
  ctx.fillText('    20h = 400  =>  h = 20 meters.', 195, 1241);
  ctx.fillText('(b) Time to reach top: v = u + gt => 0 = 20 - 10t => t = 2 seconds', 195, 1283);
  ctx.fillText('    Total time of flight T = 2 × t = 4 seconds.', 195, 1325);

  // --- QUESTION 4 ---
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Q4.', 100, 1400);
  ctx.fillText('Distinguish between Elastic and Inelastic collision. Give one key difference. [5 Marks]', 190, 1400);

  ctx.font = '700 24px "Caveat", cursive';
  ctx.fillStyle = '#1d4ed8';
  ctx.fillText('Ans: In elastic collision, both kinetic energy and momentum are conserved.', 195, 1455);
  ctx.fillText('In inelastic collision, momentum is conserved but kinetic energy is lost as heat/sound.', 195, 1497);

  return canvas.toDataURL('image/jpeg', 0.92);
}

function createMathExamCanvas(): string {
  const width = 1200;
  const height = 1600;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#faf9f5';
  ctx.fillRect(0, 0, width, height);

  // Ruled lines
  const lineHeight = 42;
  const topMargin = 220;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.2;
  for (let y = topMargin; y < height - 50; y += lineHeight) {
    ctx.beginPath();
    ctx.moveTo(70, y);
    ctx.lineTo(width - 70, y);
    ctx.stroke();
  }

  // Margin line
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(170, 70);
  ctx.lineTo(170, height - 50);
  ctx.stroke();

  // Header
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DEPARTMENT OF MATHEMATICS - PERIODIC ASSESSMENT', width / 2, 75);

  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('TOPIC: CALCULUS & OPTIMIZATION  |  TOTAL MARKS: 20', width / 2, 110);

  ctx.textAlign = 'left';
  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('Student: Sarah Chen', 190, 160);
  ctx.fillText('Grade: 12-A', 680, 160);
  ctx.fillText('Roll: 09', 950, 160);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(170, 130, width - 240, 45);

  // Answers in Dark Ink
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Q1.', 100, 260);
  ctx.fillText('Find the critical points of f(x) = 2x³ - 9x² + 12x - 3 and determine local extrema. [6 Marks]', 190, 260);

  ctx.font = '700 24px "Caveat", cursive';
  ctx.fillStyle = '#1e3a8a';
  ctx.fillText('f(x) = 2x³ - 9x² + 12x - 3', 195, 315);
  ctx.fillText('f\'(x) = 6x² - 18x + 12 = 0', 195, 357);
  ctx.fillText('Dividing by 6:  x² - 3x + 2 = 0', 195, 399);
  ctx.fillText('(x - 1)(x - 2) = 0  =>  Critical points x = 1 and x = 2', 195, 441);
  ctx.fillText('f\'\'(x) = 12x - 18', 195, 483);
  ctx.fillText('At x = 1: f\'\'(1) = 12(1) - 18 = -6 < 0  => Local Maximum at x = 1', 195, 525);
  ctx.fillText('At x = 2: f\'\'(2) = 12(2) - 18 = +6 > 0  => Local Minimum at x = 2', 195, 567);
  ctx.fillText('Max value = f(1) = 2(1) - 9(1) + 12(1) - 3 = 2', 195, 609);

  // Q2
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Q2.', 100, 710);
  ctx.fillText('Evaluate definite integral: ∫ [from 0 to 2] (3x² - 4x + 5) dx. [6 Marks]', 190, 710);

  ctx.font = '700 24px "Caveat", cursive';
  ctx.fillStyle = '#1e3a8a';
  ctx.fillText('I = ∫ (3x² - 4x + 5) dx = [ 3(x³/3) - 4(x²/2) + 5x ] from 0 to 2', 195, 765);
  ctx.fillText('  = [ x³ - 2x² + 5x ] from 0 to 2', 195, 807);
  ctx.fillText('Upper limit (x=2): (2)³ - 2(2)² + 5(2) = 8 - 8 + 10 = 10', 195, 849);
  ctx.fillText('Lower limit (x=0): 0 - 0 + 0 = 0', 195, 891);
  ctx.fillText('Therefore, I = 10 - 0 = 10', 195, 933);

  // Q3
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Q3.', 100, 1040);
  ctx.fillText('Solve the differential equation: dy/dx + 2y = e^(-x). [8 Marks]', 190, 1040);

  ctx.font = '700 24px "Caveat", cursive';
  ctx.fillStyle = '#1e3a8a';
  ctx.fillText('This is linear 1st order: dy/dx + P(x)y = Q(x) with P(x)=2, Q(x)=e^(-x)', 195, 1095);
  ctx.fillText('Integrating factor I.F. = e^(∫ 2 dx) = e^(2x)', 195, 1137);
  ctx.fillText('Multiplying both sides: y · e^(2x) = ∫ e^(-x) · e^(2x) dx', 195, 1179);
  ctx.fillText('y · e^(2x) = ∫ e^x dx = e^x + C', 195, 1221);
  ctx.fillText('y = e^(-x) + C · e^(-2x)  (Forgot to mention C is arbitrary constant!)', 195, 1263);

  return canvas.toDataURL('image/jpeg', 0.92);
}

function createAccountsExamPages(): { name: string; dataUrl: string }[] {
  const width = 1200;
  const height = 1600;

  // PAGE 1: Journal Entries & Machinery Ledger
  const canvas1 = document.createElement('canvas');
  canvas1.width = width;
  canvas1.height = height;
  const ctx1 = canvas1.getContext('2d')!;

  ctx1.fillStyle = '#fcfbf9';
  ctx1.fillRect(0, 0, width, height);

  ctx1.strokeStyle = '#e2e8f0';
  ctx1.lineWidth = 1.2;
  for (let y = 220; y < height - 50; y += 42) {
    ctx1.beginPath();
    ctx1.moveTo(70, y);
    ctx1.lineTo(width - 70, y);
    ctx1.stroke();
  }

  ctx1.strokeStyle = '#fca5a5';
  ctx1.lineWidth = 2;
  ctx1.beginPath();
  ctx1.moveTo(170, 70);
  ctx1.lineTo(170, height - 50);
  ctx1.stroke();

  ctx1.fillStyle = '#0f172a';
  ctx1.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
  ctx1.textAlign = 'center';
  ctx1.fillText('BOARD OF HIGHER COMMERCE - FINANCIAL ACCOUNTING & ECONOMICS', width / 2, 70);

  ctx1.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx1.fillStyle = '#475569';
  ctx1.fillText('PAPER: FINANCIAL STATEMENTS & LEDGER RECONCILIATION  |  PAGE 1 OF 2', width / 2, 102);

  ctx1.textAlign = 'left';
  ctx1.font = '500 15px "Plus Jakarta Sans", sans-serif';
  ctx1.fillStyle = '#334155';
  ctx1.fillText('Student: Aarav Sharma', 190, 150);
  ctx1.fillText('Class: 12-C (Commerce)', 650, 150);
  ctx1.fillText('Roll: AC-2026-44', 960, 150);

  ctx1.strokeStyle = '#94a3b8';
  ctx1.lineWidth = 1;
  ctx1.strokeRect(170, 125, width - 240, 40);

  ctx1.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
  ctx1.fillStyle = '#0f172a';
  ctx1.fillText('Q1.', 100, 240);
  ctx1.fillText('Journalize: (a) 10% depreciation on Plant & Machinery (Cost $50,000, reducing balance).', 190, 240);
  ctx1.fillText('(b) Create 5% provision for doubtful debts on trade receivables ($24,000). [5 Marks]', 190, 268);

  ctx1.font = '700 23px "Caveat", cursive';
  ctx1.fillStyle = '#1e3a8a';
  ctx1.fillText('(a) Depreciation on Machinery = 10% of $50,000 = $5,000', 195, 330);
  ctx1.fillText('    Journal Entry:', 195, 372);
  ctx1.fillText('    Depreciation A/c ..................................... Dr.   $5,000', 195, 414);
  ctx1.fillText('        To Plant & Machinery A/c ..........................        $5,000', 195, 456);
  ctx1.fillText('    (Being 10% annual depreciation written off)', 195, 498);
  ctx1.fillText('(b) Provision for Doubtful Debts = 5% of $24,000 = $1,200', 195, 550);
  ctx1.fillText('    Profit & Loss A/c .................................... Dr.   $1,200', 195, 592);
  ctx1.fillText('        To Provision for Doubtful Debts A/c ................        $1,200', 195, 634);

  ctx1.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
  ctx1.fillStyle = '#0f172a';
  ctx1.fillText('Q2.', 100, 740);
  ctx1.fillText('Prepare Machinery Ledger Account showing closing balance carried to Page 2. [5 Marks]', 190, 740);

  ctx1.font = '700 23px "Caveat", cursive';
  ctx1.fillStyle = '#1e3a8a';
  ctx1.fillText('Dr.                       PLANT & MACHINERY A/C                       Cr.', 195, 800);
  ctx1.fillText('To Balance b/d ........ $50,000    |  By Depreciation A/c .... $5,000', 195, 842);
  ctx1.fillText('                                   |  By Balance c/d (carried) $45,000', 195, 884);
  ctx1.fillText('TOTAL:                 $50,000    |  TOTAL:                   $50,000', 195, 926);
  ctx1.fillText('--> Net book value $45,000 carried forward to Page 2 Balance Sheet.', 195, 978);

  const page1DataUrl = canvas1.toDataURL('image/jpeg', 0.92);

  // PAGE 2: Income Statement & Balance Sheet
  const canvas2 = document.createElement('canvas');
  canvas2.width = width;
  canvas2.height = height;
  const ctx2 = canvas2.getContext('2d')!;

  ctx2.fillStyle = '#fcfbf9';
  ctx2.fillRect(0, 0, width, height);

  ctx2.strokeStyle = '#e2e8f0';
  ctx2.lineWidth = 1.2;
  for (let y = 220; y < height - 50; y += 42) {
    ctx2.beginPath();
    ctx2.moveTo(70, y);
    ctx2.lineTo(width - 70, y);
    ctx2.stroke();
  }

  ctx2.strokeStyle = '#fca5a5';
  ctx2.lineWidth = 2;
  ctx2.beginPath();
  ctx2.moveTo(170, 70);
  ctx2.lineTo(170, height - 50);
  ctx2.stroke();

  ctx2.fillStyle = '#0f172a';
  ctx2.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
  ctx2.textAlign = 'center';
  ctx2.fillText('BOARD OF HIGHER COMMERCE - FINANCIAL ACCOUNTING & ECONOMICS', width / 2, 70);

  ctx2.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx2.fillStyle = '#475569';
  ctx2.fillText('PAPER: FINANCIAL STATEMENTS & LEDGER RECONCILIATION  |  PAGE 2 OF 2', width / 2, 102);

  ctx2.textAlign = 'left';
  ctx2.font = '500 15px "Plus Jakarta Sans", sans-serif';
  ctx2.fillStyle = '#334155';
  ctx2.fillText('Student: Aarav Sharma', 190, 150);
  ctx2.fillText('Class: 12-C (Commerce)', 650, 150);
  ctx2.fillText('Roll: AC-2026-44', 960, 150);

  ctx2.strokeStyle = '#94a3b8';
  ctx2.lineWidth = 1;
  ctx2.strokeRect(170, 125, width - 240, 40);

  ctx2.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
  ctx2.fillStyle = '#0f172a';
  ctx2.fillText('Q3.', 100, 240);
  ctx2.fillText('Prepare Trading & Profit & Loss Statement using Revenue $120,000 and COGS $81,800. [7 Marks]', 190, 240);

  ctx2.font = '700 23px "Caveat", cursive';
  ctx2.fillStyle = '#1e3a8a';
  ctx2.fillText('Revenue: $120,000  -  Cost of Goods Sold (COGS): $81,800', 195, 300);
  ctx2.fillText('Gross Profit = $120,000 - $81,800 = $38,200', 195, 342);
  ctx2.fillText('Less Operating Expenses:', 195, 384);
  ctx2.fillText('  - Rent & Utilities: $8,000', 195, 426);
  ctx2.fillText('  - Salaries & Wages: $12,000', 195, 468);
  ctx2.fillText('  - Depreciation on Machinery (transferred from Page 1): $5,000', 195, 510);
  ctx2.fillText('  - Doubtful Debts Provision (from Page 1): $1,200', 195, 552);
  ctx2.fillText('Total Expenses = $26,200  =>  Net Operating Profit = $12,000', 195, 594);

  ctx2.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
  ctx2.fillStyle = '#0f172a';
  ctx2.fillText('Q4.', 100, 720);
  ctx2.fillText('Draft Balance Sheet incorporating cross-page ledger asset balance ($45,000). [8 Marks]', 190, 720);

  ctx2.font = '700 23px "Caveat", cursive';
  ctx2.fillStyle = '#1e3a8a';
  ctx2.fillText('ASSETS:', 195, 780);
  ctx2.fillText('  Non-Current: Plant & Machinery (Net from Page 1): $45,000', 195, 822);
  ctx2.fillText('  Current: Inventories ($35,000) + Cash ($9,700) + Debtors ($22,800) = $67,500', 195, 864);
  ctx2.fillText('  TOTAL ASSETS = $45,000 + $67,500 = $112,500', 195, 906);
  ctx2.fillText('EQUITY & LIABILITIES:', 195, 958);
  ctx2.fillText('  Capital ($80,000) + Net Profit ($12,000) - Drawings ($4,500) = $87,500', 195, 1000);
  ctx2.fillText('  Trade Payables & Accrued Expenses = $25,000', 195, 1042);
  ctx2.fillText('  TOTAL LIABILITIES & EQUITY = $87,500 + $25,000 = $112,500  [Balanced!]', 195, 1084);

  const page2DataUrl = canvas2.toDataURL('image/jpeg', 0.92);

  return [
    { name: 'Accounts-Exam-Sheet-Page-1.jpg', dataUrl: page1DataUrl },
    { name: 'Accounts-Exam-Sheet-Page-2.jpg', dataUrl: page2DataUrl },
  ];
}

export const SAMPLE_PAPERS: SamplePaper[] = [
  {
    id: 'sample-accounts-multipage',
    title: 'Class 12 Accounts & Economics (2 Pages - Ledger & Balance Sheet)',
    subject: 'Accounts',
    totalMarks: 25,
    rubric: `Accounts & Economics Exam Rubric (Total: 25 Marks across 2 Pages):
- Multi-page evaluation note: Verify calculations across continuous pages as a single unit. Check that closing ledger balances from Page 1 are correctly transferred to the Balance Sheet on Page 2.
- Q1 (5 marks): Journal entries for depreciation (3m) and bad debts provision (2m).
- Q2 (5 marks): Machinery ledger account with correct balance c/d of $45,000 carried forward to Page 2 (5m).
- Q3 (7 marks): Trading & P&L Statement: Gross profit $38,200 (3m), operating expenses transferred from Page 1 (2m), net profit $12,000 (2m). Deduct 2 marks if discount allowed is omitted.
- Q4 (8 marks): Balance Sheet: Assets sum to $112,500 (4m), Equity & Liabilities sum to $112,500 (4m).`,
    generateImage: () => createAccountsExamPages()[0].dataUrl,
    generatePages: createAccountsExamPages,
    questionPaperDoc: {
      id: 'qp-accounts',
      name: 'Accounts-Exam-Question-Paper.pdf',
      type: 'text',
      textContent: `BOARD OF HIGHER COMMERCE - TERM II (2026)
SUBJECT: FINANCIAL ACCOUNTING & ECONOMICS  |  MAX MARKS: 25  |  TIME: 1 HOUR

PAGE 1:
Q1. Journalize: (a) 10% depreciation on Plant & Machinery (Cost $50,000, reducing balance method).
    (b) Create 5% provision for doubtful debts on trade receivables ($24,000). [5 Marks]
Q2. Prepare the Plant & Machinery Ledger Account for 2025 and carry forward the closing written-down value to Page 2. [5 Marks]

PAGE 2:
Q3. Prepare the Trading and Profit & Loss Statement for the year ending 31 Dec 2025 using Revenue $120,000 and COGS $81,800. [7 Marks]
Q4. Draft the Balance Sheet as at 31 Dec 2025, ensuring cross-page ledger balances from Page 1 are incorporated. [8 Marks]`,
    },
    answerKeyDoc: {
      id: 'ak-accounts',
      name: 'Accounts-Official-Answer-Key.pdf',
      type: 'text',
      textContent: `MODEL MARKING SCHEME - FINANCIAL ACCOUNTING:

Q1 (5 Marks):
- Dep A/c Dr. $5,000 to Plant & Machinery A/c $5,000 (3 Marks)
- P&L A/c Dr. $1,200 to Provision for Doubtful Debts A/c $1,200 (2 Marks)

Q2 (5 Marks):
- Machinery A/c Dr. Balance b/d $50,000
- Cr. By Depreciation $5,000; By Balance c/d $45,000 (5 Marks)

Q3 (7 Marks):
- Gross profit: $120,000 - $81,800 = $38,200 (3 Marks)
- Operating expenses: Rent ($8,000) + Salaries ($12,000) + Dep ($5,000) + Bad debts ($1,200) = $26,200 (2 Marks)
- Net profit: $12,000 (2 Marks)

Q4 (8 Marks):
- Total Assets: Net Machinery ($45,000) + Current Assets ($67,500) = $112,500 (4 Marks)
- Total Equity & Liabilities: Capital ($87,500) + Payables ($25,000) = $112,500 (4 Marks)`,
    },
    defaultEvaluation: {
      total_score_awarded: 23,
      max_possible_score: 25,
      overall_feedback:
        'Excellent continuous multi-page accounting work! The student meticulously connected calculations across both pages, transferring the $45,000 Plant & Machinery balance from Page 1 into the Page 2 Balance Sheet seamlessly. Only 2 marks deducted on Q3 due to missing discount provision.',
      strengths: [
        'Seamless cross-page continuity: carried forward $45,000 machinery asset from Page 1 directly into the Page 2 Balance Sheet',
        'Accurate 10% reducing balance depreciation journal entries and ledger balancing',
        'Balanced the financial statements perfectly at $112,500',
      ],
      weaknesses: [
        'Minor oversight in Q3: omitted discount allowed ($300) in operating expenses section of Profit & Loss statement',
      ],
      page_scores: [
        { page_number: 1, marks_awarded: 10, max_marks: 10 },
        { page_number: 2, marks_awarded: 13, max_marks: 15 },
      ],
      question_breakdown: [
        { question_number: 'Q1', marks_obtained: 5, max_marks: 5, topic: 'Journal Entries (Depreciation & Bad Debts)', status: 'Full Marks', page_number: 1 },
        { question_number: 'Q2', marks_obtained: 5, max_marks: 5, topic: 'Machinery Ledger Account & Balance c/d', status: 'Full Marks', page_number: 1 },
        { question_number: 'Q3', marks_obtained: 5, max_marks: 7, topic: 'Trading and Profit & Loss Statement', status: 'Partial Marks', page_number: 2 },
        { question_number: 'Q4', marks_obtained: 8, max_marks: 8, topic: 'Balance Sheet & Cross-Page Reconciliation', status: 'Full Marks', page_number: 2 },
      ],
      annotations: [
        {
          id: 'acc-ann-1',
          page_number: 1,
          box_2d: [350, 195, 470, 850],
          type: 'correct',
          marks_awarded: 3.0,
          max_marks: 3.0,
          feedback_text: '✓ Flawless depreciation journal entry & 10% calculation',
          improvement_tip: 'Neat double-entry journal format followed.',
        },
        {
          id: 'acc-ann-2',
          page_number: 1,
          box_2d: [550, 195, 650, 850],
          type: 'correct',
          marks_awarded: 2.0,
          max_marks: 2.0,
          feedback_text: '✓ Correct 5% provision for doubtful debts ($1,200)',
          improvement_tip: 'Correct credit to provision account.',
        },
        {
          id: 'acc-ann-3',
          page_number: 1,
          box_2d: [800, 195, 950, 850],
          type: 'correct',
          marks_awarded: 5.0,
          max_marks: 5.0,
          feedback_text: '✓ Ledger balanced correctly to $45,000 (carried to Page 2)',
          improvement_tip: 'Clear explicit note stating balance carried forward.',
        },
        {
          id: 'acc-ann-4',
          page_number: 2,
          box_2d: [300, 195, 360, 850],
          type: 'correct',
          marks_awarded: 3.0,
          max_marks: 3.0,
          feedback_text: '✓ Gross profit calculated accurately at $38,200',
          improvement_tip: 'COGS subtraction verified.',
        },
        {
          id: 'acc-ann-5',
          page_number: 2,
          box_2d: [480, 195, 610, 850],
          type: 'partial',
          marks_awarded: 2.0,
          max_marks: 4.0,
          feedback_text: '-2.0 Omitted provision for discount allowed ($300)',
          improvement_tip: 'Always cross-check trial balance notes for discount adjustments.',
        },
        {
          id: 'acc-ann-6',
          page_number: 2,
          box_2d: [800, 195, 1100, 920],
          type: 'correct',
          marks_awarded: 8.0,
          max_marks: 8.0,
          feedback_text: '✓ Masterly cross-page link! Balance Sheet reconciled at $112,500',
          improvement_tip: 'Excellent work carrying forward the $45,000 ledger balance from Page 1.',
        },
      ],
    },
  },
  {
    id: 'sample-physics',
    title: 'Class 12 Physics - Mechanics & Dynamics Test',
    subject: 'Physics',
    totalMarks: 20,
    rubric: `Grading Rubric for Physics Exam (Total: 20 marks):
- Q1 (5 marks): Friction calculation: N=mg (1m), f_k=μN=9.8N (1.5m), F_net=10.2N (1m), a=2.04 m/s² (1.5m). Deduct 0.5m if unit m/s² is missing. Free-body diagram (+bonus or step mark).
- Q2 (5 marks): Conservation of Linear Momentum statement (2m). Validity condition: Must state "in an isolated system with NO net external force" (2m). Recoil example (1m). Deduct 2 marks if condition cites energy conservation instead of zero net external force.
- Q3 (5 marks): Vertical projectile: Max height formula & substitution h=20m (2.5m). Time of flight T=2*t = 4s (2.5m).
- Q4 (5 marks): Elastic vs Inelastic: Elastic conserves kinetic energy and momentum (2.5m). Inelastic conserves momentum while kinetic energy is dissipated (2.5m).`,
    generateImage: createPhysicsExamCanvas,
    questionPaperDoc: {
      id: 'qp-physics',
      name: 'Physics-Question-Paper-Term2.pdf',
      type: 'text',
      textContent: `CENTRAL BOARD EXAMINATION - TERM II (2026)
SUBJECT: PHYSICS (THEORY)  |  MAX MARKS: 20  |  TIME: 45 MINS

Q1. A 5 kg block rests on a rough horizontal floor (μ = 0.2). A force of 20 N is applied horizontally.
    Calculate: (a) Frictional force opposing motion, (b) Net acceleration of the block. Draw Free Body Diagram. [5 Marks]

Q2. State the Principle of Conservation of Linear Momentum. Under what physical condition is it valid?
    Give one practical example. [5 Marks]

Q3. A ball of mass 0.5 kg is thrown vertically upward with speed 20 m/s.
    Calculate: (a) Maximum height reached, (b) Total time of flight before returning to ground. (Take g = 10 m/s²). [5 Marks]

Q4. Distinguish clearly between an Elastic Collision and an Inelastic Collision in terms of momentum and kinetic energy conservation. [5 Marks]`,
    },
    answerKeyDoc: {
      id: 'ak-physics',
      name: 'Physics-Official-Model-Answer-Key.pdf',
      type: 'text',
      textContent: `OFFICIAL MARKING SCHEME & MODEL ANSWERS - PHYSICS

Q1 (5 Marks):
- Normal force N = mg = 5 * 9.8 = 49 N (1 Mark)
- Max frictional force f_k = μ * N = 0.2 * 49 = 9.8 N (1.5 Marks)
- F_net = F_applied - f_k = 20 - 9.8 = 10.2 N (1 Mark)
- Acceleration a = F_net / m = 10.2 / 5 = 2.04 m/s² (1.5 Marks). Note: Deduct 0.5 marks if unit m/s² is missing.

Q2 (5 Marks):
- Correct statement of Linear Momentum Conservation: Total initial momentum = Total final momentum (2 Marks)
- Condition: Valid ONLY in an isolated system where NET EXTERNAL FORCE IS ZERO (F_ext = 0) (2 Marks). Note: Do NOT award marks if student claims condition is energy conservation.
- Practical example: Recoil of gun / rocket propulsion (1 Mark).

Q3 (5 Marks):
- Using v² = u² + 2gh => 0 = 400 - 20h => h = 20 meters (2.5 Marks)
- Time to top t = u/g = 2s => Total time T = 2t = 4 seconds (2.5 Marks)

Q4 (5 Marks):
- Elastic: Both linear momentum and kinetic energy are conserved (2.5 Marks)
- Inelastic: Linear momentum is conserved, but kinetic energy is not conserved (converted to heat/sound) (2.5 Marks)`,
    },
    defaultEvaluation: {
      total_score_awarded: 16.5,
      max_possible_score: 20,
      overall_feedback:
        'Commendable performance demonstrating strong mathematical calculations and conceptual grasp in mechanics. FBD diagram and projectile calculations were pristine. Lost marks on Q1 due to omission of the acceleration unit (m/s²) and in Q2 for an incorrect condition for momentum conservation.',
      strengths: [
        'Precise derivation of frictional resistance and net force in Q1',
        'Clean, correctly labeled Free Body Diagram',
        'Flawless projectile motion calculation and time of flight breakdown in Q3',
        'Accurate distinction between elastic and inelastic collisions in Q4',
      ],
      weaknesses: [
        'Omitted SI acceleration units (m/s²) in the final step of Q1',
        'Misstated momentum conservation condition in Q2: momentum conservation requires zero net external force (F_ext = 0), not energy conservation',
      ],
      question_breakdown: [
        { question_number: 'Q1', marks_obtained: 4.5, max_marks: 5, topic: 'Friction & Net Acceleration', status: 'Partial Marks' },
        { question_number: 'Q2', marks_obtained: 3.0, max_marks: 5, topic: 'Conservation of Linear Momentum', status: 'Partial Marks' },
        { question_number: 'Q3', marks_obtained: 5.0, max_marks: 5, topic: 'Kinematics & Projectile Motion', status: 'Full Marks' },
        { question_number: 'Q4', marks_obtained: 4.0, max_marks: 5, topic: 'Collisions & Energy Transfer', status: 'Full Marks' },
      ],
      annotations: [
        {
          id: 'ann-1',
          box_2d: [320, 185, 395, 620],
          type: 'correct',
          marks_awarded: 1.5,
          max_marks: 1.5,
          feedback_text: '✓ Correct normal force calculation N = 49 N',
          improvement_tip: 'Always state assumptions clearly when taking g = 9.8 m/s².',
        },
        {
          id: 'ann-2',
          box_2d: [405, 185, 520, 620],
          type: 'correct',
          marks_awarded: 1.5,
          max_marks: 1.5,
          feedback_text: '✓ Correct frictional resistance formula fk = μN = 9.8 N',
          improvement_tip: 'Explicitly mention that applied force (20N) exceeds static limit so kinetic friction applies.',
        },
        {
          id: 'ann-3',
          box_2d: [610, 185, 660, 560],
          type: 'partial',
          marks_awarded: 1.5,
          max_marks: 2.0,
          feedback_text: '-0.5 Missing SI unit (m/s²)',
          improvement_tip: 'Numeric answers without SI units lose step marks. Always write "2.04 m/s²".',
        },
        {
          id: 'ann-4',
          box_2d: [390, 750, 530, 1070],
          type: 'correct',
          marks_awarded: 1.0,
          max_marks: 1.0,
          feedback_text: '✓ Well-labeled Free Body Diagram (FBD)',
          improvement_tip: 'Excellent visual representation; keep using directional vectors.',
        },
        {
          id: 'ann-5',
          box_2d: [790, 185, 870, 830],
          type: 'correct',
          marks_awarded: 2.0,
          max_marks: 2.0,
          feedback_text: '✓ Accurate definition of linear momentum conservation',
          improvement_tip: 'Mentioning vector formula Σ p_initial = Σ p_final adds rigour.',
        },
        {
          id: 'ann-6',
          box_2d: [875, 185, 915, 780],
          type: 'incorrect',
          marks_awarded: 0.0,
          max_marks: 2.0,
          feedback_text: '✗ Incorrect condition! Valid only when net external force is zero',
          improvement_tip: 'Momentum is conserved in an isolated system (F_ext = 0), regardless of whether kinetic energy is conserved.',
        },
        {
          id: 'ann-7',
          box_2d: [1135, 185, 1260, 680],
          type: 'correct',
          marks_awarded: 2.5,
          max_marks: 2.5,
          feedback_text: '✓ Correct 3rd kinematic equation and max height h = 20 m',
          improvement_tip: 'Good job identifying final velocity v=0 at highest point.',
        },
        {
          id: 'ann-8',
          box_2d: [1265, 185, 1345, 680],
          type: 'correct',
          marks_awarded: 2.5,
          max_marks: 2.5,
          feedback_text: '✓ Total time of flight T = 4 seconds',
          improvement_tip: 'Clean derivation of symmetry in upward and downward flight.',
        },
      ],
    },
  },
  {
    id: 'sample-math',
    title: 'Class 12 Mathematics - Differential Calculus & Integration',
    subject: 'Mathematics',
    totalMarks: 20,
    rubric: `Grading Rubric for Mathematics Calculus:
- Q1 (6 marks): First derivative f'(x) & roots x=1,2 (3m), Second derivative test f''(x) & classification (2m), Maximum value f(1)=2 (1m).
- Q2 (6 marks): Antiderivative terms [x^3 - 2x^2 + 5x] (3m), Upper and lower limit evaluation = 10 (3m).
- Q3 (8 marks): Identifying linear form & P(x), Q(x) (2m), Integrating factor e^(2x) (2m), Integration of RHS (3m), General solution with constant C (1m).`,
    generateImage: createMathExamCanvas,
    questionPaperDoc: {
      id: 'qp-math',
      name: 'Calculus-Periodic-Assessment.pdf',
      type: 'text',
      textContent: `DEPARTMENT OF MATHEMATICS - PERIODIC ASSESSMENT
TOPIC: CALCULUS & OPTIMIZATION  |  TOTAL MARKS: 20

Q1. Find all critical points of the function f(x) = 2x³ - 9x² + 12x - 3.
    Use the second derivative test to classify each critical point as a local maximum or minimum, and calculate the maximum value. [6 Marks]

Q2. Evaluate the definite integral:
    ∫ [from 0 to 2] (3x² - 4x + 5) dx. Show clear anti-derivative steps. [6 Marks]

Q3. Solve the first-order differential equation:
    dy/dx + 2y = e^(-x). Find the general solution y(x). [8 Marks]`,
    },
    answerKeyDoc: {
      id: 'ak-math',
      name: 'Calculus-Marking-Scheme.pdf',
      type: 'text',
      textContent: `OFFICIAL MARKING SCHEME - CALCULUS

Q1 (6 Marks):
- f'(x) = 6x² - 18x + 12 = 0 => 6(x-1)(x-2) = 0 => Critical points x=1, x=2 (3 Marks)
- f''(x) = 12x - 18:
  * f''(1) = -6 < 0 => Local Maximum at x = 1 (1 Mark)
  * f''(2) = +6 > 0 => Local Minimum at x = 2 (1 Mark)
- Max value f(1) = 2(1) - 9(1) + 12(1) - 3 = 2 (1 Mark)

Q2 (6 Marks):
- Antiderivative = [x³ - 2x² + 5x] (3 Marks)
- Evaluation: (2³ - 2*4 + 10) - (0) = (8 - 8 + 10) - 0 = 10 (3 Marks)

Q3 (8 Marks):
- Linear form recognition dy/dx + P(x)y = Q(x) with P(x)=2, Q(x)=e^(-x) (2 Marks)
- Integrating Factor I.F. = e^(∫ 2 dx) = e^(2x) (2 Marks)
- y * e^(2x) = ∫ e^(-x) * e^(2x) dx = ∫ e^x dx = e^x + C (3 Marks)
- General solution y = e^(-x) + C * e^(-2x), explicitly stating C ∈ ℝ is arbitrary constant (1 Mark). Deduct 1 mark if arbitrary constant C is not stated.`,
    },
    defaultEvaluation: {
      total_score_awarded: 19.0,
      max_possible_score: 20,
      overall_feedback:
        'Outstanding mathematical paper! The student demonstrated masterly algebraic manipulation, accurate differentiation, and methodical calculus work. Near-perfect score with only a tiny deduction on Q3 for not defining the constant of integration.',
      strengths: [
        'Flawless quadratic factorization and critical points detection in Q1',
        'Rigorous application of the second derivative test for concavity and local extrema',
        'Clean step-by-step definite integration with exact arithmetic in Q2',
        'Correct integrating factor computation in Q3',
      ],
      weaknesses: [
        'Minor omission: failed to explicitly state that C ∈ ℝ is an arbitrary constant of integration in Q3',
      ],
      question_breakdown: [
        { question_number: 'Q1', marks_obtained: 6.0, max_marks: 6, topic: 'Critical Points & 2nd Derivative Test', status: 'Full Marks' },
        { question_number: 'Q2', marks_obtained: 6.0, max_marks: 6, topic: 'Definite Integration', status: 'Full Marks' },
        { question_number: 'Q3', marks_obtained: 7.0, max_marks: 8, topic: 'Linear 1st Order Differential Eq', status: 'Partial Marks' },
      ],
      annotations: [
        {
          id: 'math-ann-1',
          box_2d: [340, 185, 455, 680],
          type: 'correct',
          marks_awarded: 3.0,
          max_marks: 3.0,
          feedback_text: '✓ Correct derivative f\'(x) and factorized roots x=1, x=2',
          improvement_tip: 'Clear factorization and zero product theorem application.',
        },
        {
          id: 'math-ann-2',
          box_2d: [465, 185, 620, 780],
          type: 'correct',
          marks_awarded: 3.0,
          max_marks: 3.0,
          feedback_text: '✓ Flawless 2nd derivative test verifying local max & min',
          improvement_tip: 'Great practice writing out f\'\'(x) explicitly for both critical points.',
        },
        {
          id: 'math-ann-3',
          box_2d: [750, 185, 950, 740],
          type: 'correct',
          marks_awarded: 6.0,
          max_marks: 6.0,
          feedback_text: '✓ Spot on! Perfect anti-derivative and limit evaluation = 10',
          improvement_tip: 'Keep using square bracket notation for definite integrals.',
        },
        {
          id: 'math-ann-4',
          box_2d: [1110, 185, 1160, 680],
          type: 'correct',
          marks_awarded: 2.0,
          max_marks: 2.0,
          feedback_text: '✓ Correct Integrating Factor I.F. = e^(2x)',
          improvement_tip: 'Nice direct recognition of standard linear 1st-order ODE form.',
        },
        {
          id: 'math-ann-5',
          box_2d: [1240, 185, 1285, 780],
          type: 'partial',
          marks_awarded: 1.0,
          max_marks: 2.0,
          feedback_text: '-1.0 State "where C is an arbitrary constant"',
          improvement_tip: 'In formal board examinations, always define C as the arbitrary constant of integration.',
        },
      ],
    },
  },
];
