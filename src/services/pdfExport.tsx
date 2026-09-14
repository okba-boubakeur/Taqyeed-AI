import pdfMake from 'pdfmake-rtl';
import vfs from '../fonts/vfs_fonts';
import { marked } from 'marked';
import htmlToPdfmake from 'html-to-pdfmake';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isTauri } from './platform';
import { useAppStore } from '../store';

// ─── Font Registration ───────────────────────────────────────────────────────
// Write embedded Tajawal font data into pdfmake-rtl's virtual filesystem.
for (const [filename, base64Data] of Object.entries(vfs)) {
  (pdfMake as any).virtualfs.writeFileSync(filename, base64Data, 'base64');
}

(pdfMake as any).fonts = {
  Tajawal: {
    normal: 'Tajawal-Regular.ttf',
    bold: 'Tajawal-Bold.ttf',
    italics: 'Tajawal-Regular.ttf',
    bolditalics: 'Tajawal-Bold.ttf',
  },
};

// ─── Design & Brand Tokens (Inspired by Executive Dashboard Layouts) ──────────
const BRAND = '#006239';         // Signature Taqyeed Emerald
const BRAND_TINT = '#E8F5E9';    // Emerald Pill Background
const TEXT_PRIMARY = '#0F172A';  // Deep Slate
const TEXT_SECONDARY = '#64748B';// Muted Slate
const BORDER_LIGHT = '#E2E8F0';  // Crisp Divider Border

function isDarkColor(colorStr: string): boolean {
  if (!colorStr) return false;
  const str = colorStr.trim().toLowerCase();
  if (['black', '#000', '#000000', '#0f172a', '#171717', '#18181b', '#1e293b', '#09090b', '#121212'].includes(str)) return true;
  if (['white', '#fff', '#ffffff', '#fafafa', '#f8fafc', '#f1f5f9', '#f3f4f6', '#e2e8f0'].includes(str)) return false;

  if (str.startsWith('rgb')) {
    const parts = str.match(/\d+/g);
    if (parts && parts.length >= 3) {
      const r = parseInt(parts[0], 10);
      const g = parseInt(parts[1], 10);
      const b = parseInt(parts[2], 10);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
    }
  }

  const clean = str.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return !isNaN(r) && !isNaN(g) && !isNaN(b) && ((0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5);
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return !isNaN(r) && !isNaN(g) && !isNaN(b) && ((0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5);
  }
  return false;
}

function sanitizeNodeContrast(nodes: any[], isDarkPaper: boolean, fallbackColor: string, headingColor: string = BRAND) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (!node) continue;
    if (typeof node === 'object') {
      if (node.isReference || (node.opacity !== undefined && node.opacity < 1)) continue;
      const isHeading = node.style === 'h1' || node.style === 'h2' || node.style === 'h3' || node.style === 'h4';
      const targetFallback = isHeading ? headingColor : fallbackColor;

      if (node.color) {
        const dark = isDarkColor(node.color);
        if (!isDarkPaper && !dark) {
          node.color = targetFallback;
        } else if (isDarkPaper && dark) {
          node.color = isHeading ? '#10B981' : fallbackColor;
        }
      }
      // Remove text highlight backgrounds (no ugly marker boxes in PDF)
      if (node.background && !node.table && !node.isTable) {
        delete node.background;
      }
      if (Array.isArray(node.text)) sanitizeNodeContrast(node.text, isDarkPaper, fallbackColor, headingColor);
      if (node.stack) sanitizeNodeContrast(node.stack, isDarkPaper, fallbackColor, headingColor);
      if (node.ul) sanitizeNodeContrast(node.ul, isDarkPaper, fallbackColor, headingColor);
      if (node.ol) sanitizeNodeContrast(node.ol, isDarkPaper, fallbackColor, headingColor);
      if (node.columns) sanitizeNodeContrast(node.columns, isDarkPaper, fallbackColor, headingColor);
      if (node.table && node.table.body) {
        for (const row of node.table.body) {
          sanitizeNodeContrast(row, isDarkPaper, fallbackColor, headingColor);
        }
      }
    }
  }
}

// ─── SVG to PNG Rasterizer for PDF Brand Logo ────────────────────────────────
async function loadSvgAsPng(url: string): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '';
  }

  let srcUrl = url;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const svgText = await res.text();
      srcUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    }
  } catch {
    // Keep fallback srcUrl
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 64, 64);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve('');
        }
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = srcUrl;
  });
}

