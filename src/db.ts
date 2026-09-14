import Dexie, { Table } from 'dexie';

export interface Recording {
  id?: number;
  title: string;
  date: string;
  duration: number;
  transcript?: string;
  summary?: string;
  audioBlob?: Blob; // optional, since we save large files to disk natively
  audioPath?: string; // the path to the physical WebM file
  noteId?: number; // link to notes table if saved as a note
  isPinned?: boolean;
  folderId?: number; // Link to Folder
}

export interface Note {
  id?: number;
  title: string;
  description: string;
  content: string;
  contentDelta?: string; // Delta JSON — preserves all formatting including RTL direction
  summary?: string;
  date: string;
  lastModified: string;
  isPinned?: boolean;
  audioPath?: string;
  audioBlob?: Blob; // Direct audio blob for zero-latency playback & AI
  audioDuration?: number; // Duration in seconds
  recordingId?: number; // Link to recordings table if applicable
  folderId?: number; // Link to Folder
  backgroundImage?: string; // Optional custom background
}

export interface Folder {
  id?: number;
  name: string;
  color?: string;
  icon?: string;
  date: string;
  lastModified: string;
  isPinned?: boolean;
}

export interface CustomBackground {
  id: string; // "custom-<timestamp>"
  dataUrl: string; // base64 encoded image
  name: string;
}

export class AppDatabase extends Dexie {
  recordings!: Table<Recording>;
  notes!: Table<Note>;
  folders!: Table<Folder>;
  customBackgrounds!: Table<CustomBackground>;

  constructor() {
    super('MeetingSummarizerDB');
    this.version(3).stores({
      recordings: '++id, date, title',
      notes: '++id, date, title, lastModified'
    });
    this.version(4).stores({
      recordings: '++id, date, title',
      notes: '++id, date, title, lastModified'
    }).upgrade(tx => {
      // v4: added contentDelta for faithful RTL/direction persistence
    });
    this.version(5).stores({
      recordings: '++id, date, title, isPinned',
      notes: '++id, date, title, lastModified, isPinned'
    });
    this.version(6).stores({
      recordings: '++id, date, title, isPinned, folderId',
      notes: '++id, date, title, lastModified, isPinned, folderId',
      folders: '++id, name, date, lastModified, isPinned'
    });
    this.version(7).stores({
      recordings: '++id, date, title, isPinned, folderId',
      notes: '++id, date, title, lastModified, isPinned, folderId',
      folders: '++id, name, date, lastModified, isPinned',
      customBackgrounds: 'id, name'
    });
  }
}

export const db = new AppDatabase();
