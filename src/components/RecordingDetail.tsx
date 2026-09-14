import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share'; 
import { db, Recording } from '../db';
import { deleteRecording } from '../services/recordings';
import {
  FileText,
  Download,
  ArrowLeft,
  Trash2,
  Sparkles,
  Loader2,
  Copy,
  Share2,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  Edit3,
} from 'lucide-react';
import { exportToPDF } from '../services/pdfExport';
import { AnimatedMarkdown } from 'flowtoken';
import 'flowtoken/dist/styles.css';
import { marked } from 'marked';
import { streamSummaryFromAudio, generateTitleFromSummary } from '../services/llm';
import { useAppStore } from '../store';
import { translations } from '../translations';
import { isTauri } from '../services/platform';
import { convertFileSrc } from '@tauri-apps/api/core';
import { AudioPlayer } from './AudioPlayer';
import { motion, AnimatePresence } from 'motion/react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useToast } from './Toast';

export function RecordingDetail({ id, onBack, onDelete, autoSummarize = false }: { id: number, onBack: () => void, onDelete: () => void, autoSummarize?: boolean }) {
  const { settings, setIsAiProcessing } = useAppStore();
  const t = translations[settings.language] || translations.ar;
  const isRtl = settings.language === 'ar';
  const { showToast } = useToast();

  const [recording, setRecording] = useState<Recording | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const hasAutoSummarized = useRef(false);

  // Editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  // Streaming states
  const [streamedSummary, setStreamedSummary] = useState('');

  const [rawAudioUrl, setRawAudioUrl] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<ReactQuill>(null);

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }, { 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      [{ 'direction': 'rtl' }],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'list', 'indent',
    'direction', 'align',
    'blockquote', 'code-block',
    'link', 'image'
  ];

  useEffect(() => {
    db.recordings.get(id).then(async rec => {
      if (rec) {
        // Ensure summary is HTML if it was saved as Markdown
        if (rec.summary && !/<[a-z][\s\S]*>/i.test(rec.summary)) {
           const parsed = await marked.parse(rec.summary);
           rec.summary = parsed;
           await db.recordings.update(id, { summary: parsed });
        }
        
        setRecording(rec);
        setEditedTitle(rec.title);
        if (rawAudioUrl && !rawAudioUrl.startsWith('asset://')) URL.revokeObjectURL(rawAudioUrl);
        
        if (rec.audioPath) {
          if (Capacitor.isNativePlatform()) {
            try {
              const fileResult = await Filesystem.readFile({
                path: rec.audioPath,
                directory: Directory.Data,
              });
              const base64Str = typeof fileResult.data === 'string' ? fileResult.data : '';
              const byteCharacters = atob(base64Str);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'audio/webm' });
              setRawAudioUrl(URL.createObjectURL(blob));
            } catch (capErr) {
              console.warn('Capacitor native file read error, falling back:', capErr);
              Filesystem.getUri({ path: rec.audioPath, directory: Directory.Data }).then(res => {
                setRawAudioUrl(Capacitor.convertFileSrc(res.uri));
              });
            }
          } else if (isTauri()) {
            try {
              const { readFile } = await import('@tauri-apps/plugin-fs');
              const bytes = await readFile(rec.audioPath);
              const blob = new Blob([bytes], { type: 'audio/webm' });
              setRawAudioUrl(URL.createObjectURL(blob));
            } catch (tauriErr) {
              console.warn('Tauri fs read fallback to convertFileSrc:', tauriErr);
              setRawAudioUrl(convertFileSrc(rec.audioPath));
            }
          }
        } else if (rec.audioBlob) {
          setRawAudioUrl(URL.createObjectURL(rec.audioBlob));
        }

      }
    });
  }, [id]);

  useEffect(() => {
    if (recording && autoSummarize && !recording.summary && !hasAutoSummarized.current) {
      hasAutoSummarized.current = true;
      handleSummarize();
    }
  }, [recording, autoSummarize]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isSummarizing && streamedSummary && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [streamedSummary, isSummarizing]);

  const handleSummarize = async () => {
    if (!recording || isSummarizing) return;

    setIsSummarizing(true);
    setIsAiProcessing(true);
    setStreamedSummary('');

    try {
      let finalTranscript = '';
      let finalSummary = '';

      let targetBlob: Blob | undefined = recording.audioBlob;
      if (recording.audioPath) {
        if (Capacitor.isNativePlatform()) {
          try {
            const fileResult = await Filesystem.readFile({
              path: recording.audioPath,
              directory: Directory.Data,
            });
            const base64Str = typeof fileResult.data === 'string' ? fileResult.data : '';
            const byteCharacters = atob(base64Str);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            targetBlob = new Blob([byteArray], { type: 'audio/webm' });
          } catch (capErr) {
            console.warn('Fallback reading via getUri/fetch:', capErr);
            const res = await Filesystem.getUri({ path: recording.audioPath, directory: Directory.Data });
            const response = await fetch(Capacitor.convertFileSrc(res.uri));
            targetBlob = await response.blob();
          }
        } else if (isTauri()) {
          try {
            const { readFile } = await import('@tauri-apps/plugin-fs');
            const bytes = await readFile(recording.audioPath);
            targetBlob = new Blob([bytes], { type: 'audio/webm' });
          } catch (tauriErr) {
            console.warn('Fallback reading via convertFileSrc:', tauriErr);
            const response = await fetch(convertFileSrc(recording.audioPath));
            targetBlob = await response.blob();
          }
        }
      }

      if (!targetBlob) throw new Error("No audio payload found.");

      const stream = streamSummaryFromAudio(
        targetBlob,
        settings.llmProvider === 'gemini' ? settings.geminiApiKey : settings.openRouterApiKey,
        settings.llmModel,
        settings.systemPrompt,
        settings.llmProvider,
        settings.sidecarUrl
      );

      for await (const chunk of stream) {
        if (chunk.summary) {
          finalSummary = chunk.summary;
          setStreamedSummary(chunk.summary);
        }
      }

      const newTitle = await generateTitleFromSummary(
        finalSummary,
        settings.llmProvider === 'gemini' ? settings.geminiApiKey : settings.openRouterApiKey,
        settings.llmModel,
        settings.language,
        settings.llmProvider,
        settings.sidecarUrl
      );

      let cleanSummary = finalSummary.trim();
      if (/^```(?:markdown|md|text)?\s*[\r\n]/i.test(cleanSummary) && /```$/.test(cleanSummary)) {
        cleanSummary = cleanSummary.replace(/^```(?:markdown|md|text)?\s*[\r\n]/i, '').replace(/[\r\n]\s*```$/, '').trim();
      }
      let htmlSummary = await marked.parse(cleanSummary);

      // Auto-detect Arabic content and wrap in RTL container
      const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(finalSummary);
      if (hasArabic) {
        htmlSummary = `<div dir="rtl" style="text-align: right;">${htmlSummary}</div>`;
      }

      // Create linked note
      let noteId = recording.noteId;
      if (!noteId) {
        const titleToUse = (newTitle || recording.title) + ' (Summary)';
        noteId = await db.notes.add({
          title: titleToUse,
          description: 'AI Generated Summary',
          content: htmlSummary,
          date: new Date().toISOString(),
          lastModified: new Date().toISOString()
        }) as number;
      } else {
        await db.notes.update(noteId, { 
          content: htmlSummary, 
          lastModified: new Date().toISOString() 
        });
      }

      await db.recordings.update(id, {
        title: newTitle || recording.title,
        transcript: '', // Preserved for backward db schema compatibility but kept empty
        summary: htmlSummary,
        noteId: noteId
      });

      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        editor.clipboard.dangerouslyPasteHTML(htmlSummary);
      }

      setRecording(prev => prev ? {
        ...prev,
        title: newTitle || prev.title,
        summary: htmlSummary,
        noteId: noteId
      } : null);
      if (newTitle) setEditedTitle(newTitle);
    } catch (err) {
      console.error("Summarization failed", err);
      showToast('Summarization failed. Please check your API key and model settings.', 'error');
    } finally {
      setIsSummarizing(false);
      setIsAiProcessing(false);
      setStreamedSummary('');
    }
  };

  const syncSummaryUpdate = async (newContent: string, delta: any, source: string) => {
    // Only accept user edits; do not overwrite from API initialization or during streaming
    if (source !== 'user' || isSummarizing || !recording) return;
    setRecording(prev => prev ? { ...prev, summary: newContent } : null);
    await db.recordings.update(id, { summary: newContent });
    if (recording.noteId) {
      await db.notes.update(recording.noteId, { content: newContent, lastModified: new Date().toISOString() });
    }
  };

  const handleSaveTitle = async () => {
    if (!recording) return;
    await db.recordings.update(id, { title: editedTitle });
    setRecording({ ...recording, title: editedTitle });
    setIsEditingTitle(false);
  };

  const handleCopySummary = async () => {
    const summary = recording?.summary || streamedSummary;
    if (!summary) return;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = summary;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';

    try {
      // First attempt: copy rich HTML to keep formatting
      if (typeof ClipboardItem !== 'undefined') {
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([summary], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        });
        await navigator.clipboard.write([clipboardItem]);
      } else {
        throw new Error('ClipboardItem not supported');
      }
    } catch (err) {
      console.warn('Rich text copy failed, falling back to plain text', err);
      // Fallback: plain text only (strips format)
      await navigator.clipboard.writeText(plainText);
    }
    
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleShare = async () => {
    const summary = recording?.summary || streamedSummary;
    if (!recording || !summary) return;
    try {
      showToast('Preparing PDF to share...', 'info');
      let folderName: string | undefined;
      if (recording.folderId) {
        const folder = await db.folders.get(recording.folderId);
        if (folder) folderName = folder.name;
      }
      await exportToPDF(recording.title, recording.date, summary, false, undefined, folderName);
    } catch (err: any) {
      console.error("Sharing failed", err);
      showToast(err?.message || 'Sharing failed. Please try again.', 'error');
    }
  };

  const handleExport = async () => {
    const summary = recording?.summary || streamedSummary;
    if (!recording || !summary) return;
    try {
      showToast('Generating PDF... Please wait.', 'info');
      let folderName: string | undefined;
      if (recording.folderId) {
        const folder = await db.folders.get(recording.folderId);
        if (folder) folderName = folder.name;
      }
      const result = (await exportToPDF(recording.title, recording.date, summary, false, undefined, folderName)) as any;
      if (result && result.cancelled) return;

      if (Capacitor.isNativePlatform() && result?.uri) {
        try {
          await Share.share({
            title: result.fileName,
            url: result.uri,
            dialogTitle: isRtl ? 'حفظ ومشاركة ملف PDF' : 'Save / Share PDF',
          });
        } catch (shareErr) {
          console.warn('Share/open PDF error:', shareErr);
        }
      }
    } catch (err: any) {
      console.error("Export failed", err);
      showToast(err?.message || 'Failed to export PDF. Please try again.', 'error');
    }
  };

  // Listen for export and share events from 3 dots menu
  useEffect(() => {
    const handleExportEvent = () => handleExport();
    const handleShareEvent = () => handleShare();
    window.addEventListener('export-note-pdf', handleExportEvent);
    window.addEventListener('share-note', handleShareEvent);
    return () => {
      window.removeEventListener('export-note-pdf', handleExportEvent);
      window.removeEventListener('share-note', handleShareEvent);
    };
  }, [handleExport, handleShare]);

  const handleDelete = async () => {
    await deleteRecording(id);
    onDelete();
  };

  if (!recording) return <div className="p-8 text-center text-gray-500">{t.loading}</div>;

  const displaySummary = recording.summary || streamedSummary;

  return (
    <div className="flex flex-col h-full bg-card md:rounded-2xl md:shadow-sm md:border md:border-border overflow-hidden" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="p-4 md:p-6 border-b border-border flex items-center justify-between bg-muted/50 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0 pr-4">
          <div className="flex-1 min-w-0 max-w-sm">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="flex-1 bg-background border border-primary rounded-lg px-3 py-1.5 text-base font-semibold outline-none focus:ring-2 focus:ring-primary/20 w-full"
                  autoFocus
                />
                <div className="flex gap-1 shrink-0">
                  <button onClick={handleSaveTitle} className="p-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90">
                    <Check className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button onClick={() => { setIsEditingTitle(false); setEditedTitle(recording.title); }} className="p-1.5 bg-muted text-muted-foreground rounded-md hover:bg-border">
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 group cursor-text" onClick={() => setIsEditingTitle(true)}>
                <h2 className="text-lg md:text-xl font-semibold text-foreground truncate select-none">{recording.title}</h2>
                <button className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all shrink-0">
                  <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            )}
            <p className="text-[10px] md:text-sm text-muted-foreground mt-0.5">{new Date(recording.date).toLocaleString()} • {Math.floor(recording.duration / 60)}m {recording.duration % 60}s</p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title={t.delete}>
            <Trash2 className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto flex flex-col">
        <div className="p-4 md:p-6 space-y-6">
          {rawAudioUrl && (
            <AudioPlayer key="raw-player" src={rawAudioUrl} title={t.meetingRecording} recordingDuration={recording.duration} />
          )}
        </div>

        {!displaySummary && !isSummarizing ? (
          <div className="mx-4 md:mx-6 mb-6 flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-muted/50">
            <Sparkles className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-medium text-foreground">{t.summarizeWithAI}</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2 mb-6">
              {t.generateSummaryDesc}
            </p>
            <button
              onClick={handleSummarize}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all shadow-md font-medium"
            >
              <Sparkles className="w-5 h-5" />
              {t.summarizeWithAI}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 min-h-[400px]">
            <div className="px-4 md:px-6 pt-4 pb-2 border-t border-border bg-background flex items-center justify-between sticky top-0 z-10">
               <h3 className="text-base md:text-lg font-semibold text-foreground flex items-center gap-2">
                 <Sparkles className="w-5 h-5 text-primary" />
                 {t.aiSummary} {isSummarizing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
               </h3>
               {displaySummary && !isSummarizing && (
                 <div className="flex items-center gap-1.5">
                   <button
                     onClick={handleCopySummary}
                     className="px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors flex items-center gap-2 text-xs font-medium border border-border bg-card"
                   >
                     {copyFeedback ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                     <span className="hidden xs:inline">{copyFeedback ? t.copied : t.copy}</span>
                   </button>
                 </div>
               )}
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col relative px-4 md:px-6 pb-6 mt-2">
              <div className="flex-1 rounded-2xl border border-border overflow-hidden flex flex-col bg-background shadow-sm relative">
                {/* Always keep ReactQuill mounted to avoid losing editor instance and unmount race conditions */}
                <ReactQuill 
                  ref={quillRef}
                  theme="snow" 
                  value={recording?.summary || ''} 
                  onChange={syncSummaryUpdate}
                  modules={modules}
                  formats={formats}
                  className={`flex-1 flex flex-col [&_.ql-container]:flex-1 [&_.ql-container]:overflow-y-auto [&_.ql-editor]:min-h-full border-none ${(/[\u0600-\u06FF]/.test(recording?.summary || '')) ? 'rtl-editor' : 'ltr-editor'}`}
                />

                {/* Animated Streaming Overlay while AI is generating summary */}
                <AnimatePresence>
                  {isSummarizing && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm p-6 md:p-8 overflow-y-auto flex flex-col"
                      dir={(/[\u0600-\u06FF]/.test(streamedSummary) || settings.language === 'ar') ? 'rtl' : 'ltr'}
                    >
                      <div className="flex items-center gap-2 mb-4 text-xs font-semibold text-primary bg-transparent border border-primary/30 px-3 py-1.5 rounded-full w-fit shrink-0">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{settings.language === 'ar' ? 'جاري توليد الملخص الذكي من الصوت...' : 'AI is generating summary from audio...'}</span>
                      </div>
                      <div 
                        className={`prose prose-sm md:prose-base dark:prose-invert max-w-none flex-1 ${
                          (/[\u0600-\u06FF]/.test(streamedSummary) || settings.language === 'ar') ? 'text-right' : 'text-left'
                        }`}
                        dir={(/[\u0600-\u06FF]/.test(streamedSummary) || settings.language === 'ar') ? 'rtl' : 'ltr'}
                      >
                        <AnimatedMarkdown
                          content={streamedSummary}
                          animation="fadeIn"
                          animationDuration="0.8s"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-border"
            >
              <div className="flex items-center gap-3 text-destructive mb-4">
                <div className="p-2 bg-transparent border border-destructive/30 rounded-full text-destructive">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">{t.delete}</h3>
              </div>
              <p className="text-muted-foreground mb-6">{t.confirmDelete}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-border transition-colors font-medium"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-colors font-medium"
                >
                  {t.delete}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .ql-container {
          font-family: inherit;
          font-size: 1rem;
          border: none !important;
          background: var(--background);
        }
        .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid var(--border) !important;
          background: var(--muted);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .ql-editor {
          color: var(--foreground);
          padding: 1.5rem 2rem !important;
        }
        .rtl-editor .ql-editor {
          direction: rtl;
          text-align: right;
        }
        .ltr-editor .ql-editor {
          direction: ltr;
          text-align: left;
        }
        .prose {
          unicode-bidi: plaintext;
          text-align: start;
        }
        /* Universal theme-aware overrides (light + dark) */
        .ql-snow .ql-stroke { stroke: var(--foreground) !important; }
        .ql-snow .ql-fill { fill: var(--foreground) !important; }
        .ql-snow .ql-picker { color: var(--foreground) !important; }
        .ql-snow .ql-picker-label { color: var(--foreground) !important; }
        .ql-snow .ql-picker-options {
          background-color: var(--popover) !important;
          border-color: var(--border) !important;
        }
        .ql-snow .ql-picker-item { color: var(--foreground) !important; }
        .ql-snow .ql-active { color: var(--primary) !important; }
        .ql-snow .ql-active .ql-stroke { stroke: var(--primary) !important; }
        .ql-snow .ql-active .ql-fill { fill: var(--primary) !important; }
        .ql-snow button:hover .ql-stroke { stroke: var(--primary) !important; }
        .ql-snow button:hover .ql-fill { fill: var(--primary) !important; }
        .ql-snow .ql-picker-label:hover { color: var(--primary) !important; }
        .ql-snow .ql-picker-label:hover .ql-stroke { stroke: var(--primary) !important; }
      `}</style>
    </div>
  );
}
