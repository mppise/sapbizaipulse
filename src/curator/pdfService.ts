import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// [F-C01-INGEST-PDF] Extract text from a PDF buffer using pdfjs-dist
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdfjs-dist expects a Uint8Array
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  const text = pages.join('\n').trim().replace(/\n{3,}/g, '\n\n');
  if (!text) throw Object.assign(new Error('No extractable text found. The PDF may be image-based.'), { code: 'CURATOR_PDF_EXTRACT_FAILED' });
  return text;
}
