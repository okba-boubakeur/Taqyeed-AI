import { isTauri } from './platform';

let previousWindowSize: { width: number; height: number } | null = null;

/**
 * Transforms Tauri desktop window into a frameless, borderless floating chatbot-like bubble/pill.
 * Hides all OS window controls & title bars, and pins it always-on-top at the corner.
 */
export async function enterFloatingMeetingWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow, LogicalSize, LogicalPosition, currentMonitor } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    const size = await appWindow.innerSize();
    if (size.width > 500 && size.height > 300) {
      previousWindowSize = { width: size.width, height: size.height };
    }
    
    // Hide OS title bar, minimize, maximize, and close buttons completely
    await appWindow.setDecorations(false);
    await appWindow.setAlwaysOnTop(true);
    // Set compact chatbot pill dimensions
    await appWindow.setSize(new LogicalSize(190, 58));

    try {
      const monitor = await currentMonitor();
      if (monitor) {
        const factor = monitor.scaleFactor || 1;
        const screenW = monitor.size.width / factor;
        const screenH = monitor.size.height / factor;
        // Position at bottom-right corner like a chatbot bubble
        await appWindow.setPosition(new LogicalPosition(Math.max(20, screenW - 220), Math.max(20, screenH - 110)));
      }
    } catch (posErr) {
      console.warn('Could not position window at bottom right:', posErr);
    }
  } catch (err) {
    console.warn('Tauri enterFloatingMeetingWindow error:', err);
  }
}

/**
 * Expands the floating chatbot pill horizontally to reveal the 3 action buttons (Pause, Stop, Full Screen).
 */
export async function expandFloatingMeetingWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    await appWindow.setSize(new LogicalSize(250, 58));
  } catch (err) {
    console.warn('Tauri expandFloatingMeetingWindow error:', err);
  }
}

/**
 * Collapses the floating chatbot window back to the sleek minimal pill size.
 */
export async function collapseFloatingMeetingWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    await appWindow.setSize(new LogicalSize(190, 58));
  } catch (err) {
    console.warn('Tauri collapseFloatingMeetingWindow error:', err);
  }
}

/**
 * Restores the window back to full size, restores OS title bar & controls, and centers it.
 */
export async function restoreFullScreenWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    // Restore OS title bar and window controls
    await appWindow.setDecorations(true);
    await appWindow.setAlwaysOnTop(false);
    const targetWidth = previousWindowSize?.width || 1200;
    const targetHeight = previousWindowSize?.height || 800;
    await appWindow.setSize(new LogicalSize(targetWidth, targetHeight));
    await appWindow.center();
  } catch (err) {
    console.warn('Tauri restoreFullScreenWindow error:', err);
  }
}

/**
 * Minimizes the desktop window to the taskbar.
 */
export async function minimizeDesktopWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  } catch (err) {
    console.warn('Tauri minimizeDesktopWindow error:', err);
  }
}

/**
 * Triggers native OS window dragging (allows dragging the frameless floating button anywhere on screen).
 */
export async function startNativeWindowDrag(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().startDragging();
  } catch (err) {
    console.warn('Tauri startDragging error:', err);
  }
}
