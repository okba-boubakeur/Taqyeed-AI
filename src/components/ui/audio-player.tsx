import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

interface AudioItem {
  id: string;
  src: string;
  data?: any;
}

interface AudioPlayerContextType {
  isPlaying: boolean;
  activeItemId: string | null;
  play: (item: AudioItem) => void;
  pause: () => void;
  isItemActive: (id: string) => boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((item: AudioItem) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (activeItemId === item.id && audioRef.current) {
      audioRef.current.play();
    } else {
      const audio = new Audio(item.src);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlaying(false);
        setActiveItemId(null);
      };
      audio.play();
      setActiveItemId(item.id);
    }
    setIsPlaying(true);
  }, [activeItemId]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const isItemActive = useCallback((id: string) => activeItemId === id, [activeItemId]);

  return (
    <AudioPlayerContext.Provider value={{ isPlaying, activeItemId, play, pause, isItemActive }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
