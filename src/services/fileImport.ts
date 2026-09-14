import { db } from '../db';
import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export interface ImportedAudioResult {
  id: number;
  title: string;
  duration: number;
}

export interface ImportedDocumentResult {
  id: number;
  title: string;
  content: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Calculates duration in seconds for an audio file.
 */
export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(audio.duration) || 0);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

/**
 * Imports an audio file from user storage and stores it in db.recordings.
 */
export async function importAudioFile(file: File, folderId?: number): Promise<ImportedAudioResult> {
  const title = file.name.replace(/\.[^/.]+$/, '').trim() || 'Audio Recording';
  const duration = await getAudioDuration(file);

  const id = (await db.recordings.add({
    title,
    date: new Date().toISOString(),
    duration,
    audioBlob: file,
    folderId: folderId || undefined,
  })) as number;

  // Also create a Note in db.notes so it appears immediately as an Audio Note
  const noteId = (await db.notes.add({
    title,
    description: '',
    content: '',
    audioBlob: file,
    audioDuration: duration,
    recordingId: id,
    folderId: folderId || undefined,
    date: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  })) as number;

  await db.recordings.update(id, { noteId });

  return { id: noteId, title, duration };
}

/**
 * Imports a document (PDF, DOCX, TXT, MD, etc.), extracts its text/content,
 * and saves it automatically as a new note in db.notes with title = file title.
 */
export async function importDocumentFile(file: File, folderId?: number): Promise<ImportedDocumentResult> {
  const title = file.name.replace(/\.[^/.]+$/, '').trim() || 'Imported Document';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = file.type.toLowerCase();

  let htmlContent = '';

  try {
    // 1. PDF Document
    if (ext === 'pdf' || mime === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
      const { text } = await extractText(pdf, { mergePages: true });
      const raw = Array.isArray(text) ? text.join('\n\n') : (text || '');
      
      const paragraphs = raw
        .split(/\r?\n\s*\r?\n/)
        .map((p: string) => p.trim())
        .filter(Boolean)
        .map((p: string) => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br/>')}</p>`)
        .join('');

      htmlContent = paragraphs || '<p></p>';
    }
    // 2. Microsoft Word DOCX
    else if (ext === 'docx' || mime.includes('wordprocessingml')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      htmlContent = result.value ? DOMPurify.sanitize(result.value) : '<p></p>';
    }
    // 3. Markdown
    else if (ext === 'md' || ext === 'markdown') {
      const rawText = await file.text();
      const parsed = await marked.parse(rawText);
      htmlContent = DOMPurify.sanitize(parsed);
    }
    // 4. HTML
    else if (ext === 'html' || ext === 'htm' || mime === 'text/html') {
      const rawText = await file.text();
      htmlContent = DOMPurify.sanitize(rawText);
    }
    // 5. Plain Text, CSV, JSON, Log, etc.
    else {
      const rawText = await file.text();
      const paragraphs = rawText
        .split(/\r?\n\s*\r?\n/)
        .map((p: string) => p.trim())
        .filter(Boolean)
        .map((p: string) => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br/>')}</p>`)
        .join('');

      htmlContent = paragraphs || `<p>${escapeHtml(rawText)}</p>`;
    }
  } catch (err) {
    console.error('Document parsing error:', err);
    // Fallback: try reading as plain text
    try {
      const fallbackText = await file.text();
      htmlContent = `<p>${escapeHtml(fallbackText)}</p>`;
    } catch {
      htmlContent = `<p>${escapeHtml(file.name)}</p>`;
    }
  }

  const plainSnippet = stripHtml(htmlContent).slice(0, 180);

  const id = (await db.notes.add({
    title,
    description: plainSnippet,
    content: htmlContent,
    folderId: folderId || undefined,
    date: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  })) as number;

  return { id, title, content: htmlContent };
}
