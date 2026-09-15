import React, { useState } from 'react';
import { Play, Pause, Trash2, Check, AlertTriangle, Square, PenLine, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { useRecorder } from '../hooks/useRecorder';
import { useToast } from './Toast';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

interface RecordingBottomBarProps {
  onSavedNote?: (noteId: number) => void;
}

export function RecordingBottomBar({ onSavedNote }: RecordingBottomBarProps) {
  const { isRecording, isPaused, recordingTime, settings, activeFolderId, setActiveRecordingNoteId } = useAppStore();
  const { pauseRecording, resumeRecording, saveRecording, discardRecording } = useRecorder();
  const { showToast } = useToast();

  const isRtl = settings.language === 'ar';
  const targetFolder = useLiveQuery(
    () => (activeFolderId ? db.folders.get(activeFolderId) : undefined),
    [activeFolderId]
  );

  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isRecording) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleTogglePause = () => {
    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  };

  // ── "Stop & Save" — stops recording, saves note, navigates to TextEditor ──
  const handleStopAndSave = async () => {
    setIsProcessing(true);
    try {
      const noteId = await saveRecording(activeFolderId);
      setShowSaveOptions(false);
      if (noteId) {
        showToast(
          isRtl
            ? targetFolder
              ? `تم حفظ التسجيل داخل مجلد "${targetFolder.name}" بنجاح`
              : 'تم حفظ الملاحظة الصوتية بنجاح'
            : targetFolder
              ? `Saved audio note to folder "${targetFolder.name}"`
              : 'Saved audio note successfully',
          'success'
        );
        if (onSavedNote) onSavedNote(noteId);
      }
    } catch (err) {
      console.error('Save recording failed:', err);
      showToast(isRtl ? 'فشل حفظ التسجيل الصوتي' : 'Failed to save recording', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── "Continue & Write" — create note, keep recording, navigate to TextEditor ──
  const handleContinueAndWrite = async () => {
    setIsProcessing(true);
    try {
      const now = new Date();
      const defaultTitle = isRtl ? 'بدون عنوان' : 'Untitled';
      const noteId = await db.notes.add({
        title: defaultTitle,
        description: '',
        content: '',
        folderId: activeFolderId || undefined,
        date: now.toISOString(),
        lastModified: now.toISOString(),
      }) as number;

      // Link this note to the ongoing recording session
      setActiveRecordingNoteId(noteId);
      setShowSaveOptions(false);

      showToast(
        isRtl ? 'يمكنك الكتابة الآن أثناء التسجيل' : 'You can now write while recording',
        'info'
      );

      if (onSavedNote) onSavedNote(noteId);
    } catch (err) {
      console.error('Continue & Write failed:', err);
      showToast(isRtl ? 'فشل إنشاء الملاحظة' : 'Failed to create note', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDiscard = async () => {
    setIsProcessing(true);
    try {
      await discardRecording();
      setShowDeleteConfirm(false);
      showToast(isRtl ? 'تم إلغاء وحذف التسجيل' : 'Recording discarded', 'info');
    } catch (err) {
      console.error('Discard recording failed:', err);
      showToast(isRtl ? 'فشل إلغاء التسجيل' : 'Failed to discard recording', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Height variance pattern for 18 red waveform bars
  const waveHeights = [12, 22, 16, 28, 20, 32, 18, 26, 36, 24, 30, 16, 28, 22, 14, 26, 18, 12];

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          Floating Recording Bar with Curved Edges
          ───────────────────────────────────────────────────────────── */}
      <div 
        className="fixed bottom-5 md:bottom-7 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-lg z-50 h-16 md:h-20 bg-card/95 backdrop-blur-2xl border border-border/80 dark:border-border shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] rounded-3xl md:rounded-[2rem] flex items-center justify-between px-3.5 sm:px-5 md:px-6 select-none"
        dir="ltr" // Kept LTR internally for strict Left-Center-Right physical positioning requested by user
      >
        {/* Left Side: Pause / Resume Button (Monochrome Icon) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleTogglePause}
            className="p-2 sm:p-2.5 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer"
            title={isPaused ? (isRtl ? 'استئناف' : 'Resume') : (isRtl ? 'إيقاف مؤقت' : 'Pause')}
          >
            {isPaused ? (
              <Play className="w-5 h-5 ml-0.5" strokeWidth={1.5} />
            ) : (
              <Pause className="w-5 h-5" strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Center: Animated Red Waveform UI + Timer */}
        <div className="flex items-center gap-2 sm:gap-4 md:gap-5 justify-center flex-1 min-w-0 mx-1 sm:mx-2 overflow-hidden">
          {/* Animated Red Waveform */}
          <div className="flex items-center gap-[2.5px] sm:gap-[3px] h-9 px-1 overflow-hidden shrink min-w-0">
            {waveHeights.map((maxH, idx) => {
              const delay = (idx * 0.08) % 1.2;
              // On very small screens hide extreme outer bars to preserve space for controls & timer
              const hideOnTinyScreen = idx < 2 || idx > 15;
              return (
                <span
                  key={idx}
                  className={`w-[2.5px] sm:w-[3px] shrink-0 rounded-full bg-red-500 transition-all ${
                    hideOnTinyScreen ? 'hidden sm:inline-block' : 'inline-block'
                  } ${isPaused ? 'opacity-40' : 'opacity-90'}`}
                  style={{
                    height: isPaused ? `${Math.max(4, Math.round(maxH * 0.3))}px` : `${maxH}px`,
                    animation: isPaused
                      ? 'none'
                      : `redWavePulse 1.1s ease-in-out infinite ${delay}s alternate`,
                  }}
                />
              );
            })}
          </div>

          {/* Recording Timer */}
          <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm md:text-base font-bold text-foreground tracking-wider shrink-0">
            <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} />
            <span>{formatTime(recordingTime)}</span>
          </div>
        </div>

        {/* Right Side: Delete and Save Buttons (Monochrome Icons) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Delete Button */}
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 sm:p-2.5 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer"
            title={isRtl ? 'حذف التسجيل' : 'Discard Recording'}
          >
            <Trash2 className="w-5 h-5" strokeWidth={1.5} />
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={() => setShowSaveOptions(true)}
            className="p-2 sm:p-2.5 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer"
            title={isRtl ? 'حفظ التسجيل' : 'Save Audio Note'}
          >
            <Check className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Save Options Modal: "Save" vs "Continue & Write"
          Styled identically to CreationFloatingButton choice modal
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSaveOptions && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 select-none"
            dir={isRtl ? 'rtl' : 'ltr'}
            onClick={() => !isProcessing && setShowSaveOptions(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.15 }}
              className="bg-card border border-border rounded-3xl p-6 md:p-7 shadow-2xl max-w-sm sm:max-w-md w-full relative overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-foreground">
                    {isRtl ? 'حفظ أو متابعة التدوين' : 'Save or Continue'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isRtl
                      ? 'اختر حفظ التسجيل الصوتي أو متابعة التدوين والكتابة أثناء التسجيل'
                      : 'Choose to save audio note or write while recording'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowSaveOptions(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              {/* 2 Options Grid identical to Home Screen Creation modal */}
              <div className="grid grid-cols-2 gap-3 md:gap-3.5">
                {/* Option 1: Save */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleStopAndSave}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl hover:bg-muted transition-all group cursor-pointer active:scale-95 text-center"
                >
                  <div className="w-12 h-12 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform text-foreground">
                    <Check className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <span className="font-bold text-sm md:text-base text-foreground">
                    {isRtl ? 'حفظ' : 'Save'}
                  </span>
                </button>

                {/* Option 2: Continue & Write */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleContinueAndWrite}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl hover:bg-muted transition-all group cursor-pointer active:scale-95 text-center"
                >
                  <div className="w-12 h-12 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform text-foreground">
                    <PenLine className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <span className="font-bold text-sm md:text-base text-foreground">
                    {isRtl ? 'متابعة وكتابة' : 'Continue Write'}
                  </span>
                </button>
              </div>

              {isProcessing && (
                <div className="absolute inset-0 bg-card/80 rounded-3xl flex items-center justify-center z-10">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          Confirmation Dialog: Discard Audio Recording
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 select-none"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.15 }}
              className="bg-card border border-border rounded-3xl w-full max-w-sm shadow-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-3 text-destructive">
                <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  {isRtl ? 'إلغاء وحذف التسجيل؟' : 'Discard Recording?'}
                </h3>
              </div>

              <p className="text-xs md:text-sm text-muted-foreground mb-6 leading-relaxed">
                {isRtl
                  ? 'سيتم حذف المقطع الصوتي المسجل بالكامل والعودة للحالة الأولية بدون حفظ. هل أنت متأكد؟'
                  : 'This will completely discard the recorded audio and reset the recorder to its initial state without saving. Are you sure?'}
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2.5 bg-muted text-muted-foreground rounded-xl hover:bg-border transition-colors font-medium text-sm cursor-pointer"
                >
                  {isRtl ? 'تراجع' : 'Keep Recording'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl hover:opacity-90 transition-colors font-medium text-sm shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  {isProcessing ? (isRtl ? 'جارٍ الإلغاء...' : 'Discarding...') : (isRtl ? 'حذف وإلغاء' : 'Discard')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
