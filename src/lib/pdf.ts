// A small, dependency-free PDF writer (PDF 1.4, standard Helvetica fonts).
// It produces real, valid PDF files: correct xref table, page tree, text streams.

export type PdfBlock =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'rule' }
  | { type: 'kv'; pairs: [string, string][] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'space' };

export interface PdfDoc {
  title: string;
  subtitle?: string;
  footer?: string;
  blocks: PdfBlock[];
}

const WIDTHS: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667,
  T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '[': 278, '\\': 278,
  ']': 278, '^': 469, _: 556, '`': 333, a: 556, b: 556, c: 500, d: 556, e: 556,
  f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556,
  p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500,
  z: 500, '{': 334, '|': 260, '}': 334, '~': 584,
};

const TRANSLIT: Record<string, string> = {
  '—': '-', '–': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...', '·': '*',
  '•': '*', '✓': '+', '→': '->', '×': 'x', '€': 'EUR', '£': 'GBP', '≈': '~',
};

const textWidth = (s: string, size: number) => {
  let w = 0;
  for (const ch of s) w += (WIDTHS[ch] ?? 556) * size;
  return w / 1000;
};

const esc = (s: string) =>
  s
    .replace(/[^\x20-\x7E]/g, (c) => TRANSLIT[c] ?? '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

function wrap(text: string, size: number, maxWidth: number, bold = false): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [''];
  const words = clean.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const w = textWidth(candidate, size) * (bold ? 1.03 : 1);
    if (w > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

export function buildPdf(doc: PdfDoc): Blob {
  const pages: string[][] = [];
  let page: string[] = [];
  let y = 0;

  const newPage = () => {
    if (page.length) pages.push(page);
    page = [];
    y = PAGE_H - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 24) newPage();
  };
  const draw = (text: string, size: number, bold: boolean, x = MARGIN, color = '0 0 0') => {
    page.push(
      `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(text)}) Tj ET`
    );
  };
  const line = (gap = 1) => {
    y -= gap;
    page.push(`0.86 0.87 0.9 RG 0.7 w ${MARGIN} ${y.toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${y.toFixed(2)} l S`);
  };

  newPage();

  // Cover block
  page.push(`${MARGIN} ${(PAGE_H - 96).toFixed(2)} ${(CONTENT_W).toFixed(2)} 60 re 0.043 0.478 1 rg f`);
  y = PAGE_H - 96 + 22;
  draw(doc.title, 20, true, MARGIN + 16, '1 1 1');
  y -= 22;
  if (doc.subtitle) {
    draw(doc.subtitle, 10.5, false, MARGIN + 16, '0.92 0.95 1');
    y -= 16;
  }
  y = PAGE_H - 132;

  for (const block of doc.blocks) {
    if (block.type === 'h1') {
      ensure(56);
      y -= 20;
      draw(block.text, 14, true);
      y -= 7;
      line();
      y -= 11;
    } else if (block.type === 'h2') {
      ensure(40);
      y -= 12;
      draw(block.text, 11.5, true);
      y -= 15;
    } else if (block.type === 'p') {
      const lines = wrap(block.text, 10, CONTENT_W);
      for (const l of lines) {
        ensure(18);
        draw(l, 10, false);
        y -= 13.4;
      }
      y -= 3;
    } else if (block.type === 'bullet') {
      for (const item of block.items) {
        const lines = wrap(item, 10, CONTENT_W - 16);
        lines.forEach((l, i) => {
          ensure(18);
          if (i === 0) draw('•', 10, false, MARGIN + 3);
          draw(l, 10, false, MARGIN + 16);
          y -= 13.4;
        });
        y -= 1.4;
      }
      y -= 3;
    } else if (block.type === 'kv') {
      for (const [k, v] of block.pairs) {
        ensure(18);
        draw(k, 9, true, MARGIN, '0.36 0.38 0.44');
        const vLines = wrap(v || '—', 10, CONTENT_W - 150);
        vLines.forEach((l, i) => {
          if (i > 0) ensure(18);
          draw(l, 10, false, MARGIN + 150);
          y -= 13.4;
        });
      }
      y -= 4;
    } else if (block.type === 'table') {
      const cols = block.head.length;
      const colW = CONTENT_W / cols;
      ensure(24);
      block.head.forEach((h, i) => draw(h.toUpperCase(), 8, true, MARGIN + i * colW, '0.36 0.38 0.44'));
      y -= 8;
      line();
      y -= 10;
      for (const row of block.rows) {
        const cells = row.map((c, i) => wrap(c, 9.5, colW - 8).slice(0, 3));
        const h = Math.max(...cells.map((c) => c.length)) * 12;
        ensure(h + 6);
        cells.forEach((linesArr, i) => {
          linesArr.forEach((l, li) => {
            page.push(
              `BT /${i === 0 ? 'F2' : 'F1'} 9.5 Tf 0 0 0 rg 1 0 0 1 ${(MARGIN + i * colW).toFixed(2)} ${(y - li * 11.6).toFixed(2)} Tm (${esc(l)}) Tj ET`
            );
          });
        });
        y -= h + 4;
        line(0);
      }
      y -= 6;
    } else if (block.type === 'rule') {
      ensure(18);
      y -= 4;
      line();
      y -= 10;
    } else {
      y -= 10;
    }
  }
  if (page.length) pages.push(page);

  // Footer on every page
  const footer = doc.footer || 'NsPace · Visa Automate';
  pages.forEach((content, i) => {
    content.push(
      `BT /F1 8 Tf 0.55 0.57 0.62 rg 1 0 0 1 ${MARGIN} 32 Tm (${esc(footer)}) Tj ET`,
      `BT /F1 8 Tf 0.55 0.57 0.62 rg 1 0 0 1 ${(PAGE_W - MARGIN - 40).toFixed(2)} 32 Tm (Page ${i + 1} of ${pages.length}) Tj ET`
    );
  });

  // Serialise
  const objects: string[] = [];
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pages.forEach((content, i) => {
    const stream = content.join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 ${3 + pages.length * 2} 0 R >> >> /Contents ${5 + i * 2} 0 R >>`
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    out += `${String(o).padStart(10, '0')} 00000 n \n`;
  });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${esc(doc.title)}) /Producer (NsPace Visa Automate) >> >>\nstartxref\n${xrefPos}\n%%EOF`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