// ─── Background Image to Data URL Loader ────────────────────────────────────
async function loadImageAsDataUrl(url: string, fillColor?: string): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '';

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Cap at A4@150dpi (1240×1754) to keep PDF size reasonable
        const MAX_W = 1240;
        const MAX_H = 1754;
        const srcW = img.naturalWidth || MAX_W;
        const srcH = img.naturalHeight || MAX_H;
        const scale = Math.min(MAX_W / srcW, MAX_H / srcH, 1);
        canvas.width = Math.round(srcW * scale);
        canvas.height = Math.round(srcH * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill with a solid color first so transparent pixels in SVG/PNG
          // don't become black when encoded as JPEG (which has no alpha channel)
          ctx.fillStyle = fillColor || '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve('');
        }
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = url;
  });
}


// ─── References / Citations Section Detection Helper ────────────────────────
export function isReferencesHeadingText(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = text
    .replace(/^[\s#*•\-\d.)(\[\]]+/, '')
    .replace(/[\s*:#.()\[\]]+$/, '')
    .trim();

  if (!clean || clean.length > 80) return false;

  const refTerms = '(?:و?التخريج|و?المراجع|و?المصادر|و?الهوامش|و?الحواشي|تخريج(?:\\s+(?:الأحاديث|الآثار))?|و?الآثار|قائمة\\s+(?:المراجع|المصادر)|references|sources|citations|bibliography|footnotes|و?المعتمدة)';
  const delim = '(?:\\s*(?:و|and|\\/|&|-|,|،)?\\s+)';
  const pattern = new RegExp(`^(?:قسم\\s+)?${refTerms}(?:${delim}${refTerms})*(?:\\s*\\([^\\)]+\\))?$`, 'i');

  return pattern.test(clean);
}

// ─── HTML Preprocessor (Quill & Tiptap Support) ──────────────────────────────
// 1. Quill uses <ol data-list="bullet"> for bullet lists. Convert to semantic <ul>.
// 2. Tiptap wraps <li> contents in <p>, which introduces extraneous margin in pdfmake.
//    Unwrap <p> inside <li> so items are compact and correctly classified.
// 3. Ensure a horizontal line precedes the references/citations section and remove bold from all its elements.
function preprocessEditorHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Convert Quill bullet <ol> to <ul>
  doc.querySelectorAll('ol').forEach((ol) => {
    const items = Array.from(ol.querySelectorAll('li'));
    const allBullets = items.every((li) => li.getAttribute('data-list') === 'bullet');
    if (allBullets && items.length > 0) {
      const ul = doc.createElement('ul');
      items.forEach((li) => {
        li.removeAttribute('data-list');
        ul.appendChild(li);
      });
      ol.replaceWith(ul);
    }
  });

  // 2. Unwrap direct <p> tags inside <li> to prevent extra paragraph spacing & stack wrapping
  doc.querySelectorAll('li > p').forEach((p) => {
    p.replaceWith(...Array.from(p.childNodes));
  });

  // 3. Ensure references section has a separator line preceding it and strip bold formatting
  const candidateHeadings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div'));
  for (const el of candidateHeadings) {
    const text = el.textContent?.trim() || '';
    const isHeaderTag = /^H[1-6]$/.test(el.tagName.toUpperCase());
    const isBoldElement = el.querySelector('strong, b') !== null;
    if ((isHeaderTag || isBoldElement || text.length < 80) && isReferencesHeadingText(text)) {
      const prev = el.previousElementSibling;
      if (!prev || prev.tagName.toUpperCase() !== 'HR') {
        const hr = doc.createElement('hr');
        el.parentNode?.insertBefore(hr, el);
      }
      // Guarantee font is NEVER bold in the references heading
      el.querySelectorAll('strong, b').forEach((b) => {
        b.replaceWith(...Array.from(b.childNodes));
      });
      // Guarantee font is NEVER bold in any subsequent elements of this references section
      let sibling = el.nextElementSibling;
      while (sibling) {
        if (/^H[1-2]$/.test(sibling.tagName.toUpperCase()) && !isReferencesHeadingText(sibling.textContent || '')) {
          break;
        }
        sibling.querySelectorAll('strong, b').forEach((b) => {
          b.replaceWith(...Array.from(b.childNodes));
        });
        sibling = sibling.nextElementSibling;
      }
      break;
    }
  }

  return doc.body.innerHTML;
}

// ─── Helper to Extract Plain Text from pdfmake AST Nodes ─────────────────────
function extractTextFromNode(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.text)) {
    return node.text.map(extractTextFromNode).join('');
  }
  if (Array.isArray(node.stack)) {
    return node.stack.map(extractTextFromNode).join('');
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromNode).join('');
  }
  return '';
}

