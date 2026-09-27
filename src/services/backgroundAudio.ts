import { registerPlugin, Capacitor } from '@capacitor/core';

export interface BackgroundAudioPluginInterface {
  startForegroundService(): Promise<{ success: boolean }>;
  stopForegroundService(): Promise<{ success: boolean }>;
  minimizeApp(): Promise<{ success: boolean }>;
  isServiceRunning(): Promise<{ isRunning: boolean }>;
  isBatteryOptimizationIgnored(): Promise<{ isIgnored: boolean }>;
  requestIgnoreBatteryOptimization(): Promise<{ success: boolean }>;
  checkPermissions(): Promise<{ microphone: string; notification: string }>;
  requestPermissions(): Promise<{ microphone: string; notification: string }>;

  // Native recording (mic + system audio via MediaProjection)
  requestMediaProjection(): Promise<{ granted: boolean; reason?: string }>;
  startNativeRecording(): Promise<{ success: boolean }>;
  stopNativeRecording(): Promise<{ success: boolean; filePath: string; durationSeconds: number; mimeType: string }>;
  pauseNativeRecording(): Promise<{ success: boolean }>;
  resumeNativeRecording(): Promise<{ success: boolean }>;
  isNativeRecordingRunning(): Promise<{ isRunning: boolean; isPaused: boolean; durationSeconds: number }>;

  // MediaStore (public device storage)
  saveToMediaStore(options: {
    fileName: string;
    mimeType: string;
    base64Data?: string;
    sourceFilePath?: string;
  }): Promise<{ success: boolean; contentUri: string; displayPath: string; fileName: string }>;
  deleteFromMediaStore(options: {
    fileName?: string;
    contentUri?: string;
    filePath?: string;
  }): Promise<{ success: boolean }>;
}

export const BackgroundAudio = registerPlugin<BackgroundAudioPluginInterface>('BackgroundAudio');

/**
 * Starts the native Android Foreground Service with microphone notification and wake lock.
 */
export async function startBackgroundRecording(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await BackgroundAudio.startForegroundService();
    return !!res?.success;
  } catch (err) {
    console.warn('BackgroundAudio.startForegroundService failed:', err);
    return false;
  }
}

/**
 * Stops the native Android Foreground Service and dismisses ongoing notification.
 */
export async function stopBackgroundRecording(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await BackgroundAudio.stopForegroundService();
    return !!res?.success;
  } catch (err) {
    console.warn('BackgroundAudio.stopForegroundService failed:', err);
    return false;
  }
}

/**
 * Minimizes the mobile app to the background (moves task to back) so user can use other apps.
 */
export async function minimizeMobileApp(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await BackgroundAudio.minimizeApp();
    return !!res?.success;
  } catch (err) {
    console.warn('BackgroundAudio.minimizeApp failed:', err);
    return false;
  }
}

/**
 * Checks whether the app is whitelisted from Android Doze battery optimizations.
 */
export async function isBatteryOptimizationIgnored(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await BackgroundAudio.isBatteryOptimizationIgnored();
    return !!res?.isIgnored;
  } catch (err) {
    console.warn('BackgroundAudio.isBatteryOptimizationIgnored failed:', err);
    return true;
  }
}

/**
 * Requests Android system to whitelist this app from battery saver / Doze killings during recordings.
 */
export async function requestIgnoreBatteryOptimization(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await BackgroundAudio.requestIgnoreBatteryOptimization();
    return !!res?.success;
  } catch (err) {
    console.warn('BackgroundAudio.requestIgnoreBatteryOptimization failed:', err);
    return false;
  }
}

/**
 * Requests microphone and notification permissions via the native plugin if available.
 */
export async function requestNativeAudioPermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    if (typeof BackgroundAudio.requestPermissions === 'function') {
      const perms = await BackgroundAudio.requestPermissions();
      return perms?.microphone === 'granted';
    }
    return true;
  } catch (err) {
    console.warn('BackgroundAudio.requestPermissions failed:', err);
    return false;
  }
}

// ─────────────────────────── Native Recording (Mic + System Audio) ───────────────────────────

/**
 * Requests MediaProjection consent from the user (system dialog).
 * Must be called before startNativeRecording(). Returns whether consent was granted.
 */
export async function requestMediaProjection(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await BackgroundAudio.requestMediaProjection();
    return !!res?.granted;
  } catch (err) {
    console.warn('BackgroundAudio.requestMediaProjection failed:', err);
    return false;
  }
}

/**
 * Starts native recording service (mic + system audio mixing + AAC encoding).
 * Call requestMediaProjection() first to get consent for system audio.
 */
export async function startNativeRecording(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await BackgroundAudio.startNativeRecording();
    return !!res?.success;
  } catch (err) {
    console.warn('BackgroundAudio.startNativeRecording failed:', err);
    return false;
  }
}

/**
 * Stops the native recording and returns the M4A file path + duration.
 */
export async function stopNativeRecording(): Promise<{
  filePath: string;
  durationSeconds: number;
  mimeType: string;
} | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await BackgroundAudio.stopNativeRecording();
    if (res?.success) {
      return {
        filePath: res.filePath,
        durationSeconds: res.durationSeconds,
        mimeType: res.mimeType || 'audio/mp4',
      };
    }
    return null;
  } catch (err) {
    console.warn('BackgroundAudio.stopNativeRecording failed:', err);
    return null;
  }
}

/**
 * Pauses native recording (mic + system audio).
 */
export async function pauseNativeRecording(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await BackgroundAudio.pauseNativeRecording();
    return !!res?.success;
  } catch (err) {
    console.warn('BackgroundAudio.pauseNativeRecording failed:', err);
    return false;
  }
}

/**
 * Resumes native recording after pause.
 */
export async function resumeNativeRecording(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await BackgroundAudio.resumeNativeRecording();
    return !!res?.success;
  } catch (err) {
    console.warn('BackgroundAudio.resumeNativeRecording failed:', err);
    return false;
  }
}

// ─────────────────────────── MediaStore (Public Device Storage) ───────────────────────────

/**
 * Saves an audio file to the public Music/Taqyeed AI/ folder via Android MediaStore.
 * The file becomes visible in file managers and music apps.
 */
export async function saveToMediaStore(options: {
  fileName: string;
  mimeType: string;
  base64Data?: string;
  sourceFilePath?: string;
}): Promise<{ contentUri: string; displayPath: string; fileName: string } | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await BackgroundAudio.saveToMediaStore(options);
    if (res?.success) {
      return {
        contentUri: res.contentUri,
        displayPath: res.displayPath,
        fileName: res.fileName,
      };
    }
    return null;
  } catch (err) {
    console.warn('BackgroundAudio.saveToMediaStore failed:', err);
    return null;
  }
}

/**
 * Deletes an audio file from MediaStore (and underlying storage).
 */
export async function deleteFromMediaStore(options: {
  fileName?: string;
  contentUri?: string;
  filePath?: string;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await BackgroundAudio.deleteFromMediaStore(options);
    return !!res?.success;
  } catch (err) {
    console.warn('BackgroundAudio.deleteFromMediaStore failed:', err);
    return false;
  }
}
