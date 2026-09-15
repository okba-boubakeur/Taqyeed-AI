import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Zap,
  PenLine,
  Mic,
  Trash2,
  Bookmark,
  Sparkles,
  X,
  AlertTriangle,
  FileAudio,
  FileUp,
  Loader2,
  FolderPlus,
  Folder,
  FileText,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { translations } from '../translations';
import { useRecorder } from '../hooks/useRecorder';
import { deleteRecording } from '../services/recordings';
import { db } from '../db';
import { useToast } from './Toast';
import { importAudioFile, importDocumentFile } from '../services/fileImport';
import { BorderBeam } from './ui/border-beam';

interface CreationFloatingButtonProps {
  onStartSummarization: (id: number) => void;
  onOpenNewNote?: () => void;
}

export function CreationFloatingButton({ onStartSummarization, onOpenNewNote }: CreationFloatingButtonProps) {
  const {
    settings,
    isRecording,
    setActiveScreen,
    activeNoteId,
    setActiveNoteId,
    setIsNewNote,
    isNoteOpen,
    activeScreen,
    setActiveFolderId
  } = useAppStore();

  const { startRecording } = useRecorder();
  const { showToast } = useToast();

  // Mode selection popover (Simple Note vs Folder)
  const [showModeMenu, setShowModeMenu] = useState(false);

  // Folder Creation Prompt Dialog
  const [showFolderPrompt, setShowFolderPrompt] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState('#10b981');
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);
  const [targetFolderName, setTargetFolderName] = useState<string>('');

  // 4-choice creation modal (Write, Record, Import Audio, Import Document)
  const [showChoiceModal, setShowChoiceModal] = useState(false);

  // File import state and refs
  const audioInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatusText, setImportStatusText] = useState('');

  const t = translations[settings.language] || translations.ar;
  const isRtl = settings.language === 'ar';

  const folderColorPresets = [
    { hex: '#10b981', label: 'Emerald' },
    { hex: '#0ea5e9', label: 'Sky' },
    { hex: '#f59e0b', label: 'Amber' },
    { hex: '#8b5cf6', label: 'Purple' },
    { hex: '#f43f5e', label: 'Rose' },
    { hex: '#64748b', label: 'Slate' },
  ];

  // Listen for custom event triggered from inside a Folder modal to add note to that specific folder
  useEffect(() => {
    const handleOpenForFolder = (e: any) => {
      const fId = e.detail?.folderId;
      const fName = e.detail?.folderName || '';
      if (fId) {
        setTargetFolderId(fId);
        setTargetFolderName(fName);
        setActiveFolderId(fId);
        setShowModeMenu(false);
        setShowChoiceModal(true);
      }
    };

    window.addEventListener('open-creation-for-folder', handleOpenForFolder);
    return () => {
      window.removeEventListener('open-creation-for-folder', handleOpenForFolder);
    };
  }, [setActiveFolderId]);

  // Option 1: Simple Note selected
  const handleSelectSimpleNote = () => {
    setTargetFolderId(null);
    setTargetFolderName('');
    setActiveFolderId(null);
    setShowModeMenu(false);
    setShowChoiceModal(true);
  };

  // Option 2: Folder selected
  const handleSelectFolder = () => {
    setShowModeMenu(false);
    setFolderName('');
    setFolderColor('#10b981');
    setShowFolderPrompt(true);
  };

  // Submit new folder prompt
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = folderName.trim();
    if (!trimmed) {
      showToast(isRtl ? 'يرجى كتابة اسم المجلد' : 'Please enter a folder name', 'warning');
      return;
    }

    try {
      const fId = await db.folders.add({
        name: trimmed,
        color: folderColor,
        icon: 'folder',
        date: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      }) as number;

      setTargetFolderId(fId);
      setTargetFolderName(trimmed);
      setActiveFolderId(fId);
      setShowFolderPrompt(false);
      setShowChoiceModal(true);
      showToast(
        isRtl ? `تم إنشاء مجلد "${trimmed}" بنجاح` : `Folder "${trimmed}" created successfully`,
        'success'
      );
    } catch (err) {
      console.error('Failed to create folder:', err);
      showToast(isRtl ? 'فشل إنشاء المجلد' : 'Failed to create folder', 'error');
    }
  };

  // Action inside 4-choice modal: Write
  const handleOpenWrite = async () => {
    setShowChoiceModal(false);
    try {
      const id = await db.notes.add({
        title: isRtl ? 'ملاحظة جديدة' : 'Untitled Note',
        description: '',
        content: '',
        folderId: targetFolderId || undefined,
        date: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }) as number;

      setIsNewNote(true);
      setActiveNoteId(id);
      setActiveScreen('texteditor');
      if (onOpenNewNote) onOpenNewNote();
    } catch (e) {
      console.warn('Failed to pre-create note:', e);
      setActiveScreen('texteditor');
    }
  };

  // Action inside 4-choice modal: Record
  const handleStartRecord = async () => {
    setShowChoiceModal(false);
    try {
      setActiveFolderId(targetFolderId);
      await startRecording('mic');
    } catch (err) {
      console.error('Failed to start recording:', err);
      showToast('Microphone permission required to record.', 'error');
    }
  };

  // Handle local audio file import
  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowChoiceModal(false);
    e.target.value = '';

    setIsImporting(true);
    setImportStatusText(isRtl ? 'جارٍ استيراد الملف الصوتي...' : 'Importing audio file...');

    try {
      const result = await importAudioFile(file, targetFolderId || undefined);
      showToast(
        isRtl
          ? `تم استيراد الملف الصوتي "${result.title}" بنجاح`
          : `Audio "${result.title}" imported successfully`,
        'success'
      );
    } catch (err: any) {
      console.error('Audio import failed:', err);
      showToast(isRtl ? 'فشل استيراد الملف الصوتي' : 'Failed to import audio file', 'error');
    } finally {
      setIsImporting(false);
      setImportStatusText('');
    }
  };

  // Handle document (PDF, DOCX, TXT, MD, etc.) import
  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowChoiceModal(false);
    e.target.value = '';

    setIsImporting(true);
    setImportStatusText(isRtl ? 'جارٍ استخراج المحتوى وحفظ الملاحظة...' : 'Extracting content & saving note...');

    try {
      const result = await importDocumentFile(file, targetFolderId || undefined);
      setIsNewNote(false);
      setActiveNoteId(result.id);
      setActiveScreen('texteditor');
      if (onOpenNewNote) onOpenNewNote();
      showToast(
        isRtl
          ? `تم استيراد "${result.title}" وحفظها في ملاحظة جديدة`
          : `Extracted "${result.title}" into a new note`,
        'success'
      );
    } catch (err: any) {
      console.error('Document import failed:', err);
      showToast(isRtl ? 'تعذر استخراج محتوى الملف' : 'Failed to extract document content', 'error');
    } finally {
      setIsImporting(false);
      setImportStatusText('');
    }
  };

  // Hide floating button when recording is active or when user opened a note / editor
  const isHidden = isRecording || isNoteOpen || !!activeNoteId || activeScreen !== 'home';

  return (
    <>
      {/* Hidden File Inputs for Audio & Document Importing */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac,.opus"
        className="hidden"
        onChange={handleAudioFileChange}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md,.markdown,.json,.csv,.rtf,.html,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleDocFileChange}
      />

      {/* ─────────────────────────────────────────────────────────────
          1. Floating (+) Black Button with Green Moving Border
          ───────────────────────────────────────────────────────────── */}
      {!isHidden && (
        <div className="fixed bottom-6 right-6 z-40 select-none">
          <button
            onClick={() => setShowModeMenu(prev => !prev)}
            className="relative overflow-hidden w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 border border-emerald-400/50 shadow-xl shadow-emerald-600/35 flex items-center justify-center group cursor-pointer transition-transform active:scale-95"
            title={isRtl ? 'إنشاء جديد' : 'New Creation'}
          >
            <BorderBeam
              size={140}
              duration={6}
              colorFrom="#a7f3d0"
              colorTo="#34d399"
              borderWidth={2}
            />
            <Plus className={`w-7 h-7 md:w-8 md:h-8 text-white relative z-10 transition-transform duration-300 ${showModeMenu ? 'rotate-45' : 'group-hover:rotate-90'}`} />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. Dropdown Menu: 2 Options ("Simple Note" vs "Folder")
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModeMenu && !isHidden && (
          <>
            {/* Backdrop click to close */}
            <div
              className="fixed inset-0 z-[185]"
              onClick={() => setShowModeMenu(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ duration: 0.15 }}
              className={`fixed bottom-24 ${isRtl ? 'right-6' : 'right-6'} z-[190] bg-card border border-border shadow-2xl rounded-2xl p-2 w-64 md:w-72 select-none overflow-hidden`}
              dir={isRtl ? 'rtl' : 'ltr'}
            >

              <button
                type="button"
                onClick={handleSelectSimpleNote}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/80 transition-all text-left rtl:text-right group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-foreground transition-colors">
                    {isRtl ? 'ملاحظة بسيطة' : 'Simple Note'}
                  </h4>
                </div>
              </button>

              <button
                type="button"
                onClick={handleSelectFolder}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/80 transition-all text-left rtl:text-right group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                  <FolderPlus className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-foreground transition-colors">
                    {isRtl ? 'مجلد / وحدة دراسية' : 'Folder / Module'}
                  </h4>
                </div>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          3. Folder Creation Name & Color Dialog Modal
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFolderPrompt && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 select-none"
            onClick={() => setShowFolderPrompt(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card border border-border rounded-3xl p-6 shadow-2xl max-w-sm w-full relative overflow-hidden"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-transparent text-amber-500 flex items-center justify-center border border-amber-500/30">
                    <Folder className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {isRtl ? 'إنشاء مجلد أو وحدة' : 'New Folder / Module'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {isRtl ? 'لتنظيم سلسلة الدروس والمحاضرات' : 'To organize a series of lessons'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFolderPrompt(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    {isRtl ? 'اسم المجلد أو المادة الدراسية' : 'Folder or Course Name'} *
                  </label>
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    autoFocus
                    placeholder={isRtl ? 'مثال: أصول الفقه، خوارزميات...' : 'e.g. Physics 101, Algorithms...'}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Color presets */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    {isRtl ? 'لون التمييز' : 'Accent Color'}
                  </label>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {folderColorPresets.map((preset) => {
                      const isSelected = folderColor === preset.hex;
                      return (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setFolderColor(preset.hex)}
                          className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center cursor-pointer ${isSelected ? 'scale-110 ring-2 ring-foreground/40' : 'hover:scale-105 opacity-85'
                            }`}
                          style={{ backgroundColor: preset.hex }}
                          title={preset.label}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={2} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFolderPrompt(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted font-semibold text-xs transition-colors cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    {isRtl ? 'إنشاء ومتابعة' : 'Create & Continue'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          4. Overlay Choice Modal: 4 Options (Write, Record, Import Audio, Import Doc)
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showChoiceModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 select-none"
            onClick={() => setShowChoiceModal(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card border border-border rounded-3xl p-6 md:p-7 shadow-2xl max-w-sm sm:max-w-md w-full relative overflow-hidden"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg md:text-xl font-bold text-foreground">
                      {isRtl ? 'إنشاء أو استيراد' : 'Create or Import'}
                    </h3>
                    {targetFolderName && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {targetFolderName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {targetFolderName
                      ? (isRtl ? `إضافة محتوى إلى مجلد "${targetFolderName}"` : `Add item into "${targetFolderName}"`)
                      : (isRtl ? 'اختر طريقة تدوين أو استيراد المعرفة' : 'Choose how you want to capture knowledge')}
                  </p>
                </div>
                <button
                  onClick={() => setShowChoiceModal(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-3.5">
                <button
                  onClick={handleOpenWrite}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border border-border/80 hover:border-foreground/30 bg-muted/20 hover:bg-muted/60 transition-all group cursor-pointer active:scale-95 text-center"
                >
                  <div className="w-12 h-12 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform text-foreground">
                    <PenLine className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <span className="font-bold text-sm md:text-base text-foreground">
                    {isRtl ? 'كتابة' : 'Write'}
                  </span>
                </button>

                <button
                  onClick={handleStartRecord}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border border-border/80 hover:border-foreground/30 bg-muted/20 hover:bg-muted/60 transition-all group cursor-pointer active:scale-95 text-center"
                >
                  <div className="w-12 h-12 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform text-foreground">
                    <Mic className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <span className="font-bold text-sm md:text-base text-foreground">
                    {isRtl ? 'تسجيل صوتي' : 'Record'}
                  </span>
                </button>

                <button
                  onClick={() => audioInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border border-border/80 hover:border-foreground/30 bg-muted/20 hover:bg-muted/60 transition-all group cursor-pointer active:scale-95 text-center"
                >
                  <div className="w-12 h-12 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform text-foreground">
                    <FileUp className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <span className="font-bold text-sm md:text-base text-foreground">
                    {isRtl ? 'ارفق Audio' : 'Import Audio'}
                  </span>
                </button>

                <button
                  onClick={() => docInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border border-border/80 hover:border-foreground/30 bg-muted/20 hover:bg-muted/60 transition-all group cursor-pointer active:scale-95 text-center"
                >
                  <div className="w-12 h-12 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform text-foreground">
                    <FileUp className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <span className="font-bold text-sm md:text-base text-foreground">
                    {isRtl ? 'ارفق ملف' : 'Import'}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
