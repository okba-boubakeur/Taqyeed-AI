/**
 * Platform detection utility.
 * Detects if the app is running in Tauri (desktop), Capacitor (mobile), or plain browser.
 */

export type Platform = 'tauri' | 'capacitor' | 'web';

export function detectPlatform(): Platform {
  // Tauri injects __TAURI_INTERNALS__ into the window
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return 'tauri';
  }
  
  // Capacitor injects the Capacitor object
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return 'capacitor';
  }
  
  return 'web';
}

export const currentPlatform = detectPlatform();

export function isTauri(): boolean {
  return currentPlatform === 'tauri';
}

export function isCapacitor(): boolean {
  return currentPlatform === 'capacitor';
}

export function isWeb(): boolean {
  return currentPlatform === 'web';
}

export function isMobile(): boolean {
  return isCapacitor() || (typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent));
}

export function isDesktop(): boolean {
  return isTauri() || (!isMobile() && isWeb());
}

/**
 * Check if the Web Share API is available (with file support).
 */
export function canShareFiles(): boolean {
  if (!navigator.share || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([], 'test.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}
