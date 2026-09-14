import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note, Recording, Folder } from '../db';
import { useAppStore } from '../store';
import { translations } from '../translations';
import { deleteRecording } from '../services/recordings';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { 
  FileText, 
  Clock, 
  Play, 
  Trash2, 
  AlertTriangle, 
  Sparkles, 
  Pin, 
  Mic, 
  Check, 
  ChevronRight,
  Search,
  CheckSquare,
  Square,
  Share2,
  Folder as FolderIcon,
  FolderPlus,
  Plus,
  X,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioCardPlayer } from './AudioCardPlayer';
import { useToast } from './Toast';
import { exportToPDF } from '../services/pdfExport';
import { marked } from 'marked';
import { BorderBeam } from './ui/border-beam';

interface DashboardProps {
  onViewRecording: (id: number) => void;
  onOpenNote?: (id: number) => void;
  onStartSummarization?: (id: number) => void;
}

export function Dashboard({ onViewRecording, onOpenNote, onStartSummarization }: DashboardProps) {
  const { 
    settings, 
    viewMode, 
    searchQuery, 
    isSelectMode, 
    setIsSelectMode, 
    selectedNoteIds, 
    setSelectedNoteIds,
    selectedRecordingIds, 
    setSelectedRecordingIds,
    selectedFolderIds,
    setSelectedFolderIds,
    clearSelection,
    setActiveScreen,
    setActiveNoteId
  } = useAppStore();

  const t = translations[settings.language] || translations.ar;
  const isRtl = settings.language === 'ar';
  const { showToast } = useToast();

  const notes = useLiveQuery(() => db.notes.toArray()) || [];
  const recordings = useLiveQuery(() => db.recordings.toArray()) || [];
  const folders = useLiveQuery(() => db.folders.toArray()) || [];

  const [activeFolder, setActiveFolder] = useState<Folder | null>(null);
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<Folder | null>(null);

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    type: 'single-note' | 'single-rec' | 'bulk';
    id?: number;
  }>({ isOpen: false, type: 'bulk' });

  // Long press timer ref
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const isDraggingRef = useRef(false);

  // Helper to strip HTML tags for clean search and thumbnail snippets
  const stripHtml = (html: string): string => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  };

  // ─────────────────────────────────────────────────────────────
  // 1. Search Filtering across Title and Note/Audio content
  // ─────────────────────────────────────────────────────────────
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredNotes = notes.filter(note => {
    if (!normalizedQuery) return true;
    const titleMatch = (note.title || '').toLowerCase().includes(normalizedQuery);
    const descMatch = (note.description || '').toLowerCase().includes(normalizedQuery);
    const contentMatch = stripHtml(note.content || '').toLowerCase().includes(normalizedQuery);
    return titleMatch || descMatch || contentMatch;
  });

  const filteredRecordings = recordings.filter(rec => {
    if (!normalizedQuery) return true;
    const titleMatch = (rec.title || '').toLowerCase().includes(normalizedQuery);
    const transcriptMatch = (rec.transcript || '').toLowerCase().includes(normalizedQuery);
    const summaryMatch = stripHtml(rec.summary || '').toLowerCase().includes(normalizedQuery);
    return titleMatch || transcriptMatch || summaryMatch;
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Separate Pinned vs Regular Items (Pinned always at the top)
  // ─────────────────────────────────────────────────────────────
  type UnifiedItem = 
    | { itemType: 'note'; data: Note }
    | { itemType: 'rec'; data: Recording };

  // On home without search: display simple standalone notes (folder notes stay organized inside folder)
  const displayNotes = normalizedQuery ? filteredNotes : filteredNotes.filter(n => !n.folderId);
  const displayRecordings = (normalizedQuery ? filteredRecordings : filteredRecordings.filter(r => !r.folderId))
    .filter(r => !r.noteId && !notes.some(n => n.recordingId === r.id));

  const allItems: UnifiedItem[] = [
    ...displayNotes.map(n => ({ itemType: 'note' as const, data: n })),
    ...displayRecordings.map(r => ({ itemType: 'rec' as const, data: r }))
  ];

  // Sort: Pinned first, then by date descending
  allItems.sort((a, b) => {
    const aPinned = a.data.isPinned ? 1 : 0;
    const bPinned = b.data.isPinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;

    const dateA = new Date(a.itemType === 'note' ? a.data.lastModified || a.data.date : a.data.date).getTime();
    const dateB = new Date(b.itemType === 'note' ? b.data.lastModified || b.data.date : b.data.date).getTime();
    return dateB - dateA;
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Selection & Long Press Logic
  // ─────────────────────────────────────────────────────────────
  const handleTouchStart = (itemType: 'note' | 'rec', id: number) => {
    if (isDraggingRef.current) return;
    isLongPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setIsSelectMode(true);
      toggleSelectItem(itemType, id);
      if ('vibrate' in navigator) {
        try { navigator.vibrate(50); } catch {}
      }
    }, 550);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const toggleSelectFolder = (id: number) => {
    setSelectedFolderIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (next.length === 0 && selectedNoteIds.length === 0 && selectedRecordingIds.length === 0) {
        setIsSelectMode(false);
      }
      return next;
    });
  };

  const handleTouchStartFolder = (id: number) => {
    if (isDraggingRef.current) return;
    isLongPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setIsSelectMode(true);
      toggleSelectFolder(id);
      if ('vibrate' in navigator) {
        try { navigator.vibrate(50); } catch {}
      }
    }, 550);
  };

  const toggleSelectItem = (itemType: 'note' | 'rec', id: number) => {
    if (itemType === 'note') {
      setSelectedNoteIds(prev => {
        const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
        if (next.length === 0 && selectedRecordingIds.length === 0 && selectedFolderIds.length === 0) {
          setIsSelectMode(false);
        }
        return next;
      });
    } else {
      setSelectedRecordingIds(prev => {
        const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
        if (next.length === 0 && selectedNoteIds.length === 0 && selectedFolderIds.length === 0) {
          setIsSelectMode(false);
        }
        return next;
      });
    }
  };

  const handleItemClick = (item: UnifiedItem) => {
    if (isDraggingRef.current) return;
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }

    if (isSelectMode) {
      toggleSelectItem(item.itemType, item.data.id!);
      return;
    }

    if (item.itemType === 'note') {
      setActiveNoteId(item.data.id!);
      setActiveScreen('texteditor');
      if (onOpenNote) onOpenNote(item.data.id!);
    } else {
      const rec = item.data as Recording;
      if (rec.noteId) {
        setActiveNoteId(rec.noteId);
        setActiveScreen('texteditor');
        if (onOpenNote) onOpenNote(rec.noteId);
      } else {
        db.notes.add({
          title: rec.title || (isRtl ? 'تسجيل صوتي' : 'Audio Note'),
          description: '',
          content: rec.summary || '',
          audioBlob: rec.audioBlob,
          audioPath: rec.audioPath,
          audioDuration: rec.duration,
          recordingId: rec.id,
          folderId: rec.folderId,
          date: rec.date,
          lastModified: new Date().toISOString(),
        }).then((newNoteId) => {
          db.recordings.update(rec.id!, { noteId: newNoteId as number });
          setActiveNoteId(newNoteId as number);
          setActiveScreen('texteditor');
          if (onOpenNote) onOpenNote(newNoteId as number);
        }).catch(() => {
          onViewRecording(rec.id!);
        });
      }
    }
  };

  // Pin / Unpin Individual Item
  const handleTogglePin = async (e: React.MouseEvent, item: UnifiedItem) => {
    e.stopPropagation();
    const newPinned = !item.data.isPinned;
    if (item.itemType === 'note') {
      await db.notes.update(item.data.id!, { isPinned: newPinned });
    } else {
      await db.recordings.update(item.data.id!, { isPinned: newPinned });
    }
  };

  // Swipe Right to Share Individual Note / Recording
  const handleSwipeShare = async (item: UnifiedItem) => {
    const isNote = item.itemType === 'note';
    const title = item.data.title || (isRtl ? 'بدون عنوان' : 'Untitled');
    const content = isNote 
      ? stripHtml((item.data as Note).content) || (item.data as Note).description || ''
      : stripHtml((item.data as Recording).summary) || (item.data as Recording).transcript || '';

    const textToShare = `${title}\n\n${content}`.trim();
    if (!textToShare) {
      showToast(isRtl ? 'لا يوجد محتوى للمشاركة' : 'No content to share', 'info');
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title,
          text: textToShare,
          dialogTitle: isRtl ? 'مشاركة' : 'Share',
        });
      } else if (navigator.share) {
        await navigator.share({
          title,
          text: textToShare,
        });
      } else {
        await navigator.clipboard.writeText(textToShare);
        showToast(isRtl ? 'تم نسخ الملاحظة إلى الحافظة' : 'Note copied to clipboard', 'success');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(textToShare);
          showToast(isRtl ? 'تم نسخ الملاحظة إلى الحافظة' : 'Note copied to clipboard', 'success');
        } catch {
          showToast(isRtl ? 'تعذر مشاركة الملاحظة' : 'Failed to share note', 'error');
        }
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 4. Bulk Operations
  // ─────────────────────────────────────────────────────────────
  const totalSelectedCount = selectedNoteIds.length + selectedRecordingIds.length + selectedFolderIds.length;

  const isAllSelectedPinned = () => {
    const selectedNotesPinned = notes.filter(n => selectedNoteIds.includes(n.id!)).every(n => n.isPinned);
    const selectedRecsPinned = recordings.filter(r => selectedRecordingIds.includes(r.id!)).every(r => r.isPinned);
    return selectedNotesPinned && selectedRecsPinned;
  };

  const handleBulkTogglePin = async () => {
    const shouldPin = !isAllSelectedPinned();
    await Promise.all([
      ...selectedNoteIds.map(id => db.notes.update(id, { isPinned: shouldPin })),
      ...selectedRecordingIds.map(id => db.recordings.update(id, { isPinned: shouldPin }))
    ]);
    showToast(
      shouldPin 
        ? (isRtl ? 'تم تثبيت العناصر في الأعلى' : 'Pinned items to top')
        : (isRtl ? 'تم إلغاء تثبيت العناصر' : 'Unpinned items'),
      'success'
    );
  };

  const handleBulkShare = async () => {
    if (totalSelectedCount === 0) return;
    const selectedNotes = notes.filter(n => selectedNoteIds.includes(n.id!));
    const selectedRecs = recordings.filter(r => selectedRecordingIds.includes(r.id!));

    const parts: string[] = [];
    selectedNotes.forEach(n => {
      const text = stripHtml(n.content) || n.description || '';
      parts.push(`📝 ${n.title || (isRtl ? 'بدون عنوان' : 'Untitled')}\n${text}`);
    });
    selectedRecs.forEach(r => {
      const text = stripHtml(r.summary) || r.transcript || '';
      parts.push(`🎙️ ${r.title || (isRtl ? 'بدون عنوان' : 'Untitled')}\n${text}`);
    });

    const combinedText = parts.join('\n\n---\n\n').trim();
    if (!combinedText) {
      showToast(isRtl ? 'لا يوجد محتوى للمشاركة' : 'No content to share', 'info');
      return;
    }

    const shareTitle = selectedNotes.length === 1 && selectedRecs.length === 0 
      ? selectedNotes[0].title 
      : (isRtl ? 'ملاحظات مشاركة' : 'Shared Notes');

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: shareTitle,
          text: combinedText,
          dialogTitle: isRtl ? 'مشاركة العناصر المحددة' : 'Share Selected Items',
        });
      } else if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: combinedText,
        });
      } else {
        await navigator.clipboard.writeText(combinedText);
        showToast(isRtl ? 'تم نسخ المحتوى إلى الحافظة' : 'Copied content to clipboard', 'success');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(combinedText);
          showToast(isRtl ? 'تم نسخ المحتوى إلى الحافظة' : 'Copied content to clipboard', 'success');
        } catch {
          showToast(isRtl ? 'تعذر مشاركة العناصر' : 'Failed to share items', 'error');
        }
      }
    }
  };

  const handleBulkExportPDF = async () => {
    if (totalSelectedCount === 0) return;
    const selectedNotes = notes.filter(n => selectedNoteIds.includes(n.id!));
    const selectedRecs = recordings.filter(r => selectedRecordingIds.includes(r.id!));

    const parts: string[] = [];
    selectedNotes.forEach(n => {
      const text = n.content || n.description || '';
      parts.push(`<h2>${n.title || (isRtl ? 'بدون عنوان' : 'Untitled')}</h2><div>${text}</div>`);
    });
    selectedRecs.forEach(r => {
      const markdownText = r.summary || r.transcript || '';
      const text = marked.parse(markdownText) as string;
      parts.push(`<h2>${r.title || (isRtl ? 'بدون عنوان' : 'Untitled')}</h2><div>${text}</div>`);
    });

    const combinedHtml = parts.join('<hr/>');
    const exportTitle = isRtl ? 'تصدير جماعي' : 'Bulk Export';
    const exportDate = new Date().toISOString();

    try {
      const result = (await exportToPDF(exportTitle, exportDate, combinedHtml, isRtl)) as any;
      if (result && result.cancelled) return;

      if (Capacitor.isNativePlatform() && result?.uri) {
        try {
          await Share.share({
            title: result.fileName,
            url: result.uri,
            dialogTitle: isRtl ? 'حفظ ومشاركة ملف PDF' : 'Save / Share PDF',
          });
        } catch (shareErr) {
          console.warn('Share/open PDF error:', shareErr);
        }
      }
      clearSelection();
    } catch (err: any) {
      showToast(isRtl ? 'فشل التصدير' : 'Export failed', 'error');
    }
  };

  const totalSelectableCount = allItems.length + folders.length;

  const handleBulkSelectAll = () => {
    if (totalSelectedCount === totalSelectableCount) {
      clearSelection();
    } else {
      setSelectedNoteIds(notes.map(n => n.id!));
      setSelectedRecordingIds(recordings.map(r => r.id!));
      setSelectedFolderIds(folders.map(f => f.id!));
    }
  };

  const handleExecuteDelete = async () => {
    if (deleteConfirmModal.type === 'single-note' && deleteConfirmModal.id) {
      await db.notes.delete(deleteConfirmModal.id);
    } else if (deleteConfirmModal.type === 'single-rec' && deleteConfirmModal.id) {
      await deleteRecording(deleteConfirmModal.id);
    } else if (deleteConfirmModal.type === 'bulk') {
      await Promise.all([
        ...selectedNoteIds.map(id => db.notes.delete(id)),
        ...selectedRecordingIds.map(id => deleteRecording(id)),
        ...selectedFolderIds.map(async fId => {
          const fNotes = notes.filter(n => n.folderId === fId);
          const fRecs = recordings.filter(r => r.folderId === fId);
          await Promise.all([
            ...fNotes.map(n => db.notes.delete(n.id!)),
            ...fRecs.map(r => deleteRecording(r.id!)),
            db.folders.delete(fId)
          ]);
        })
      ]);
      clearSelection();
    }
    setDeleteConfirmModal({ isOpen: false, type: 'bulk' });
    showToast(isRtl ? 'تم الحذف بنجاح' : 'Deleted successfully', 'info');
  };

  // ─────────────────────────────────────────────────────────────
  // Render Item Card Content (Swipe Right -> PIN, Swipe Left -> DELETE)
  // ─────────────────────────────────────────────────────────────
  const renderItemCard = (item: UnifiedItem) => {
    const isNote = item.itemType === 'note';
    const note = isNote ? (item.data as Note) : null;
    const rec = !isNote ? (item.data as Recording) : null;
    const id = item.data.id!;
    const isPinned = !!item.data.isPinned;
    const isSelected = isNote 
      ? selectedNoteIds.includes(id) 
      : selectedRecordingIds.includes(id);

    const formattedDate = new Date(
      isNote ? note!.lastModified || note!.date : rec!.date
    ).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    const isAudio = !isNote || !!(note!.audioBlob || note!.audioPath);
    const audioDuration = isNote ? (note!.audioDuration || 0) : (rec!.duration || 0);

    const cardInnerContent = (
      <div 
        className={`p-3.5 md:p-4 flex flex-col justify-between h-28 md:h-32 cursor-pointer transition-all select-none group relative ${
          isSelected ? 'bg-primary/10' : ''
        }`}
        onClick={() => handleItemClick(item)}
        onMouseDown={() => handleTouchStart(item.itemType, id)}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onTouchStart={() => handleTouchStart(item.itemType, id)}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsSelectMode(true);
          toggleSelectItem(item.itemType, id);
        }}
      >
        {/* Header: Icon BESIDE Title (left) + Pin/Selection (right) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isAudio ? (
              <Mic className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={1.5} />
            ) : (
              <FileText className="w-4 h-4 text-blue-500 shrink-0" strokeWidth={1.5} />
            )}
            <h3 className="font-bold text-sm md:text-base text-foreground truncate group-hover:text-primary transition-colors">
              {item.data.title || (isRtl ? 'بدون عنوان' : 'Untitled')}
            </h3>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isSelectMode && (
              <div className="p-0.5 text-primary">
                {isSelected ? (
                  <CheckSquare className="w-4 h-4 fill-primary text-primary-foreground" strokeWidth={1.5} />
                ) : (
                  <Square className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Date & duration only (No content/audio thumbnails) */}
        <div className="mt-auto pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" strokeWidth={1.5} />
            {formattedDate}
          </span>
          {isAudio && audioDuration > 0 && (
            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {Math.floor(audioDuration / 60)}m {Math.floor(audioDuration % 60)}s
            </span>
          )}
        </div>
      </div>
    );

    return (
      <div key={`${item.itemType}-${id}`} className="relative overflow-hidden rounded-2xl select-none group">
        {/* Swipe action reveal background */}
        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none rounded-2xl bg-muted/40 border border-border">
          {/* Left side: Revealed on swipe Right -> SHARE */}
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-xs">
            <Share2 className="w-4 h-4" strokeWidth={1.5} />
            <span>{isRtl ? 'مشاركة' : 'SHARE'}</span>
          </div>

          {/* Right side: Revealed on swipe Left -> DELETE */}
          <div className="flex items-center gap-1.5 text-destructive font-bold text-xs">
            <span>{isRtl ? 'حذف' : 'DELETE'}</span>
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
          </div>
        </div>

        {/* Draggable Card Surface */}
        <motion.div
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.4}
          onDragStart={() => {
            isDraggingRef.current = true;
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          }}
          onDragEnd={async (_, info) => {
            setTimeout(() => { isDraggingRef.current = false; }, 150);
            if ((!isRtl && info.offset.x > 70) || (isRtl && info.offset.x < -70)) {
              // Swiped Right (LTR) or Left (RTL) -> SHARE
              await handleSwipeShare(item);
            } else if ((!isRtl && info.offset.x < -70) || (isRtl && info.offset.x > 70)) {
              // Swiped Left (LTR) or Right (RTL) -> DELETE (with mandatory confirmation dialog)
              setDeleteConfirmModal({
                isOpen: true,
                type: isNote ? 'single-note' : 'single-rec',
                id: id
              });
            }
          }}
          style={{ touchAction: 'pan-y' }}
          className={`relative z-10 w-full h-full overflow-hidden rounded-2xl transition-all shadow-sm ${
            isPinned
              ? 'border border-primary/40 bg-card'
              : `bg-card border ${
                  isSelected 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/40'
                }`
          }`}
        >
          {cardInnerContent}
          {isPinned && (
            <BorderBeam
              size={180}
              duration={8}
              colorFrom="#10b981"
              colorTo="#3b82f6"
              borderWidth={1.5}
            />
          )}
        </motion.div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // Render List View Row (Swipe Right -> PIN, Swipe Left -> DELETE)
  // ─────────────────────────────────────────────────────────────
  const renderItemRow = (item: UnifiedItem) => {
    const isNote = item.itemType === 'note';
    const note = isNote ? (item.data as Note) : null;
    const rec = !isNote ? (item.data as Recording) : null;
    const id = item.data.id!;
    const isPinned = !!item.data.isPinned;
    const isSelected = isNote 
      ? selectedNoteIds.includes(id) 
      : selectedRecordingIds.includes(id);

    const formattedDate = new Date(
      isNote ? note!.lastModified || note!.date : rec!.date
    ).toLocaleDateString([], { month: 'short', day: 'numeric' });

    const rowInner = (
      <div
        className={`p-3.5 md:p-4 flex items-center justify-between gap-3 cursor-pointer transition-all select-none group ${
          isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'
        }`}
        onClick={() => handleItemClick(item)}
        onMouseDown={() => handleTouchStart(item.itemType, id)}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onTouchStart={() => handleTouchStart(item.itemType, id)}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsSelectMode(true);
          toggleSelectItem(item.itemType, id);
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {isSelectMode ? (
            <div className="text-primary shrink-0">
              {isSelected ? (
                <CheckSquare className="w-5 h-5 fill-primary text-primary-foreground" strokeWidth={1.5} />
              ) : (
                <Square className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
              )}
            </div>
          ) : (
            (isNote && !(note?.audioBlob || note?.audioPath)) ? (
              <FileText className="w-4 h-4 text-blue-500 shrink-0" strokeWidth={1.5} />
            ) : (
              <Mic className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={1.5} />
            )
          )}

          <div className="min-w-0 flex-1 flex items-center gap-2">
            <h4 className="font-bold text-sm md:text-base text-foreground truncate group-hover:text-primary transition-colors">
              {item.data.title || (isRtl ? 'بدون عنوان' : 'Untitled')}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground font-mono">
            {formattedDate}
          </span>
          <ChevronRight className={`w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors ${isRtl ? 'rotate-180' : ''}`} strokeWidth={1.5} />
        </div>
      </div>
    );

    return (
      <div key={`${item.itemType}-${id}`} className="relative overflow-hidden select-none">
        {/* Swipe action reveal background */}
        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none bg-muted/40 border-b border-border/70">
          {/* Left: swipe Right -> SHARE */}
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-xs">
            <Share2 className="w-4 h-4" strokeWidth={1.5} />
            <span>{isRtl ? 'مشاركة' : 'SHARE'}</span>
          </div>

          {/* Right: swipe Left -> DELETE */}
          <div className="flex items-center gap-1.5 text-destructive font-bold text-xs">
            <span>{isRtl ? 'حذف' : 'DELETE'}</span>
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
          </div>
        </div>

        {/* Draggable Row Surface */}
        <motion.div
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.4}
          onDragStart={() => {
            isDraggingRef.current = true;
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          }}
          onDragEnd={async (_, info) => {
            setTimeout(() => { isDraggingRef.current = false; }, 150);
            if ((!isRtl && info.offset.x > 70) || (isRtl && info.offset.x < -70)) {
              // Swiped Right (LTR) or Left (RTL) -> SHARE
              await handleSwipeShare(item);
            } else if ((!isRtl && info.offset.x < -70) || (isRtl && info.offset.x > 70)) {
              // Swiped Left (LTR) or Right (RTL) -> DELETE (with mandatory confirmation dialog)
              setDeleteConfirmModal({
                isOpen: true,
                type: isNote ? 'single-note' : 'single-rec',
                id: id
              });
            }
          }}
          style={{ touchAction: 'pan-y' }}
          className={`relative z-10 w-full overflow-hidden ${
            isPinned 
              ? 'rounded-xl my-1 border border-primary/40 bg-card shadow-xs' 
              : `bg-card border-b border-border/70 last:border-0 ${isSelected ? 'bg-primary/5' : ''}`
          }`}
        >
          {rowInner}
          {isPinned && (
            <BorderBeam
              size={220}
              duration={8}
              colorFrom="#10b981"
              colorTo="#3b82f6"
              borderWidth={1.5}
            />
          )}
        </motion.div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // Render Folder Card (Grid View - 2x mobile / 4x desktop)
  // ─────────────────────────────────────────────────────────────
  const renderFolderCard = (folder: Folder) => {
    const fNotesCount = notes.filter(n => n.folderId === folder.id).length;
    const fRecsCount = recordings.filter(r => r.folderId === folder.id && !r.noteId && !notes.some(n => n.recordingId === r.id)).length;
    const totalCount = fNotesCount + fRecsCount;
    const isFolderSelected = selectedFolderIds.includes(folder.id!);

    const cardContent = (
      <div
        onClick={() => {
          if (isDraggingRef.current) return;
          if (isLongPressTriggeredRef.current) {
            isLongPressTriggeredRef.current = false;
            return;
          }
          if (isSelectMode) {
            toggleSelectFolder(folder.id!);
            return;
          }
          setActiveFolder(folder);
        }}
        onMouseDown={() => handleTouchStartFolder(folder.id!)}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onTouchStart={() => handleTouchStartFolder(folder.id!)}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsSelectMode(true);
          toggleSelectFolder(folder.id!);
        }}
        className={`group relative bg-card border transition-all rounded-2xl p-3.5 md:p-4 cursor-pointer flex flex-col justify-between h-28 md:h-32 overflow-hidden select-none active:scale-[0.98] ${
          isFolderSelected 
            ? 'border-primary ring-2 ring-primary/20 bg-primary/10 shadow-md' 
            : 'border-border hover:border-primary/50 hover:shadow-md'
        }`}
      >
        <div 
          className="absolute top-0 inset-x-0 h-1 rounded-t-2xl" 
          style={{ backgroundColor: folder.color || '#10b981' }} 
        />

        {/* Header: Icon BESIDE Title + Selection Checkbox if in select mode */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FolderIcon 
              className="w-4 h-4 shrink-0" 
              style={{ color: folder.color || '#10b981' }} 
              strokeWidth={1.5} 
            />
            <h3 className="font-bold text-sm md:text-base text-foreground truncate group-hover:text-primary transition-colors">
              {folder.name}
            </h3>
          </div>

          {isSelectMode && (
            <div className="p-0.5 text-primary shrink-0">
              {isFolderSelected ? (
                <CheckSquare className="w-4 h-4 fill-primary text-primary-foreground" strokeWidth={1.5} />
              ) : (
                <Square className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              )}
            </div>
          )}
        </div>

        {/* Footer: Item count & indicator */}
        <div className="mt-auto pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {totalCount}{' '}
            {isRtl 
              ? (totalCount === 1 ? 'ملاحظة' : totalCount === 2 ? 'ملاحظتان' : totalCount > 10 ? 'ملاحظة' : 'ملاحظات')
              : (totalCount === 1 ? 'item' : 'items')}
          </span>
          <span 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ backgroundColor: folder.color || '#10b981' }} 
          />
        </div>
      </div>
    );

    return (
      <div key={`folder-card-${folder.id}`} className="relative overflow-hidden rounded-2xl select-none">
        {/* Swipe action reveal background (red delete area on right) */}
        <div className="absolute inset-0 flex items-center justify-end px-4 pointer-events-none bg-destructive/10 text-destructive font-bold text-xs rounded-2xl">
          <div className="flex items-center gap-1.5">
            <span>{isRtl ? 'حذف المجلد' : 'DELETE'}</span>
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
          </div>
        </div>

        <motion.div
          drag={isSelectMode ? false : "x"}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.4}
          onDragStart={() => { isDraggingRef.current = true; }}
          onDragEnd={async (_, info) => {
            setTimeout(() => { isDraggingRef.current = false; }, 150);
            if ((!isRtl && info.offset.x < -70) || (isRtl && info.offset.x > 70)) {
              setDeleteFolderConfirm(folder);
            }
          }}
          style={{ touchAction: 'pan-y' }}
          className="relative z-10 w-full h-full"
        >
          {cardContent}
        </motion.div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // Render Folder Row (List View - matching notes list rows)
  // ─────────────────────────────────────────────────────────────
  const renderFolderRow = (folder: Folder) => {
    const fNotesCount = notes.filter(n => n.folderId === folder.id).length;
    const fRecsCount = recordings.filter(r => r.folderId === folder.id && !r.noteId && !notes.some(n => n.recordingId === r.id)).length;
    const totalCount = fNotesCount + fRecsCount;
    const isFolderSelected = selectedFolderIds.includes(folder.id!);

    const rowContent = (
      <div
        onClick={() => {
          if (isDraggingRef.current) return;
          if (isLongPressTriggeredRef.current) {
            isLongPressTriggeredRef.current = false;
            return;
          }
          if (isSelectMode) {
            toggleSelectFolder(folder.id!);
            return;
          }
          setActiveFolder(folder);
        }}
        onMouseDown={() => handleTouchStartFolder(folder.id!)}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onTouchStart={() => handleTouchStartFolder(folder.id!)}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsSelectMode(true);
          toggleSelectFolder(folder.id!);
        }}
        className={`p-3 sm:p-3.5 transition-colors cursor-pointer flex items-center justify-between gap-3 select-none group ${
          isFolderSelected ? 'bg-primary/10' : 'bg-card hover:bg-muted/40'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Accent Folder Icon */}
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
            style={{ 
              borderColor: `${folder.color || '#10b981'}40`,
              backgroundColor: `${folder.color || '#10b981'}15`
            }}
          >
            <FolderIcon 
              className="w-4 h-4" 
              style={{ color: folder.color || '#10b981' }} 
              strokeWidth={1.5} 
            />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {folder.name}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground font-mono">
            {totalCount}{' '}
            {isRtl 
              ? (totalCount === 1 ? 'ملاحظة' : totalCount === 2 ? 'ملاحظتان' : totalCount > 10 ? 'ملاحظة' : 'ملاحظات')
              : (totalCount === 1 ? 'item' : 'items')}
          </span>

          {isSelectMode && (
            <div className="p-0.5 text-primary">
              {isFolderSelected ? (
                <CheckSquare className="w-4 h-4 fill-primary text-primary-foreground" strokeWidth={1.5} />
              ) : (
                <Square className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              )}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <div key={`folder-row-${folder.id}`} className="relative overflow-hidden select-none border-b border-border/70 last:border-0">
        {/* Swipe action reveal background (red delete area on right) */}
        <div className="absolute inset-0 flex items-center justify-end px-4 pointer-events-none bg-destructive/10 text-destructive font-bold text-xs">
          <div className="flex items-center gap-1.5">
            <span>{isRtl ? 'حذف المجلد' : 'DELETE'}</span>
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
          </div>
        </div>

        <motion.div
          drag={isSelectMode ? false : "x"}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.4}
          onDragStart={() => { isDraggingRef.current = true; }}
          onDragEnd={async (_, info) => {
            setTimeout(() => { isDraggingRef.current = false; }, 150);
            if ((!isRtl && info.offset.x < -70) || (isRtl && info.offset.x > 70)) {
              setDeleteFolderConfirm(folder);
            }
          }}
          style={{ touchAction: 'pan-y' }}
          className="relative z-10 w-full bg-card"
        >
          {rowContent}
        </motion.div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 select-none pb-24">
      {/* Search match banner if searching */}
      {searchQuery && (
        <div className="flex items-center justify-between p-3 bg-muted/60 rounded-xl border border-border text-xs text-muted-foreground">
          <span>
            {isRtl 
              ? `نتائج البحث عن "${searchQuery}": ${allItems.length} نتيجة`
              : `Search results for "${searchQuery}": ${allItems.length} found`}
          </span>
          <button 
            onClick={() => useAppStore.getState().setSearchQuery('')}
            className="text-primary hover:underline font-bold"
          >
            {isRtl ? 'إلغاء البحث' : 'Clear Search'}
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Folders & Modules Section (المجلدات والوحدات الدراسية)
          ───────────────────────────────────────────────────────────── */}
      {folders.length > 0 && !searchQuery && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderIcon className="w-5 h-5 text-primary" strokeWidth={1.5} />
              <h2 className="text-sm md:text-base font-bold text-foreground">
                {isRtl ? 'المجلدات والوحدات الدراسية' : 'Folders & Course Modules'}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-transparent border border-border text-muted-foreground font-mono">
                {folders.length}
              </span>
            </div>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {folders.map(renderFolderCard)}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border/60">
              {folders.map(renderFolderRow)}
            </div>
          )}
        </div>
      )}

      {/* Section divider and title if folders exist */}
      {folders.length > 0 && !searchQuery && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          <FileText className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <h3 className="text-xs md:text-sm font-bold text-muted-foreground">
            {isRtl ? 'الملاحظات الفردية والملفات' : 'Standalone Notes & Recordings'}
          </h3>
        </div>
      )}

      {/* Empty State */}
      {allItems.length === 0 ? (
        folders.length > 0 && !searchQuery ? (
          <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/80 p-6">
            {isRtl 
              ? 'لا توجد ملاحظات فردية خارج المجلدات. اضغط على زر (+) لإضافة ملاحظة أو وحدة جديدة.' 
              : 'No standalone notes outside folders. Tap (+) to create a new note or folder.'}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground/60">
              {searchQuery ? <Search className="w-8 h-8" strokeWidth={1.5} /> : <FileText className="w-8 h-8" strokeWidth={1.5} />}
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">
              {searchQuery 
                ? (isRtl ? 'لم يتم العثور على نتائج' : 'No matches found') 
                : (isRtl ? 'لا توجد ملاحظات أو تسجيلات بعد' : 'No notes or recordings yet')}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground max-w-sm">
              {searchQuery 
                ? (isRtl ? 'جرب البحث بكلمات أخرى أو تحقق من الحروف' : 'Try searching for different keywords or check spelling') 
                : (isRtl ? 'اضغط على زر (+) بالأسفل لكتابة ملاحظة جديدة أو بدء تسجيل محاضرة' : 'Tap the (+) button below to write a note or record a meeting')}
            </p>
          </div>
        )
      ) : (
        /* Main Notes / Recordings List or Grid */
        <div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {allItems.map(renderItemCard)}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border/60">
              {allItems.map(renderItemRow)}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. Bulk Actions Bottom Navigation Bar (Shown during Select Mode)
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSelectMode && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="fixed bottom-6 inset-x-4 max-w-xl mx-auto bg-card/95 dark:bg-card/90 backdrop-blur-2xl border-2 border-border shadow-2xl rounded-2xl p-2.5 z-50 flex items-center gap-2 select-none"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Button 1: Select / Unselect All (Monochrome) */}
            <button
              onClick={handleBulkSelectAll}
              className="flex-1 py-3 px-3.5 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl text-xs md:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span className="truncate">
                {totalSelectedCount === totalSelectableCount 
                  ? (isRtl ? 'إلغاء' : 'None') 
                  : (isRtl ? 'الكل' : 'All')}
              </span>
            </button>

            {/* Button 2: PIN / UNPIN (Monochrome) */}
            <button
              onClick={handleBulkTogglePin}
              disabled={totalSelectedCount === 0}
              title={isAllSelectedPinned() ? (isRtl ? 'إلغاء التثبيت' : 'Unpin') : (isRtl ? 'تثبيت' : 'Pin')}
              className="p-3 bg-transparent border border-border hover:bg-muted text-foreground rounded-xl transition-all active:scale-95 shadow-xs disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center shrink-0"
            >
              <Pin className={`w-5 h-5 shrink-0 ${isAllSelectedPinned() ? 'fill-current' : ''}`} strokeWidth={1.5} />
            </button>

            {/* Button 3: SHARE (Monochrome) */}
            <button
              onClick={handleBulkShare}
              disabled={totalSelectedCount === 0}
              title={isRtl ? 'مشاركة' : 'Share'}
              className="p-3 bg-transparent border border-border hover:bg-muted text-foreground rounded-xl transition-all active:scale-95 shadow-xs disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center shrink-0"
            >
              <Share2 className="w-5 h-5 shrink-0" strokeWidth={1.5} />
            </button>

            {/* Button 3.5: EXPORT TO PDF (Monochrome) */}
            <button
              onClick={handleBulkExportPDF}
              disabled={totalSelectedCount === 0}
              title={isRtl ? 'تصدير كملف PDF' : 'Export to PDF'}
              className="p-3 bg-transparent border border-border hover:bg-muted text-foreground rounded-xl transition-all active:scale-95 shadow-xs disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center shrink-0"
            >
              <Download className="w-5 h-5 shrink-0" strokeWidth={1.5} />
            </button>

            {/* Button 4: DELETE (Monochrome) */}
            <button
              onClick={() => setDeleteConfirmModal({ isOpen: true, type: 'bulk' })}
              disabled={totalSelectedCount === 0}
              title={isRtl ? 'حذف' : 'Delete'}
              className="p-3 bg-transparent border border-border hover:bg-muted text-foreground rounded-xl transition-all active:scale-95 shadow-xs disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center shrink-0"
            >
              <Trash2 className="w-5 h-5 shrink-0" strokeWidth={1.5} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          6. Delete Confirmation Modal
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteConfirmModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-border"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center gap-3 text-destructive mb-3">
                <div className="p-2 bg-transparent border border-destructive/30 rounded-full text-destructive">
                  <AlertTriangle className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold">
                  {isRtl ? 'تأكيد الحذف' : 'Confirm Deletion'}
                </h3>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mb-6">
                {deleteConfirmModal.type === 'bulk'
                  ? (isRtl 
                      ? `هل أنت متأكد من حذف ${totalSelectedCount} من العناصر المحددة؟ سيتم حذف أي ملفات صوتية نهائياً من الذاكرة.`
                      : `Are you sure you want to delete ${totalSelectedCount} selected item(s)? Any audio files will be permanently erased from device storage.`)
                  : (isRtl
                      ? 'هل أنت متأكد من حذف هذا العنصر؟ لن يمكنك التراجع عن هذا الإجراء.'
                      : 'Are you sure you want to delete this item? This action cannot be undone.')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmModal({ isOpen: false, type: 'bulk' })}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-xl hover:bg-border transition-colors font-medium text-sm"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleExecuteDelete}
                  className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-xl hover:opacity-90 transition-colors font-medium text-sm shadow-md"
                >
                  {isRtl ? 'حذف نهائي' : 'Confirm Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          7. Folder Notes Overlay Modal (نافذة محتويات المجلد / الوحدة)
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeFolder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[140] flex items-center justify-center p-3 sm:p-6 select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-card rounded-3xl w-full max-w-4xl max-h-[88vh] shadow-2xl border border-border flex flex-col overflow-hidden"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {/* Modal Top Accent Header */}
              <div 
                className="h-1.5 w-full shrink-0" 
                style={{ backgroundColor: activeFolder.color || '#10b981' }} 
              />

              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-10 h-10 rounded-xl bg-transparent border border-border flex items-center justify-center shrink-0"
                    style={{ borderColor: `${activeFolder.color || '#10b981'}50` }}
                  >
                    <FolderIcon 
                      className="w-5 h-5" 
                      style={{ color: activeFolder.color || '#10b981' }} 
                      strokeWidth={1.5} 
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                        {activeFolder.name}
                      </h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-transparent border border-border text-muted-foreground font-mono shrink-0">
                        {notes.filter(n => n.folderId === activeFolder.id).length + recordings.filter(r => r.folderId === activeFolder.id && !r.noteId && !notes.some(n => n.recordingId === r.id)).length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {isRtl ? 'اسحب لليسار للحذف، ولليمين للمشاركة (أو استخدم أزرار البطاقة)' : 'Swipe left to delete, right to share (or use card buttons)'}
                    </p>
                  </div>
                </div>

                {/* Exit / Close button ONLY in header */}
                <button
                  onClick={() => setActiveFolder(null)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer bg-transparent shrink-0"
                  title={isRtl ? 'إغلاق' : 'Close'}
                >
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Modal Body: Add Note Button above list + Always List View */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                {/* (+) Add Note Button above the notes list */}
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-creation-for-folder', {
                      detail: { folderId: activeFolder.id, folderName: activeFolder.name }
                    }));
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 text-primary text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  <span>{isRtl ? 'إضافة ملاحظة للوحدة' : '+ Add Note to Folder'}</span>
                </button>

                {(() => {
                  const folderNotes = notes.filter(n => n.folderId === activeFolder.id);
                  const folderRecs = recordings.filter(r => r.folderId === activeFolder.id && !r.noteId && !notes.some(n => n.recordingId === r.id));
                  const folderItems: UnifiedItem[] = [
                    ...folderNotes.map(n => ({ itemType: 'note' as const, data: n })),
                    ...folderRecs.map(r => ({ itemType: 'rec' as const, data: r }))
                  ];

                  folderItems.sort((a, b) => {
                    const aPinned = a.data.isPinned ? 1 : 0;
                    const bPinned = b.data.isPinned ? 1 : 0;
                    if (aPinned !== bPinned) return bPinned - aPinned;
                    const dateA = new Date(a.itemType === 'note' ? a.data.lastModified || a.data.date : a.data.date).getTime();
                    const dateB = new Date(b.itemType === 'note' ? b.data.lastModified || b.data.date : b.data.date).getTime();
                    return dateB - dateA;
                  });

                  if (folderItems.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div 
                          className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mb-3"
                        >
                          <FolderIcon 
                            className="w-6 h-6" 
                            style={{ color: activeFolder.color || '#10b981' }} 
                            strokeWidth={1.5} 
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {isRtl ? 'لا توجد ملاحظات في هذا المجلد بعد' : 'No notes in this folder yet'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border/60">
                      {folderItems.map(item => {
                        const isNote = item.itemType === 'note';
                        const n = isNote ? (item.data as Note) : null;
                        const r = !isNote ? (item.data as Recording) : null;
                        const itemId = item.data.id!;
                        const isAudio = !isNote || !!(n!.audioBlob || n!.audioPath);
                        const isPinned = !!item.data.isPinned;

                        const dateStr = new Date(
                          isNote ? n!.lastModified || n!.date : r!.date
                        ).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

                        const rowContent = (
                          <div
                            className="p-3.5 md:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/40 transition-all select-none group"
                            onClick={() => {
                              if (isNote) {
                                setActiveFolder(null);
                                setActiveNoteId(itemId);
                                setActiveScreen('texteditor');
                                if (onOpenNote) onOpenNote(itemId);
                              } else {
                                setActiveFolder(null);
                                onViewRecording(itemId);
                              }
                            }}
                          >
                            {/* Icon BESIDE Title */}
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {isAudio ? (
                                <Mic className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={1.5} />
                              ) : (
                                <FileText className="w-4 h-4 text-blue-500 shrink-0" strokeWidth={1.5} />
                              )}
                              <h4 className="font-bold text-sm md:text-base text-foreground truncate group-hover:text-primary transition-colors">
                                {item.data.title || (isRtl ? 'بدون عنوان' : 'Untitled')}
                              </h4>
                            </div>

                            {/* Date and chevron only (NO buttons on card!) */}
                            <div className="flex items-center gap-2.5 shrink-0 text-xs text-muted-foreground font-mono">
                              <span>{dateStr}</span>
                              <ChevronRight className={`w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors ${isRtl ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                            </div>
                          </div>
                        );

                        return (
                          <div key={`folder-item-${item.itemType}-${itemId}`} className="relative overflow-hidden select-none">
                            {/* Swipe action reveal background */}
                            <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none bg-muted/40 border-b border-border/70">
                              {/* Left: swipe Right -> SHARE */}
                              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-xs">
                                <Share2 className="w-4 h-4" strokeWidth={1.5} />
                                <span>{isRtl ? 'مشاركة' : 'SHARE'}</span>
                              </div>

                              {/* Right: swipe Left -> DELETE */}
                              <div className="flex items-center gap-1.5 text-destructive font-bold text-xs">
                                <span>{isRtl ? 'حذف' : 'DELETE'}</span>
                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                              </div>
                            </div>

                            {/* Draggable Row Surface */}
                            <motion.div
                              drag="x"
                              dragDirectionLock
                              dragConstraints={{ left: 0, right: 0 }}
                              dragElastic={0.4}
                              onDragEnd={async (_, info) => {
                                if ((!isRtl && info.offset.x > 70) || (isRtl && info.offset.x < -70)) {
                                  await handleSwipeShare(item);
                                } else if ((!isRtl && info.offset.x < -70) || (isRtl && info.offset.x > 70)) {
                                  setDeleteConfirmModal({
                                    isOpen: true,
                                    type: isNote ? 'single-note' : 'single-rec',
                                    id: itemId
                                  });
                                }
                              }}
                              style={{ touchAction: 'pan-y' }}
                              className="relative z-10 w-full bg-card border-b border-border/60 last:border-0"
                            >
                              {rowContent}
                            </motion.div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          8. Folder Deletion Confirmation Modal
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteFolderConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[160] flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-2xl w-full max-w-md shadow-2xl p-6 border border-border"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center gap-3 text-destructive mb-3">
                <div className="p-2 bg-transparent border border-destructive/30 rounded-full text-destructive">
                  <AlertTriangle className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold">
                  {isRtl ? 'حذف المجلد' : 'Delete Folder'}
                </h3>
              </div>

              <p className="text-sm text-foreground font-semibold mb-1">
                {deleteFolderConfirm.name}
              </p>

              <p className="text-xs md:text-sm text-muted-foreground mb-6">
                {isRtl
                  ? 'اختر ما تريد فعله بالملاحظات والتسجيلات الموجودة داخل هذا المجلد:'
                  : 'Choose what to do with the notes and recordings inside this folder:'}
              </p>

              <div className="flex flex-col gap-2.5">
                {/* Option A: Keep notes, unlink folder */}
                <button
                  onClick={async () => {
                    const folderId = deleteFolderConfirm.id!;
                    const fNotes = notes.filter(n => n.folderId === folderId);
                    const fRecs = recordings.filter(r => r.folderId === folderId);
                    await Promise.all([
                      ...fNotes.map(n => db.notes.update(n.id!, { folderId: undefined })),
                      ...fRecs.map(r => db.recordings.update(r.id!, { folderId: undefined })),
                      db.folders.delete(folderId)
                    ]);
                    if (activeFolder?.id === folderId) setActiveFolder(null);
                    setDeleteFolderConfirm(null);
                    showToast(isRtl ? 'تم حذف المجلد ونقل الملاحظات للرئيسية' : 'Folder deleted, notes moved to home', 'success');
                  }}
                  className="w-full py-2.5 px-4 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs md:text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isRtl ? 'حذف المجلد فقط (الاحتفاظ بالملاحظات)' : 'Delete folder only (keep notes)'}
                </button>

                {/* Option B: Delete folder AND all notes */}
                <button
                  onClick={async () => {
                    const folderId = deleteFolderConfirm.id!;
                    const fNotes = notes.filter(n => n.folderId === folderId);
                    const fRecs = recordings.filter(r => r.folderId === folderId);
                    await Promise.all([
                      ...fNotes.map(n => db.notes.delete(n.id!)),
                      ...fRecs.map(r => deleteRecording(r.id!)),
                      db.folders.delete(folderId)
                    ]);
                    if (activeFolder?.id === folderId) setActiveFolder(null);
                    setDeleteFolderConfirm(null);
                    showToast(isRtl ? 'تم حذف المجلد وملاحظاته نهائياً' : 'Folder and its notes deleted', 'info');
                  }}
                  className="w-full py-2.5 px-4 bg-destructive text-destructive-foreground hover:opacity-90 rounded-xl text-xs md:text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-4 h-4 text-destructive-foreground" strokeWidth={1.5} />
                  {isRtl ? 'حذف المجلد بجميع ملاحظاته' : 'Delete folder and all notes'}
                </button>

                {/* Cancel */}
                <button
                  onClick={() => setDeleteFolderConfirm(null)}
                  className="w-full py-2 px-4 text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
