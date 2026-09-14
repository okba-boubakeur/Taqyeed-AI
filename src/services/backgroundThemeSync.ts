import { db } from '../db';

/**
 * Bi-directional mapping between Light Theme backgrounds (2.jpg to 9.jpg)
 * and Dark Theme backgrounds (10.jpg to 17.jpg).
 */
export const BACKGROUND_THEME_MAP: Record<string, string> = {
  // Light to Dark
  '2.jpg': '10.jpg',
  '3.jpg': '11.jpg',
  '4.jpg': '12.jpg',
  '5.jpg': '13.jpg',
  '6.jpg': '14.jpg',
  '7.jpg': '15.jpg',
  '8.jpg': '16.jpg',
  '9.jpg': '17.jpg',

  // Dark to Light
  '10.jpg': '2.jpg',
  '11.jpg': '3.jpg',
  '12.jpg': '4.jpg',
  '13.jpg': '5.jpg',
  '14.jpg': '6.jpg',
  '15.jpg': '7.jpg',
  '16.jpg': '8.jpg',
  '17.jpg': '9.jpg',
};

const DARK_BACKGROUND_FILES = new Set(['10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg']);
const LIGHT_BACKGROUND_FILES = new Set(['2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg', '8.jpg', '9.jpg']);

/**
 * Returns the counterpart background for the given target theme (isDark).
 * If the current background is not a preset or already matches the theme polarity,
 * it is returned unchanged.
 */
export function getCounterpartBackground(bg: string | undefined, targetIsDark: boolean): string | undefined {
  if (!bg || bg === 'none' || bg.startsWith('custom-')) {
    return bg;
  }

  const filename = bg.split('/').pop() || bg;
  const counterpart = BACKGROUND_THEME_MAP[filename];
  if (!counterpart) {
    return bg;
  }

  const isCurrentlyDark = DARK_BACKGROUND_FILES.has(filename);
  const isCurrentlyLight = LIGHT_BACKGROUND_FILES.has(filename);

  // If we want dark theme and current is light -> switch to dark counterpart
  if (targetIsDark && isCurrentlyLight) {
    return bg.includes('/') ? bg.replace(filename, counterpart) : counterpart;
  }

  // If we want light theme and current is dark -> switch to light counterpart
  if (!targetIsDark && isCurrentlyDark) {
    return bg.includes('/') ? bg.replace(filename, counterpart) : counterpart;
  }

  return bg;
}

/**
 * Scans all notes in IndexedDB and updates any preset background images
 * to match the active theme (light <-> dark counterpart).
 * Also broadcasts a custom event so active editors update immediately.
 */
export async function syncNoteBackgroundsToTheme(targetIsDark: boolean): Promise<number> {
  try {
    const allNotes = await db.notes.toArray();
    let updatedCount = 0;

    for (const note of allNotes) {
      if (note.id && note.backgroundImage) {
        const nextBg = getCounterpartBackground(note.backgroundImage, targetIsDark);
        if (nextBg && nextBg !== note.backgroundImage) {
          await db.notes.update(note.id, { backgroundImage: nextBg });
          updatedCount++;
        }
      }
    }

    // Broadcast event so any active Note/Editor updates in real time
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('theme-changed-bg-sync', {
          detail: { isDark: targetIsDark },
        })
      );
    }

    return updatedCount;
  } catch (error) {
    console.error('Error syncing note backgrounds to theme:', error);
    return 0;
  }
}
