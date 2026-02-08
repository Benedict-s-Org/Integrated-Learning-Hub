// Document Parser Utility
// Supports: txt, md, docx, pdf, json, csv

import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import Papa from 'papaparse';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedContent {
  type: 'text' | 'html' | 'data';
  text?: string;
  html?: string;
  data?: Record<string, any>[];
  columns?: string[];
  pages?: number;
  metadata: {
    fileName: string;
    fileSize: number;
    fileType: string;
    parseDate: string;
  };
}

export interface ParseOptions {
  extractImages?: boolean;
  maxPages?: number;
}

// =============================================================================
// MAIN PARSER
// =============================================================================

export async function parseDocument(
  file: File,
  options: ParseOptions = {}
): Promise<ParsedContent> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const metadata = {
    fileName: file.name,
    fileSize: file.size,
    fileType: ext,
    parseDate: new Date().toISOString(),
  };

  try {
    switch (ext) {
      case 'txt':
        return await parseTextFile(file, metadata);
      case 'md':
        return await parseMarkdownFile(file, metadata);
      case 'docx':
        return await parseWordDocument(file, metadata);
      case 'pdf':
        return await parsePDFDocument(file, metadata, options);
      case 'json':
        return await parseJSONFile(file, metadata);
      case 'csv':
        return await parseCSVFile(file, metadata);
      default:
        throw new Error(`不支援的檔案格式: ${ext}`);
    }
  } catch (error) {
    console.error('Document parsing error:', error);
    throw error;
  }
}

// =============================================================================
// TEXT FILE PARSER
// =============================================================================

async function parseTextFile(
  file: File,
  metadata: ParsedContent['metadata']
): Promise<ParsedContent> {
  const text = await file.text();
  return {
    type: 'text',
    text,
    metadata,
  };
}

// =============================================================================
// MARKDOWN FILE PARSER
// =============================================================================

async function parseMarkdownFile(
  file: File,
  metadata: ParsedContent['metadata']
): Promise<ParsedContent> {
  const text = await file.text();
  // Simple markdown to HTML conversion
  const html = simpleMarkdownToHtml(text);
  return {
    type: 'html',
    text,
    html,
    metadata,
  };
}

function simpleMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Lists
  html = html.replace(/^\- (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  return html;
}

// =============================================================================
// WORD DOCUMENT PARSER
// =============================================================================

async function parseWordDocument(
  file: File,
  metadata: ParsedContent['metadata']
): Promise<ParsedContent> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });

  // Extract plain text as well
  const textResult = await mammoth.extractRawText({ arrayBuffer });

  return {
    type: 'html',
    text: textResult.value,
    html: result.value,
    metadata,
  };
}

// =============================================================================
// PDF DOCUMENT PARSER
// =============================================================================

async function parsePDFDocument(
  file: File,
  metadata: ParsedContent['metadata'],
  options: ParseOptions = {}
): Promise<ParsedContent> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const maxPages = options.maxPages || pdf.numPages;
  const pagesToParse = Math.min(maxPages, pdf.numPages);

  let fullText = '';

  for (let i = 1; i <= pagesToParse; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n\n';
  }

  return {
    type: 'text',
    text: fullText.trim(),
    pages: pdf.numPages,
    metadata,
  };
}

// =============================================================================
// JSON FILE PARSER
// =============================================================================

async function parseJSONFile(
  file: File,
  metadata: ParsedContent['metadata']
): Promise<ParsedContent> {
  const text = await file.text();
  const parsed = JSON.parse(text);

  // Convert to array if single object
  const data = Array.isArray(parsed) ? parsed : [parsed];

  // Extract columns from first item
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return {
    type: 'data',
    data,
    columns,
    metadata,
  };
}

// =============================================================================
// CSV FILE PARSER
// =============================================================================

async function parseCSVFile(
  file: File,
  metadata: ParsedContent['metadata']
): Promise<ParsedContent> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          type: 'data',
          data: results.data as Record<string, any>[],
          columns: results.meta.fields || [],
          metadata,
        });
      },
      error: (error) => {
        reject(new Error(`CSV 解析錯誤: ${error.message}`));
      },
    });
  });
}

// =============================================================================
// FILE TYPE DETECTION
// =============================================================================

export function getFileCategory(fileName: string): 'image' | 'document' | 'data' | 'unknown' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const documentExts = ['txt', 'md', 'docx', 'pdf'];
  const dataExts = ['json', 'csv'];

  if (imageExts.includes(ext)) return 'image';
  if (documentExts.includes(ext)) return 'document';
  if (dataExts.includes(ext)) return 'data';
  return 'unknown';
}

export function getSupportedExtensions(): string[] {
  return ['txt', 'md', 'docx', 'pdf', 'json', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
