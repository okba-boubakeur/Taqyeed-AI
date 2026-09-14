import { db } from '../db';
import { isTauri } from './platform';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export async function deleteRecording(id: number) {
  const recording = await db.recordings.get(id);
  if (!recording) return;

  if (recording.audioPath) {
    try {
      if (isTauri()) {
        const { remove } = await import('@tauri-apps/plugin-fs');
        await remove(recording.audioPath);
      } else if (Capacitor.isNativePlatform()) {
        await Filesystem.deleteFile({
          path: recording.audioPath,
          directory: Directory.Data
        });
      }
    } catch (e) {
      console.warn("Failed to delete physical audio file:", e);
    }
  }
  
  await db.recordings.delete(id);
}