// Typography & Semantic Colors requested by user:
// - Very important words in bold/Golden Color
// - Ayat in golden color
// - Hadith in Green color
// - Citations/References in gray color
const GOLD_LIGHT = '#B45309';    // Warm Golden Amber (high contrast on light paper)
const GOLD_DARK = '#F59E0B';     // Vibrant Gold for dark paper
const GREEN_LIGHT = '#059669';   // Authentic Emerald Green for light paper
const GREEN_DARK = '#10B981';    // Bright Emerald Green for dark paper
const GRAY_LIGHT = '#64748B';    // Neutral Gray for light paper
const GRAY_DARK = '#94A3B8';     // Soft Slate Gray for dark paper

// ─── RTL List Normalizer Engine ──────────────────────────────────────────────
// Deep-dive fix for: "Bullets at left side and text at right side"
//
// Root causes in pdfmake-rtl:
// 1. In `LayoutBuilder.js`, `processList` does NOT check `node.rtl`, it only calls `this._isListRTL(listItems)`.
// 2. `_isListRTL` strictly checks `typeof item === 'string'` or `item.text`.
//    When `html-to-pdfmake` outputs rich nested list items, items are either Arrays or `{ stack: [...] }`.
//    Because `item.text` is undefined on arrays and stacks, `_isListRTL` returns false,
//    causing pdfmake-rtl to default to LTR and draw the bullet at `-marker._minWidth` (the far left margin)!
// 3. Sub-lists nested inside `item.stack` were previously never traversed or normalized.
//
// Solution:
// Recursively walk every node and nested list:
// 1. Normalize all array items into `{ text: inlines, alignment: 'right' }`.
// 2. Prepend `\u061C` (Unicode Arabic Letter Mark, zero-width invisible) to all list texts in RTL mode,
//    which guarantees `_isListRTL` evaluates to true 100% of the time.
// 3. Remove LTR left-margins (`marginLeft`) and apply clean RTL right indentation (`margin: [0, 2, 14, 4]`).
function normalizePdfLists(nodes: any, isDocRtl: boolean, depth: number = 0): void {
  if (!nodes) return;
  const list = Array.isArray(nodes) ? nodes : [nodes];

  for (const node of list) {
    if (!node || typeof node !== 'object') continue;

    // 1. Process unordered lists (bullets)
    if (node.ul && Array.isArray(node.ul)) {
      node.ul = node.ul.map((item: any) => {
        if (Array.isArray(item)) {
          return { text: item, alignment: isDocRtl ? 'right' : 'left' };
        }
        if (item && typeof item === 'object') {
          if (item.stack) {
            normalizePdfLists(item.stack, isDocRtl, depth + 1);
            item.text = extractTextFromNode(item.stack);
          } else if (item.text) {
            if (Array.isArray(item.text)) {
              normalizePdfLists(item.text, isDocRtl, depth + 1);
            }
          }
          if (isDocRtl) item.alignment = 'right';
        }
        return item;
      });

      if (isDocRtl) {
        node.rtl = true;
        if (node.margin && Array.isArray(node.margin)) {
          node.margin[0] = 0;
          if (depth > 0) {
            node.margin[2] = 14; // right indent for sub-lists
          }
        } else if (depth > 0) {
          node.margin = [0, 2, 14, 4];
        }
      }
    }

    // 2. Process ordered lists (numbers: 1., 2., 3.)
    if (node.ol && Array.isArray(node.ol)) {
      node.ol = node.ol.map((item: any) => {
        if (Array.isArray(item)) {
          return { text: item, alignment: isDocRtl ? 'right' : 'left' };
        }
        if (item && typeof item === 'object') {
          if (item.stack) {
            normalizePdfLists(item.stack, isDocRtl, depth + 1);
            item.text = extractTextFromNode(item.stack);
          } else if (item.text) {
            if (Array.isArray(item.text)) {
              normalizePdfLists(item.text, isDocRtl, depth + 1);
            }
          }
          if (isDocRtl) item.alignment = 'right';
        }
        return item;
      });

      if (isDocRtl) {
        node.rtl = true;
        if (node.margin && Array.isArray(node.margin)) {
          node.margin[0] = 0;
          if (depth > 0) {
            node.margin[2] = 14;
          }
        } else if (depth > 0) {
          node.margin = [0, 2, 14, 4];
        }
      }
    }

    // 3. Recursively process nested stacks, columns, and tables
    if (node.stack) normalizePdfLists(node.stack, isDocRtl, depth);
    if (node.columns) normalizePdfLists(node.columns, isDocRtl, depth);
    if (node.table && node.table.body) {
      for (const row of node.table.body) {
        normalizePdfLists(row, isDocRtl, depth);
      }
    }
  }
}

