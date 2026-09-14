import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import { translations } from '../translations';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ArrowLeft, 
  Search, 
  Sun, 
  Moon, 
  MoreVertical, 
  LayoutGrid, 
  List, 
  CheckSquare, 
  Settings as SettingsIcon,
  X,
  Download,
  Share2,
  Copy,
  Trash2,
  Image
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  onBack?: () => void;
}

export function Header({ onBack }: HeaderProps) {
  const { 
    settings, 
    updateSettings, 
    activeScreen, 
    setActiveScreen, 
    viewMode, 
    setViewMode, 
    searchQuery, 
    setSearchQuery, 
    isSearchOpen, 
    setIsSearchOpen,
    isSelectMode,
    setIsSelectMode,
    isNoteOpen,
    activeNoteId
  } = useAppStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const t = translations[settings.language] || translations.ar;
  const isRtl = settings.language === 'ar';

  // Real-time active note details for the header
  const activeNote = useLiveQuery(
    () => (activeNoteId ? db.notes.get(activeNoteId) : undefined),
    [activeNoteId]
  );



  // Close search bar automatically if a note is opened
  useEffect(() => {
    if (isNoteOpen && isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  }, [isNoteOpen, isSearchOpen, setIsSearchOpen, setSearchQuery]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Focus search input when search bar opens
  useEffect(() => {
    if (!isNoteOpen && isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen, isNoteOpen]);

  // Direct 2-option theme switch: light <-> night (dark)
  const isNight = settings.theme === 'dark';
  const handleToggleTheme = () => {
    updateSettings({ theme: isNight ? 'light' : 'dark' });
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      if (activeScreen === 'settings' && (activeNoteId || isNoteOpen)) {
        setActiveScreen('texteditor');
      } else if (activeScreen === 'texteditor') {
        window.dispatchEvent(new CustomEvent('app-back-press'));
      } else {
        setActiveScreen('home');
      }
    }
  };

  const isNotHome = activeScreen !== 'home' || isNoteOpen;

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30 transition-all">
      <div className="h-16 px-4 md:px-6 flex items-center justify-between gap-2">
        {/* Left: Back Arrow (when inside note) + Theme Toggle */}
        <div className="flex items-center gap-1 min-w-[40px]">
          {isNotHome && (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer"
              title={isRtl ? 'رجوع' : 'Back'}
            >
              <ArrowLeft className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} strokeWidth={1.5} />
            </button>
          )}

          {/* Theme Button: placed at the left side (light / night direct toggle) */}
          <button
            onClick={handleToggleTheme}
            className="p-2 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer"
            title={isNight ? (isRtl ? 'الوضع النهاري' : 'Light mode') : (isRtl ? 'الوضع الليلي' : 'Night mode')}
          >
            {isNight ? (
              <Sun className="w-5 h-5 hover:rotate-45 transition-transform" strokeWidth={1.5} />
            ) : (
              <Moon className="w-5 h-5 hover:-rotate-12 transition-transform" strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Center: When Note is Open -> Display Note Title and Folder (if in folder); When on Dashboard -> Search Bar if open */}
        {isNoteOpen ? (
          <div className="flex-1 max-w-xs md:max-w-md mx-2 text-center select-none overflow-hidden animate-in fade-in duration-150">
            <h1 className="text-sm md:text-base font-bold text-foreground truncate leading-tight">
              {activeNote?.title || (isRtl ? 'ملاحظة' : 'Note')}
            </h1>
          </div>
        ) : isSearchOpen ? (
          <div className="flex-1 max-w-lg mx-2 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center bg-muted/70 rounded-full px-3 py-1.5 border border-border focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRtl ? 'ابحث في العناوين وكلمات الملاحظات...' : 'Search titles and note words...'}
                className="w-full bg-transparent border-0 outline-none px-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 hover:bg-muted rounded-full text-muted-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              )}
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="ml-1 p-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {isRtl ? 'إلغاء' : 'Close'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right side: Search toggle (when home) + 3 dots menu */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search Toggle Button: ONLY shown when note is NOT open */}
          {!isNoteOpen && !isSearchOpen && (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer"
              title={isRtl ? 'بحث' : 'Search'}
            >
              <Search className="w-5 h-5" strokeWidth={1.5} />
            </button>
          )}

          {/* 3 Dots Dropdown Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-2 text-foreground hover:bg-muted rounded-full transition-colors active:scale-95 cursor-pointer ${menuOpen ? 'bg-muted' : ''}`}
              title={isRtl ? 'المزيد من الخيارات' : 'More options'}
            >
              <MoreVertical className="w-5 h-5" strokeWidth={1.5} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute ${isRtl ? 'left-0' : 'right-0'} top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-xl py-2 z-50 overflow-hidden`}
                >
                  {/* ── CASE 1: Note is Open -> Strictly Note-Related Options + Settings ── */}
                  {isNoteOpen ? (
                    <>
                      {/* 1. Export as PDF */}
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('export-note-pdf'));
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/80 transition-colors font-medium text-left rtl:text-right cursor-pointer"
                      >
                        <Download className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        <span>{isRtl ? 'تصدير كملف PDF' : 'Export as PDF'}</span>
                      </button>

                      {/* 2. Share Note */}
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('share-note'));
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/80 transition-colors font-medium text-left rtl:text-right cursor-pointer"
                      >
                        <Share2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        <span>{isRtl ? 'مشاركة الملاحظة' : 'Share Note'}</span>
                      </button>

                      {/* 3. Copy Note Content */}
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('copy-note-text'));
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/80 transition-colors font-medium text-left rtl:text-right cursor-pointer"
                      >
                        <Copy className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        <span>{isRtl ? 'نسخ نص الملاحظة' : 'Copy Note Text'}</span>
                      </button>



                      {/* 4. Background (New) */}
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('open-background-modal'));
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/80 transition-colors font-medium text-left rtl:text-right cursor-pointer"
                      >
                        <Image className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        <span>{isRtl ? 'خلفية الملاحظة' : 'Note Background'}</span>
                      </button>

                      {/* 5. Delete Note */}

                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('delete-active-note'));
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/80 transition-colors font-medium text-left rtl:text-right cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        <span>{isRtl ? 'حذف الملاحظة' : 'Delete Note'}</span>
                      </button>

                      <div className="my-1 border-t border-border/60" />

                      {/* Settings link (kept as is leading to settings screen) */}
                      <button
                        onClick={() => {
                          setActiveScreen('settings');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors font-medium text-left rtl:text-right cursor-pointer"
                      >
                        <SettingsIcon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        <span>{isRtl ? 'الإعدادات' : 'Settings'}</span>
                      </button>
                    </>
                  ) : (
                    /* ── CASE 2: Dashboard / Home -> Grid/List, Select, Settings ── */
                    <>
                      {/* Option 1: List / Grid view */}
                      <button
                        onClick={() => {
                          setViewMode(viewMode === 'grid' ? 'list' : 'grid');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/80 transition-colors font-medium text-left rtl:text-right cursor-pointer"
                      >
                        {viewMode === 'grid' ? (
                          <>
                            <List className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                            <span>{isRtl ? 'عرض القائمة' : 'List view'}</span>
                          </>
                        ) : (
                          <>
                            <LayoutGrid className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                            <span>{isRtl ? 'عرض الشبكة' : 'Grid view'}</span>
                          </>
                        )}
                      </button>

                      {/* Option 2: Select */}
                      <button
                        onClick={() => {
                          setIsSelectMode(!isSelectMode);
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/80 transition-colors font-medium text-left rtl:text-right cursor-pointer"
                      >
                        <CheckSquare className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        <span>{isSelectMode ? (isRtl ? 'إلغاء التحديد' : 'Deselect all') : (isRtl ? 'تحديد' : 'Select')}</span>
                      </button>

                      <div className="my-1 border-t border-border/60" />

                      {/* Settings link */}
                      <button
                        onClick={() => {
                          setActiveScreen('settings');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors font-medium text-left rtl:text-right cursor-pointer"
                      >
                        <SettingsIcon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        <span>{isRtl ? 'الإعدادات' : 'Settings'}</span>
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
