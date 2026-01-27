
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';

/**
 * 导出工具类
 * 支持将文本导出为 Markdown, TXT 和 Word (.docx) 格式
 */

export const downloadFile = (content: Blob | string, filename: string, type: string) => {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToMarkdown = (content: string, filename: string = 'translation.md') => {
  downloadFile(content, filename, 'text/markdown;charset=utf-8');
};

export const exportToTxt = (content: string, filename: string = 'translation.txt') => {
  downloadFile(content, filename, 'text/plain;charset=utf-8');
};

// Helper to check if a line is a markdown table row
const isTableRow = (line: string) => {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
};

// Helper to check if a line is a markdown separator row (e.g., |---|---|)
const isSeparatorRow = (line: string) => {
  return isTableRow(line) && line.replace(/\|/g, '').trim().match(/^[\s\-:]+$/);
};

// Parse a markdown table row into cells
const parseTableRow = (line: string): string[] => {
  // Remove leading/trailing pipes and split by pipe
  // Note: simpler regex that assumes no escaped pipes for now
  return line.trim()
    .slice(1, -1)
    .split('|')
    .map(cell => cell.trim());
};

export const exportToDocx = async (content: string, filename: string = 'translation.docx') => {
  const lines = content.split(/\n/);
  const children: (Paragraph | Table)[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if we are starting a table
    if (isTableRow(line)) {
      const tableRows: TableRow[] = [];
      
      // Look ahead to check if the next line is a separator (confirming it's a table header)
      // or if we are already in a table body
      // We'll just assume any block of pipe-rows is a table for simplicity
      
      let tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        // Skip separator lines
        if (!isSeparatorRow(lines[i])) {
          tableLines.push(lines[i]);
        }
        i++;
      }
      
      // Create docx table rows
      for (const tableLine of tableLines) {
        const cells = parseTableRow(tableLine);
        const docxCells = cells.map(cellText => {
          return new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cellText,
                    font: "Times New Roman",
                    size: 22, // 11pt for table content
                  }),
                ],
              }),
            ],
            width: {
              size: 100 / cells.length,
              type: WidthType.PERCENTAGE,
            },
          });
        });
        
        tableRows.push(new TableRow({
          children: docxCells,
        }));
      }
      
      if (tableRows.length > 0) {
        children.push(new Table({
          rows: tableRows,
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          }
        }));
        // Add spacing after table
        children.push(new Paragraph({ text: "" })); 
      }
      
      // Continue loop without incrementing i because inner loop already did
      continue;
    }
    
    // Regular paragraph
    if (line.trim()) {
      children.push(new Paragraph({
        children: [
          new TextRun({
            text: line,
            font: "Times New Roman",
            size: 24, // 12pt
          }),
        ],
        spacing: {
          after: 200,
          line: 360,
        },
      }));
    } else {
      // Empty line -> empty paragraph
       children.push(new Paragraph({ text: "" }));
    }
    i++;
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadFile(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
};

export const generateFilename = (originalName: string, ext: string): string => {
  const date = new Date().toISOString().split('T')[0];
  const baseName = originalName ? originalName.replace(/\.[^/.]+$/, "") : 'translation';
  return `${baseName}_${date}.${ext}`;
};