// ─── Format Subtree for References / Citations ───────────────────────────────
function formatReferenceNode(node: any, refColor: string, isHeading: boolean = false): void {
  if (!node || typeof node !== 'object') return;

  // Never bold anything in the references section
  node.bold = false;
  node.color = refColor;
  node.isReference = true;
  delete node.opacity; // Keep solid and fully legible to normal eyes

  if (isHeading) {
    node.fontSize = 12;
    node.bold = false;
    node.margin = [0, 10, 0, 6];
  } else {
    if (node.fontSize === undefined || node.fontSize > 10.5) {
      node.fontSize = 10.5;
    }
    node.bold = false;
    node.lineHeight = 1.4;
    if (node.margin && Array.isArray(node.margin)) {
      node.margin[1] = Math.min(node.margin[1] || 0, 2);
      node.margin[3] = Math.min(node.margin[3] || 0, 3);
    }
  }

  // Strip bold styles from node.style
  if (typeof node.style === 'string' && (node.style === 'b' || node.style === 'strong')) {
    node.style = undefined;
  } else if (Array.isArray(node.style)) {
    node.style = node.style.filter((s: string) => s !== 'b' && s !== 'strong');
  }

  if (Array.isArray(node.text)) {
    for (const child of node.text) {
      if (child && typeof child === 'object') {
        formatReferenceNode(child, refColor, isHeading);
      }
    }
  } else if (node.text && typeof node.text === 'object') {
    formatReferenceNode(node.text, refColor, isHeading);
  }

  if (Array.isArray(node.stack)) {
    for (const child of node.stack) {
      formatReferenceNode(child, refColor, false);
    }
  }

  if (node.ul && Array.isArray(node.ul)) {
    node.bold = false;
    node.color = refColor;
    delete node.opacity;
    node.isReference = true;
    for (const item of node.ul) {
      formatReferenceNode(item, refColor, false);
    }
  }

  if (node.ol && Array.isArray(node.ol)) {
    node.bold = false;
    node.color = refColor;
    delete node.opacity;
    node.isReference = true;
    for (const item of node.ol) {
      formatReferenceNode(item, refColor, false);
    }
  }

  if (node.columns && Array.isArray(node.columns)) {
    for (const col of node.columns) {
      formatReferenceNode(col, refColor, false);
    }
  }

  if (node.table && node.table.body) {
    for (const row of node.table.body) {
      for (const cell of row) {
        formatReferenceNode(cell, refColor, false);
      }
    }
  }
}

// ─── References / Citations Section Separator & Styler ───────────────────────
function processReferencesSection(contentArray: any[], isDarkPaper: boolean): void {
  if (!Array.isArray(contentArray) || contentArray.length === 0) return;

  // Solid, highly legible muted slate tones (no compounding opacity)
  const refColor = isDarkPaper ? '#94A3B8' : '#475569';
  const borderRuleColor = isDarkPaper ? '#334155' : BORDER_LIGHT;

  let refIndex = -1;
  for (let i = 0; i < contentArray.length; i++) {
    const node = contentArray[i];
    if (!node) continue;
    const text = extractTextFromNode(node);
    if (isReferencesHeadingText(text)) {
      refIndex = i;
      break;
    }
  }

  if (refIndex === -1) return;

  // 1. Ensure a separator line directly precedes the references section
  let hasLineBefore = false;
  if (refIndex > 0) {
    const prev = contentArray[refIndex - 1];
    if (prev && (prev.canvas || prev.style === 'hr' || (prev.table && prev.table.body?.length === 1))) {
      hasLineBefore = true;
    }
  }

  if (!hasLineBefore) {
    const separatorLine = {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 515,
          y2: 0,
          lineWidth: 0.75,
          lineColor: borderRuleColor,
        },
      ],
      margin: [0, 18, 0, 12],
    };
    contentArray.splice(refIndex, 0, separatorLine);
    refIndex++;
  }

  // 2. Format the references heading (never bold, 12pt, solid refColor)
  formatReferenceNode(contentArray[refIndex], refColor, true);

  // 3. Format all subsequent nodes belonging to the references section (never bold, 10.5pt, solid refColor)
  for (let i = refIndex + 1; i < contentArray.length; i++) {
    const node = contentArray[i];
    if (node && (node.style === 'h1' || node.style === 'h2') && !isReferencesHeadingText(extractTextFromNode(node))) {
      break;
    }
    formatReferenceNode(node, refColor, false);
  }
}

