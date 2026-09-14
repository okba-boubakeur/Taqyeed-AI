import { useAppStore } from '../store';
import { db } from '../db';
import { isTauri } from './platform';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { startBackgroundRecording, stopBackgroundRecording } from './backgroundAudio';

const convertBlobToBase64 = (blob: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.includes(',') ? res.split(',')[1] : res);
    };
    reader.readAsDataURL(blob);
  });

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidateTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidateTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

/**
 * Battle-tested AudioRecorderService (Singleton)
 * Shares the hardware MediaStream, MediaRecorder, and chunk buffer across all components.
 * Prevents multiple hook instances from losing recorder handle or chunk state.
 */
class AudioRecorderService {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private timerInterval: any = null;
  private wakeLock: any = null;
  private selectedMimeType: string = '';
  private elapsedSeconds: number = 0;

  private startTimer() {
    this.stopTimer();
    this.timerInterval = window.setInterval(() => {
      this.elapsedSeconds += 1;
      useAppStore.getState().setRecordingTime(this.elapsedSeconds);
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public async startRecording(source: 'mic' | 'system' = 'mic'): Promise<void> {
    try {
      // 1. Clean up any active capture session before starting fresh
      await this.cleanup();

      this.audioChunks = [];
      this.elapsedSeconds = 0;
      const store = useAppStore.getState();
      store.setRecordingTime(0);

      // 2. Acquire audio stream
      let stream: MediaStream;
      if (source === 'mic') {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } else {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true,
          });
          if (displayStream.getAudioTracks().length > 0) {
            displayStream.getVideoTracks().forEach((track) => track.stop());
            stream = new MediaStream(displayStream.getAudioTracks());
          } else {
            displayStream.getVideoTracks().forEach((track) => track.stop());
            console.warn('Display stream had no audio tracks; acquiring mic audio fallback');
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
        } catch (displayErr) {
          console.warn('Display media capture failed, falling back to mic:', displayErr);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      }

      this.mediaStream = stream;
      this.selectedMimeType = getSupportedMimeType();

      // 3. Instantiate MediaRecorder
      const options: MediaRecorderOptions = {};
      if (this.selectedMimeType) {
        options.mimeType = this.selectedMimeType;
      }

      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Start capturing in 500ms timeslices for reliable streaming data
      recorder.start(500);
      this.mediaRecorder = recorder;

      // 4. Update UI State
      store.setIsRecording(true);
      store.setIsPaused(false);
      store.setIsMeetingMode(false);

      // 5. Start timer
      this.startTimer();

      // 6. Request WakeLock to prevent device from sleeping during recording
      if ('wakeLock' in navigator) {
        try {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (e) {
          console.warn('Wake lock not granted:', e);
        }
      }

      // 7. Foreground notification service on Android / iOS
      if (Capacitor.isNativePlatform()) {
        try {
          await startBackgroundRecording();
        } catch (bgErr) {
          console.warn('Background service start notice:', bgErr);
        }
      }

      // 8. Stream track resilience: log track termination
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          console.warn('Audio track ended event received; recording session preserved');
        };
      });
    } catch (err) {
      console.error('AudioRecorderService startRecording failed:', err);
      await this.cleanup();
      useAppStore.getState().setIsRecording(false);
      useAppStore.getState().setIsPaused(false);
      useAppStore.getState().setRecordingTime(0);
      throw err;
    }
  }

