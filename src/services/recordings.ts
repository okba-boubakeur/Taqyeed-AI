import { db } from '../db';
import { isTauri } from './platform';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { deleteFromMediaStore } from './backgroundAudio';

export async function deleteRecording(id: number) {
  const recording = await db.recordings.get(id);
  if (!recording) return;

  if (recording.audioPath) {
    try {
      if (isTauri()) {
        const { remove } = await import('@tauri-apps/plugin-fs');
        await remove(recording.audioPath);
      } else if (Capacitor.isNativePlatform()) {
        // Delete from public MediaStore (Music/Taqyeed AI/) and also try Filesystem fallback
        const fileName = recording.audioPath.split('/').pop() || '';
        await deleteFromMediaStore({ fileName, filePath: recording.audioPath });

        // Also try the old Filesystem path as fallback
        try {
          await Filesystem.deleteFile({
            path: recording.audioPath,
            directory: Directory.Documents,
          });
        } catch {
          // May not exist if already deleted via MediaStore — expected
        }
      }
    } catch (e) {
      console.warn("Failed to delete physical audio file:", e);
    }
  }

  // Also delete the linked note's physical audio file if it exists
  if (recording.noteId) {
    try {
      const note = await db.notes.get(recording.noteId);
      if (note?.audioPath) {
        const noteFileName = note.audioPath.split('/').pop() || '';
        if (Capacitor.isNativePlatform()) {
          await deleteFromMediaStore({ fileName: noteFileName, filePath: note.audioPath });
        }
        await db.notes.update(recording.noteId, {
          audioBlob: undefined,
          audioPath: undefined,
          audioDuration: undefined,
        });
      }
    } catch {
      // Note may have already been deleted
    }
  }
  
  await db.recordings.delete(id);
}

/**
 * Deletes the physical audio file for a note from device storage.
 * Call this when removing audio from a note or deleting a note with audio.
 */
export async function deleteNoteAudioFile(audioPath: string | undefined): Promise<void> {
  if (!audioPath) return;
  try {
    if (isTauri()) {
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(audioPath);
    } else if (Capacitor.isNativePlatform()) {
      const fileName = audioPath.split('/').pop() || '';
      await deleteFromMediaStore({ fileName, filePath: audioPath });
      try {
        await Filesystem.deleteFile({ path: audioPath, directory: Directory.Documents });
      } catch {}
    }
  } catch (e) {
    console.warn('Failed to delete note audio file:', e);
  }
}
