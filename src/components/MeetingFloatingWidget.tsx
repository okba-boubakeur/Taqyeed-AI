import React, { useState } from 'react';
import { Square, Pause, Play, Maximize2, X, Loader2, GripVertical, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { useRecorder } from '../hooks/useRecorder';
import { 
  restoreFullScreenWindow, 
  expandFloatingMeetingWindow, 
  collapseFloatingMeetingWindow, 
  startNativeWindowDrag 
} from '../services/windowMode';
import { minimizeMobileApp } from '../services/backgroundAudio';
import { isTauri } from '../services/platform';
import { useToast } from './Toast';

interface MeetingFloatingWidgetProps {
  onStartSummarization: (id: number) => void;
  isDedicatedWindow?: boolean;
}

export function MeetingFloatingWidget({ onStartSummarization, isDedicatedWindow = false }: MeetingFloatingWidgetProps) {
  const { isPaused, recordingTime, setIsMeetingMode, isRecording, setPostRecordingModal, settings } = useAppStore();
  const { pauseRecording, resumeRecording, stopRecording } = useRecorder();
  const { showToast } = useToast();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isRecording) return null;

  const isDesktop = isTauri();
  const isRtl = settings.language === 'ar';

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
    if (isDesktop && isDedicatedWindow) {
      await expandFloatingMeetingWindow();
    }
  };

  const handleCollapse = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsExpanded(false);
    if (isDesktop && isDedicatedWindow) {
      await collapseFloatingMeetingWindow();
    }
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);
    try {
      const id = await stopRecording();
      setIsMeetingMode(false);
      await restoreFullScreenWindow();
      if (id) {
        showToast(isRtl ? 'تم حفظ التسجيل الصوتي بنجاح' : 'Audio recording saved successfully', 'success');
        setPostRecordingModal({ isOpen: true, recordingId: id });
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      showToast(isRtl ? 'فشل حفظ التسجيل الصوتي' : 'Failed to save recording.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFullScreen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMeetingMode(false);
    await restoreFullScreenWindow();
    setIsExpanded(false);
  };

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDesktop) {
      await minimizeMobileApp();
    } else {
      await collapseFloatingMeetingWindow();
    }
  };

  const handleNativeDrag = async () => {
    if (isDesktop) {
      await startNativeWindowDrag();
    }
  };

  // Pure Chatbot-Style Floating Pill / Bubble Content
  const floatingButtonContent = (
    <AnimatePresence mode="wait">
      {!isExpanded ? (
        /* ─────────────────────────────────────────────────────────────
           1. COLLAPSED FLOATING CHATBOT PILL / BUBBLE
           Clean, minimalist, frameless - like a chat launcher
        ───────────────────────────────────────────────────────────── */
        <motion.div
          key="collapsed-bubble"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleExpand}
          className="flex items-center gap-2.5 px-3 py-2 bg-card/95 dark:bg-card/90 backdrop-blur-2xl border border-border/80 hover:border-primary/60 shadow-2xl rounded-full cursor-pointer transition-all select-none shadow-primary/10 hover:shadow-primary/25"
          title="Click to open recording controls"
        >
          {/* Drag Handle */}
          <div 
            onPointerDown={handleNativeDrag}
            className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing p-0.5 -mr-1 transition-colors"
            title="Drag"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {/* Pulsing Recording Dot */}
          <div className="relative flex items-center justify-center">
            <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-destructive animate-pulse'}`} />
            {!isPaused && (
              <span className="absolute w-4 h-4 rounded-full bg-destructive/30 animate-ping opacity-75" />
            )}
          </div>

          {/* Dynamic Audio Equalizer Bars */}
          <div className="flex items-end gap-0.5 h-3">
            <span className={`w-1 rounded-full transition-all ${isPaused ? 'bg-amber-500 h-1' : 'bg-destructive animate-bounce [animation-delay:-0.3s] h-full'}`} />
            <span className={`w-1 rounded-full transition-all ${isPaused ? 'bg-amber-500 h-2' : 'bg-destructive animate-bounce [animation-delay:-0.15s] h-3/5'}`} />
            <span className={`w-1 rounded-full transition-all ${isPaused ? 'bg-amber-500 h-1.5' : 'bg-destructive animate-bounce h-4/5'}`} />
          </div>

          {/* Digital Timer */}
          <span className="font-mono text-xs font-black tracking-tight text-foreground">
            {formatTime(recordingTime)}
          </span>
        </motion.div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
           2. EXPANDED CHATBOT ACTION BAR (The 3 Core Action Buttons)
           Horizontal, streamlined, no window title bars or headers
        ───────────────────────────────────────────────────────────── */
        <motion.div
          key="expanded-bar"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          className="flex items-center gap-1.5 p-1.5 bg-card/95 dark:bg-card/90 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-full select-none"
        >
          {/* Drag Handle */}
          <div 
            onPointerDown={handleNativeDrag}
            className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing px-1 transition-colors"
            title="Drag"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {/* Button 1: Pause / Resume */}
          <button
            type="button"
            onClick={isPaused ? resumeRecording : pauseRecording}
            disabled={isProcessing}
            className={`p-2 rounded-full transition-all active:scale-90 cursor-pointer ${
              isPaused 
                ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' 
                : 'hover:bg-muted text-foreground'
            }`}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-4 h-4 fill-current text-amber-500" /> : <Pause className="w-4 h-4" />}
          </button>

          {/* Button 2: Stop Recording (Red Solid Circle) */}
          <button
            type="button"
            onClick={handleStop}
            disabled={isProcessing}
            className="p-2 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-90 shadow-md cursor-pointer"
            title="Stop & Save Recording"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Square className="w-4 h-4 fill-current" />
            )}
          </button>

          {/* Button 3: Full Screen (Open Full App) */}
          <button
            type="button"
            onClick={handleFullScreen}
            disabled={isProcessing}
            className="p-2 rounded-full hover:bg-primary/15 text-primary transition-all active:scale-90 cursor-pointer"
            title="Open Full Screen App"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Button 4: Minimize App to background */}
          <button
            type="button"
            onClick={handleMinimize}
            disabled={isProcessing}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-90 cursor-pointer"
            title={isRtl ? 'تصغير واستخدام تطبيقات أخرى' : 'Minimize and use other apps'}
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          {/* Close / Collapse Button */}
          <button
            type="button"
            onClick={handleCollapse}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all active:scale-90 ml-0.5 cursor-pointer"
            title="Collapse"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Dedicated Tauri Window (Desktop): Frameless, transparent, native drag
  if (isDedicatedWindow) {
    return (
      <div className="w-full h-full flex items-center justify-center p-0.5 bg-transparent select-none overflow-hidden">
        {floatingButtonContent}
      </div>
    );
  }

  // Mobile / In-DOM floating layer
  return (
    <aside aria-label="Floating Recorder" className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none">
      <motion.div
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="pointer-events-auto fixed bottom-24 md:bottom-8 right-6"
      >
        {floatingButtonContent}
      </motion.div>
    </aside>
  );
}