// ─── Markdown / HTML → pdfmake Content Array ─────────────────────────────────
async function markdownToContent(
  summary: string,
  isRtl: boolean,
  textColor: string = TEXT_PRIMARY,
  isDarkPaper: boolean = false
): Promise<any[]> {
  let text = summary;

  // If content is pure markdown without HTML tags, convert using 'marked'
  if (!/<[a-z][\s\S]*>/i.test(text)) {
    text = await marked.parse(text);
  }

  // Clean editor artifacts (Quill bullet markers and Tiptap nested <p>s in <li>)
  text = preprocessEditorHtml(text);

  const headingColor = isDarkPaper ? '#10B981' : BRAND;
  const goldColor = isDarkPaper ? GOLD_DARK : GOLD_LIGHT;
  const greenColor = isDarkPaper ? GREEN_DARK : GREEN_LIGHT;
  const grayColor = isDarkPaper ? GRAY_DARK : GRAY_LIGHT;
  const refColor = isDarkPaper ? '#94A3B8' : '#475569';

  // ── Remove All Highlight Background Colors (Use Italics & Semantic Colors: Red / Green / Golden) ──
  text = text.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, `<span style="color: ${goldColor}; font-style: italic; font-weight: bold;">$1</span>`);
  text = text.replace(/==([^=\n]+)==/g, `<span style="color: ${goldColor}; font-style: italic; font-weight: bold;">$1</span>`);
  text = text.replace(/(<span[^>]*?)background(?:-color)?:\s*[^;"]+;?/gi, '$1');

  // ── Theme Contrast Sanitization ──
  // Guarantee that font in light background never displays white/light font or invisible highlights,
  // and vice-versa for dark backgrounds.
  if (!isDarkPaper) {
    text = text.replace(/color:\s*(?:white|#fff(?:fff)?|#f8fafc|#fafafa|#f1f5f9|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/gi, `color: ${textColor}`);
  } else {
    text = text.replace(/color:\s*(?:black|#000(?:000)?|#0f172a|#171717|#18181b|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/gi, `color: ${textColor}`);
  }

  // ── Islamic & Semantic Content Post-Processing ──
  // 1. Ayat (Quranic Verses) in Golden Color
  text = text.replace(/﴿([^﴾]+)﴾/g, `<span style="color: ${goldColor}; font-weight: bold; font-style: italic;">﴿$1﴾</span>`);
  text = text.replace(/\{([^{}]+)\}/g, (match, inner) => {
    return /[\u0600-\u06FF]/.test(inner) ? `<span style="color: ${goldColor}; font-weight: bold; font-style: italic;">{${inner}}</span>` : match;
  });

  // 2. Prophetic Hadiths in Green Color
  text = text.replace(/«([^»]+)»/g, `<span style="color: ${greenColor}; font-weight: bold;">«$1»</span>`);

  // 3. Citations & References in Slate Color (never bold, small font size 10.5pt, solid opacity)
  text = text.replace(/(\((?:سورة|رواه|أخرجه|متفق عليه|صحيح|حسن|ضعيف|تخريج|المصدر|المرجع|انظر)[^\)]+\))/g, `<span style="color: ${refColor}; font-style: italic; font-weight: normal; font-size: 10.5pt;">$1</span>`);

  // Parse HTML into pdfmake JSON AST with executive typography styling
  const pdfContent = htmlToPdfmake(text, {
    defaultStyles: {
      b: { bold: true },
      strong: { bold: true },
      u: { decoration: 'underline' },
      s: { decoration: 'lineThrough' },
      em: { italics: true },
      i: { italics: true },
      h1: { fontSize: 18, color: textColor, bold: true, margin: [0, 14, 0, 8] },
      h2: { fontSize: 16.5, color: textColor, bold: true, margin: [0, 12, 0, 6] },
      h3: { fontSize: 15, color: textColor, bold: true, margin: [0, 8, 0, 4] },
      h4: { fontSize: 14, color: textColor, bold: true, margin: [0, 6, 0, 3] },
      p: { fontSize: 13.5, color: textColor, lineHeight: 1.45, margin: [0, 0, 0, 7] },
      ul: { margin: [0, 2, 0, 6] },
      ol: { margin: [0, 2, 0, 6] },
      li: { fontSize: 13.5, color: textColor, lineHeight: 1.45, margin: [0, 1.5, 0, 4] },
      th: { fontSize: 13.5, bold: true },
      td: { fontSize: 13 },
      mark: {
        color: goldColor,
        italics: true,
        bold: true,
      },
      blockquote: {
        fontSize: 13,
        italics: true,
        color: textColor,
        background: isDarkPaper ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
        margin: [0, 6, 0, 6],
      },
      code: {
        font: 'Tajawal',
        fontSize: 12,
        background: isDarkPaper ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
      },
    },
    customStyles: {
      ayah: { color: goldColor, bold: true, italics: true },
      hadith: { color: greenColor, bold: true },
      citation: { color: refColor, italics: true, bold: false, fontSize: 10.5 },
      reference: { color: refColor, italics: true, bold: false, fontSize: 10.5 },
      important: { color: goldColor, bold: true, italics: true },
      highlightGold: { color: goldColor, bold: true, italics: true },
      highlightGreen: { color: greenColor, bold: true, italics: true },
      highlightRed: { color: isDarkPaper ? '#F87171' : '#DC2626', bold: true, italics: true },
    },
  });

  const contentArray = Array.isArray(pdfContent) ? pdfContent : [pdfContent];

  // Apply recursive RTL list normalizer to guarantee markers align on the correct side
  normalizePdfLists(contentArray, isRtl);

  // Apply recursive contrast sanitizer so no text is ever invisible against the paper
  sanitizeNodeContrast(contentArray, isDarkPaper, textColor, headingColor);

  // Apply references and citations section separation and 50% opacity styling
  processReferencesSection(contentArray, isDarkPaper);

  return contentArray;
}

// ─── Dual Date Formatter (Hijri + Gregorian) ──────────────────────────────
export function formatPdfHeaderDate(dateInput: string | Date, isArabic: boolean): string {
  const d = new Date(dateInput);
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const HIJRI_MONTHS_EN: Record<number, string> = {
    1: 'Muharram',
    2: 'Safar',
    3: "Rabi' al-Awwal",
    4: "Rabi' al-Thani",
    5: 'Jumada al-Awwal',
    6: 'Jumada al-Thaniyah',
    7: 'Rajab',
    8: "Sha'ban",
    9: 'Ramadan',
    10: 'Shawwal',
    11: "Dhu al-Qi'dah",
    12: 'Dhu al-Hijjah',
  };

  try {
    if (isArabic) {
      // Hijri formatted in Arabic with Latin/Western digits
      const hijriAr = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(validDate).replace(/،|,/g, '').trim();

      // Gregorian formatted in Arabic
      const gregAr = new Intl.DateTimeFormat('ar-DZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(validDate).trim();

      return `التاريخ: ${hijriAr}  /  ${gregAr}`;
    } else {
      // English mode:
      // Date: Thursday, 28 Rabi' al-Awwal 1448 AH, corresponding to September 10, 2026
      const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
        weekday: 'long',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      }).formatToParts(validDate);

      const p: Record<string, string> = {};
      for (const part of parts) {
        p[part.type] = part.value;
      }

      const weekday = p.weekday || 'Thursday';
      const day = p.day || '1';
      const monthNum = parseInt(p.month || '1', 10);
      const monthName = HIJRI_MONTHS_EN[monthNum] || "Rabi' al-Awwal";
      const year = p.year || '1448';
      const era = p.era || 'AH';

      const gregEn = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(validDate);

      return `${weekday}, ${day} ${monthName} ${year} ${era}/${gregEn}`;
    }
  } catch {
    // Fallback if Intl fails
    const fallbackGreg = validDate.toLocaleDateString(isArabic ? 'ar-DZ' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return isArabic ? `${fallbackGreg}` : ` ${fallbackGreg}`;
  }
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  filePath?: string;
  folderPath?: string;
  uri?: string;
  blob?: Blob;
  cancelled?: boolean;
}

// ─── Export Function ─────────────────────────────────────────────────────────
export async function exportToPDF(
  title: string,
  date: string,
  summary: string,
  returnBlob: boolean = false,
  customPaperColor?: string,
  folderName?: string,
  backgroundImage?: string
): Promise<Blob | string | ExportResult> {
  const { settings } = useAppStore.getState();
  const isDarkTheme = settings.theme === 'dark' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const activePaperColor = customPaperColor || (isDarkTheme ? (settings.darkPaperColor || '#171717') : (settings.lightPaperColor || '#fafafa'));
  const isDarkPaper = isDarkColor(activePaperColor);

  const textColor = isDarkPaper ? '#F8FAFC' : TEXT_PRIMARY;
  const secondaryTextColor = isDarkPaper ? '#94A3B8' : TEXT_SECONDARY;
  const borderRuleColor = isDarkPaper ? '#334155' : BORDER_LIGHT;

  const isRtl = /[\u0600-\u06FF]/.test(summary + ' ' + title);
  const content = await markdownToContent(summary, isRtl, textColor, isDarkPaper);

  // Attempt to load brand logo icon
  let logoDataUrl = '';
  try {
    logoDataUrl = await loadSvgAsPng('/logo.svg');
  } catch {
    logoDataUrl = '';
  }

  // Load note background image as data URL if present
  let bgImageDataUrl = '';
  if (backgroundImage) {
    try {
      if (backgroundImage.startsWith('custom-')) {
        // Custom user-uploaded background: fetch DataURL directly from Dexie
        const { db } = await import('../db');
        const customBg = await db.customBackgrounds.get(backgroundImage);
        bgImageDataUrl = customBg?.dataUrl ?? '';
      } else {
        // For the pattern SVG/PNG background, we must pre-fill the canvas with
        // the paper color so transparent pixels don't turn black in the JPEG.
        // In light mode use white; in dark mode use the actual paper color.
        const bgFillColor = activePaperColor;
        bgImageDataUrl = await loadImageAsDataUrl(`/backgrounds/${backgroundImage}`, bgFillColor);
      }
    } catch {
      bgImageDataUrl = '';
    }
  }

  const isArabic = settings.language === 'ar' || (settings.language !== 'en' && isRtl);
  const formattedDate = formatPdfHeaderDate(date, isArabic);

  const displayTitle = title.trim() || (isRtl ? 'ملاحظة بدون عنوان' : 'Untitled Note');

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 50],
    background: (_currentPage: number, pageSize: any) => {
      const solidBackground = {
        canvas: [
          {
            type: 'rect',
            x: 0,
            y: 0,
            w: pageSize.width,
            h: pageSize.height,
            color: activePaperColor,
          },
        ],
      };

      if (bgImageDataUrl) {
        // Render solid color behind the image, then the pattern image on top
        return [
          solidBackground,
          {
            image: bgImageDataUrl,
            width: pageSize.width,
            height: pageSize.height,
            absolutePosition: { x: 0, y: 0 },
            opacity: 1,
          },
        ];
      }
      // Fallback: solid paper color rectangle only
      return solidBackground;
    },
    defaultStyle: {
      font: 'Tajawal',
      fontSize: 13.5,
      lineHeight: 1.45,
      color: textColor,
      alignment: isRtl ? 'right' : 'left',
    },

    // ─── Running Top Header: Folder name centered, Dual Date on edge, divider below ─
    header: () => ({
      margin: [40, 16, 40, 0],
      stack: [
        {
          columns: [
            // Left column (shows Title if English, or Date if Arabic)
            {
              width: '*',
              text: !isArabic ? displayTitle : formattedDate,
              fontSize: 8,
              lineHeight: 1.2,
              color: secondaryTextColor,
              alignment: 'left',
            },
            // Center column: always empty
            {
              width: 'auto',
              text: '',
              fontSize: 9,
              bold: true,
              color: BRAND,
              alignment: 'center',
            },
            // Right column (shows Title if Arabic, or Date if English)
            {
              width: '*',
              text: isArabic ? displayTitle : formattedDate,
              fontSize: 8,
              lineHeight: 1.2,
              color: secondaryTextColor,
              alignment: 'right',
            },
          ],
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 5,
              x2: 515,
              y2: 5,
              lineWidth: 0.5,
              lineColor: borderRuleColor,
            },
          ],
          margin: [0, 3, 0, 0],
        },
      ],
    }),

    // ─── Running Bottom Footer with Separator Rule, Brand Logo & Pagination ─
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 10, 40, 0],
      stack: [
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 0.5,
              lineColor: borderRuleColor,
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            // Left side: Logo
            {
              width: 120,
              stack: [
                logoDataUrl
                  ? {
                    image: logoDataUrl,
                    width: 16,
                    height: 16,
                    alignment: 'left',
                  }
                  : { text: '' },
              ],
            },
            // Center: Page number
            {
              width: '*',
              text: `${currentPage} / ${pageCount}`,
              fontSize: 9,
              color: secondaryTextColor,
              alignment: 'center',
              margin: [0, 3, 0, 0],
            },
            // Right side: by Taqyeed AI
            {
              width: 120,
              text: 'by Taqyeed AI',
              fontSize: 9,
              color: secondaryTextColor,
              alignment: 'right',
              margin: [0, 3, 0, 0],
            },
          ],
        },
      ],
    }),

    // ─── Document Content ───────────────────────────────────────────────────
    content: [
      ...(displayTitle
        ? [
          {
            text: displayTitle,
            fontSize: 24,
            bold: true,
            color: BRAND,
            alignment: isRtl ? 'right' : 'left',
            margin: [0, 6, 0, 16],
          },
        ]
        : []),
      ...content,
    ],
  };

  const pdfDoc = (pdfMake as any).createPdf(docDefinition);

  // Modern pdfmake-rtl returns a Promise from getBase64()
  const base64: string = await pdfDoc.getBase64();
  if (!base64) {
    throw new Error('Failed to generate PDF data.');
  }

  // Convert Base64 to Uint8Array & Blob
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const pdfBlob = new Blob([byteArray], { type: 'application/pdf' });

  if (returnBlob) {
    return Capacitor.isNativePlatform() ? base64 : pdfBlob;
  }

  const safeTitle = displayTitle.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Document';
  const fileName = `${safeTitle}.pdf`;

  // 1. Laptop / Desktop Tauri App (Trigger native desktop Save File Dialog)
  if (isTauri()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const filePath = await save({
        defaultPath: fileName,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });
      if (filePath) {
        await writeFile(filePath, byteArray);
        const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        const folderPath = lastSep !== -1 ? filePath.substring(0, lastSep) : filePath;
        return {
          success: true,
          fileName,
          filePath,
          folderPath,
          blob: pdfBlob,
        };
      } else {
        // User cancelled dialog
        return { success: false, cancelled: true, fileName };
      }
    } catch (tauriErr) {
      console.warn('Tauri save dialog error, falling back to browser download:', tauriErr);
    }
  }

  // 2. Android / iOS Native Capacitor Platform (Save directly to device Documents / Files)
  if (Capacitor.isNativePlatform()) {
    let savedDirectory = Directory.Documents;
    let displayFolder = 'Documents';
    try {
      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch (capErr: any) {
      savedDirectory = Directory.Data;
      displayFolder = 'AppData';
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Data,
          recursive: true,
        });
      } catch (fallbackErr: any) {
        console.error('Capacitor native save error:', capErr, fallbackErr);
        throw new Error(`Mobile save error: ${capErr?.message || 'Cannot save PDF'}`);
      }
    }

    let uri: string | undefined;
    try {
      const res = await Filesystem.getUri({
        path: fileName,
        directory: savedDirectory,
      });
      uri = res.uri;
    } catch {}

    return {
      success: true,
      fileName,
      filePath: `${displayFolder}/${fileName}`,
      folderPath: displayFolder,
      uri,
      blob: pdfBlob,
    };
  }

  // 3. Modern Web File System Access API (Presents true native "Save to..." file dialog)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'PDF Document',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writableStream = await fileHandle.createWritable();
      await writableStream.write(pdfBlob);
      await writableStream.close();
      return {
        success: true,
        fileName,
        folderPath: 'Saved Destination',
        filePath: fileName,
        blob: pdfBlob,
      };
    } catch (pickerErr: any) {
      if (pickerErr?.name === 'AbortError') {
        // User deliberately cancelled the Save dialog
        return { success: false, cancelled: true, fileName };
      }
      // Otherwise fall through to standard download
    }
  }

  // 4. Standard Direct File Download (Saves straight to Downloads folder)
  const blobUrl = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);

  return {
    success: true,
    fileName,
    folderPath: 'Downloads',
    filePath: `Downloads/${fileName}`,
    blob: pdfBlob,
  };
}
