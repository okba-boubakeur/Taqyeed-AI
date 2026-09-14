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

