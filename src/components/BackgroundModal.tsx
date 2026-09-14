import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2, Check, Upload, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../store';
import { db, Note } from '../db';
import { translations } from '../translations';
import { getCounterpartBackground } from '../services/backgroundThemeSync';

const lightBackgrounds = [
  { id: 'none', type: 'none', label: 'بدون خلفية' },
  { id: '2.jpg', type: 'image', label: 'ورق قديم 1' },
  { id: '3.jpg', type: 'image', label: 'ورق قديم 2' },
  { id: '4.jpg', type: 'image', label: 'ورق قديم 3' },
  { id: '5.jpg', type: 'image', label: 'ورق قديم 4' },
  { id: '6.jpg', type: 'image', label: 'ورق قديم 5' },
  { id: '7.jpg', type: 'image', label: 'ورق قديم 6' },
  { id: '8.jpg', type: 'image', label: 'ورق قديم 7' },
  { id: '9.jpg', type: 'image', label: 'ورق قديم 8' },
];

const darkBackgrounds = [
  { id: 'none', type: 'none', label: 'بدون خلفية' },
  { id: '10.jpg', type: 'image', label: 'ليلي داكن 1' },
  { id: '11.jpg', type: 'image', label: 'ليلي داكن 2' },
  { id: '12.jpg', type: 'image', label: 'ليلي داكن 3' },
  { id: '13.jpg', type: 'image', label: 'ليلي داكن 4' },
  { id: '14.jpg', type: 'image', label: 'ليلي داكن 5' },
  { id: '15.jpg', type: 'image', label: 'ليلي داكن 6' },
  { id: '16.jpg', type: 'image', label: 'ليلي داكن 7' },
  { id: '17.jpg', type: 'image', label: 'ليلي داكن 8' },
];

interface BackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeNote: Note | null;
}

