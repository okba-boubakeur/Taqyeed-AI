import { useCallback } from 'react';
import { useAppStore } from '../store';
import { audioRecorderService } from '../services/audioRecorderService';

/**
 * useRecorder Hook
 * Bridges components to the battle-tested singleton AudioRecorderService.
 * Guarantees that recorder state, active hardware streams, and captured audio chunks
 * are consistently shared across all components (floating buttons, bottom bars, widgets).
 */
export function useRecorder() {
  const { isRecording, isPaused, recordingTime } = useAppStore();

  const startRecording = useCallback(async (source: 'mic' | 'system' = 'mic') => {
    return audioRecorderService.startRecording(source);
  }, []);

  const pauseRecording = useCallback(() => {
    audioRecorderService.pauseRecording();
  }, []);

  const resumeRecording = useCallback(() => {
    audioRecorderService.resumeRecording();
  }, []);

  const saveRecording = useCallback(
    async (explicitFolderId?: number | null, customTitle?: string, targetNoteId?: number) => {
      return audioRecorderService.saveRecording(explicitFolderId, customTitle, targetNoteId);
    },
    []
  );

  const discardRecording = useCallback(async () => {
    return audioRecorderService.discardRecording();
  }, []);

  // Alias stopRecording to saveRecording for backward compatibility
  const stopRecording = useCallback(async () => {
    return audioRecorderService.saveRecording();
  }, []);

  return {
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    saveRecording,
    discardRecording,
    isRecording,
    isPaused,
    recordingTime,
  };
}
