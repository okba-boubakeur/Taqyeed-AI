import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Sparkles, Trash2, Pin } from 'lucide-react';
import { isTauri } from '../services/platform';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { convertFileSrc } from '@tauri-apps/api/core';

interface AudioCardPlayerProps {
  audioPath?: string;
  audioBlob?: Blob;
  duration?: number;
}

export function AudioCardPlayer({ audioPath, audioBlob, duration: initialDuration = 0 }: AudioCardPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load audio source from path or blob
  useEffect(() => {
    let url: string | null = null;
    let isCancelled = false;

    async function loadAudio() {
      // 1. If audioBlob is stored directly in IndexedDB, use it immediately (zero latency, zero memory decoding)
      if (audioBlob) {
        url = URL.createObjectURL(audioBlob);
        if (!isCancelled) setAudioUrl(url);
        return;
      }

      // 2. Fallback to reading file from disk/filesystem
      if (audioPath) {
        if (Capacitor.isNativePlatform()) {
          try {
            // Check Documents first, then Data
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
              const byteCharacters = atob(base64Str);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'audio/webm' });
              if (!isCancelled) {
                url = URL.createObjectURL(blob);
                setAudioUrl(url);
              }
            }
          } catch (capErr) {
            console.warn('Capacitor audio read fallback to getUri:', capErr);
            Filesystem.getUri({ path: audioPath, directory: Directory.Documents })
              .catch(() => Filesystem.getUri({ path: audioPath, directory: Directory.Data }))
              .then(res => {
                if (!isCancelled && res?.uri) setAudioUrl(Capacitor.convertFileSrc(res.uri));
              });
          }
        } else if (isTauri()) {
          try {
            const { readFile } = await import('@tauri-apps/plugin-fs');
            const bytes = await readFile(audioPath);
            const blob = new Blob([bytes], { type: 'audio/webm' });
            if (!isCancelled) {
              url = URL.createObjectURL(blob);
              setAudioUrl(url);
            }
          } catch (tauriErr) {
            if (!isCancelled) setAudioUrl(convertFileSrc(audioPath));
          }
        }
      }
    }

    loadAudio();

    return () => {
      isCancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [audioPath, audioBlob]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Playback failed:', err);
      });
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full bg-muted/60 rounded-xl p-2.5 flex flex-col gap-1.5 border border-border/60" onClick={(e) => e.stopPropagation()}>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          preload="metadata"
        />
      )}

      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Seek Scrubber */}
        <div className="flex-1 flex flex-col justify-center">
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        {/* Time display */}
        <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
          {formatSeconds(currentTime)} / {formatSeconds(duration)}
        </span>
      </div>
    </div>
  );
}
