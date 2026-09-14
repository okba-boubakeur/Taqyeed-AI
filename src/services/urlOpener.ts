import { isTauri } from './platform';
import { Capacitor } from '@capacitor/core';

/**
 * Opens an external URL in the system's default web browser across
 * Desktop (Tauri), Mobile (Capacitor / Android / iOS), and standard Web.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;

  // 1. Desktop (Tauri)
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_url', { url });
      return;
    } catch (err) {
      console.warn('Failed to open URL via Tauri command, trying window.open:', err);
    }
  }

  // 2. Mobile (Capacitor)
  if (Capacitor.isNativePlatform()) {
    try {
      // In Capacitor, '_system' delegates to the OS default browser (Chrome/Safari)
      window.open(url, '_system');
      return;
    } catch (err) {
      console.warn('Failed to open URL via _system, fallback to _blank:', err);
    }
  }

  // 3. Web / Generic Fallback
  window.open(url, '_blank', 'noopener,noreferrer');
}
