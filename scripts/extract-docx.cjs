#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

(async () => {
  const [, , inputPath, outputPathArg] = process.argv;
  if (!inputPath) {
    console.error('Usage: node scripts/extract-docx.cjs <input.docx> [output.txt]');
    process.exit(1);
  }
  const resolvedInput = path.resolve(inputPath);
  const outPath = outputPathArg ? path.resolve(outputPathArg) : resolvedInput.replace(/\.docx$/i, '.txt');
  try {
    const result = await mammoth.extractRawText({ path: resolvedInput });
    fs.writeFileSync(outPath, result.value, 'utf8');
    console.log(`Extracted to: ${outPath}`);
  } catch (err) {
    console.error('Failed to extract DOCX:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();