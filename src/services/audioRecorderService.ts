import { useAppStore } from '../store';
import { db } from '../db';
import { isTauri } from './platform';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  startBackgroundRecording,
  stopBackgroundRecording,
  requestMediaProjection,
  startNativeRecording,
  stopNativeRecording,
  pauseNativeRecording,
  resumeNativeRecording,
  saveToMediaStore,
} from './backgroundAudio';

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
 *
 * Enhanced Recording (Android):
 *   When settings.enhancedRecording is enabled, the service uses the native
 *   NativeAudioCaptureService (via Capacitor plugin) which captures both the
 *   microphone AND system/internal audio from other apps using Android's
 *   AudioPlaybackCapture API. The two PCM streams are mixed in real time and
 *   encoded to M4A on the native side. Smart fallback: if an app blocks system
 *   audio capture, the mic naturally picks up the speaker output acoustically.
 */
class AudioRecorderService {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private timerInterval: any = null;
  private wakeLock: any = null;
  private selectedMimeType: string = '';
  private elapsedSeconds: number = 0;

  /** When true, the native NativeAudioCaptureService handles recording (not WebView MediaRecorder) */
  private isNativeRecordingActive: boolean = false;

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
      this.isNativeRecordingActive = false;
      const store = useAppStore.getState();
      store.setRecordingTime(0);

      const enhancedRecording = !!store.settings.enhancedRecording;

      // ─── Native Enhanced Recording (Mic + System Audio) on Android ───
      if (Capacitor.isNativePlatform() && enhancedRecording) {
        try {
          // Request MediaProjection consent (system dialog)
          const granted = await requestMediaProjection();
          if (granted) {
            // Start native service — handles mic + internal audio + encoding
            const started = await startNativeRecording();
            if (started) {
              this.isNativeRecordingActive = true;

              // Update UI State
              store.setIsRecording(true);
              store.setIsPaused(false);
              store.setIsMeetingMode(false);

              // Start timer
              this.startTimer();

              // Request WakeLock
              if ('wakeLock' in navigator) {
                try {
                  this.wakeLock = await (navigator as any).wakeLock.request('screen');
                } catch (e) {
                  console.warn('Wake lock not granted:', e);
                }
              }

              return; // Native service takes over — skip WebView MediaRecorder
            }
          }
          // If consent denied or start failed, fall through to WebView mic recording
          console.warn('Enhanced recording not available, falling back to mic-only');
        } catch (err) {
          console.warn('Enhanced recording setup failed, falling back to mic-only:', err);
        }
      }

      // ─── Standard WebView Recording (mic-only or system via getDisplayMedia) ───

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
    if (this.isNativeRecordingActive) {
      pauseNativeRecording();
      this.stopTimer();
      useAppStore.getState().setIsPaused(true);
      return;
    }

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
    if (this.isNativeRecordingActive) {
      resumeNativeRecording();
      this.startTimer();
      useAppStore.getState().setIsPaused(false);
      return;
    }

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

    // ─── Native Enhanced Recording Path ───
    if (this.isNativeRecordingActive) {
      return this.saveNativeRecording(store, explicitFolderId, customTitle, targetNoteId);
    }

    // ─── Standard WebView Recording Path ───

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
      let mediaStoreUri: string | undefined;

