import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { 
  Sparkles, Zap, Loader2, Download, FileText, Plus, Trash2, Edit3, Check, X, 
  AlertTriangle, Undo, Redo, Upload, SlidersHorizontal,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, 
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Minus, CheckCheck, ListTree,
  Shrink, Feather, BookOpen, Languages, Table, Globe, Search, ArrowLeft, ArrowRight, ArrowUp, Folder,
  Copy, Scissors, CheckSquare, Image as ImageIcon, Palette, Type, ChevronDown,
  Lightbulb, HelpCircle, Play, Pause
} from 'lucide-react';
import { getCounterpartBackground } from '../services/backgroundThemeSync';
import { useAppStore, defaultAiActionPrompts, AiActionPrompts, QuickActionItem, defaultQuickActions, defaultGeneralActions, worldLanguages } from '../store';
import { translations } from '../translations';
import { streamEnhanceContent, executeTargetedQuickAction } from '../services/llm';
import { exportToPDF } from '../services/pdfExport';
import { db, Note } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import { AnimatedMarkdown } from 'flowtoken';
import 'flowtoken/dist/styles.css';
import { marked } from 'marked';
import { useToast } from './Toast';
import { isTauri } from '../services/platform';
import { BackgroundModal } from './BackgroundModal';
import { AudioNoteCard } from './AudioNoteCard';
import { BorderBeam } from './ui/border-beam';
import { ResizableImage } from './ui/resizable-image';
import { useRecorder } from '../hooks/useRecorder';

import { Table as TiptapTable } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Extension, Mark, mergeAttributes } from '@tiptap/core';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';

const FONT_SIZE_PRESETS = [
  { label: 'Default', labelAr: 'افتراضي', size: '', previewSize: '14px' },
  { label: '12px', labelAr: '12 بكسل', size: '12px', previewSize: '12px' },
  { label: '14px', labelAr: '14 بكسل', size: '14px', previewSize: '14px' },
  { label: '16px', labelAr: '16 بكسل', size: '16px', previewSize: '16px' },
  { label: '18px', labelAr: '18 بكسل', size: '18px', previewSize: '18px' },
  { label: '20px', labelAr: '20 بكسل', size: '20px', previewSize: '20px' },
  { label: '24px', labelAr: '24 بكسل', size: '24px', previewSize: '24px' },
  { label: '28px', labelAr: '28 بكسل', size: '28px', previewSize: '28px' },
  { label: '32px', labelAr: '32 بكسل', size: '32px', previewSize: '32px' },
  { label: '36px', labelAr: '36 بكسل', size: '36px', previewSize: '36px' },
];

// Custom Tiptap Extension for Font Size support
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/["']/g, '') || null,
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
      },
    } as any;
  },
});

// Custom Tiptap Mark for AI Processing State (renders non-selectable shimmering wave text from ai-text-effect.md)
export const AiProcessingMark = Mark.create({
  name: 'aiProcessing',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-ai-id'),
        renderHTML: attributes => {
          if (!attributes.id) return {};
          return { 'data-ai-id': attributes.id };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-ai-processing]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-ai-processing': 'true',
        'contenteditable': 'false',
        'class': 'ai-shimmering-text',
      }),
      0,
    ];
  },
});

// Helper to detect touch devices
const isTouchDevice = (): boolean => {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
};

