import { useState } from 'react';
import { Mic, Square, Wand2, Zap, Loader2, Pause, Play, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { translations } from '../translations';
import { useRecorder } from '../hooks/useRecorder';
import { isTauri } from '../services/platform';
import { useToast } from './Toast';

interface FloatingRecorderProps {
  onStartSummarization: (id: number) => void;
  variant?: 'floating' | 'nav';
}

export function FloatingRecorder({ onStartSummarization, variant = 'floating' }: FloatingRecorderProps) {
  const { settings, isRecording, isPaused, recordingTime, lastRecordingId, setLastRecordingId, activeScreen, isAiProcessing, isNoteOpen } = useAppStore();
  const t = translations[settings.language] || translations.ar;
  const { startRecording, pauseRecording, resumeRecording } = useRecorder();
  
  const isEditorMode = activeScreen === 'texteditor' && isNoteOpen && !isRecording && !lastRecordingId && !isAiProcessing;
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const { showToast } = useToast();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStartWithSource = async (source: 'mic' | 'system') => {
    setShowSourcePicker(false);
    try {
      await startRecording(source);
    } catch (err) {
      showToast('Failed to start recording. Please check permissions.', 'error');
    }
  };

  const handleMainClick = async () => {
    if (isEditorMode) {
      // Trigger AI enhancement via custom event
      window.dispatchEvent(new CustomEvent('enhance-editor-content'));
      return;
    }
    if (!isRecording && !lastRecordingId) {
      // On Tauri desktop: show mic vs system audio choice
      if (isTauri()) {
        setShowSourcePicker(true);
      } else {
        // Mobile: just start mic
        try {
          await startRecording('mic');
        } catch (err) {
          showToast('Failed to start recording. Please check permissions.', 'error');
        }
      }
    } else if (isRecording) {
      // In bottom nav, tapping the recording button toggles pause/resume without opening modals
      if (isPaused) {
        resumeRecording();
      } else {
        pauseRecording();
      }
    } else if (lastRecordingId) {
      onStartSummarization(lastRecordingId);
      setLastRecordingId(null);
    }
  };

  // Nav variant (for mobile BottomNav)
  if (variant === 'nav') {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-w-[64px] relative">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleMainClick}
            disabled={isProcessing}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all relative z-10 cursor-pointer ${
              isRecording 
                ? isPaused ? 'bg-amber-500 text-white' : 'bg-destructive text-white'
                : lastRecordingId 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white animate-pulse shadow-emerald-500/40 border-2 border-white/30' 
                  : 'bg-primary text-primary-foreground'
            }`}
            title={isRecording ? (isPaused ? 'Resume' : 'Pause') : lastRecordingId ? 'Start Generating Notes' : 'Start Recording'}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isEditorMode ? (
              <Wand2 className="w-5 h-5" />
            ) : isRecording ? (
              isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />
            ) : lastRecordingId ? (
              <Zap className="w-6 h-6 fill-current text-amber-300" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
            
            {lastRecordingId && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-background"
              >
                1
              </motion.div>
            )}
          </motion.button>
          
          {isRecording && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] font-mono mt-1 font-bold text-foreground"
            >
              {formatTime(recordingTime)}
            </motion.span>
          )}
          {!isRecording && (
            <span className={`text-[10px] font-medium mt-1 truncate max-w-[64px] ${lastRecordingId ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
              {isEditorMode ? 'Enhance' : lastRecordingId ? (settings.language === 'ar' ? 'توليد' : 'Generate') : t.newRecording}
            </span>
          )}
        </div>

        {/* Source Picker Modal — Tauri Desktop Only */}
        <AnimatePresence>
          {showSourcePicker && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setShowSourcePicker(false)}>
              <motion.div 
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-card border border-border rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center"
              >
                <div className="w-16 h-16 bg-transparent border border-primary/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Mic className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Choose Audio Source</h3>
                <p className="text-muted-foreground mb-8">Select what you want to record</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleStartWithSource('mic')}
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
                  >
                    <Mic className="w-7 h-7 text-primary" />
                    <span className="font-semibold">Microphone</span>
                  </button>
                  <button 
                    onClick={() => handleStartWithSource('system')}
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
                  >
                    <Monitor className="w-7 h-7 text-primary" />
                    <span className="font-semibold">System Audio</span>
                  </button>
                </div>
                
                <button 
                  onClick={() => setShowSourcePicker(false)}
                  className="mt-6 w-full py-3 text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Floating variant:
  // When recording, MeetingFloatingWidget is ALREADY active as the sleek draggable pill/capsule!
  // Do NOT render a duplicate button or any big modal here.
  if (isRecording) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-24 md:bottom-8 right-6 z-[100] flex flex-col items-end gap-2.5 select-none">
        {lastRecordingId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={handleMainClick}
            className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-black rounded-full shadow-lg shadow-primary/20 flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 transition-all animate-bounce"
          >
            <Zap className="w-3.5 h-3.5 fill-current text-amber-300" />
            <span>{settings.language === 'ar' ? 'بدء التوليد بالذكاء الاصطناعي' : 'Ready to Generate!'}</span>
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleMainClick}
          disabled={isProcessing}
          className={`shadow-2xl transition-all relative cursor-pointer flex items-center justify-center ${
            lastRecordingId 
              ? 'h-14 md:h-16 px-5 md:px-7 rounded-full bg-gradient-to-r from-primary via-emerald-600 to-teal-700 text-white shadow-primary/30 border-2 border-white/30 gap-2.5 animate-pulse' 
              : 'w-14 h-14 md:w-20 md:h-20 rounded-full bg-primary text-primary-foreground'
          }`}
          title={isEditorMode ? 'Enhance Note' : lastRecordingId ? 'Start Generating Notes' : 'Start Recording'}
        >
          {isProcessing ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : isEditorMode ? (
            <Wand2 className="w-7 h-7" />
          ) : lastRecordingId ? (
            <>
              <Zap className="w-7 h-7 fill-current text-amber-300" />
              <span className="font-black text-sm tracking-tight hidden sm:inline whitespace-nowrap">
                {settings.language === 'ar' ? 'بدء التوليد' : 'Start Generating'}
              </span>
            </>
          ) : (
            <Mic className="w-7 h-7 md:w-8 md:h-8" />
          )}
          
          {lastRecordingId && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background shadow-md"
            >
              1
            </motion.div>
          )}
        </motion.button>
      </div>

      {/* Source Picker Modal — Tauri Desktop Only */}
      <AnimatePresence>
        {showSourcePicker && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setShowSourcePicker(false)}>
            <motion.div 
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card border border-border rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-transparent border border-primary/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Mic className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Choose Audio Source</h3>
              <p className="text-muted-foreground mb-8">Select what you want to record</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleStartWithSource('mic')}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <Mic className="w-7 h-7 text-primary" />
                  <span className="font-semibold">Microphone</span>
                  <span className="text-xs text-muted-foreground">Your voice</span>
                </button>
                <button 
                  onClick={() => handleStartWithSource('system')}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <Monitor className="w-7 h-7 text-primary" />
                  <span className="font-semibold">System Audio</span>
                  <span className="text-xs text-muted-foreground">Screen / app audio</span>
                </button>
              </div>
              
              <button 
                onClick={() => setShowSourcePicker(false)}
                className="mt-6 w-full py-3 text-muted-foreground hover:text-foreground font-medium cursor-pointer"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
