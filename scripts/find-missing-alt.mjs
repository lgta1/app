#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd(), 'app');
const results = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (/\.tsx$/.test(entry)) scanFile(full);
  }
}

function scanFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  // Rough parse: capture <img ... >, allowing newlines until closing '>' not followed by '\n<' inside same tag
  // We'll iterate charwise to collect tags starting with <img
  let i = 0;
  while (i < text.length) {
    const idx = text.indexOf('<img', i);
    if (idx === -1) break;
    let j = idx + 4; // start after '<img'
    let inString = false;
    let stringChar = '';
    while (j < text.length) {
      const c = text[j];
      if (inString) {
        if (c === stringChar && text[j-1] !== '\\') inString = false;
      } else {
        if (c === '"' || c === '\'') { inString = true; stringChar = c; }
        else if (c === '>') { j++; break; }
      }
      j++;
    }
    const tag = text.slice(idx, j);
    // Skip if it's a closing tag or malformed
    if (/^<img[^>]*>$/s.test(tag)) {
      const hasAlt = /\balt\s*=/.test(tag);
      if (!hasAlt) {
        // derive approximate line number
        const pre = text.slice(0, idx);
        const line = pre.split(/\n/).length;
        results.push({ file, line, snippet: tag.replace(/\n/g, ' ') });
      }
    }
    i = j;
  }
}

walk(root);

if (results.length === 0) {
  console.log('✅ Không tìm thấy <img> thiếu alt');
} else {
  console.log('⚠️ Phát hiện', results.length, 'thẻ <img> thiếu alt');
  for (const r of results) {
    console.log(`- ${path.relative(process.cwd(), r.file)}:${r.line} :: ${r.snippet}`);
  }
}