// Helper to adapt AI output and clean markdown into rich HTML matching exported PDF typography & contrast
const cleanAndFormatMarkdown = async (
  rawText: string,
  preferInline: boolean = false,
  isDarkThemeOrPaper: boolean = false
): Promise<string> => {
  if (!rawText) return '';
  let text = rawText.trim();

  // 1. Strip surrounding ```markdown ... ``` or ``` ... ``` code fences if LLM fenced its whole reply
  if (/^```(?:markdown|md|text)?\s*[\r\n]/i.test(text) && /```$/.test(text)) {
    text = text.replace(/^```(?:markdown|md|text)?\s*[\r\n]/i, '').replace(/[\r\n]\s*```$/, '').trim();
  }

  // 2. Check if text has block-level markdown structures
  const hasBlockStructures =
    text.includes('\n') ||
    text.includes('|') ||
    /^#{1,6}\s+/m.test(text) ||
    /^\s*[-*+]\s+/m.test(text) ||
    /^\s*\d+\.\s+/m.test(text) ||
    /^\s*>\s+/m.test(text);

  let html: string;
  if (preferInline && !hasBlockStructures) {
    const inline = await marked.parseInline(text);
    html = inline.trim();
  } else {
    const blockHtml = await marked.parse(text);
    html = blockHtml.trim();
  }

  // Exact Islamic semantic palette from pdfExport.tsx
  const goldColor = isDarkThemeOrPaper ? '#fbbf24' : '#b45309';
  const greenColor = isDarkThemeOrPaper ? '#34d399' : '#006239';
  const grayColor = isDarkThemeOrPaper ? '#94a3b8' : '#64748b';
  const headingColor = isDarkThemeOrPaper ? '#10b981' : '#006239';

  // 5. Semantic Islamic & Scholarly Typography (Quranic Verses, Hadiths, Citations)
  // Ayat (Quranic Verses) in Golden Color (bold + italic)
  html = html.replace(/﴿([^﴾]+)﴾/g, `<span class="ayah" style="color: ${goldColor}; font-weight: bold; font-style: italic;" data-semantic="ayah">﴿$1﴾</span>`);
  html = html.replace(/\{([^{}]+)\}/g, (match, inner) => {
    return /[\u0600-\u06FF]/.test(inner) ? `<span class="ayah" style="color: ${goldColor}; font-weight: bold; font-style: italic;" data-semantic="ayah">{${inner}}</span>` : match;
  });

  // Hadiths in Green Color (bold)
  html = html.replace(/«([^»]+)»/g, `<span class="hadith" style="color: ${greenColor}; font-weight: bold;" data-semantic="hadith">«$1»</span>`);

  // Citations & References in Gray Color (italic + smaller size)
  html = html.replace(/(\((?:سورة|رواه|أخرجه|متفق عليه|صحيح|حسن|ضعيف|تخريج|المصدر|المرجع|انظر)[^\)]+\))/g, `<span class="citation" style="color: ${grayColor}; font-style: italic; font-size: 0.88em;" data-semantic="citation">$1</span>`);

  // 6. Highlight Background Colors (replace with elegant gold italic)
  html = html.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, `<span class="highlight-gold" style="color: ${goldColor}; font-style: italic; font-weight: 600; background: transparent;">$1</span>`);
  html = html.replace(/==([^=\n]+)==/g, `<span class="highlight-gold" style="color: ${goldColor}; font-style: italic; font-weight: 600; background: transparent;">$1</span>`);
  html = html.replace(/(<span[^>]*?)background(?:-color)?:\s*[^;"]+;?/gi, '$1');

  // 7. Ensure AI Headings (h1, h2, h3, h4) use the signature emerald brand color
  html = html.replace(/<h([1-4])([^>]*)>/gi, (match, level, attrs) => {
    if (/style\s*=\s*"/i.test(attrs)) {
      return `<h${level}${attrs.replace(/style\s*=\s*"([^"]*)"/i, `style="$1; color: ${headingColor}; font-weight: 700;"`)}>`;
    }
    return `<h${level}${attrs} style="color: ${headingColor}; font-weight: 700;">`;
  });

  // 8. Strict Contrast Guard (ensures text is never invisible in either dark or light mode)
  if (isDarkThemeOrPaper) {
    // In dark theme: replace any black or dark grey colors with light readable text
    html = html.replace(/color:\s*(?:black|#000(?:000)?|#0f172a|#171717|#18181b|#1e293b|#09090b|#121212|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/gi, 'color: #f8fafc');
  } else {
    // In light theme: replace any pure white or near-white colors with dark readable text
    html = html.replace(/color:\s*(?:white|#fff(?:fff)?|#f8fafc|#fafafa|#f1f5f9|#f3f4f6|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/gi, 'color: #0f172a');
  }

  return html;
};

// Helper to calculate color luminance and detect dark backgrounds
const isColorDark = (hexColor: string): boolean => {
  if (!hexColor) return false;
  const str = hexColor.trim().toLowerCase();
  if (['black', '#000', '#000000', '#0f172a', '#171717', '#18181b', '#1e293b', '#09090b', '#121212', '#262626'].includes(str)) return true;
  if (['white', '#fff', '#ffffff', '#fafafa', '#f8fafc', '#f1f5f9', '#f3f4f6', '#e2e8f0'].includes(str)) return false;

  let c = str.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length === 6) {
    const r = parseInt(c.substring(0, 2), 16) || 0;
    const g = parseInt(c.substring(2, 4), 16) || 0;
    const b = parseInt(c.substring(4, 6), 16) || 0;
    return (r * 0.299 + g * 0.587 + b * 0.114) < 140;
  }
  return false;
};

// Helper to detect Arabic characters in text
const isArabicContent = (text: string): boolean => {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
};

export function TextEditor({ onAudioUpload }: { onAudioUpload?: (file: File) => void }) {
  const { settings, setIsNoteOpen, activeNoteId, setActiveNoteId, setActiveScreen, setActiveView, isNewNote, setIsNewNote, isRecording, isPaused, recordingTime, activeRecordingNoteId, setActiveRecordingNoteId } = useAppStore();
  const { pauseRecording, resumeRecording, saveRecording: saveRecordingHook, discardRecording: discardRecordingHook } = useRecorder();
  const t = translations[settings.language] || translations.ar;
  const isRtl = settings.language === 'ar';
  const { showToast } = useToast();

  const notes = useLiveQuery(() => db.notes.orderBy('lastModified').reverse().toArray());

  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const activeFolder = useLiveQuery(
    () => (activeNote?.folderId ? db.folders.get(activeNote.folderId) : undefined),
    [activeNote?.folderId]
  );

  const [customBgDataUrl, setCustomBgDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (activeNote?.backgroundImage?.startsWith('custom-')) {
      db.customBackgrounds.get(activeNote.backgroundImage).then(bg => {
        if (bg) {
          setCustomBgDataUrl(bg.dataUrl);
        } else {
          setCustomBgDataUrl(null);
        }
      });
    } else {
      setCustomBgDataUrl(null);
    }
  }, [activeNote?.backgroundImage]);

  const [content, setContent] = useState(''); // HTML for display/export
  const [isEditing, setIsEditing] = useState(false); // Initially locked (Read only)
  const [showToolbar, setShowToolbar] = useState(false); // Formatting tools initially hidden
  const [isSaving, setIsSaving] = useState(false);
  const isDirtyRef = React.useRef(false);
  const isLoadingRef = React.useRef(false);
  const activeNoteRef = useRef<Note | null>(null);
  activeNoteRef.current = activeNote;

  // Manual RTL/LTR direction toggle state
  const [manualDirection, setManualDirection] = useState<'rtl' | 'ltr' | null>(null);

  // Dynamic RTL detection based on note content, title, and UI language, overridable by manual toggle
  const isNoteRtl = useMemo(() => {
    if (manualDirection) return manualDirection === 'rtl';
    const raw = (activeNote?.content || '') + ' ' + (activeNote?.title || '') + ' ' + (content || '');
    if (!raw.trim()) return isRtl;
    return isArabicContent(raw);
  }, [manualDirection, activeNote?.content, activeNote?.title, content, isRtl]);

  // Note title editing state
  const [editedTitle, setEditedTitle] = useState('');

  // Modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [streamedEnhancement, setStreamedEnhancement] = useState('');
  const [showAiMenu, setShowAiMenu] = useState(false);
  const isAiDraggingRef = useRef(false);
  const enhanceScrollRef = useRef<HTMLDivElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const fontSizeBtnRef = useRef<HTMLButtonElement>(null);
  const [fontSizeDropdownPos, setFontSizeDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [showColorMenu, setShowColorMenu] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    if (!file.type.startsWith('image/')) {
      showToast(isRtl ? 'يرجى اختيار ملف صورة صالح' : 'Please select a valid image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        editor.chain().focus().setImage({ src: dataUrl, alt: file.name, width: 360, alignment: 'center' } as any).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Smart Targeted Selection & Context Menu State
  const [selectedRange, setSelectedRange] = useState<{ from: number; to: number; text: string } | null>(null);
  const pendingSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextCoords, setContextCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showSelectionBubble, setShowSelectionBubble] = useState(false);
  const [bubbleCoords, setBubbleCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isProcessingActionId, setIsProcessingActionId] = useState<string | null>(null);
  const isProcessingActionIdRef = useRef<string | null>(null);
  const undoTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Personal Prompts Centered Modal State
  const [showCustomPromptModal, setShowCustomPromptModal] = useState(false);
  const [customModalMode, setCustomModalMode] = useState<'general' | 'selection'>('general');
  const [customModalPrompt, setCustomModalPrompt] = useState('');
  const [savePromptToActionList, setSavePromptToActionList] = useState(false);
  const customPromptTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showCustomPromptModal) {
      const timer = setTimeout(() => {
        customPromptTextareaRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showCustomPromptModal]);

  // Cleanup pending undo timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of undoTimersRef.current.values()) {
        clearTimeout(timer);
      }
      undoTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const openBackgroundModalHandler = () => setIsBackgroundModalOpen(true);
    const updateNoteBgHandler = (e: any) => {
      // Update backgroundImage even when detail is undefined (i.e., user removed the background)
      setActiveNote(prev => prev ? { ...prev, backgroundImage: e.detail } : null);
    };
    const themeBgSyncHandler = (e: any) => {
      const isDark = e.detail?.isDark;
      setActiveNote(prev => {
        if (!prev || !prev.backgroundImage) return prev;
        const newBg = getCounterpartBackground(prev.backgroundImage, isDark);
        if (newBg && newBg !== prev.backgroundImage) {
          return { ...prev, backgroundImage: newBg };
        }
        return prev;
      });
    };
    window.addEventListener('open-background-modal', openBackgroundModalHandler);
    window.addEventListener('update-note-bg', updateNoteBgHandler as EventListener);
    window.addEventListener('theme-changed-bg-sync', themeBgSyncHandler as EventListener);
    return () => {
      window.removeEventListener('open-background-modal', openBackgroundModalHandler);
      window.removeEventListener('update-note-bg', updateNoteBgHandler as EventListener);
      window.removeEventListener('theme-changed-bg-sync', themeBgSyncHandler as EventListener);
    };
  }, []);

  const [dragConstraints, setDragConstraints] = useState({ left: -200, right: 0, top: -200, bottom: 0 });
  useEffect(() => {
    const updateConstraints = () => {
      setDragConstraints({
        left: -window.innerWidth + 320,
        right: 0,
        top: -window.innerHeight + 400,
        bottom: 0
      });
    };
    updateConstraints();
    window.addEventListener('resize', updateConstraints);
    return () => window.removeEventListener('resize', updateConstraints);
  }, []);


  // Searchable World Language Picker State (for Translate action)
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');
  const [activeActionForLanguage, setActiveActionForLanguage] = useState<QuickActionItem | null>(null);

  // Small screen detection for centering contextual popups and avoiding edge-overflow
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Note Page Writing Area Zoom State (Strictly scoped to note canvas) ──
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const noteContainerRef = useRef<HTMLDivElement>(null);
  const touchStartDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1.0);
  const isPinchingRef = useRef<boolean>(false);

  // Long-press detection to intercept native context menu before it fires
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTouchRef = useRef<{ clientX: number; clientY: number } | null>(null);

  // Desktop Wheel & Keyboard Zoom Listeners (Ctrl + Wheel, Ctrl + '+', Ctrl + '-', Ctrl + '0')
  useEffect(() => {
    const container = noteContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoomLevel((prev) => Math.min(2.5, Math.max(0.6, Math.round((prev + delta) * 10) / 10)));
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          setZoomLevel((prev) => Math.min(2.5, Math.round((prev + 0.1) * 10) / 10));
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          setZoomLevel((prev) => Math.max(0.6, Math.round((prev - 0.1) * 10) / 10));
        } else if (e.key === '0') {
          e.preventDefault();
          setZoomLevel(1.0);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Mobile/Tablet Two-Finger Pinch-to-Zoom Handlers + Long-press AI bubble trigger
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isPinchingRef.current = true;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStartDistRef.current = dist;
      initialZoomRef.current = zoomLevel;
      // Cancel any pending long-press if second finger arrives
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      return;
    }

    // Single finger: start long-press timer (fires at 450ms — before native menu at ~500ms)
    if (e.touches.length === 1 && editor && !editor.isDestroyed && isEditing) {
      const touch = e.touches[0];
      longPressTouchRef.current = { clientX: touch.clientX, clientY: touch.clientY };
      longPressTimerRef.current = setTimeout(() => {
        if (!editor || editor.isDestroyed || !longPressTouchRef.current) return;
        const { clientX, clientY } = longPressTouchRef.current;
        // Select the word under the finger
        const pos = editor.view.posAtCoords({ left: clientX, top: clientY })?.pos;
        if (pos != null) {
          const $pos = editor.state.doc.resolve(pos);
          const blockText = $pos.parent.textBetween(0, $pos.parent.content.size);
          const offset = $pos.parentOffset;
          let startOffset = offset;
          let endOffset = offset;
          while (startOffset > 0 && !/\s/.test(blockText[startOffset - 1])) startOffset--;
          while (endOffset < blockText.length && !/\s/.test(blockText[endOffset])) endOffset++;
          if (endOffset > startOffset) {
            const startPos = $pos.start() + startOffset;
            const endPos = $pos.start() + endOffset;
            editor.commands.setTextSelection({ from: startPos, to: endPos });
            const wordText = blockText.slice(startOffset, endOffset);
            setSelectedRange({ from: startPos, to: endPos, text: wordText });
            pendingSelectionRef.current = { from: startPos, to: endPos, text: wordText };
            // Position the AI bubble above the touch point
            const padding = 16;
            const bubbleWidth = 140;
            const bubbleHeight = 40;
            setBubbleCoords({
              x: Math.min(Math.max(padding, clientX - bubbleWidth / 2), window.innerWidth - bubbleWidth - padding),
              y: Math.max(65, Math.min(clientY - 58, window.innerHeight - bubbleHeight - padding)),
            });
            setShowSelectionBubble(true);
          }
        }
        longPressTimerRef.current = null;
      }, 450);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Any movement cancels the long-press (user is scrolling, not holding)
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isPinchingRef.current && e.touches.length === 2 && touchStartDistRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = dist / touchStartDistRef.current;
      const targetZoom = Math.min(2.5, Math.max(0.6, Math.round(initialZoomRef.current * ratio * 10) / 10));
      setZoomLevel(targetZoom);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (e.touches.length < 2) {
      isPinchingRef.current = false;
      touchStartDistRef.current = null;
    }
  };

  const isDarkTheme = settings.theme === 'dark' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const currentPaperColor = isDarkTheme
    ? (settings.darkPaperColor || '#171717')
    : (settings.lightPaperColor || '#fafafa');

  const isDarkPaper = useMemo(() => isColorDark(currentPaperColor), [currentPaperColor]);

  // ─────────────────────────────────────────────────────────────
  // 1. Initialize Tiptap Editor
  // ─────────────────────────────────────────────────────────────
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Placeholder.configure({
      placeholder: isRtl ? 'ابدأ كتابة ملاحظتك هنا...' : 'Start typing your notes here...',
    }),
    TiptapTable.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    ResizableImage,
    AiProcessingMark,
    TextStyle,
    Color,
    FontSize,
  ], [isRtl]);

  const editor = useEditor({
    extensions,
    content: '',
    editable: isEditing,
    textDirection: 'auto',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `tiptap prose prose-neutral ${isDarkPaper ? 'dark:prose-invert text-slate-100' : 'text-slate-900'} max-w-none focus:outline-none min-h-[450px] ${
          isNoteRtl ? 'tiptap-rtl' : 'tiptap-ltr'
        }`,
        dir: isNoteRtl ? 'rtl' : 'ltr',
      },
    },
    onTransaction: ({ editor }) => {
      if (editor.isDestroyed || isLoadingRef.current) return;

      const currentProcessingMarkId = isProcessingActionIdRef.current;
      const activeMarkIdsInDoc = new Set<string>();

      editor.state.doc.descendants((node) => {
        if (node.isText && node.marks) {
          node.marks.forEach((m) => {
            if (m.type.name === 'aiProcessing') {
              const id = m.attrs.id;
              if (id) activeMarkIdsInDoc.add(id);
            }
          });
        }
      });

      // 1. Clear timers for any mark IDs that are no longer in the document
      for (const [id, timer] of undoTimersRef.current.entries()) {
        if (!activeMarkIdsInDoc.has(id)) {
          clearTimeout(timer);
          undoTimersRef.current.delete(id);
        }
      }

      // 2. Schedule 3-second auto-removal for any mark restored by "Undo"
      for (const id of activeMarkIdsInDoc) {
        if (id !== currentProcessingMarkId && !undoTimersRef.current.has(id)) {
          const timer = setTimeout(() => {
            if (!editor || editor.isDestroyed) return;

            const ranges: { from: number; to: number }[] = [];
            editor.state.doc.descendants((node, pos) => {
              if (node.isText && node.marks) {
                if (node.marks.some((m) => m.type.name === 'aiProcessing' && m.attrs.id === id)) {
                  ranges.push({ from: pos, to: pos + node.nodeSize });
                }
              }
            });

            if (ranges.length > 0 && editor.schema.marks.aiProcessing) {
              const tr = editor.state.tr;
              ranges.forEach((r) => {
                tr.removeMark(r.from, r.to, editor.schema.marks.aiProcessing);
              });
              tr.setMeta('addToHistory', false);
              editor.view.dispatch(tr);
            }

            undoTimersRef.current.delete(id);
          }, 3000);

          undoTimersRef.current.set(id, timer);
        }
      }
    },
    onUpdate: ({ editor }) => {
      if (isLoadingRef.current) return;
      const html = editor.getHTML();
      setContent(html);
      isDirtyRef.current = true;
    },
    onSelectionUpdate: ({ editor }) => {
      if (editor.isDestroyed || isLoadingRef.current) return;
      const { from, to } = editor.state.selection;
      if (from !== to) {
        // Guard: do not show bubble or trigger actions if selection intersects active AI processing text
        let hasAiProcessing = false;
        editor.state.doc.nodesBetween(from, to, (node) => {
          if (node.marks?.some((m) => m.type.name === 'aiProcessing')) {
            hasAiProcessing = true;
          }
        });
        if (hasAiProcessing) {
          setShowSelectionBubble(false);
          return;
        }

        const text = editor.state.doc.textBetween(from, to, ' ');
        if (text.trim().length > 0) {
          setSelectedRange({ from, to, text });
          pendingSelectionRef.current = { from, to, text };
          try {
            const coords = editor.view.coordsAtPos(to);
            const padding = 16;
            const bubbleWidth = 120;
            const bubbleHeight = 40;
            setBubbleCoords({
              x: Math.min(Math.max(padding, coords.left), Math.max(padding, window.innerWidth - bubbleWidth - padding)),
              y: Math.max(65, Math.min(coords.top - 54, window.innerHeight - bubbleHeight - padding)),
            });
            setShowSelectionBubble(true);
          } catch {
            setShowSelectionBubble(false);
          }
          return;
        }
      }
      setShowSelectionBubble(false);
    },
  });

  const isStreamRtl = useMemo(() => {
    return isArabicContent(streamedEnhancement) || isArabicContent(editor?.getText() || '') || isNoteRtl;
  }, [streamedEnhancement, editor, isNoteRtl]);

  // Keep Tiptap editable status, dark:prose-invert, and text direction in sync with state
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing && !isEnhancing);
      if (editor.view && editor.view.dom) {
        editor.view.dom.setAttribute('dir', isNoteRtl ? 'rtl' : 'ltr');
        if (isNoteRtl) {
          editor.view.dom.classList.add('tiptap-rtl');
          editor.view.dom.classList.remove('tiptap-ltr');
        } else {
          editor.view.dom.classList.add('tiptap-ltr');
          editor.view.dom.classList.remove('tiptap-rtl');
        }
        if (isDarkPaper) {
          editor.view.dom.classList.add('dark:prose-invert', 'text-slate-100');
          editor.view.dom.classList.remove('text-slate-900');
        } else {
          editor.view.dom.classList.remove('dark:prose-invert', 'text-slate-100');
          editor.view.dom.classList.add('text-slate-900');
        }
      }
    }
  }, [isEditing, isEnhancing, editor, isNoteRtl, isDarkPaper]);

  // Block native Android/iOS context menu at the DOM level (second layer of protection).
  // React's synthetic onContextMenu is not always enough in Android WebView — the native
  // long-press "Copy/Paste" popup fires before React can intercept it. Attaching a
  // non-passive native listener directly on the ProseMirror DOM node stops it at the root.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom as HTMLElement;
    const blockNativeMenu = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    // Apply CSS that blocks the iOS/Android callout popup
    dom.style.setProperty('-webkit-touch-callout', 'none');
    dom.style.setProperty('-webkit-user-select', 'text'); // still allow text selection
    dom.addEventListener('contextmenu', blockNativeMenu, { capture: true });
    return () => {
      dom.removeEventListener('contextmenu', blockNativeMenu, { capture: true });
    };
  }, [editor]);

  // Helper: persist editor state to DB
  const persistNote = useCallback(async (noteId: number) => {
    if (!editor) return;
    setIsSaving(true);
    const rawHtml = editor.getHTML();
    const html = rawHtml.replace(/<span\s+data-ai-processing="true"[^>]*>(.*?)<\/span>/gi, '$1');
    const json = JSON.stringify(editor.getJSON());
    await db.notes.update(noteId, {
      content: html,
      contentDelta: json,
      lastModified: new Date().toISOString()
    });
    isDirtyRef.current = false;
    setTimeout(() => setIsSaving(false), 600);
  }, [editor]);

  // Load content into Tiptap when activeNote changes
  useEffect(() => {
    if (editor && activeNote) {
      isLoadingRef.current = true;
      let loaded = false;
      if (activeNote.contentDelta) {
        try {
          const json = JSON.parse(activeNote.contentDelta);
          if (json && json.type === 'doc') {
            editor.commands.setContent(json);
            loaded = true;
          }
        } catch {
          // not Tiptap JSON, fallback to HTML
        }
      }
      if (!loaded) {
        editor.commands.setContent(activeNote.content || '');
      }
      setContent(editor.getHTML());
      editor.setEditable(isEditing);
      isLoadingRef.current = false;
      isDirtyRef.current = false;
      if (isEditing) {
        setTimeout(() => editor.commands.focus('end'), 50);
      }
    }
  }, [activeNote?.id, editor]);

  // Auto-save with debounce when content changes
  useEffect(() => {
    if (activeNote && isDirtyRef.current && editor) {
      const saveTimer = setTimeout(() => {
        persistNote(activeNote.id!);
      }, 1000);
      return () => clearTimeout(saveTimer);
    }
  }, [content, activeNote?.id, editor, persistNote]);

  // Flush unsaved changes on visibility change or page unload
  useEffect(() => {
    const handleFlush = () => {
      if (activeNoteRef.current && isDirtyRef.current && editor) {
        const html = editor.getHTML();
        const json = JSON.stringify(editor.getJSON());
        db.notes.update(activeNoteRef.current.id!, {
          content: html,
          contentDelta: json,
          lastModified: new Date().toISOString()
        });
        isDirtyRef.current = false;
      }
    };

    window.addEventListener('beforeunload', handleFlush);
    const handleVisChange = () => {
      if (document.visibilityState === 'hidden') handleFlush();
    };
    document.addEventListener('visibilitychange', handleVisChange);

    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      document.removeEventListener('visibilitychange', handleVisChange);
      handleFlush();
    };
  }, [editor]);

  // Auto load note by activeNoteId or most recent
  useEffect(() => {
    if (activeNoteId) {
      db.notes.get(activeNoteId).then(n => {
        if (n) {
          // New notes (only) must be unlocked (read/write)
          const isBlankNew = (!n.content || n.content === '<p></p>') && !n.contentDelta;
          const shouldUnlock = isNewNote || isBlankNew;
          handleOpenNote(n, shouldUnlock);
          if (isNewNote) {
            setIsNewNote(false);
          }
        }
      });
    } else if (!activeNote) {
      db.notes.orderBy('lastModified').reverse().first().then(latest => {
        if (latest) {
          handleOpenNote(latest, false);
        } else {
          db.notes.add({
            title: isRtl ? 'ملاحظة جديدة' : 'Untitled Note',
            description: '',
            content: '',
            date: new Date().toISOString(),
            lastModified: new Date().toISOString()
          }).then(id => {
            setIsNewNote(true);
            setActiveNoteId(id as number);
          });
        }
      });
    }
  }, [activeNoteId]);

  // Listen for Header's single back arrow press
  useEffect(() => {
    const handleHeaderBack = async () => {
      if (activeNoteRef.current && isDirtyRef.current && editor) {
        await persistNote(activeNoteRef.current.id!);
      }
      setActiveNote(null);
      setActiveNoteId(null);
      // Update BOTH activeView and activeScreen so App.tsx switches away from texteditor
      setActiveView('home');
      setActiveScreen('home');
    };
    window.addEventListener('app-back-press', handleHeaderBack);
    return () => window.removeEventListener('app-back-press', handleHeaderBack);
  }, [editor, persistNote, setActiveView]);

  // Synchronize note content into editor whenever editor becomes ready or note changes
  useEffect(() => {
    if (!editor || editor.isDestroyed || !activeNote) return;
    isLoadingRef.current = true;
    let loaded = false;
    if (activeNote.contentDelta) {
      try {
        const json = JSON.parse(activeNote.contentDelta);
        if (json && json.type === 'doc') {
          editor.commands.setContent(json);
          loaded = true;
        }
      } catch {}
    }
    if (!loaded) {
      editor.commands.setContent(activeNote.content || '');
    }
    setContent(editor.getHTML());
    editor.setEditable(isEditing);
    isLoadingRef.current = false;
  }, [editor, activeNote?.id]);

  const handleCreateNote = async () => {
    if (activeNote && isDirtyRef.current && editor && !editor.isDestroyed) {
      await persistNote(activeNote.id!);
    }
    const title = newTitle.trim() || (isRtl ? 'ملاحظة جديدة' : 'Untitled Note');
    const id = await db.notes.add({
      title,
      description: newDescription.trim(),
      content: '',
      date: new Date().toISOString(),
      lastModified: new Date().toISOString()
    }) as number;
    setIsNewNote(true);
    setActiveNoteId(id);
    const newNote = await db.notes.get(id);
    if (newNote) {
      setActiveNote(newNote);
      setEditedTitle(newNote.title);
      setContent('');
      setIsEditing(true); // Newly created note starts ready to edit (read/write)
      setShowToolbar(false);
      isDirtyRef.current = false;
      if (editor && !editor.isDestroyed) {
        editor.commands.clearContent();
        editor.setEditable(true);
        setTimeout(() => {
          if (editor && !editor.isDestroyed) {
            editor.commands.focus('end');
          }
        }, 50);
      }
    }
    setShowNewModal(false);
    setNewTitle('');
    setNewDescription('');
  };

  const handleOpenNote = async (note: Note, initialEditState: boolean = false) => {
    if (activeNote && isDirtyRef.current && editor && !editor.isDestroyed) {
      await persistNote(activeNote.id!);
    }
    setActiveNote(note);
    setEditedTitle(note.title);
    setIsEditing(initialEditState); // Unlocked if new note, locked if existing note
    setShowToolbar(false);
    isDirtyRef.current = false;

    if (editor && !editor.isDestroyed) {
      isLoadingRef.current = true;
      let loaded = false;
      if (note.contentDelta) {
        try {
          const json = JSON.parse(note.contentDelta);
          if (json && json.type === 'doc') {
            editor.commands.setContent(json);
            loaded = true;
          }
        } catch {
          // not Tiptap JSON, fallback to HTML
        }
      }
      if (!loaded) {
        editor.commands.setContent(note.content || '');
      }
      setContent(editor.getHTML());
      editor.setEditable(initialEditState);
      isLoadingRef.current = false;
      if (initialEditState) {
        setTimeout(() => {
          if (editor && !editor.isDestroyed) {
            editor.commands.focus('end');
          }
        }, 50);
      }
    } else {
      setContent(note.content || '');
    }
  };

  const handleToggleEdit = async () => {
    if (isEditing) {
      if (activeNote && isDirtyRef.current && editor && !editor.isDestroyed) {
        await persistNote(activeNote.id!);
      }
      setIsEditing(false);
      setShowToolbar(false);
      if (editor && !editor.isDestroyed) {
        editor.setEditable(false);
      }
    } else {
      setIsEditing(true);
      if (editor && !editor.isDestroyed) {
        editor.setEditable(true);
      }
      setTimeout(() => {
        if (editor && !editor.isDestroyed) {
          editor.commands.focus();
        }
      }, 50);
    }
  };


  const handleDeleteNote = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  // Auto-saves title directly as user types
  const handleTitleChange = async (newVal: string) => {
    setEditedTitle(newVal);
    if (activeNote) {
      setActiveNote(prev => prev ? { ...prev, title: newVal } : null);
      if (newVal.trim()) {
        setIsSaving(true);
        await db.notes.update(activeNote.id!, { 
          title: newVal.trim(),
          lastModified: new Date().toISOString()
        });
        setTimeout(() => setIsSaving(false), 600);
      }
    }
  };

  const handleExport = useCallback(async () => {
    if (!activeNote) return;
    const html = (editor && !editor.isDestroyed) ? editor.getHTML() : (activeNote.content || '');
    if (!html.trim()) {
      showToast(isRtl ? 'الملاحظة فارغة للتصدير.' : 'Note is empty to export.', 'warning');
      return;
    }
    try {
      const activePaper = isDarkTheme ? (settings.darkPaperColor || '#171717') : (settings.lightPaperColor || '#fafafa');
      let folderName = activeFolder?.name;
      if (!folderName && activeNote.folderId) {
        const f = await db.folders.get(activeNote.folderId);
        if (f) folderName = f.name;
      }
      const result = (await exportToPDF(activeNote.title, activeNote.date, html, false, activePaper, folderName, activeNote.backgroundImage)) as any;
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
    } catch (err) {
      showToast(isRtl ? 'فشل تصدير PDF.' : 'Failed to export PDF.', 'error');
    }
  }, [activeNote, editor, isRtl, isDarkTheme, settings.darkPaperColor, settings.lightPaperColor, activeFolder, showToast]);

  const handleShare = useCallback(async () => {
    if (!activeNote || !editor || editor.isDestroyed) return;
    const plainText = editor.getText().trim();
    if (!plainText) {
      showToast(isRtl ? 'الملاحظة فارغة للمشاركة' : 'Note is empty to share', 'info');
      return;
    }
    const title = activeNote.title || (isRtl ? 'ملاحظة' : 'Note');

    try {
      // 1. Capacitor native (Android / iOS) — use the OS share sheet
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: title,
          text: plainText,
          dialogTitle: isRtl ? 'مشاركة الملاحظة' : 'Share Note',
        });
        return;
      }

      // 2. Tauri desktop — no native share sheet; copy to clipboard instead
      if (isTauri()) {
        await navigator.clipboard.writeText(`${title}\n\n${plainText}`);
        showToast(isRtl ? 'تم نسخ نص الملاحظة إلى الحافظة' : 'Note copied to clipboard', 'success');
        return;
      }

      // 3. Web Share API (supported browsers / PWA)
      if (navigator.share) {
        await navigator.share({ title, text: plainText });
        return;
      }

      // 4. Generic clipboard fallback
      await navigator.clipboard.writeText(`${title}\n\n${plainText}`);
      showToast(isRtl ? 'تم نسخ نص الملاحظة إلى الحافظة' : 'Note copied to clipboard', 'success');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(`${title}\n\n${plainText}`);
          showToast(isRtl ? 'تم نسخ نص الملاحظة إلى الحافظة' : 'Note text copied to clipboard', 'success');
        } catch {
          showToast(isRtl ? 'تعذر مشاركة الملاحظة' : 'Failed to share note', 'error');
        }
      }
    }
  }, [activeNote, editor, isRtl, showToast]);


  // Listen for export, share, copy, duplicate, and delete events from app main header
  useEffect(() => {
    const handleExportEvent = () => handleExport();
    const handleShareEvent = () => handleShare();

    const handleCopyTextEvent = async () => {
      if (!editor || editor.isDestroyed) return;
      const text = editor.getText().trim();
      if (!text) {
        showToast(isRtl ? 'الملاحظة فارغة' : 'Note is empty', 'info');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        showToast(isRtl ? 'تم نسخ نص الملاحظة إلى الحافظة' : 'Note text copied to clipboard', 'success');
      } catch {
        showToast(isRtl ? 'فشل نسخ النص' : 'Failed to copy text', 'error');
      }
    };

    const handleDuplicateActiveEvent = async () => {
      if (!activeNote) return;
      try {
        const copyTitle = `${activeNote.title} (${isRtl ? 'نسخة' : 'Copy'})`;
        const html = (editor && !editor.isDestroyed) ? editor.getHTML() : (activeNote.content || '');
        const delta = (editor && !editor.isDestroyed) ? JSON.stringify(editor.getJSON()) : (activeNote.contentDelta || '');
        const newId = await db.notes.add({
          title: copyTitle,
          description: activeNote.description || '',
          date: new Date().toISOString(),
          content: html,
          contentDelta: delta,
          lastModified: new Date().toISOString(),
        }) as number;
        const duplicated = await db.notes.get(newId);
        if (duplicated) {
          handleOpenNote(duplicated);
          showToast(isRtl ? 'تم تكرار الملاحظة بنجاح' : 'Note duplicated successfully', 'success');
        }
      } catch {
        showToast(isRtl ? 'فشل تكرار الملاحظة' : 'Failed to duplicate note', 'error');
      }
    };

    const handleDeleteActiveEvent = () => {
      if (activeNote?.id) {
        setDeleteId(activeNote.id);
      }
    };

    window.addEventListener('export-note-pdf', handleExportEvent);
    window.addEventListener('share-note', handleShareEvent);
    window.addEventListener('copy-note-text', handleCopyTextEvent);
    window.addEventListener('duplicate-active-note', handleDuplicateActiveEvent);
    window.addEventListener('delete-active-note', handleDeleteActiveEvent);

    return () => {
      window.removeEventListener('export-note-pdf', handleExportEvent);
      window.removeEventListener('share-note', handleShareEvent);
      window.removeEventListener('copy-note-text', handleCopyTextEvent);
      window.removeEventListener('duplicate-active-note', handleDuplicateActiveEvent);
      window.removeEventListener('delete-active-note', handleDeleteActiveEvent);
    };
  }, [handleExport, handleShare, activeNote, editor, isRtl, showToast]);

  // AI Enhancement handler with custom prompt support
  const handleEnhance = useCallback(async (customPrompt?: string) => {
    if (!activeNote || isEnhancing || !editor || editor.isDestroyed) return;
    const html = editor.getHTML();
    if (!html || !editor.getText().trim()) {
      showToast(isRtl ? 'يرجى كتابة محتوى أولاً قبل التحسين.' : 'Please write some content first before enhancing.', 'info');
      return;
    }

    const { settings, setIsAiProcessing } = useAppStore.getState();
    const apiKey = settings.llmProvider === 'gemini' ? settings.geminiApiKey : settings.openRouterApiKey;
    if (settings.llmProvider !== 'sidecar' && !apiKey && !settings.geminiApiKey && !settings.openRouterApiKey) {
      showToast(isRtl ? 'يرجى ضبط مفتاح API في الإعدادات أو تفعيل بوابة تقييد.' : 'Please configure your API key or activate Taqyeed Gate in Settings.', 'error');
      return;
    }

    setIsEnhancing(true);
    setIsAiProcessing(true);
    setStreamedEnhancement('');

    const floatingActionId = `ai-floating-${Date.now()}`;
    // Lock action ID in ref so Tiptap's 3-second mark auto-cleanup routine doesn't remove the shimmering effect
    isProcessingActionIdRef.current = floatingActionId;

    // Apply shimmering wave mark across note content so user sees the animated effect
    try {
      editor
        .chain()
        .selectAll()
        .setMark('aiProcessing', { id: floatingActionId })
        .setTextSelection(editor.state.doc.content.size)
        .run();
    } catch (e) {
      console.warn('Failed to apply aiProcessing mark for floating enhance:', e);
    }

    try {
      const stream = streamEnhanceContent(
        html,
        apiKey || '',
        settings.llmModel,
        settings.language,
        settings.llmProvider,
        settings.sidecarUrl,
        customPrompt
      );
      let finalText = '';
      for await (const chunk of stream) {
        if (chunk.enhanced) {
          finalText = chunk.enhanced;
          setStreamedEnhancement(chunk.enhanced);
        }
      }

      if (!finalText.trim()) {
        throw new Error(isRtl ? 'لم يتم استلام نص التحسين من الذكاء الاصطناعي' : 'No enhanced content received from AI');
      }

      // Convert final markdown to clean formatted HTML and load into editor
      const enhancedHtml = await cleanAndFormatMarkdown(finalText, false, isDarkPaper || isDarkTheme);
      if (editor && !editor.isDestroyed) {
        isLoadingRef.current = true;
        editor.commands.setContent(enhancedHtml);
        const newHtml = editor.getHTML();
        const newDelta = JSON.stringify(editor.getJSON());
        setContent(newHtml);
        isLoadingRef.current = false;
        isDirtyRef.current = false;
        await db.notes.update(activeNote.id!, {
          content: newHtml,
          contentDelta: newDelta,
          lastModified: new Date().toISOString()
        });
        setActiveNote(prev => prev ? { ...prev, content: newHtml, contentDelta: newDelta } : null);
      }
      // Save successfully enhanced content
    } catch (err: any) {
      console.error('Enhancement failed:', err);
      showToast(err?.message || (isRtl ? 'فشل تحسين الملاحظة.' : 'AI Enhancement failed. Please check your settings.'), 'error');
    } finally {
      setIsEnhancing(false);
      setIsAiProcessing(false);
      setStreamedEnhancement('');
      if (isProcessingActionIdRef.current === floatingActionId) {
        isProcessingActionIdRef.current = null;
      }
      // Clean up shimmering mark if content was not replaced
      if (editor && !editor.isDestroyed) {
        try {
          editor.chain().selectAll().unsetMark('aiProcessing').setTextSelection(editor.state.doc.content.size).run();
        } catch {}
      }
    }
  }, [activeNote, isEnhancing, editor, isRtl, showToast]);

  // ── Delete attached audio from active note ──
  const handleDeleteAudioFromNote = useCallback(async () => {
    if (!activeNote?.id) return;
    try {
      await db.notes.update(activeNote.id, {
        audioBlob: undefined,
        audioPath: undefined,
        audioDuration: undefined,
        lastModified: new Date().toISOString(),
      });
      setActiveNote((prev) =>
        prev
          ? {
              ...prev,
              audioBlob: undefined,
              audioPath: undefined,
              audioDuration: undefined,
            }
          : null
      );
      showToast(isRtl ? 'تم حذف التسجيل الصوتي من الملاحظة' : 'Audio recording removed from note', 'info');
    } catch (err) {
      console.error('Failed to remove audio from note:', err);
      showToast(isRtl ? 'فشل حذف التسجيل الصوتي' : 'Failed to remove audio', 'error');
    }
  }, [activeNote?.id, isRtl, showToast]);

  // ── Generate & Verify Note from Attached Audio with Gemini ──
  const handleGenerateAudioNotes = useCallback(async () => {
    if (!activeNote || isEnhancing || !editor || editor.isDestroyed) return;

    let audioBlobToUse = activeNote.audioBlob;
    if (!audioBlobToUse && activeNote.audioPath) {
      try {
        if (Capacitor.isNativePlatform()) {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          let fileResult;
          try {
            fileResult = await Filesystem.readFile({
              path: activeNote.audioPath,
              directory: Directory.Documents,
            });
          } catch {
            fileResult = await Filesystem.readFile({
              path: activeNote.audioPath,
              directory: Directory.Data,
            });
          }
          const base64Str = typeof fileResult.data === 'string' ? fileResult.data : '';
          if (base64Str) {
            const byteChars = atob(base64Str);
            const byteNums = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
              byteNums[i] = byteChars.charCodeAt(i);
            }
            const mime = activeNote.audioPath.endsWith('.mp4') ? 'audio/mp4' : 'audio/webm';
            audioBlobToUse = new Blob([new Uint8Array(byteNums)], { type: mime });
          }
        } else if (isTauri()) {
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const bytes = await readFile(activeNote.audioPath);
          const mime = activeNote.audioPath.endsWith('.mp4') ? 'audio/mp4' : 'audio/webm';
          audioBlobToUse = new Blob([bytes], { type: mime });
        }
      } catch (readErr) {
        console.warn('Failed to load audio from disk for generation:', readErr);
      }
    }

    if (!audioBlobToUse) {
      showToast(isRtl ? 'الملف الصوتي غير متوفر للتوليد' : 'Audio recording not found for generation', 'error');
      return;
    }

    const { settings: currentSettings, setIsAiProcessing } = useAppStore.getState();
    const effectiveKey = (currentSettings.llmProvider === 'gemini' ? currentSettings.geminiApiKey : currentSettings.openRouterApiKey) || currentSettings.geminiApiKey;
    if (currentSettings.llmProvider !== 'sidecar' && !effectiveKey) {
      showToast(isRtl ? 'يرجى إدخال مفتاح Gemini API في الإعدادات أو الاتصال ببوابة تقييد' : 'Please configure Gemini API key in Settings or connect Taqyeed Gate', 'error');
      return;
    }

    // Extract student's existing written notes in the editor if any
    const existingWriting = editor.getText().trim();
    const baseImprovePrompt = currentSettings.aiActionPrompts?.improveAll || defaultAiActionPrompts.improveAll;

    let promptPayload = baseImprovePrompt;
    if (existingWriting) {
      promptPayload += `\n\n--- EXISTING WRITTEN NOTES IN THE EDITOR ---\n"""\n${existingWriting}\n"""\n\n--- SMART DE-DUPLICATION INSTRUCTION ---\nThe student was writing notes SIMULTANEOUSLY while the audio was being recorded. Therefore, there will be significant overlap between the written notes above and the audio content.

CRITICAL RULES:
1. Do NOT duplicate any point, sentence, concept, or piece of information that is already captured in the student's written notes above.
2. Use the student's written notes as the PRIMARY foundation — preserve their structure, wording, and authentic voice.
3. From the audio, ONLY add new information, details, examples, citations, or corrections that are MISSING from the written notes.
4. If the audio contains a better or more complete version of something the student wrote, seamlessly enhance the student's version rather than adding a duplicate.
5. Fix any linguistic errors in the student's notes, verify facts and citations.
6. Format Quranic verses with ﴿...﴾ and Hadiths with «...».
7. Output a single, unified, comprehensive scholarly note in clean Markdown format — NOT two separate sections.`;
    } else {
      promptPayload += `\n\n--- INSTRUCTION ---\nListen carefully to the attached audio lecture/recording and produce comprehensive, structured scholarly notes adhering strictly to the "Improve & Verify" guidelines. Return only the structured notes in clean Markdown format.`;
    }

    setIsEnhancing(true);
    setIsAiProcessing(true);

    const actionId = `ai-audio-transcribe-${Date.now()}`;
    isProcessingActionIdRef.current = actionId;

    try {
      editor
        .chain()
        .selectAll()
        .setMark('aiProcessing', { id: actionId })
        .setTextSelection(editor.state.doc.content.size)
        .run();
    } catch {}

    try {
      const { streamSummaryFromAudio } = await import('../services/llm');
      const stream = streamSummaryFromAudio(
        audioBlobToUse,
        effectiveKey || '',
        currentSettings.llmModel,
        promptPayload,
        currentSettings.llmProvider,
        currentSettings.sidecarUrl
      );

      let fullGeneratedText = '';
      for await (const chunk of stream) {
        if (chunk.summary) {
          fullGeneratedText = chunk.summary;
        }
      }

      if (!fullGeneratedText.trim()) {
        throw new Error(isRtl ? 'لم يتم استلام نص التوليد من الذكاء الاصطناعي' : 'No generated content received from AI');
      }

      const formattedHtml = await cleanAndFormatMarkdown(fullGeneratedText, false, isDarkPaper || isDarkTheme);
      if (editor && !editor.isDestroyed) {
        isLoadingRef.current = true;
        editor.commands.setContent(formattedHtml);
        const newHtml = editor.getHTML();
        const newDelta = JSON.stringify(editor.getJSON());
        setContent(newHtml);
        isLoadingRef.current = false;
        isDirtyRef.current = false;

        await db.notes.update(activeNote.id!, {
          content: newHtml,
          contentDelta: newDelta,
          lastModified: new Date().toISOString(),
        });
        setActiveNote((prev) => (prev ? { ...prev, content: newHtml, contentDelta: newDelta } : null));
      }
      showToast(isRtl ? 'تم توليد وتوثيق الملاحظة بنجاح' : 'Notes generated & verified successfully', 'success');
    } catch (genErr: any) {
      console.error('Audio note generation failed:', genErr);
      showToast(genErr?.message || (isRtl ? 'فشل توليد الملاحظات من التسجيل' : 'Failed to generate notes from audio'), 'error');
    } finally {
      setIsEnhancing(false);
      setIsAiProcessing(false);
      if (isProcessingActionIdRef.current === actionId) {
        isProcessingActionIdRef.current = null;
      }
      if (editor && !editor.isDestroyed) {
        try {
          editor.chain().selectAll().unsetMark('aiProcessing').setTextSelection(editor.state.doc.content.size).run();
        } catch {}
      }
    }
  }, [activeNote, isEnhancing, editor, isRtl, showToast]);

  const handleTriggerAiAction = (actionKey: keyof AiActionPrompts) => {
    setShowAiMenu(false);
    useAppStore.getState().updateSettings({ selectedAiOption: actionKey });
    const customPrompt = settings.aiActionPrompts?.[actionKey] || defaultAiActionPrompts[actionKey];
    handleEnhance(customPrompt);
  };

  const getActionIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles': return Sparkles;
      case 'Check': return Check;
      case 'CheckCheck': return CheckCheck;
      case 'ListTree': return ListTree;
      case 'FileText': return FileText;
      case 'Shrink': return Shrink;
      case 'Feather': return Feather;
      case 'BookOpen': return BookOpen;
      case 'Languages': return Languages;
      case 'List': return List;
      case 'Table': return Table;
      case 'HelpCircle': return HelpCircle;
      case 'Lightbulb': return Lightbulb;
      case 'Search': return Search;
      default: return Lightbulb;
    }
  };

  const filteredLanguages = useMemo(() => {
    const q = languageSearch.trim().toLowerCase();
    if (!q) return worldLanguages;
    return worldLanguages.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.native.toLowerCase().includes(q) ||
      l.nameAr.includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  }, [languageSearch]);

  const handleContextMenu = (e: React.MouseEvent) => {
    // ALWAYS prevent the native browser/Android context menu inside the editor.
    // On touch devices this fires from a long-press; we show our AI bubble instead.
    e.preventDefault();
    e.stopPropagation();

    if (!editor || editor.isDestroyed) return;
    if (isProcessingActionId !== null) return;

    // On touch devices: if there is already a selection show our menu;
    // if not (finger just touched), the long-press timer above will handle selection.
    if (isTouchDevice()) {
      const { from, to } = editor.state.selection;
      if (from === to) return; // long-press timer will pick this up
    }

    let { from, to } = editor.state.selection;
    let text = '';

    // Ignore if selection intersects active AI processing text
    let hasAiProcessing = false;
    editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.marks?.some((m) => m.type.name === 'aiProcessing')) {
        hasAiProcessing = true;
      }
    });
    if (hasAiProcessing) return;

    if (from === to) {
      // Desktop mouse right-click auto word selection
      const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos;
      if (pos != null) {
        const $pos = editor.state.doc.resolve(pos);
        const textBlock = $pos.parent.textBetween(0, $pos.parent.content.size);
        const offset = $pos.parentOffset;
        let startOffset = offset;
        let endOffset = offset;
        while (startOffset > 0 && !/\s/.test(textBlock[startOffset - 1])) {
          startOffset--;
        }
        while (endOffset < textBlock.length && !/\s/.test(textBlock[endOffset])) {
          endOffset++;
        }
        if (endOffset > startOffset) {
          const startPos = $pos.start() + startOffset;
          const endPos = $pos.start() + endOffset;
          editor.commands.setTextSelection({ from: startPos, to: endPos });
          from = startPos;
          to = endPos;
        }
      }
    }

    text = editor.state.doc.textBetween(from, to, ' ');
    if (text.trim().length > 0) {
      e.preventDefault();
      setSelectedRange({ from, to, text });
      pendingSelectionRef.current = { from, to, text };

      const menuWidth = 300;
      const menuHeight = 440;
      const padding = 16;
      let targetY = e.clientY;
      if (e.clientY + menuHeight > window.innerHeight - padding && e.clientY - menuHeight >= padding) {
        targetY = e.clientY - menuHeight;
      }
      const x = Math.min(Math.max(padding, e.clientX), Math.max(padding, window.innerWidth - menuWidth - padding));
      const y = Math.min(Math.max(padding, targetY), Math.max(padding, window.innerHeight - menuHeight - padding));
      setContextCoords({ x, y });
      setShowContextMenu(true);
      setShowSelectionBubble(false);
    }
  };

  const handleOpenFromBubble = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessingActionId !== null) return;
    const currentRange = selectedRange || pendingSelectionRef.current;
    if (!currentRange) return;
    const menuWidth = 300;
    const menuHeight = 440;
    const padding = 16;
    let targetY = bubbleCoords.y + 40;
    if (bubbleCoords.y + 40 + menuHeight > window.innerHeight - padding && bubbleCoords.y - menuHeight - 10 >= padding) {
      targetY = bubbleCoords.y - menuHeight - 10;
    }
    const x = Math.min(Math.max(padding, bubbleCoords.x), Math.max(padding, window.innerWidth - menuWidth - padding));
    const y = Math.min(Math.max(padding, targetY), Math.max(padding, window.innerHeight - menuHeight - padding));
    setContextCoords({ x, y });
    setShowContextMenu(true);
    setShowSelectionBubble(false);
  };

  const removeAiProcessingMark = (actionId: string) => {
    if (!editor || editor.isDestroyed) return;
    let matchedFrom: number | null = null;
    let matchedTo: number | null = null;

    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.marks) {
        const hasMark = node.marks.some(
          (m: any) => m.type.name === 'aiProcessing' && m.attrs.id === actionId
        );
        if (hasMark) {
          if (matchedFrom === null) matchedFrom = pos;
          matchedTo = pos + node.nodeSize;
        }
      }
    });

    if (matchedFrom !== null && matchedTo !== null) {
      editor
        .chain()
        .setTextSelection({ from: matchedFrom, to: matchedTo })
        .unsetMark('aiProcessing')
        .run();
    }
  };

  const handleExecuteQuickAction = async (action: QuickActionItem, targetLanguage?: string) => {
    if (!editor || editor.isDestroyed) return;

    // Anti-spam guard: if an action is currently processing, ignore new action calls
    if (isProcessingActionId !== null) return;

    const currentRange = selectedRange || pendingSelectionRef.current;
    if (!currentRange || !currentRange.text.trim()) return;

    // If translate / requires target language and not selected yet, open language picker
    if (action.prompt.includes('{{TARGET_LANGUAGE}}') && !targetLanguage) {
      pendingSelectionRef.current = currentRange;
      setActiveActionForLanguage(action);
      setShowContextMenu(false);
      setShowSelectionBubble(false);
      setShowLanguagePicker(true);
      return;
    }

    const { from, to, text } = currentRange;
    const actionId = `ai-${Date.now()}`;

    // DISMISS ALL MENUS IMMEDIATELY (Requirement 3)
    setShowContextMenu(false);
    setShowSelectionBubble(false);
    setShowLanguagePicker(false);
    setActiveActionForLanguage(null);
    setSelectedRange(null);
    pendingSelectionRef.current = null;

    // Lock action ID for anti-spam (Requirement 5)
    setIsProcessingActionId(action.id);
    isProcessingActionIdRef.current = actionId;

    // Apply the shimmering non-selectable mark to the selected text (Requirement 3)
    try {
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setMark('aiProcessing', { id: actionId })
        .setTextSelection({ from: to, to }) // move cursor right after processing text so user can continue writing freely
        .run();
    } catch (e) {
      console.warn('Failed to apply aiProcessing mark:', e);
    }

    try {
      // Execute the AI processing (Translation, Enhancement, etc.)
      const output = await executeTargetedQuickAction(text, action.prompt, targetLanguage);
      if (!output) {
        showToast(isRtl ? 'لم يتم استلام رد من النموذج' : 'No response from model', 'warning');
        removeAiProcessingMark(actionId);
        return;
      }

      const isInlineSelection = !text.includes('\n');
      const insertable = await cleanAndFormatMarkdown(output, isInlineSelection, isDarkPaper || isDarkTheme);

      if (editor && !editor.isDestroyed) {
        // Locate the tracked span in case user continued writing elsewhere (Requirement 4 & 5)
        let matchedFrom: number | null = null;
        let matchedTo: number | null = null;

        editor.state.doc.descendants((node, pos) => {
          if (node.isText && node.marks) {
            const hasMark = node.marks.some(
              (m: any) => m.type.name === 'aiProcessing' && m.attrs.id === actionId
            );
            if (hasMark) {
              if (matchedFrom === null) matchedFrom = pos;
              matchedTo = pos + node.nodeSize;
            }
          }
        });

        // If the marked span is found (user didn't delete it while writing)
        if (matchedFrom !== null && matchedTo !== null) {
          isLoadingRef.current = true;
          editor
            .chain()
            .focus()
            .setTextSelection({ from: matchedFrom, to: matchedTo })
            .deleteSelection()
            .insertContent(insertable)
            .run();

          const newHtml = editor.getHTML();
          const newDelta = JSON.stringify(editor.getJSON());
          setContent(newHtml);
          isLoadingRef.current = false;
          isDirtyRef.current = false;

          if (activeNote?.id) {
            await db.notes.update(activeNote.id, {
              content: newHtml,
              contentDelta: newDelta,
              lastModified: new Date().toISOString(),
            });
          }
        }
      }

    } catch (err: any) {
      console.error('Targeted Quick Action error:', err);
      removeAiProcessingMark(actionId);
      showToast(err.message || (isRtl ? 'فشل تطبيق الإجراء' : 'Failed to apply action'), 'error');
    } finally {
      isProcessingActionIdRef.current = null;
      setIsProcessingActionId(null);
    }
  };

  const handleExecuteCustomPromptModal = async () => {
    const prompt = customModalPrompt.trim();
    if (!prompt) return;

    if (customModalMode === 'general') {
      if (savePromptToActionList) {
        const name = prompt.length > 25 ? prompt.slice(0, 25) + '…' : prompt;
        useAppStore.getState().addGeneralAction({
          name,
          nameAr: name,
          prompt,
          icon: 'Sparkles',
          enabled: true,
          isCustom: true,
        });
        showToast(isRtl ? 'تم حفظ الأمر في قائمة الإجراءات العامة' : 'Saved to General Actions list', 'success');
      }

      setCustomModalPrompt('');
      setSavePromptToActionList(false);
      setShowCustomPromptModal(false);
      handleEnhance(prompt);
    } else {
      const currentRange = selectedRange || pendingSelectionRef.current;
      if (!currentRange || !currentRange.text.trim()) {
        showToast(isRtl ? 'يرجى تحديد نص أولاً' : 'Please select text first', 'warning');
        setShowCustomPromptModal(false);
        return;
      }

      const name = prompt.length > 25 ? prompt.slice(0, 25) + '…' : prompt;
      const actionId = `custom_prompt_${Date.now()}`;
      const customActionItem: QuickActionItem = {
        id: actionId,
        name,
        nameAr: name,
        prompt,
        icon: 'Sparkles',
        enabled: true,
        isCustom: true,
      };

      if (savePromptToActionList) {
        useAppStore.getState().addQuickAction({
          name,
          nameAr: name,
          prompt,
          icon: 'Sparkles',
          enabled: true,
          isCustom: true,
        });
        showToast(isRtl ? 'تم حفظ الأمر في قائمة الإجراءات السريعة' : 'Saved to Quick Actions list', 'success');
      }

      setCustomModalPrompt('');
      setSavePromptToActionList(false);
      setShowCustomPromptModal(false);
      handleExecuteQuickAction(customActionItem);
    }
  };

  // Listen for enhance event from FloatingRecorder wand button
  useEffect(() => {
    const handler = () => handleEnhance();
    window.addEventListener('enhance-editor-content', handler);
    return () => window.removeEventListener('enhance-editor-content', handler);
  }, [handleEnhance]);

  // Auto-scroll during enhancement streaming
  useEffect(() => {
    if (isEnhancing && streamedEnhancement && enhanceScrollRef.current) {
      enhanceScrollRef.current.scrollTo({
        top: enhanceScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [streamedEnhancement, isEnhancing]);

  // Sync isNoteOpen and activeNoteId to global store
  useEffect(() => {
    setIsNoteOpen(!!activeNote);
    if (activeNote?.id) {
      setActiveNoteId(activeNote.id);
    }
    return () => {
      setIsNoteOpen(false);
    };
  }, [activeNote, setIsNoteOpen, setActiveNoteId]);

  // ─────────────────────────────────────────────────────────────
  // 3. Render: Grid View when no note is open
  // ─────────────────────────────────────────────────────────────
  if (!activeNote) {
    return (
      <div className="flex flex-col h-full bg-card md:rounded-2xl md:border md:border-border overflow-hidden shadow-sm" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="p-4 md:p-6 border-b border-border flex items-center justify-between bg-muted/50 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-transparent border border-primary/30 rounded-lg">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{isRtl ? 'الملاحظات' : 'Notes'}</h2>
              <p className="text-sm text-muted-foreground">{isRtl ? 'إدارة المستندات والملاحظات' : 'Manage your documents and notes'}</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="p-2 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95"
            title={isRtl ? 'إضافة ملاحظة' : 'Add Note'}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {notes?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
              <FileText className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">{isRtl ? 'لا توجد ملاحظات.' : 'No notes found.'}</p>
              <p className="text-sm mb-6">{isRtl ? 'أنشئ ملاحظة جديدة للبدء.' : 'Create a new note to get started.'}</p>
              <button
                onClick={() => setShowNewModal(true)}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
              >
                {isRtl ? 'إنشاء ملاحظة جديدة' : 'Create New Note'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notes?.map((note: Note) => (
                <div
                  key={note.id}
                  onClick={() => handleOpenNote(note)}
                  className="bg-card border border-border hover:border-primary/50 transition-colors rounded-xl p-5 cursor-pointer group flex flex-col shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg text-foreground line-clamp-1 flex-1">{note.title}</h3>
                    <button
                      onClick={(e) => handleDeleteNote(note.id!, e)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {note.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{note.description}</p>
                  )}
                  <div className="mt-auto pt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(note.lastModified).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal for New Note */}
        <AnimatePresence>
          {showNewModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setShowNewModal(false)}>
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card rounded-2xl w-full max-w-md shadow-2xl p-6 border border-border"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    {isRtl ? 'إنشاء ملاحظة جديدة' : 'Create New Note'}
                  </h3>
                  <button onClick={() => setShowNewModal(false)} className="text-muted-foreground hover:bg-muted p-1 rounded-md transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground/80">{isRtl ? 'العنوان' : 'Title'}</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder={isRtl ? 'مثال: ملخص كتاب' : 'e.g. Fiqh Summary Chapter 1'}
                      autoFocus
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground/80">{isRtl ? 'الوصف (اختياري)' : 'Description (Optional)'}</label>
                    <textarea
                      value={newDescription}
                      onChange={e => setNewDescription(e.target.value)}
                      placeholder={isRtl ? 'وصف مختصر للملاحظة...' : 'Brief context about this note...'}
                      rows={3}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all"
                    />
                  </div>
                </div>

                {/* Audio Upload Section */}
                <div className="relative">
                  <div className="absolute inset-x-0 -top-1 flex items-center">
                    <div className="flex-1 border-t border-border"></div>
                    <span className="px-3 text-xs text-muted-foreground bg-card">{isRtl ? 'أو ارفع ملفاً صوتياً للتلخيص' : 'or upload audio to summarize'}</span>
                    <div className="flex-1 border-t border-border"></div>
                  </div>
                  <div className="pt-6">
                    <input
                      ref={audioFileRef}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setUploadedFileName(file.name);
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => audioFileRef.current?.click()}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl transition-all text-sm font-medium ${
                        uploadedFileName 
                          ? 'border-primary/50 bg-primary/5 text-primary' 
                          : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-primary/5'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      {uploadedFileName || (isRtl ? 'اختر ملفاً صوتياً...' : 'Choose audio file...')}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                  <button
                    onClick={() => { setShowNewModal(false); setUploadedFileName(''); }}
                    className="px-5 py-2 font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  {uploadedFileName && audioFileRef.current?.files?.[0] ? (
                    <button
                      onClick={() => {
                        const file = audioFileRef.current?.files?.[0];
                        if (file && onAudioUpload) {
                          onAudioUpload(file);
                          setShowNewModal(false);
                          setUploadedFileName('');
                          setNewTitle('');
                          setNewDescription('');
                        }
                      }}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all shadow-sm font-medium flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" /> {isRtl ? 'رفع وتلخيص' : 'Upload & Summarize'}
                    </button>
                  ) : (
                    <button
                      onClick={handleCreateNote}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all shadow-sm font-medium flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> {isRtl ? 'إنشاء' : 'Create'}
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteId !== null && (
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
                    onClick={() => setDeleteId(null)}
                    className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-border transition-colors font-medium"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={async () => {
                      await db.notes.delete(deleteId);
                      if (activeNote?.id === deleteId) {
                        setActiveNote(null);
                      }
                      setDeleteId(null);
                    }}
                    className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-colors font-medium"
                  >
                    {t.delete}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Render: Note View (Locked or Editing)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-card rounded-none border-0 md:rounded-2xl md:border md:border-border overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-200" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── Top Header Bar ── */}
      <div className="px-3 py-3 md:px-6 md:py-4 border-b border-border flex items-center justify-between bg-card/70 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-2 md:pr-4">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={isRtl ? 'عنوان الملاحظة...' : 'Note title...'}
                className="w-full max-w-sm md:max-w-md bg-transparent border-0 border-b border-border focus:border-primary px-1 py-1 text-lg md:text-xl font-bold text-foreground outline-none transition-colors"
                autoFocus
              />
            ) : (
              <h2 className="text-lg md:text-xl font-bold text-foreground truncate select-none">
                {activeNote.title || (isRtl ? 'بدون عنوان' : 'Untitled Note')}
              </h2>
            )}
          </div>
        </div>

        {/* Action buttons (Containerless outline icons) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Undo / Redo buttons (only in edit mode) */}
          {isEditing && (
            <>
              <button
                type="button"
                onClick={() => editor && !editor.isDestroyed && editor.chain().focus().undo().run()}
                disabled={!editor || editor.isDestroyed || !editor.can().undo()}
                className="p-2 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 disabled:opacity-30 cursor-pointer"
                title={isRtl ? 'تراجع' : 'Undo'}
              >
                <Undo className="w-5 h-5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => editor && !editor.isDestroyed && editor.chain().focus().redo().run()}
                disabled={!editor || editor.isDestroyed || !editor.can().redo()}
                className="p-2 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 disabled:opacity-30 cursor-pointer"
                title={isRtl ? 'إعادة' : 'Redo'}
              >
                <Redo className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </>
          )}

          {/* Edit / Done Lock Toggle Button */}
          <button
            type="button"
            onClick={handleToggleEdit}
            className="p-2 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer"
            title={isEditing ? (isRtl ? 'تم (قفل الملاحظة)' : 'Done (Lock Note)') : (isRtl ? 'تعديل الملاحظة' : 'Edit Note')}
          >
            {isEditing ? (
              <Check className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
            ) : (
              <Edit3 className="w-5 h-5" strokeWidth={1.5} />
            )}
          </button>

          {/* Togglable formatting tools button with "Aa" icon placed at the very right side */}
          <button
            type="button"
            onClick={() => {
              if (!isEditing && !showToolbar) {
                setIsEditing(true);
              }
              setShowToolbar(prev => !prev);
            }}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 cursor-pointer select-none ${
              showToolbar 
                ? 'text-primary bg-primary/10 border border-primary/30 shadow-xs' 
                : 'text-foreground hover:bg-muted border border-transparent'
            }`}
            title={isRtl ? 'أدوات التنسيق (Aa)' : 'Formatting tools (Aa)'}
          >
            <span className="font-serif font-bold text-base tracking-tighter leading-none">
              Aa
            </span>
          </button>
        </div>
      </div>

      {/* ── Togglable Formatting Toolbar ── */}
      <AnimatePresence>
        {showToolbar && editor && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-b border-border bg-muted/40 backdrop-blur-xs shrink-0"
          >
            <input 
              ref={imageFileInputRef} 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload} 
            />

            <div className="px-3 py-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap select-none">
              {/* RTL / LTR Direction Toggle */}
              <button
                type="button"
                onClick={() => {
                  setManualDirection((prev) => {
                    const next = (prev === 'rtl' || (!prev && isNoteRtl)) ? 'ltr' : 'rtl';
                    return next;
                  });
                }}
                className={`p-2 rounded-xl transition-all shrink-0 cursor-pointer border ${
                  isNoteRtl 
                    ? 'bg-primary/15 text-primary border-primary/30 shadow-2xs' 
                    : 'bg-muted text-muted-foreground border-border/70 hover:text-foreground'
                }`}
                title={isNoteRtl ? (isRtl ? 'اتجاه النص: من اليمين لليسار (RTL)' : 'Text Direction: Right-to-Left (RTL)') : (isRtl ? 'اتجاه النص: من اليسار لليمين (LTR)' : 'Text Direction: Left-to-Right (LTR)')}
              >
                {isNoteRtl ? <ArrowLeft className="w-5 h-5 shrink-0" strokeWidth={2} /> : <ArrowRight className="w-5 h-5 shrink-0" strokeWidth={2} />}
              </button>

              <div className="w-[1px] h-5 bg-border mx-0.5 shrink-0" />

              {/* Font Size Dropdown Button */}
              <button
                ref={fontSizeBtnRef}
                type="button"
                onClick={() => {
                  if (showFontSizeMenu) {
                    setShowFontSizeMenu(false);
                  } else {
                    setShowColorMenu(false);
                    if (fontSizeBtnRef.current) {
                      const rect = fontSizeBtnRef.current.getBoundingClientRect();
                      const menuWidth = 145;
                      let left = isRtl ? rect.right - menuWidth : rect.left;
                      if (left < 8) left = 8;
                      if (left + menuWidth > window.innerWidth - 8) {
                        left = window.innerWidth - menuWidth - 8;
                      }
                      setFontSizeDropdownPos({
                        top: rect.bottom + 6,
                        left,
                      });
                      setShowFontSizeMenu(true);
                    }
                  }
                }}
                className={`px-2.5 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                  showFontSizeMenu || editor.getAttributes('textStyle').fontSize
                    ? 'bg-primary/15 text-primary font-bold border-primary/30 shadow-2xs'
                    : 'bg-card/80 hover:bg-muted text-foreground border-border/80'
                }`}
                title={isRtl ? 'حجم الخط' : 'Font Size'}
              >
                <Type className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span className="text-xs font-semibold">
                  {editor.getAttributes('textStyle').fontSize
                    ? editor.getAttributes('textStyle').fontSize.replace('px', '') + 'px'
                    : (isRtl ? 'الحجم' : 'Size')}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${showFontSizeMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Font Color Button */}
              <button
                type="button"
                onClick={() => {
                  setShowColorMenu(prev => !prev);
                  setShowFontSizeMenu(false);
                }}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  showColorMenu || editor.getAttributes('textStyle').color
                    ? 'bg-primary/20 text-primary font-bold border border-primary/30'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title={isRtl ? 'لون الخط' : 'Font Color'}
              >
                <Palette className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                {editor.getAttributes('textStyle').color && (
                  <span 
                    className="w-2.5 h-2.5 rounded-full border border-border shadow-xs shrink-0" 
                    style={{ backgroundColor: editor.getAttributes('textStyle').color }}
                  />
                )}
              </button>

              <div className="w-[1px] h-5 bg-border mx-0.5 shrink-0" />

              {/* Heading 1 */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive('heading', { level: 1 })
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Heading 1"
              >
                <Heading1 className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Heading 2 */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive('heading', { level: 2 })
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Heading 2"
              >
                <Heading2 className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Heading 3 */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive('heading', { level: 3 })
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Heading 3"
              >
                <Heading3 className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              <div className="w-[1px] h-5 bg-border mx-0.5 shrink-0" />

              {/* Bold */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive('bold')
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Bold"
              >
                <Bold className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Italic */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive('italic')
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Italic"
              >
                <Italic className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Underline */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive('underline')
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Underline"
              >
                <UnderlineIcon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Strikethrough */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive('strike')
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Strikethrough"
              >
                <Strikethrough className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Inline Code */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive('code')
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Inline Code"
              >
                <Code className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              <div className="w-[1px] h-5 bg-border mx-0.5 shrink-0" />

              {/* Bullet List */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive('bulletList')
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Bullet List"
              >
                <List className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Ordered List */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive('orderedList')
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Numbered List"
              >
                <ListOrdered className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Blockquote */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive('blockquote')
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Quote"
              >
                <Quote className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Divider / Horizontal Rule */}
              <button
                type="button"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                className="p-2 rounded-xl text-foreground hover:bg-muted active:scale-95 transition-colors shrink-0 cursor-pointer"
                title="Divider"
              >
                <Minus className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              <div className="w-[1px] h-5 bg-border mx-0.5 shrink-0" />

              {/* Align Left */}
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive({ textAlign: 'left' })
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Align Left"
              >
                <AlignLeft className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Align Center */}
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive({ textAlign: 'center' })
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Align Center"
              >
                <AlignCenter className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Align Right */}
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive({ textAlign: 'right' })
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title="Align Right"
              >
                <AlignRight className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Align Justify */}
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  editor.isActive({ textAlign: 'justify' })
                    ? 'bg-foreground text-background font-bold'
                    : 'text-foreground hover:bg-muted active:scale-95'
                }`}
                title={isRtl ? 'محاذاة مضبوطة (Justify)' : 'Justify'}
              >
                <AlignJustify className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              <div className="w-[1px] h-5 bg-border mx-0.5 shrink-0" />

              {/* Insert Table */}
              <button
                type="button"
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                className="p-2 rounded-xl text-foreground hover:bg-muted active:scale-95 transition-colors shrink-0 cursor-pointer"
                title={isRtl ? 'إدراج جدول' : 'Insert Table'}
              >
                <Table className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>

              {/* Insert Image */}
              <button
                type="button"
                onClick={() => imageFileInputRef.current?.click()}
                className="p-2 rounded-xl text-foreground hover:bg-muted active:scale-95 transition-colors shrink-0 cursor-pointer"
                title={isRtl ? 'إدراج صورة' : 'Insert Image'}
              >
                <ImageIcon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              </button>
            </div>

            {/* Font Size Dropdown List Menu */}
            <AnimatePresence>
              {showFontSizeMenu && fontSizeDropdownPos && (
                <>
                  <div 
                    className="fixed inset-0 z-[90]" 
                    onClick={() => setShowFontSizeMenu(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: 'fixed',
                      top: fontSizeDropdownPos.top,
                      left: fontSizeDropdownPos.left,
                      width: 145,
                      zIndex: 100,
                    }}
                    className="bg-card border border-border shadow-2xl rounded-2xl py-1 max-h-64 overflow-y-auto select-none backdrop-blur-md"
                    dir={isRtl ? 'rtl' : 'ltr'}
                  >
                    <div className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground border-b border-border/50 flex items-center justify-between">
                      <span>{isRtl ? 'حجم الخط' : 'Font Size'}</span>
                      <Type className="w-3.5 h-3.5" />
                    </div>
                    <div className="py-1">
                      {FONT_SIZE_PRESETS.map((preset) => {
                        const currentSize = editor.getAttributes('textStyle').fontSize;
                        const isActive = preset.size === '' ? !currentSize : currentSize === preset.size;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              if (preset.size === '') {
                                (editor.chain().focus() as any).unsetFontSize().run();
                              } else {
                                (editor.chain().focus() as any).setFontSize(preset.size).run();
                              }
                              setShowFontSizeMenu(false);
                            }}
                            className={`w-full px-3 py-1.5 flex items-center justify-between text-xs transition-colors cursor-pointer hover:bg-muted/80 ${
                              isActive ? 'text-primary font-bold bg-primary/10' : 'text-foreground'
                            }`}
                          >
                            <span style={{ fontSize: preset.size || '13px' }}>
                              {isRtl ? preset.labelAr : preset.label}
                            </span>
                            {isActive && <Check className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={2} />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Font Color Selector Sub-bar */}
            <AnimatePresence>
              {showColorMenu && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="px-3 py-2 border-t border-border/60 bg-muted/60 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-muted-foreground px-1 shrink-0 flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5" />
                      {isRtl ? 'لون الخط:' : 'Color:'}
                    </span>
                    
                    {/* Reset Color */}
                    <button
                      type="button"
                      onClick={() => {
                        (editor.chain().focus() as any).unsetColor().run();
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-all shrink-0 cursor-pointer ${
                        !editor.getAttributes('textStyle').color
                          ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                          : 'bg-background hover:bg-muted text-foreground border border-border/70'
                      }`}
                    >
                      {isRtl ? 'تلقائي' : 'Default'}
                    </button>

                    {/* Curated Swatches matching PDF & modern themes */}
                    {[
                      { name: 'Dark Neutral', color: '#0f172a' },
                      { name: 'Light Neutral', color: '#f8fafc' },
                      { name: 'Emerald', color: '#006239' },
                      { name: 'Bright Emerald', color: '#10b981' },
                      { name: 'Amber/Gold', color: '#b45309' },
                      { name: 'Gold', color: '#fbbf24' },
                      { name: 'Royal Blue', color: '#1d4ed8' },
                      { name: 'Sky Blue', color: '#38bdf8' },
                      { name: 'Crimson', color: '#b91c1c' },
                      { name: 'Coral Red', color: '#f87171' },
                      { name: 'Purple', color: '#7c3aed' },
                      { name: 'Slate Gray', color: '#64748b' },
                    ].map((swatch) => {
                      const currentColor = editor.getAttributes('textStyle').color;
                      const isSelected = currentColor?.toLowerCase() === swatch.color.toLowerCase();
                      return (
                        <button
                          key={swatch.color}
                          type="button"
                          onClick={() => {
                            (editor.chain().focus() as any).setColor(swatch.color).run();
                          }}
                          className={`w-6 h-6 rounded-full shrink-0 cursor-pointer transition-transform hover:scale-115 relative border ${
                            isSelected ? 'ring-2 ring-primary ring-offset-2 scale-110 border-primary' : 'border-border/80'
                          }`}
                          style={{ backgroundColor: swatch.color }}
                          title={swatch.name}
                        />
                      );
                    })}

                    {/* Custom Color Input */}
                    <label 
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-background hover:bg-muted border border-border/70 rounded-lg text-xs cursor-pointer shrink-0 transition-colors shadow-2xs"
                      title={isRtl ? 'اختر لوناً مخصصاً' : 'Choose custom color'}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-rose-500 via-amber-500 via-emerald-500 to-sky-500 shrink-0" />
                      <span className="font-medium">{isRtl ? 'مخصص' : 'Custom'}</span>
                      <input
                        type="color"
                        value={editor.getAttributes('textStyle').color || '#000000'}
                        onChange={(e) => {
                          (editor.chain().focus() as any).setColor(e.target.value).run();
                        }}
                        className="w-0 h-0 opacity-0 pointer-events-none absolute"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowColorMenu(false)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                    title={isRtl ? 'إغلاق' : 'Close'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Editor Content Area ── */}
      <div 
        ref={noteContainerRef}
        className={`flex-1 min-h-0 overflow-y-auto relative p-4 md:p-8 cursor-text ${
          isDarkPaper ? 'paper-dark' : 'paper-light'
        } ${
          !isEditing ? 'read-only-view' : 'editing-view'
        } ${isNoteRtl ? 'note-rtl' : 'note-ltr'}`} 
        dir={isNoteRtl ? 'rtl' : 'ltr'}
        style={{
          backgroundColor: activeNote?.backgroundImage ? 'transparent' : currentPaperColor,
          backgroundImage: activeNote?.backgroundImage 
            ? (activeNote.backgroundImage.startsWith('custom-') && customBgDataUrl
                ? `url(${customBgDataUrl})` 
                : `url('/backgrounds/${activeNote.backgroundImage}')`)
            : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        onClick={() => {
          const domSel = typeof window !== 'undefined' ? window.getSelection() : null;
          if (domSel && domSel.toString().trim().length > 0) return;
          if (isEditing && editor && !editor.isDestroyed && !editor.isFocused) {
            editor.commands.focus();
          }
        }}
      >
        <div 
          className="note-zoom-canvas h-full w-full"
          style={{
            zoom: zoomLevel,
          }}
        >
          {/* ── In-Note Live Recording Card (appears when "Continue & Write" is active) ── */}
          {isRecording && activeRecordingNoteId === activeNote?.id && (
            <div className="mb-4 mx-0 rounded-2xl border border-red-500/30 bg-red-500/5 dark:bg-red-500/10 backdrop-blur-sm p-3.5 select-none" dir="ltr">
              <div className="flex items-center gap-3">
                {/* Pause / Resume */}
                <button
                  type="button"
                  onClick={() => isPaused ? resumeRecording() : pauseRecording()}
                  className="p-2 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer shrink-0"
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? <Play className="w-4.5 h-4.5 ml-0.5" strokeWidth={1.5} /> : <Pause className="w-4.5 h-4.5" strokeWidth={1.5} />}
                </button>

                {/* Waveform + Timer + Status */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-[2px] h-7 shrink min-w-0 overflow-hidden">
                    {[12, 22, 16, 28, 20, 32, 18, 26, 36, 24, 30, 16, 28, 22, 14, 26, 18, 12].map((maxH, idx) => (
                      <span
                        key={idx}
                        className={`w-[2px] shrink-0 rounded-full bg-red-500 transition-all ${isPaused ? 'opacity-40' : 'opacity-80'}`}
                        style={{
                          height: isPaused ? `${Math.max(3, Math.round(maxH * 0.25))}px` : `${Math.round(maxH * 0.75)}px`,
                          animation: isPaused ? 'none' : `redWavePulse 1.1s ease-in-out infinite ${(idx * 0.08) % 1.2}s alternate`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} />
                    <span className="font-mono text-xs font-bold text-foreground tracking-wider">
                      {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:{String(recordingTime % 60).padStart(2, '0')}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                    {isRtl ? 'تسجيل قيد التشغيل — يمكنك الكتابة' : 'Recording — you can type'}
                  </span>
                </div>

                {/* Discard */}
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm(isRtl ? 'هل تريد إلغاء التسجيل؟' : 'Discard recording?')) {
                      await discardRecordingHook();
                      showToast(isRtl ? 'تم إلغاء التسجيل' : 'Recording discarded', 'info');
                    }
                  }}
                  className="p-2 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer shrink-0"
                  title={isRtl ? 'إلغاء التسجيل' : 'Discard'}
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>

                {/* Save Recording to This Note (Solid Green with Done Icon) */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const noteId = await saveRecordingHook(activeNote?.folderId, undefined, activeNote?.id!);
                      if (noteId && activeNote) {
                        // Refresh note from DB to get the new audio data
                        const updated = await db.notes.get(noteId);
                        if (updated) {
                          setActiveNote(prev => prev ? {
                            ...prev,
                            audioBlob: updated.audioBlob,
                            audioPath: updated.audioPath,
                            audioDuration: updated.audioDuration,
                          } : null);
                        }
                        showToast(isRtl ? 'تم حفظ التسجيل بنجاح' : 'Recording saved to note', 'success');
                      }
                    } catch (err) {
                      console.error('In-note save failed:', err);
                      showToast(isRtl ? 'فشل حفظ التسجيل' : 'Failed to save recording', 'error');
                    }
                  }}
                  className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-xs transition-all cursor-pointer active:scale-95 hover:opacity-90 shrink-0"
                  title={isRtl ? 'حفظ التسجيل' : 'Save Recording'}
                >
                  <Check className="w-4 h-4 md:w-4.5 md:h-4.5 text-white" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}

          {/* Attached Recorded Voice Card for Audio Notes (also appears after in-note recording is saved) */}
          {(activeNote?.audioBlob || activeNote?.audioPath) && !(isRecording && activeRecordingNoteId === activeNote?.id) && (
            <AudioNoteCard
              audioBlob={activeNote.audioBlob}
              audioPath={activeNote.audioPath}
              duration={activeNote.audioDuration}
              onDeleteAudio={handleDeleteAudioFromNote}
              onGenerateNotes={handleGenerateAudioNotes}
              isGenerating={isEnhancing}
              isRtl={isNoteRtl}
            />
          )}

          <EditorContent 
            editor={editor} 
            className="tiptap-wrapper h-full"
          />
        </div>



        {/* Interactive Floating Zoom Indicator & Controls */}
        <AnimatePresence>
          {zoomLevel !== 1.0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 10 }}
              transition={{ duration: 0.15 }}
              className="fixed bottom-6 left-6 z-30 flex items-center gap-1.5 bg-card/90 backdrop-blur-md border border-border/80 text-foreground px-2.5 py-1.5 rounded-full shadow-lg text-xs font-mono select-none"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomLevel((prev) => Math.max(0.6, Math.round((prev - 0.1) * 10) / 10));
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition-all text-muted-foreground hover:text-foreground cursor-pointer"
                title="Zoom Out (Ctrl -)"
              >
                <Minus className="w-3 h-3" />
              </button>

              <span className="font-semibold text-[11px] px-1 min-w-[36px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomLevel((prev) => Math.min(2.5, Math.round((prev + 0.1) * 10) / 10));
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition-all text-muted-foreground hover:text-foreground cursor-pointer"
                title="Zoom In (Ctrl +)"
              >
                <Plus className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomLevel(1.0);
                }}
                className="text-[10px] text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded hover:bg-muted transition-colors cursor-pointer border-l border-border/60 ml-0.5 pl-1.5"
                title="Reset Zoom (Ctrl 0)"
              >
                {isRtl ? 'إعادة ضبط' : 'Reset'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Circular Draggable Floating AI Assistant Button (hidden during processing) ── */}
      {!isEnhancing && !isProcessingActionId && (
      <motion.div
        drag
        dragConstraints={dragConstraints}
        dragMomentum={false}
        dragElastic={0.1}
        onDragStart={() => {
          isAiDraggingRef.current = true;
        }}
        onDragEnd={() => {
          setTimeout(() => {
            isAiDraggingRef.current = false;
          }, 100);
        }}
        className="fixed bottom-6 right-6 z-40 touch-none select-none"
      >
        <div className="relative">
          {/* ── AI Dropdown Menu (Compact Popover) ── */}
          <AnimatePresence>
            {showAiMenu && (
              <>
                {/* Transparent click-away backdrop (no dark blur) */}
                <div
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAiMenu(false);
                  }}
                />

                {/* Dropdown Menu Container */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 8 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full right-0 mb-3 w-72 sm:w-80 max-h-[82vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl p-2.5 z-20 select-none overflow-hidden"
                  dir={isRtl ? 'rtl' : 'ltr'}
                >
                  {/* Menu Items List */}
                  <div className="space-y-1 overflow-y-auto flex-1 max-h-72 pr-0.5">
                    {/* Custom Option: identical UI to other options in the list */}
                    <div
                      className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-muted/80 transition-all group cursor-pointer"
                      onClick={() => {
                        setShowAiMenu(false);
                        setCustomModalMode('general');
                        setCustomModalPrompt('');
                        setSavePromptToActionList(false);
                        setShowCustomPromptModal(true);
                      }}
                    >
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 text-left rtl:text-right">
                        <div className="text-xs font-semibold text-foreground transition-colors truncate">
                          <span>{isRtl ? 'طلب مخصص...' : 'Custom Prompt...'}</span>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const enabledActions = (settings.generalActions || defaultGeneralActions).filter(action => action.enabled !== false);
                      if (enabledActions.length === 0) {
                        return (
                          <div className="p-3 text-center text-xs text-muted-foreground">
                            {isRtl ? 'لا توجد إجراءات عامة مفعلة' : 'No active general actions'}
                          </div>
                        );
                      }
                      return enabledActions.map((action) => {
                        const Icon = getActionIcon(action.icon);
                        const isSelected = settings.selectedAiOption === action.id;
                        return (
                          <div
                            key={action.id}
                            className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-muted/80 transition-all group cursor-pointer"
                            onClick={() => {
                              setShowAiMenu(false);
                              useAppStore.getState().updateSettings({ selectedAiOption: action.id });
                              handleEnhance(action.prompt);
                            }}
                          >
                            <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 text-left rtl:text-right">
                              <div className="text-xs font-semibold text-foreground transition-colors truncate flex items-center justify-between">
                                <span>{isRtl ? (action.nameAr || action.name) : action.name}</span>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-foreground shrink-0" />
                                )}
                              </div>
                            </div>
                            {action.isCustom && (
                              <button
                                type="button"
                                title={isRtl ? 'حذف الإجراء' : 'Delete action'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  useAppStore.getState().removeGeneralAction(action.id);
                                  showToast(isRtl ? 'تم حذف الإجراء' : 'Action deleted', 'success');
                                }}
                                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Trigger Button: Styled with BorderBeam and solid green bolt icon, becomes red and locked during live recording */}
          <button
            type="button"
            onClick={() => {
              if (isAiDraggingRef.current) return;
              if (isRecording) {
                showToast(
                  isRtl
                    ? 'يرجى إيقاف التسجيل وحفظه أولاً لتتمكن من استخدام إجراءات الزر العائم'
                    : 'Please stop & save recording first to use floating AI actions',
                  'warning'
                );
                return;
              }
              setShowAiMenu((prev) => !prev);
            }}
            disabled={isEnhancing}
            className={`relative overflow-hidden w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center group cursor-pointer transition-all active:scale-95 disabled:opacity-50 shadow-xl ${
              isRecording
                ? 'bg-gradient-to-br from-red-600 via-red-700 to-red-900 border border-red-500/50 shadow-red-950/40 opacity-75'
                : 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-700 text-white border border-emerald-400/50 shadow-emerald-600/35'
            }`}
            title={
              isRecording
                ? (isRtl ? 'التسجيل قيد التشغيل — أوقف التسجيل لاستخدام الإجراءات' : 'Recording active — stop recording to use actions')
                : (isRtl ? 'المساعد الذكي لتقييد AI' : 'Taqyeed AI Assistant')
            }
          >
            {!isRecording && (
              <BorderBeam
                size={140}
                duration={6}
                colorFrom="#ffffff"
                colorTo="#a7f3d0"
                borderWidth={2}
              />
            )}
            {isEnhancing ? (
              <Loader2 className="w-7 h-7 md:w-8 md:h-8 text-white animate-spin relative z-10" strokeWidth={1.5} />
            ) : (
              <Zap className={`w-7 h-7 md:w-8 md:h-8 ${isRecording ? 'text-white/70 fill-white/70' : 'text-white fill-white'} relative z-10 transition-transform duration-300 ${showAiMenu ? 'scale-110 rotate-12' : 'group-hover:scale-110'}`} strokeWidth={0} />
            )}
          </button>
        </div>
      </motion.div>
      )} {/* end !isEnhancing && !isProcessingActionId */}

      <BackgroundModal 
        isOpen={isBackgroundModalOpen} 
        onClose={() => setIsBackgroundModalOpen(false)} 
        activeNote={activeNote} 
      />

      {/* Delete Confirmation Modal for Active Note */}
      <AnimatePresence>
        {deleteId !== null && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
            <motion.div
              onClick={(e) => e.stopPropagation()}
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
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-border transition-colors font-medium cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await db.notes.delete(deleteId);
                    if (activeNote?.id === deleteId) {
                      setActiveNote(null);
                      setActiveNoteId(null);
                      setIsNoteOpen(false);
                    }
                    setDeleteId(null);
                    showToast(isRtl ? 'تم حذف الملاحظة' : 'Note deleted', 'info');
                  }}
                  className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-colors font-medium cursor-pointer"
                >
                  {t.delete}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Floating Selection Bubble (Mobile & Quick Access) ── */}
      <AnimatePresence>
        {showSelectionBubble && !showContextMenu && !showLanguagePicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 5 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: bubbleCoords.x,
              top: bubbleCoords.y,
              zIndex: 90,
              pointerEvents: 'none',
            }}
          >
            <button
              type="button"
              onClick={handleOpenFromBubble}
              style={{ pointerEvents: 'auto' }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background font-medium text-xs rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all border border-background/20 cursor-pointer select-none"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
              <span>{isRtl ? 'إجراءات ذكية' : 'AI Actions'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Contextual Menu Popover ── */}
      <AnimatePresence>
        {showContextMenu && (
          <div 
            className={`fixed inset-0 z-[100] ${
              isSmallScreen 
                ? 'bg-black/60 backdrop-blur-xs flex items-center justify-center p-4' 
                : 'bg-black/15'
            }`}
            onClick={() => setShowContextMenu(false)}
          >
            <motion.div
              initial={isSmallScreen ? { opacity: 0, scale: 0.95, y: 10 } : { opacity: 0, scale: 0.92, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={isSmallScreen ? { opacity: 0, scale: 0.95, y: 10 } : { opacity: 0, scale: 0.92, y: 6 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              style={
                isSmallScreen
                  ? {
                      width: '100%',
                      maxWidth: 320,
                      maxHeight: 'min(480px, 82vh)',
                    }
                  : {
                      position: 'fixed',
                      left: `${contextCoords.x}px`,
                      top: `${contextCoords.y}px`,
                      width: 300,
                      maxHeight: 'min(440px, calc(100vh - 32px))',
                    }
              }
              className="bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col z-[101]"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {/* Menu Header (Removed as per user request) */}

              {/* Selected snippet preview */}
              {selectedRange?.text && (
                <div className="px-3.5 py-2 bg-muted/20 border-b border-border/50 text-[11px] text-muted-foreground truncate italic">
                  "{selectedRange.text.length > 35 ? selectedRange.text.slice(0, 35) + '…' : selectedRange.text}"
                </div>
              )}

              {/* Actions List */}
              <div className="p-1.5 overflow-y-auto flex-1 flex flex-col divide-y divide-border/20">
                
                {/* Standard Clipboard Actions */}
                <div className="flex justify-between px-2 py-3 gap-2 bg-muted/20 mb-1">
                  <button
                    type="button"
                    onClick={() => {
                      editor?.chain().focus().selectAll().run();
                    }}
                    className="flex-1 flex flex-col items-center justify-center p-2 rounded-xl hover:bg-muted transition-colors text-foreground cursor-pointer"
                  >
                    <CheckSquare className="w-5 h-5 mb-1.5 text-foreground" />
                    <span className="text-xs font-bold">{isRtl ? 'تحديد الكل' : 'Select All'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRange?.text) {
                        navigator.clipboard.writeText(selectedRange.text);
                        setShowContextMenu(false);
                      }
                    }}
                    className="flex-1 flex flex-col items-center justify-center p-2 rounded-xl hover:bg-muted transition-colors text-foreground cursor-pointer"
                  >
                    <Copy className="w-5 h-5 mb-1.5 text-foreground" />
                    <span className="text-xs font-bold">{isRtl ? 'نسخ' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRange?.text) {
                        navigator.clipboard.writeText(selectedRange.text);
                        editor?.chain().focus().deleteSelection().run();
                        setShowContextMenu(false);
                      }
                    }}
                    className="flex-1 flex flex-col items-center justify-center p-2 rounded-xl hover:bg-muted transition-colors text-foreground cursor-pointer"
                  >
                    <Scissors className="w-5 h-5 mb-1.5 text-foreground" />
                    <span className="text-xs font-bold">{isRtl ? 'قص' : 'Cut'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editor?.chain().focus().deleteSelection().run();
                      setShowContextMenu(false);
                    }}
                    className="flex-1 flex flex-col items-center justify-center p-2 rounded-xl hover:bg-destructive/10 text-destructive transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-5 h-5 mb-1.5 text-destructive" />
                    <span className="text-xs font-bold">{isRtl ? 'حذف' : 'Delete'}</span>
                  </button>
                </div>

                {/* AI Quick Actions */}
                <div className="flex flex-col divide-y divide-border/20 pt-1">
                  {/* Custom Option: identical UI to other options in the list */}
                  <div
                    className="w-full text-left rtl:text-right px-3 py-2.5 transition-colors group flex items-center justify-between gap-3 hover:bg-muted active:bg-muted/80 cursor-pointer"
                    onClick={() => {
                      const currentRange = selectedRange || pendingSelectionRef.current;
                      if (!currentRange || !currentRange.text.trim()) return;
                      pendingSelectionRef.current = currentRange;
                      setSelectedRange(currentRange);
                      setShowContextMenu(false);
                      setShowSelectionBubble(false);
                      setCustomModalMode('selection');
                      setCustomModalPrompt('');
                      setSavePromptToActionList(false);
                      setShowCustomPromptModal(true);
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Sparkles className="w-4 h-4 text-foreground/80 shrink-0" />
                      <span className="text-xs font-semibold text-foreground truncate">
                        {isRtl ? 'طلب مخصص...' : 'Custom Prompt...'}
                      </span>
                    </div>
                  </div>
                  {(settings.quickActions || defaultQuickActions)
                    .filter(a => a.enabled !== false)
                    .map((action) => {
                      const IconComponent = getActionIcon(action.icon);
                      const isProcessing = isProcessingActionId === action.id;
                      const isTranslate = action.prompt.includes('{{TARGET_LANGUAGE}}');

                      return (
                        <div
                          key={action.id}
                          className={`w-full text-left rtl:text-right px-3 py-2.5 transition-colors group flex items-center justify-between gap-3 hover:bg-muted active:bg-muted/80 ${
                            isProcessing ? 'bg-muted/50' : ''
                          }`}
                        >
                          <button
                            type="button"
                            disabled={isProcessingActionId !== null}
                            onClick={() => handleExecuteQuickAction(action)}
                            className="flex-1 min-w-0 flex items-center justify-between gap-3 cursor-pointer text-left rtl:text-right"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0 group-hover:scale-105 transition-all">
                                {isProcessing ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                                ) : (
                                  <IconComponent className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-foreground transition-colors truncate">
                                  {isRtl ? (action.nameAr || action.name) : action.name}
                                </div>
                              </div>
                            </div>

                            {isTranslate && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {isRtl ? 'لغات العالم' : 'All Languages'}
                              </span>
                            )}
                          </button>

                          {action.isCustom && (
                            <button
                              type="button"
                              title={isRtl ? 'حذف الإجراء' : 'Delete action'}
                              onClick={(e) => {
                                e.stopPropagation();
                                useAppStore.getState().removeQuickAction(action.id);
                                showToast(isRtl ? 'تم حذف الإجراء' : 'Action deleted', 'success');
                              }}
                              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Center Screen Pop Animation for Prompt Input (No container, no header) ── */}
      <AnimatePresence>
        {showCustomPromptModal && (
          <div
            className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-default"
            onClick={() => setShowCustomPromptModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-[24px] border border-border bg-card shadow-2xl focus-within:border-ring/50 focus-within:ring-1 focus-within:ring-ring/20 p-3 pt-3.5 pb-2.5 flex flex-col justify-between select-none"
              style={{ minHeight: 124 }}
            >
              <style dangerouslySetInnerHTML={{ __html: `
                .prompt-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; background: transparent; }
                .prompt-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .prompt-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; }
                .prompt-scrollbar:hover::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.3); }
              `}} />

              {/* Textarea */}
              <textarea
                ref={customPromptTextareaRef}
                value={customModalPrompt}
                onChange={(e) => setCustomModalPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (customModalPrompt.trim() && !isEnhancing && isProcessingActionId === null) {
                      handleExecuteCustomPromptModal();
                    }
                  }
                  if (e.key === 'Escape') {
                    setShowCustomPromptModal(false);
                  }
                }}
                placeholder={
                  customModalMode === 'selection'
                    ? (isRtl ? 'اطلب أي شيء للنص المحدد (اضغط Enter للإرسال)...' : 'Ask anything for selection (Press Enter to send)...')
                    : (isRtl ? 'اطلب أي شيء للملاحظة (اضغط Enter للإرسال)...' : 'Ask anything for this note (Press Enter to send)...')
                }
                dir={isRtl ? 'rtl' : 'ltr'}
                rows={3}
                className="prompt-scrollbar w-full resize-none bg-transparent px-2 pt-0.5 pb-2 text-sm leading-[22px] text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground/70 cursor-text min-h-[64px] max-h-[160px] overflow-y-auto"
              />

              {/* Bottom row: Save Action on left, Send button on right */}
              <div className="flex items-center justify-between pt-1 px-1" dir="ltr">
                {/* Left side: Save Action */}
                <label
                  className="flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
                  dir={isRtl ? 'rtl' : 'ltr'}
                >
                  <input
                    type="checkbox"
                    checked={savePromptToActionList}
                    onChange={(e) => setSavePromptToActionList(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-border text-foreground accent-foreground cursor-pointer"
                  />
                  <span>{isRtl ? 'حفظ في قائمة الإجراءات' : 'Save in actions list'}</span>
                </label>

                {/* Right side: Send button */}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={handleExecuteCustomPromptModal}
                  disabled={!customModalPrompt.trim() || isEnhancing || isProcessingActionId !== null}
                  aria-label={isRtl ? 'إرسال' : 'Send prompt'}
                  style={{ borderRadius: 9999 }}
                  className="flex h-8 w-8 items-center justify-center bg-foreground text-background transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-30 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer shrink-0"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.2]" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Searchable World Language Picker Modal ── */}
      <AnimatePresence>
        {showLanguagePicker && (
          <div 
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowLanguagePicker(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {/* Picker Header */}
              <div className="p-4 border-b border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-transparent border border-primary/30 text-primary flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {isRtl ? 'اختر لغة الترجمة' : 'Select Target Language'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {isRtl ? 'اختر أي لغة من لغات العالم للترجمة الأكاديمية' : 'Choose any world language for precision translation'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLanguagePicker(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-3 border-b border-border/60 bg-muted/20">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    autoFocus
                    value={languageSearch}
                    onChange={(e) => setLanguageSearch(e.target.value)}
                    placeholder={isRtl ? 'ابحث عن لغة (مثال: الإنجليزية، الفرنسية، Spanish)...' : 'Search language (e.g., Arabic, French, Japanese)...'}
                    className="w-full bg-background border border-border rounded-xl pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {languageSearch && (
                    <button
                      type="button"
                      onClick={() => setLanguageSearch('')}
                      className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Languages List */}
              <div className="p-2 overflow-y-auto flex-1 divide-y divide-border/20 max-h-[380px]">
                {filteredLanguages.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    {isRtl ? 'لم يتم العثور على لغة مطابقة' : 'No matching languages found'}
                  </div>
                ) : (
                  filteredLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        if (activeActionForLanguage) {
                          handleExecuteQuickAction(activeActionForLanguage, lang.name);
                        }
                      }}
                      className="w-full text-left rtl:text-right px-3 py-2.5 rounded-xl hover:bg-primary/10 active:bg-primary/15 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                          {lang.code}
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                            {isRtl ? lang.nameAr : lang.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {lang.native} {isRtl ? `• ${lang.name}` : `• ${lang.nameAr}`}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        {isRtl ? 'ترجمة الآن ←' : 'Translate →'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Custom Styling for Tiptap & RTL ── */}
      <style>{`
        .tiptap-wrapper {
          min-height: 100%;
        }
        .tiptap {
          min-height: 100%;
          outline: none !important;
          color: var(--foreground);
          user-select: text !important;
          -webkit-user-select: text !important;
          touch-action: manipulation;
        }

        /* ── AI Shimmering Processing Effect (from ai-text-effect.md) ── */
        .ai-shimmering-text {
          position: relative;
          display: inline-block;
          user-select: none !important;
          -webkit-user-select: none !important;
          cursor: wait !important;
          pointer-events: none;
          border-radius: 6px;
          padding: 1px 6px;
          margin: 0 1px;
          font-weight: 500;
          color: #10b981 !important;
          background: linear-gradient(
            90deg,
            rgba(16, 185, 129, 0.12) 0%,
            rgba(59, 130, 246, 0.28) 25%,
            rgba(168, 85, 247, 0.35) 50%,
            rgba(16, 185, 129, 0.28) 75%,
            rgba(16, 185, 129, 0.12) 100%
          );
          background-size: 200% 100%;
          animation: ai-text-shimmer 1.8s infinite linear, ai-text-wave 2.2s ease-in-out infinite;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
          border-bottom: 2px dashed rgba(16, 185, 129, 0.7);
        }

        @keyframes ai-text-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        @keyframes ai-text-wave {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-1.5px) scale(1.02);
          }
        }

        /* ── Rich Native Tables ── */
        .tiptap table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1.25rem 0;
          overflow: hidden;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
        }
        .tiptap table td,
        .tiptap table th {
          min-width: 1em;
          border: 1px solid var(--border);
          padding: 0.5rem 0.75rem;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .tiptap table th {
          font-weight: 700;
          text-align: inherit;
          background-color: var(--muted);
          color: var(--foreground);
        }
        .tiptap p,
        .tiptap h1,
        .tiptap h2,
        .tiptap h3,
        .tiptap blockquote {
          unicode-bidi: plaintext;
        }
        .tiptap p.is-editor-empty:first-child::before {
          color: var(--muted-foreground);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          opacity: 0.5;
        }
        [dir="rtl"] .tiptap p.is-editor-empty:first-child::before,
        .tiptap-rtl p.is-editor-empty:first-child::before {
          float: right;
          text-align: right;
        }
        .tiptap blockquote {
          border-left: 3px solid var(--primary);
          padding-left: 1rem;
          margin: 1rem 0;
          font-style: italic;
          opacity: 0.85;
        }
        [dir="rtl"] .tiptap blockquote,
        .tiptap-rtl blockquote {
          border-left: none;
          border-right: 3px solid var(--primary);
          padding-left: 0;
          padding-right: 1rem;
        }
        .tiptap code {
          background-color: var(--muted);
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
          color: var(--foreground);
        }
        .tiptap pre {
          background: var(--muted);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          margin: 1rem 0;
          overflow-x: auto;
        }

        /* ── Unified List & Bullet Alignment ── */
        .tiptap ul {
          list-style-type: disc !important;
          margin: 0.5rem 0;
        }
        .tiptap ol {
          list-style-type: decimal !important;
          margin: 0.5rem 0;
        }
        .tiptap li {
          margin: 0.25rem 0;
        }
        .tiptap li p {
          margin: 0 !important;
          display: inline;
        }

        /* LTR Lists: Bullets strictly on the left */
        .tiptap[dir="ltr"] ul,
        .tiptap[dir="ltr"] ol,
        .tiptap-ltr ul,
        .tiptap-ltr ol,
        .note-ltr .tiptap ul,
        .note-ltr .tiptap ol {
          direction: ltr !important;
          text-align: left !important;
          padding-left: 1.75rem !important;
          padding-right: 0 !important;
        }
        .tiptap[dir="ltr"] li,
        .tiptap-ltr li,
        .note-ltr .tiptap li {
          direction: ltr !important;
          text-align: left !important;
        }

        /* RTL Lists: Bullets strictly on the right with their Arabic text */
        .tiptap[dir="rtl"] ul,
        .tiptap[dir="rtl"] ol,
        .tiptap-rtl ul,
        .tiptap-rtl ol,
        .note-rtl .tiptap ul,
        .note-rtl .tiptap ol,
        [dir="rtl"] .tiptap ul,
        [dir="rtl"] .tiptap ol {
          direction: rtl !important;
          text-align: right !important;
          padding-right: 1.75rem !important;
          padding-left: 0 !important;
          margin-right: 0 !important;
        }
        .tiptap[dir="rtl"] li,
        .tiptap-rtl li,
        .note-rtl .tiptap li,
        [dir="rtl"] .tiptap li {
          direction: rtl !important;
          text-align: right !important;
        }
        .tiptap[dir="rtl"] li p,
        .tiptap-rtl li p,
        .note-rtl .tiptap li p,
        [dir="rtl"] .tiptap li p {
          direction: rtl !important;
          text-align: right !important;
        }

        /* Override Tailwind Typography prose ::before bullets if injected */
        .prose.tiptap-rtl :where(ul > li)::before,
        .prose .note-rtl :where(ul > li)::before,
        .note-rtl .prose :where(ul > li)::before,
        [dir="rtl"] .prose :where(ul > li)::before {
          right: 0.25em !important;
          left: auto !important;
        }

        .tiptap hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 1.5rem 0;
        }
        .read-only-view .tiptap {
          cursor: default;
        }

        /* ── Islamic & Semantic Color Styling matching PDF Export ── */
        .tiptap .ayah {
          color: #b45309;
          font-weight: bold;
          font-style: italic;
        }
        .paper-dark .tiptap .ayah,
        .dark .tiptap .ayah {
          color: #fbbf24 !important;
        }
        .tiptap .hadith {
          color: #006239;
          font-weight: bold;
        }
        .paper-dark .tiptap .hadith,
        .dark .tiptap .hadith {
          color: #34d399 !important;
        }
        .tiptap .citation {
          color: #64748b;
          font-style: italic;
          font-size: 0.88em;
        }
        .paper-dark .tiptap .citation,
        .dark .tiptap .citation {
          color: #94a3b8 !important;
        }
        .tiptap .highlight-gold {
          color: #b45309;
          font-weight: 600;
          font-style: italic;
        }
        .paper-dark .tiptap .highlight-gold,
        .dark .tiptap .highlight-gold {
          color: #fbbf24 !important;
        }

        /* PDF-aligned headings */
        .tiptap h1, .tiptap h2, .tiptap h3 {
          color: #006239;
          font-weight: 700;
        }
        .paper-dark .tiptap h1,
        .paper-dark .tiptap h2,
        .paper-dark .tiptap h3,
        .dark .tiptap h1,
        .dark .tiptap h2,
        .dark .tiptap h3 {
          color: #10b981 !important;
        }

        /* Strict Contrast Guard: Ensure text is never invisible in either theme */
        .paper-dark .tiptap [style*="color: black"],
        .paper-dark .tiptap [style*="color: #000"],
        .paper-dark .tiptap [style*="color: rgb(0, 0, 0)"],
        .dark .tiptap [style*="color: black"],
        .dark .tiptap [style*="color: #000"],
        .dark .tiptap [style*="color: rgb(0, 0, 0)"] {
          color: #f8fafc !important;
        }
        .paper-light .tiptap [style*="color: white"],
        .paper-light .tiptap [style*="color: #fff"],
        .paper-light .tiptap [style*="color: rgb(255, 255, 255)"] {
          color: #0f172a !important;
        }
      `}</style>
    </div>
  );
}
