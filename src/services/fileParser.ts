import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import * as XLSX from 'xlsx';

// Configure Turndown service with GFM (GitHub Flavored Markdown) for tables
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});
turndownService.use(gfm);

// Remove images to prevent base64 data clutter
turndownService.remove('img');

// Custom rule to handle paragraphs better
turndownService.addRule('preserveParagraphs', {
  filter: 'p',
  replacement: function (content) {
    return '\n\n' + content + '\n\n';
  }
});

export interface FileParseResult {
  text: string;
  type: 'docx' | 'xlsx' | 'txt' | 'unknown';
  error?: string;
}

/**
 * Parses a file and returns its content as a string, preserving structure (especially tables).
 * Supports .docx (via mammoth -> html -> markdown) and .xlsx (via xlsx -> markdown tables).
 */
export const parseFile = async (file: File): Promise<FileParseResult> => {
  const fileType = file.name.split('.').pop()?.toLowerCase();

  try {
    if (fileType === 'docx') {
      return await parseDocx(file);
    } else if (fileType === 'xlsx' || fileType === 'xls') {
      return await parseExcel(file);
    } else if (fileType === 'txt') {
      const text = await file.text();
      return { text, type: 'txt' };
    } else {
      return { text: '', type: 'unknown', error: 'Unsupported file type' };
    }
  } catch (error: unknown) {
    console.error('File parsing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
    return { text: '', type: 'unknown', error: errorMessage };
  }
};

/**
 * Clean HTML content using DOMParser to remove unwanted elements and ensure structure.
 * Exported for testing purposes.
 */
export const cleanHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Remove all images
  doc.querySelectorAll('img').forEach(img => img.remove());

  // 2. Remove empty paragraphs
  doc.querySelectorAll('p').forEach(p => {
    if (!p.textContent?.trim()) {
      p.remove();
    }
  });

  // 3. Remove empty table rows
  doc.querySelectorAll('tr').forEach(tr => {
    const cells = Array.from(tr.querySelectorAll('td'));
    const isEmpty = cells.every(cell => !cell.textContent?.trim());
    if (isEmpty && cells.length > 0) {
      tr.remove();
    }
  });

  // 4. Unwrap paragraphs and divs inside table cells
  doc.querySelectorAll('td').forEach(td => {
    // Find all p and div elements inside the cell
    const blockElements = td.querySelectorAll('p, div');
    blockElements.forEach(el => {
      // Create a text node with the content + space to prevent sticking
      const text = (el.textContent || '') + ' ';
      const textNode = doc.createTextNode(text);
      el.replaceWith(textNode);
    });
  });

  // 5. Ensure tables have a header for GFM compatibility
  doc.querySelectorAll('table').forEach(table => {
    const thead = table.querySelector('thead');
    if (!thead) {
      const tbody = table.querySelector('tbody');
      const firstRow = tbody?.querySelector('tr');
      if (tbody && firstRow) {
        const newThead = doc.createElement('thead');
        newThead.appendChild(firstRow); // Moves the row to thead
        table.insertBefore(newThead, tbody);
      }
    }
  });

  return doc.body.innerHTML;
};

const parseDocx = async (file: File): Promise<FileParseResult> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Configure mammoth to ignore images or replace them with lightweight placeholders
  const options = {
    convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' }))
  };

  // Convert to HTML first to preserve table structure
  const result = await mammoth.convertToHtml({ arrayBuffer }, options);
  let html = result.value;
  
  // Use extracted cleaning logic
  html = cleanHtml(html);

  // Convert HTML to Markdown (preserving tables)
  const markdown = turndownService.turndown(html);
  
  return {
    text: markdown,
    type: 'docx'
  };
};

const parseExcel = async (file: File): Promise<FileParseResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  let allContent = '';
  
  // Iterate through all sheets
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    // Convert sheet to array of arrays
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    
    if (rows.length > 0) {
      allContent += `## Sheet: ${sheetName}\n\n`;
      allContent += convertRowsToMarkdownTable(rows) + '\n\n';
    }
  });
  
  return {
    text: allContent.trim(),
    type: 'xlsx'
  };
};

// Helper to convert array of arrays to Markdown table
const convertRowsToMarkdownTable = (rows: unknown[][]): string => {
  if (rows.length === 0) return '';
  
  // Determine max columns
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (colCount === 0) return '';
  
  let markdown = '';
  
  // Header
  const headerRow = rows[0] || [];
  const safeHeader = Array(colCount).fill('').map((_, i) => String(headerRow[i] ?? '').replace(/\n/g, ' '));
  markdown += '| ' + safeHeader.join(' | ') + ' |\n';
  
  // Separator
  markdown += '| ' + Array(colCount).fill('---').join(' | ') + ' |\n';
  
  // Body
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const safeRow = Array(colCount).fill('').map((_, j) => String(row[j] ?? '').replace(/\n/g, ' '));
    markdown += '| ' + safeRow.join(' | ') + ' |\n';
  }
  
  return markdown;
};
