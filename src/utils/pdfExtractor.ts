import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure worker using local Vite asset URL with fallback to cdnjs
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl || `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('Could not set local pdf workerSrc, using fallback:', e);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }
}

export interface ExtractedPdfPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Extracts each page of a PDF file as high-resolution JPEG/PNG dataUrls suitable for OCR and visual grading.
 */
export async function extractPagesFromPdf(
  fileOrBuffer: File | ArrayBuffer | Uint8Array,
  scale = 1.8 // High DPI for clear handwriting OCR
): Promise<ExtractedPdfPage[]> {
  let arrayBuffer: ArrayBuffer;

  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof Uint8Array) {
    arrayBuffer = fileOrBuffer.buffer.slice(
      fileOrBuffer.byteOffset,
      fileOrBuffer.byteOffset + fileOrBuffer.byteLength
    ) as ArrayBuffer;
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/cmaps/`,
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pages: ExtractedPdfPage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) continue;

    // Fill white background (PDFs can have transparent backgrounds)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    // @ts-ignore
    await page.render(renderContext).promise;

    // Convert to crisp image JPEG for fast OCR & memory management
    const dataUrl = canvas.toDataURL('image/jpeg', 0.90);

    pages.push({
      pageNumber: i,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    });
  }

  return pages;
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|tiff)$/i.test(file.name);
}

export function cleanStudentName(fileName: string): string {
  let name = fileName.replace(/\.[^/.]+$/, ''); // remove extension
  // remove page indicators like _page1, _pg2, -p1, _1, (1), etc.
  name = name.replace(/[-_ ]*(?:page|pg|p)[-_ ]*\d+/gi, '');
  name = name.replace(/[-_ ]*\(\d+\)$/g, '');
  name = name.replace(/[-_ ]*\b\d+$/g, '');
  // remove subject keywords if they appear as prefixes like Physics_ or Math_
  name = name.replace(/^(?:physics|chemistry|math|mathematics|science|english|biology|exam|test|midterm|final)[-_ ]+/gi, '');
  // replace underscores and hyphens with space
  name = name.replace(/[-_]/g, ' ').trim();
  // Capitalize words
  if (!name) return 'Student';
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface StudentFileGroup {
  studentName: string;
  files: File[];
  isPdf: boolean;
}

/**
 * Groups files (PDFs and/or images) into logical student exam booklets so that:
 * 1. Each PDF is inherently recognized as 1 student's multi-page submission.
 * 2. PNG/JPEG images can be grouped either by matching file name prefixes (e.g. Alex_pg1.png, Alex_pg2.png)
 *    or by a fixed number of pages per student (e.g. 2 pages each).
 */
export function groupFilesIntoStudentBooklets(
  files: File[],
  strategy: 'smart' | 'prefix' | 'fixed' = 'smart',
  fixedPagesPerStudent = 2
): StudentFileGroup[] {
  const groups: StudentFileGroup[] = [];
  const imageFiles: File[] = [];

  // Separate PDFs immediately (1 PDF = 1 student booklet containing all its pages)
  for (const file of files) {
    if (isPdfFile(file)) {
      groups.push({
        studentName: cleanStudentName(file.name),
        files: [file],
        isPdf: true,
      });
    } else if (isImageFile(file)) {
      imageFiles.push(file);
    }
  }

  if (imageFiles.length === 0) {
    return groups;
  }

  if (strategy === 'fixed' && fixedPagesPerStudent > 0) {
    // Group strictly by sequential count (e.g. every 2 or 3 images = 1 student)
    for (let i = 0; i < imageFiles.length; i += fixedPagesPerStudent) {
      const slice = imageFiles.slice(i, i + fixedPagesPerStudent);
      const studentIdx = groups.length + 1;
      const firstFileName = slice[0].name;
      const derivedName = cleanStudentName(firstFileName) || `Student ${studentIdx}`;

      groups.push({
        studentName: derivedName,
        files: slice,
        isPdf: false,
      });
    }
    return groups;
  }

  // Strategy 'smart' or 'prefix': try grouping by detected student prefix
  const prefixMap = new Map<string, File[]>();

  for (const img of imageFiles) {
    const key = cleanStudentName(img.name);
    if (!prefixMap.has(key)) {
      prefixMap.set(key, []);
    }
    prefixMap.get(key)!.push(img);
  }

  // If grouping produced meaningful clusters or if all had different names
  prefixMap.forEach((matchedFiles, name) => {
    // Sort pages naturally e.g. pg1 before pg2
    matchedFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    groups.push({
      studentName: name || `Student ${groups.length + 1}`,
      files: matchedFiles,
      isPdf: false,
    });
  });

  return groups;
}