export function BackgroundModal({ isOpen, onClose, activeNote }: BackgroundModalProps) {
  const { settings } = useAppStore();
  const isRtl = settings.language === 'ar';
  const t = translations[settings.language];
  const [selectedBg, setSelectedBg] = useState<string | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDarkTheme = settings.theme === 'dark' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const activePresets = isDarkTheme ? darkBackgrounds : lightBackgrounds;

  const customBackgrounds = useLiveQuery(() => db.customBackgrounds.toArray(), []) || [];
  
  const allBackgrounds = [
    ...activePresets.map(bg => ({
      ...bg,
      label: isRtl ? bg.label : (bg.id === 'none' ? 'None' : bg.id.replace('.jpg', ''))
    })),
    ...customBackgrounds.map(bg => ({
      id: bg.id,
      type: 'custom',
      label: bg.name,
      dataUrl: bg.dataUrl
    }))
  ];

  useEffect(() => {
    if (isOpen && activeNote) {
      const initialBg = activeNote.backgroundImage 
        ? (getCounterpartBackground(activeNote.backgroundImage, isDarkTheme) || activeNote.backgroundImage)
        : 'none';
      setSelectedBg(initialBg);
    }
  }, [isOpen, activeNote]);

  // If theme toggles while modal is open, also sync the selected background
  useEffect(() => {
    if (isOpen && selectedBg && selectedBg !== 'none') {
      const counterpart = getCounterpartBackground(selectedBg, isDarkTheme);
      if (counterpart && counterpart !== selectedBg) {
        setSelectedBg(counterpart);
      }
    }
  }, [isOpen, isDarkTheme]);

  const handleApply = async () => {
    if (!activeNote?.id) return;
    const newBg = selectedBg === 'none' ? undefined : selectedBg;

    await db.notes.update(activeNote.id, {
      backgroundImage: newBg,
      lastModified: new Date().toISOString()
    });

    // Dispatch event so TextEditor immediately updates the background visually without a reload
    window.dispatchEvent(new CustomEvent('update-note-bg', { detail: newBg }));

    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      const id = `custom-${Date.now()}`;
      await db.customBackgrounds.add({
        id,
        dataUrl,
        name: file.name
      });
      setSelectedBg(id);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteCustomBg = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent selecting the background while deleting
    await db.customBackgrounds.delete(id);
    if (selectedBg === id) {
      setSelectedBg('none');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`bg-card w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-border flex flex-col ${isPreviewExpanded ? 'h-[90vh]' : 'max-h-[85vh]'}`}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-border/60">
            <h2 className="text-xl font-bold text-foreground">
              {isRtl ? 'تخصيص خلفية الملاحظة' : 'Customize Note Background'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
                title={isPreviewExpanded ? 'Collapse Preview' : 'Expand Preview'}
              >
                {isPreviewExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Sidebar with Grid */}
            <div className={`p-4 overflow-y-auto border-border/60 ${isPreviewExpanded ? 'hidden' : 'w-full md:w-1/3 md:border-r rtl:md:border-l rtl:md:border-r-0'}`}>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-muted/50 hover:bg-muted text-foreground p-3 rounded-xl border border-dashed border-border/80 transition-colors mb-4"
              >
                <Upload className="w-5 h-5" />
                <span className="font-medium text-sm">{isRtl ? 'رفع خلفية جديدة' : 'Upload Background'}</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              <div className="grid grid-cols-2 gap-3">
                {allBackgrounds.map((bg: any) => {
                  const isSelected = selectedBg === bg.id;
                  return (
                    <div key={bg.id} className="relative aspect-[3/4] group">
                      <button
                        onClick={() => setSelectedBg(bg.id)}
                        className={`w-full h-full relative rounded-xl border-2 overflow-hidden transition-all ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border/60 hover:border-primary/50'
                          }`}
                      >
                        {bg.id === 'none' ? (
                          <div className="w-full h-full bg-card flex items-center justify-center text-muted-foreground">
                            <X className="w-8 h-8 opacity-50" />
                          </div>
                        ) : (
                          <div
                            className="w-full h-full bg-cover bg-center"
                            style={{
                              backgroundImage: bg.type === 'custom' ? `url(${bg.dataUrl})` : `url('/backgrounds/${bg.id}')`,
                              backgroundSize: bg.type === 'pattern' ? '100% 100%' : 'cover'
                            }}
                          />
                        )}

                        {/* Label Overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1.5 flex items-center justify-center">
                          <span className="text-[10px] text-white font-medium truncate">
                            {bg.label}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                          </div>
                        )}
                      </button>

                      {bg.type === 'custom' && (
                        <button
                          onClick={(e) => handleDeleteCustomBg(e, bg.id)}
                          className="absolute top-2 left-2 w-6 h-6 bg-destructive/90 text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-destructive"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Preview Area */}
            <div className={`flex-1 bg-muted/30 p-4 md:p-6 overflow-hidden flex flex-col ${isPreviewExpanded ? 'h-full' : ''}`}>
              <div className="text-sm font-semibold text-foreground mb-3 flex items-center justify-between">
                <span>{isRtl ? 'معاينة مباشرة' : 'Live Preview'}</span>
              </div>

              <div className="flex-1 relative rounded-2xl overflow-hidden shadow-sm border border-border bg-card flex items-center justify-center">
                {/* Simulated Paper */}
                <div
                  className="absolute inset-0 w-full h-full transition-all duration-300"
                  style={{
                    backgroundColor: selectedBg === 'none' ? 'var(--card)' : 'transparent',
                    backgroundImage: selectedBg !== 'none' 
                      ? (() => {
                          const found = allBackgrounds.find((b) => b.id === selectedBg) as any;
                          return found?.type === 'custom' 
                            ? `url(${found.dataUrl})` 
                            : `url('/backgrounds/${selectedBg}')`;
                        })()
                      : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                >
                  <div className="p-8 md:p-12 w-full h-full flex flex-col gap-4 overflow-y-auto">
                    {/* Dummy Content to show font readability */}
                    <h1 className="text-3xl font-bold text-foreground">
                      {activeNote?.title || (isRtl ? 'عنوان الملاحظة' : 'Note Title')}
                    </h1>
                    <p className="text-foreground/80 leading-relaxed font-sans text-lg">
                      {isRtl
                        ? 'هذا النص هو مثال لمعاينة شكل الخلفية مع الخطوط والنصوص المختلفة. تأكد من أن الخلفية لا تعيق قراءة النص وأن الألوان متناسقة.'
                        : 'This text is an example to preview how the background looks with various fonts and text. Make sure the background does not hinder readability.'}
                    </p>
                    <div className="mt-4 p-4 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm">
                      <span className="font-bold text-primary block mb-2">{isRtl ? 'نص بارز (مثال)' : 'Highlighted Text (Example)'}</span>
                      <p className="text-foreground/90 font-serif">
                        {isRtl ? '﴿ إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ ﴾' : '“Indeed, it is We who sent down the Qur\'an and indeed, We will be its guardian.”'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border/60 bg-muted/10 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-muted text-foreground transition-colors"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleApply}
              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
            >
              {isRtl ? 'تطبيق الخلفية' : 'Apply Background'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
