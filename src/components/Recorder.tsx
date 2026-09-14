import { useState } from 'react';
import { Mic, MonitorUp } from 'lucide-react';
import { useAppStore } from '../store';
import { translations } from '../translations';
import { useRecorder } from '../hooks/useRecorder';

export function Recorder({ onRecordingComplete }: { onRecordingComplete: (id: number) => void }) {
  const { settings, isRecording, isPaused, recordingTime } = useAppStore();
  const t = translations[settings.language] || translations.ar;
  const { startRecording, stopRecording } = useRecorder();
  const [source, setSource] = useState<'mic' | 'system'>('mic');
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleToggle = async () => {
    if (isRecording) {
      const id = await stopRecording();
      if (id) onRecordingComplete(id);
    } else {
      await startRecording(source);
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-4 md:p-6 flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px]">
      
      {!isRecording && (
        <div className="flex gap-3 md:gap-4 mb-6 md:mb-8">
          <button 
            onClick={() => setSource('mic')}
            className={`flex flex-col items-center gap-2 p-3 md:p-4 rounded-xl border-2 transition-all ${source === 'mic' ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:border-muted text-muted-foreground'}`}
          >
            <Mic className="w-6 h-6 md:w-8 md:h-8" />
            <span className="text-xs md:text-sm font-medium">{t.microphone}</span>
          </button>
          <button 
            onClick={() => setSource('system')}
            className={`flex flex-col items-center gap-2 p-3 md:p-4 rounded-xl border-2 transition-all ${source === 'system' ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:border-muted text-muted-foreground'}`}
          >
            <MonitorUp className="w-6 h-6 md:w-8 md:h-8" />
            <span className="text-xs md:text-sm font-medium">{t.systemAudio}</span>
          </button>
        </div>
      )}

      <div className="flex flex-col items-center gap-4 md:gap-6 w-full max-w-lg">
        <div className="text-4xl md:text-5xl font-mono font-light text-foreground tracking-tight">
          {formatTime(recordingTime)}
        </div>
        
        <button
          onClick={handleToggle}
          className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105 ${
            isRecording 
              ? 'bg-destructive hover:opacity-90 animate-pulse' 
              : 'bg-primary hover:opacity-90'
          }`}
        >
          {isRecording ? (
            <div className="w-6 h-6 md:w-8 md:h-8 bg-destructive-foreground rounded-sm" />
          ) : (
            <Mic className="w-6 h-6 md:w-8 md:h-8 text-primary-foreground" />
          )}
        </button>

        {isRecording && (
          <div className="mt-8 flex items-center gap-2 text-destructive font-medium animate-pulse">
            <div className="w-2 h-2 bg-destructive rounded-full"></div>
            {isPaused ? 'Recording Paused' : t.recordingInProgress}
          </div>
        )}
      </div>
    </div>
  );
}