      // 6. Mobile Native Storage: save to public MediaStore (Music/Taqyeed AI/)
      if (Capacitor.isNativePlatform()) {
        try {
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('aac') ? 'aac' : 'webm';
          const msFileName = `rec_${timestamp}.${ext}`;
          const base64Data = await convertBlobToBase64(audioBlob);

          const msResult = await saveToMediaStore({
            fileName: msFileName,
            mimeType: mimeType.includes('mp4') ? 'audio/mp4' : mimeType.includes('aac') ? 'audio/aac' : 'audio/webm',
            base64Data,
          });

          if (msResult) {
            savedFilePath = msResult.displayPath;
            mediaStoreUri = msResult.contentUri;
          } else {
            // Fallback to app-private Documents
            savedFilePath = `rec_${timestamp}.${ext}`;
            await Filesystem.writeFile({
              path: savedFilePath,
              data: base64Data,
              directory: Directory.Documents,
              recursive: true,
            });
          }
        } catch (capErr) {
          console.warn('Native filesystem save failed, relying on IndexedDB:', capErr);
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

  /**
   * Handles saving when the native NativeAudioCaptureService was used.
   * The native service produces an M4A file — we read it, store to MediaStore, and save to DB.
   */
  private async saveNativeRecording(
    store: ReturnType<typeof useAppStore.getState>,
    explicitFolderId?: number | null,
    customTitle?: string,
    targetNoteId?: number
  ): Promise<number | null> {
    if (this.wakeLock) {
      try { await this.wakeLock.release(); } catch {}
      this.wakeLock = null;
    }

    this.stopTimer();

    // Stop native service — returns file info
    const nativeResult = await stopNativeRecording();
    this.isNativeRecordingActive = false;

    if (!nativeResult || !nativeResult.filePath) {
      console.warn('Native recording returned no file');
      store.setIsRecording(false);
      store.setIsPaused(false);
      store.setRecordingTime(0);
      store.setActiveRecordingNoteId(null);
      this.elapsedSeconds = 0;
      return null;
    }

    const finalDuration = Math.max(1, nativeResult.durationSeconds, this.elapsedSeconds, store.recordingTime);
    const mimeType = nativeResult.mimeType || 'audio/mp4';

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
      // Read the native M4A file as a Blob for IndexedDB storage & AI processing
      let audioBlob: Blob | undefined;
      try {
        const fileResult = await Filesystem.readFile({
          path: nativeResult.filePath,
        });
        if (typeof fileResult.data === 'string') {
          const binaryStr = atob(fileResult.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          audioBlob = new Blob([bytes], { type: mimeType });
        } else if (fileResult.data instanceof Blob) {
          audioBlob = fileResult.data;
        }
      } catch (readErr) {
        console.warn('Failed to read native recording file as blob:', readErr);
      }

      // Save to public MediaStore (Music/Taqyeed AI/)
      let savedFilePath: string | undefined;
      try {
        const msFileName = `rec_${timestamp}.m4a`;
        const msResult = await saveToMediaStore({
          fileName: msFileName,
          mimeType: 'audio/mp4',
          sourceFilePath: nativeResult.filePath,
        });
        if (msResult) {
          savedFilePath = msResult.displayPath;
        }
      } catch (msErr) {
        console.warn('MediaStore save failed, using native path:', msErr);
        savedFilePath = nativeResult.filePath;
      }

      let noteId: number;

      if (targetNoteId) {
        await db.notes.update(targetNoteId, {
          audioBlob,
          audioPath: savedFilePath,
          audioDuration: finalDuration,
          lastModified: new Date().toISOString(),
        });
        noteId = targetNoteId;
      } else {
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

      const recId = (await db.recordings.add({
        title: finalTitle,
        date: new Date().toISOString(),
        duration: finalDuration,
        audioBlob,
        audioPath: savedFilePath,
        folderId: folderIdToUse,
        noteId,
      })) as number;

      store.setLastRecordingId(recId);
      store.setIsRecording(false);
      store.setIsPaused(false);
      store.setRecordingTime(0);
      store.setActiveRecordingNoteId(null);
      this.audioChunks = [];
      this.elapsedSeconds = 0;
      return noteId;
    } catch (err) {
      console.error('AudioRecorderService saveNativeRecording failed:', err);
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
    if (this.isNativeRecordingActive) {
      try { await stopNativeRecording(); } catch {}
      this.isNativeRecordingActive = false;
    }
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
    if (this.isNativeRecordingActive) {
      try { await stopNativeRecording(); } catch {}
      this.isNativeRecordingActive = false;
    }

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
