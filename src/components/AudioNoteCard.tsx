import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Trash2, Zap, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isTauri } from '../services/platform';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { convertFileSrc } from '@tauri-apps/api/core';

interface AudioNoteCardProps {
  audioBlob?: Blob;
  audioPath?: string;
  duration?: number;
  onDeleteAudio: () => void;
  onGenerateNotes: () => void;
  isGenerating?: boolean;
  isRtl?: boolean;
}

export function AudioNoteCard({
  audioBlob,
  audioPath,
  duration: initialDuration = 0,
  onDeleteAudio,
  onGenerateNotes,
  isGenerating = false,
  isRtl = false,
}: AudioNoteCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);

  // Load audio source from blob or native filesystem
  useEffect(() => {
    let url: string | null = null;
    let isCancelled = false;

    async function loadAudioSource() {
      // 1. Direct Blob from IndexedDB (instant, zero memory overhead)
      if (audioBlob) {
        url = URL.createObjectURL(audioBlob);
        if (!isCancelled) setAudioUrl(url);
        return;
      }

      // 2. Fallback to physical file path
      if (audioPath) {
        if (Capacitor.isNativePlatform()) {
          try {
            let fileResult;
            try {
              fileResult = await Filesystem.readFile({
                path: audioPath,
                directory: Directory.Documents,
              });
            } catch {
              fileResult = await Filesystem.readFile({
                path: audioPath,
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
              const byteArray = new Uint8Array(byteNums);
              const mime = audioPath.endsWith('.mp4') ? 'audio/mp4' : 'audio/webm';
              const b = new Blob([byteArray], { type: mime });
              if (!isCancelled) {
                url = URL.createObjectURL(b);
                setAudioUrl(url);
              }
            }
          } catch (err) {
            console.warn('Capacitor native audio load error:', err);
          }
        } else if (isTauri()) {
          try {
            const { readFile } = await import('@tauri-apps/plugin-fs');
            const bytes = await readFile(audioPath);
            const mime = audioPath.endsWith('.mp4') ? 'audio/mp4' : 'audio/webm';
            const b = new Blob([bytes], { type: mime });
            if (!isCancelled) {
              url = URL.createObjectURL(b);
              setAudioUrl(url);
            }
          } catch {
            if (!isCancelled) setAudioUrl(convertFileSrc(audioPath));
          }
        }
      }
    }

    loadAudioSource();

    return () => {
      isCancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [audioBlob, audioPath]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('Audio playback error:', err));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  // Click on waveform to seek
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!waveformContainerRef.current || !audioRef.current) return;
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = clickX / rect.width;
    const newTime = ratio * (duration || 1);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Fixed signature pattern of 38 waveform bars
  const waveformHeights = useMemo(() => [
    10, 16, 22, 14, 28, 20, 32, 18, 26, 30, 24, 18, 32, 22, 16, 28, 
    20, 14, 26, 32, 28, 20, 26, 18, 14, 22, 28, 30, 24, 16, 28, 20,
    14, 22, 18, 26, 16, 10
  ], []);

  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const activeBarIndex = Math.floor(progressRatio * waveformHeights.length);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      await onDeleteAudio();
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Delete audio error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div 
        className="w-full mb-6 bg-card/90 dark:bg-card/90 border border-border rounded-2xl p-3.5 md:p-4 shadow-sm backdrop-blur-sm select-none"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
            preload="metadata"
          />
        )}

        <div className="flex items-center gap-2.5 md:gap-4">
          {/* 1. Pause / Resume Button (Monochrome Icon) */}
          <button
            type="button"
            onClick={togglePlay}
            className="p-2.5 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer shrink-0"
            title={isPlaying ? (isRtl ? 'إيقاف مؤقت' : 'Pause') : (isRtl ? 'تشغيل' : 'Play')}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" strokeWidth={1.5} />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" strokeWidth={1.5} />
            )}
          </button>

          {/* 2. Black Waveform + Time (Center) */}
          <div className="flex-1 flex flex-col justify-center min-w-0">
            {/* Clickable Black Waveform */}
            <div
              ref={waveformContainerRef}
              onClick={handleWaveformClick}
              className="h-9 flex items-center justify-between gap-[2px] cursor-pointer py-1 px-1 rounded-lg hover:bg-muted/40 transition-colors"
              title={isRtl ? 'انقر للتقديم أو التأخير' : 'Click to seek audio'}
            >
              {waveformHeights.map((h, idx) => {
                const isPassed = idx <= activeBarIndex;
                return (
                  <span
                    key={idx}
                    className={`w-[2.5px] md:w-[3px] rounded-full transition-colors ${
                      isPassed
                        ? 'bg-neutral-900 dark:bg-neutral-100 opacity-95'
                        : 'bg-neutral-300 dark:bg-neutral-700 opacity-60'
                    }`}
                    style={{ height: `${h}px` }}
                  />
                );
              })}
            </div>

            {/* Time display */}
            <div className="flex items-center justify-between px-1 text-[11px] font-mono text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* 3. Actions: AI Action & Delete */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* AI Action Button (Solid App Green with Bolt Icon) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isGenerating) onGenerateNotes();
              }}
              disabled={isGenerating}
              className={`w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 hover:opacity-90 ${
                isGenerating ? 'animate-pulse' : ''
              }`}
              title={isRtl ? 'توليد وتوثيق الملاحظة بالذكاء الاصطناعي' : 'Generate & Verify Notes with AI'}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 md:w-4.5 md:h-4.5 animate-spin text-white" strokeWidth={2} />
              ) : (
                <Zap className="w-4 h-4 md:w-4.5 md:h-4.5 fill-current text-white" strokeWidth={0} />
              )}
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              disabled={isGenerating}
              className="p-2.5 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer"
              title={isRtl ? 'حذف التسجيل الصوتي من الملاحظة' : 'Delete Attached Audio'}
            >
              <Trash2 className="w-5 h-5 text-muted-foreground hover:text-destructive transition-colors" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog: Delete Attached Audio */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4 select-none"
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
                  {isRtl ? 'حذف التسجيل الصوتي من الملاحظة؟' : 'Delete Attached Audio?'}
                </h3>
              </div>

              <p className="text-xs md:text-sm text-muted-foreground mb-6 leading-relaxed">
                {isRtl
                  ? 'سيتم حذف التسجيل الصوتي المرفق من هذه الملاحظة، وستبقى جميع النصوص والتدوينات المكتوبة داخل الملاحظة محفوظة دون أي مساس.'
                  : 'This will remove the attached audio recording from this note. All written text and formatting in the editor will remain completely preserved.'}
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-muted text-muted-foreground rounded-xl hover:bg-border transition-colors font-medium text-sm cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl hover:opacity-90 transition-colors font-medium text-sm shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  {isDeleting ? (isRtl ? 'جارٍ الحذف...' : 'Deleting...') : (isRtl ? 'تأكيد الحذف' : 'Delete Audio')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