  public pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        this.mediaRecorder.pause();
      } catch (err) {
        console.warn('Error pausing MediaRecorder:', err);
      }
      this.stopTimer();
      useAppStore.getState().setIsPaused(true);
    }
  }

  public resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      try {
        this.mediaRecorder.resume();
      } catch (err) {
        console.warn('Error resuming MediaRecorder:', err);
      }
      this.startTimer();
      useAppStore.getState().setIsPaused(false);
    }
  }

  public async saveRecording(
    explicitFolderId?: number | null,
    customTitle?: string,
    targetNoteId?: number
  ): Promise<number | null> {
    const store = useAppStore.getState();

    // 1. Stop background service & release wake lock
    if (Capacitor.isNativePlatform()) {
      try {
        await stopBackgroundRecording();
      } catch {}
    }

    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }

    this.stopTimer();
    const finalDuration = Math.max(1, this.elapsedSeconds, store.recordingTime);

    // 2. Stop MediaRecorder cleanly and wait for final data flush
    const recorder = this.mediaRecorder;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('MediaRecorder onstop timeout; resolving buffered chunks');
          resolve();
        }, 1200);

        recorder.onstop = () => {
          clearTimeout(timeout);
          resolve();
        };

        try {
          if (recorder.state === 'recording' || recorder.state === 'paused') {
            recorder.requestData();
          }
        } catch {}

        try {
          recorder.stop();
        } catch {}
      });
    }
    this.mediaRecorder = null;

    // 3. Stop all media stream audio tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // 4. Validate captured chunks
    if (this.audioChunks.length === 0) {
      console.warn('No audio chunks captured during recording');
      store.setIsRecording(false);
      store.setIsPaused(false);
      store.setRecordingTime(0);
      store.setActiveRecordingNoteId(null);
      this.elapsedSeconds = 0;
      return null;
    }

    // 5. Construct audio Blob
    const mimeType = this.audioChunks[0]?.type || this.selectedMimeType || 'audio/webm';
    const audioBlob = new Blob(this.audioChunks, { type: mimeType });

    const isRtl = store.settings.language === 'ar';
    const now = new Date();
    const defaultTitle = isRtl
      ? `تسجيل صوتي - ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : `Audio Note - ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const finalTitle = customTitle && customTitle.trim() ? customTitle.trim() : defaultTitle;
    const timestamp = Date.now();

    const folderIdToUse =
      explicitFolderId !== undefined
        ? explicitFolderId || undefined
        : store.activeFolderId || undefined;

    try {
      let savedFilePath: string | undefined;

      // 6. Mobile Native Filesystem Persistence (Capacitor)
      if (Capacitor.isNativePlatform()) {
        try {
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('aac') ? 'aac' : 'webm';
          savedFilePath = `rec_${timestamp}.${ext}`;
          const base64Data = await convertBlobToBase64(audioBlob);

          await Filesystem.writeFile({
            path: savedFilePath,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true,
          });
        } catch (capErr) {
          console.warn('Capacitor native filesystem save failed, relying on IndexedDB:', capErr);
        }
      }
      // 7. Desktop Native Filesystem Persistence (Tauri)
      else if (isTauri()) {
        try {
          const { appDataDir } = await import('@tauri-apps/api/path');
          const { writeFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');

          const baseDir = await appDataDir();
          const recDir = `${baseDir.replace(/\\/g, '/')}/recordings`;

          if (!(await exists(recDir))) {
            await mkdir(recDir, { recursive: true });
          }

          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('aac') ? 'aac' : 'webm';
          savedFilePath = `${recDir}/rec_${timestamp}.${ext}`;
          const buffer = await audioBlob.arrayBuffer();
          await writeFile(savedFilePath, new Uint8Array(buffer));
        } catch (tauriErr) {
          console.warn('Tauri filesystem save failed, falling back to IndexedDB:', tauriErr);
        }
      }

      let noteId: number;

      // 8. If targetNoteId is provided, update that existing note with audio data
      if (targetNoteId) {
        await db.notes.update(targetNoteId, {
          audioBlob,
          audioPath: savedFilePath,
          audioDuration: finalDuration,
          lastModified: new Date().toISOString(),
        });
        noteId = targetNoteId;
      } else {
        // Save as new Audio Note in db.notes
        noteId = (await db.notes.add({
          title: finalTitle,
          description: '',
          content: '',
          audioBlob,
          audioPath: savedFilePath,
          audioDuration: finalDuration,
          folderId: folderIdToUse,
          date: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        })) as number;
      }

      // 9. Also save to db.recordings for backward compatibility
      const recId = (await db.recordings.add({
        title: finalTitle,
        date: new Date().toISOString(),
        duration: finalDuration,
        audioBlob,
        audioPath: savedFilePath,
        folderId: folderIdToUse,
        noteId,
      })) as number;

      // 10. Update Zustand Store & clean session
      store.setLastRecordingId(recId);
      store.setIsRecording(false);
      store.setIsPaused(false);
      store.setRecordingTime(0);
      store.setActiveRecordingNoteId(null);

      this.audioChunks = [];
      this.elapsedSeconds = 0;
      return noteId;
    } catch (err) {
      console.error('AudioRecorderService saveRecording failed:', err);
      store.setIsRecording(false);
      store.setIsPaused(false);
      store.setRecordingTime(0);
      store.setActiveRecordingNoteId(null);
      this.audioChunks = [];
      this.elapsedSeconds = 0;
      throw err;
    }
  }

  public async discardRecording(): Promise<void> {
    await this.cleanup();
    const store = useAppStore.getState();
    store.setIsRecording(false);
    store.setIsPaused(false);
    store.setRecordingTime(0);
    store.setActiveRecordingNoteId(null);
    this.audioChunks = [];
    this.elapsedSeconds = 0;
  }

  private async cleanup(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await stopBackgroundRecording();
      } catch {}
    }

    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }

    this.stopTimer();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.mediaStream = null;
    }
  }
}

export const audioRecorderService = new AudioRecorderService();
