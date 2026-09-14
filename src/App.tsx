import { useState, useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';
import { syncNoteBackgroundsToTheme } from './services/backgroundThemeSync';
import { db } from './db';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { Recorder } from './components/Recorder';
import { RecordingDetail } from './components/RecordingDetail';
import { SettingsScreen } from './components/SettingsModal';
import { CreationFloatingButton } from './components/CreationFloatingButton';
import { useAppStore } from './store';
import { translations } from './translations';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { requestNativeAudioPermissions } from './services/backgroundAudio';

import { TextEditor } from './components/TextEditor';
import { ToastProvider } from './components/Toast';
import { RecordingBottomBar } from './components/RecordingBottomBar';
import { SplashScreen } from './components/SplashScreen';
import { isTauri } from './services/platform';

export default function App() {
  const { 
    settings, 
    isRecording, 
    isMeetingMode, 
    activeScreen, 
    setActiveScreen, 
    lastRecordingId, 
    setActiveNoteId,
    activeNoteId,
    isNoteOpen,
    activeView,
    setActiveView,
    previousView,
    setPreviousView,
    activeRecordingId,
    setActiveRecordingId
  } = useAppStore();

  const t = translations[settings.language] || translations.ar;
  const [shouldAutoSummarize, setShouldAutoSummarize] = useState(false);

  // Sync root documentElement lang & dir with current language
  useEffect(() => {
    document.documentElement.lang = settings.language;
    document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
  }, [settings.language]);

  // One-time startup reset: if the app was closed while inside a note (texteditor),
  // reset to home so the user isn't stuck in the editor on relaunch.
  useEffect(() => {
    if (activeView === 'texteditor' || activeScreen === 'texteditor') {
      setActiveView('home');
      setActiveScreen('home');
      setActiveNoteId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only once on mount

  // Keep legacy activeScreen in sync with the persisted activeView
  useEffect(() => {
    if (activeScreen !== activeView) {
      setActiveScreen(activeView);
    }
  }, [activeView]);

  // Track previous view prior to opening settings
  useEffect(() => {
    if (activeView !== 'settings') {
      setPreviousView(activeView);
    }
  }, [activeView]);

  // When recording stops, ensure clean view state
  useEffect(() => {
    if (!isRecording && activeView === 'active') {
      setActiveView('home');
      setActiveScreen('home');
    }
  }, [isRecording, activeView, setActiveView, setActiveScreen]);


  // Request microphone, notification, and storage permissions on first launch (Android/iOS)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          await requestNativeAudioPermissions();
        } catch (err) {
          console.warn('Native audio permission request failed:', err);
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.warn('Microphone permission not granted:', err);
        }
        try {
          await Filesystem.requestPermissions();
        } catch (err) {
          console.warn('Storage permission not granted:', err);
        }
      })();
    }
  }, []);

  const prevIsDarkRef = useRef<boolean | null>(null);

  // Theme & Note Paper Color application
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    const isDark = 
      settings.theme === 'dark' || 
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.add('light');
    }

    // Clean up any legacy root background overrides so app UI stays clean
    root.style.removeProperty('--background');
    root.style.removeProperty('--card');
    root.style.removeProperty('--popover');

    // Only set note-paper-color CSS variable for writing paper
    const activePaperColor = isDark 
      ? (settings.darkPaperColor || '#171717') 
      : (settings.lightPaperColor || '#fafafa');
    root.style.setProperty('--note-paper-color', activePaperColor);

    // If theme switched polarity between light and dark, sync note backgrounds
    if (prevIsDarkRef.current !== null && prevIsDarkRef.current !== isDark) {
      syncNoteBackgroundsToTheme(isDark);
    }
    prevIsDarkRef.current = isDark;
  }, [settings.theme, settings.lightPaperColor, settings.darkPaperColor]);

  // Handle system theme changes when theme is set to 'system'
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const isDark = e.matches;
      if (prevIsDarkRef.current !== isDark) {
        prevIsDarkRef.current = isDark;
        syncNoteBackgroundsToTheme(isDark);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  const handleRecordingComplete = (id: number) => {
    setActiveRecordingId(id);
    setActiveView('detail');
    setActiveScreen('detail');
  };

  const handleViewRecording = (id: number) => {
    setActiveRecordingId(id);
    setShouldAutoSummarize(false);
    setActiveView('detail');
    setActiveScreen('detail');
  };

  const handleStartSummarization = (id: number) => {
    setActiveRecordingId(id);
    setShouldAutoSummarize(true);
    setActiveView('detail');
    setActiveScreen('detail');
  };

  // Header Back Button Action
  const handleHeaderBack = () => {
    if (activeView === 'settings' || activeScreen === 'settings') {
      // If returning from settings and a note is active or user was in texteditor, return to note
      if (activeNoteId !== null || isNoteOpen || previousView === 'texteditor') {
        setActiveView('texteditor');
        setActiveScreen('texteditor');
      } else if (previousView && previousView !== 'settings' && previousView !== 'home') {
        setActiveView(previousView);
        setActiveScreen(previousView);
      } else {
        setActiveView('home');
        setActiveScreen('home');
      }
    } else if (activeView === 'texteditor') {
      window.dispatchEvent(new CustomEvent('app-back-press'));
    } else {
      setActiveView('home');
      setActiveScreen('home');
      setShouldAutoSummarize(false);
    }
  };

  // Audio file upload handler
  const handleAudioUpload = async (file: File) => {
    const audioBlob = file;
    const id = await db.recordings.add({
      title: file.name ? file.name.replace(/\.[^/.]+$/, '') : `Meeting_${Date.now()}`,
      date: new Date().toISOString(),
      duration: 0,
      audioBlob
    }) as number;

    handleViewRecording(id);
  };

  const renderView = () => {
    switch (activeView) {
      case 'home':
        return (
          <Dashboard 
            onViewRecording={handleViewRecording}
            onOpenNote={(id) => {
              setActiveNoteId(id);
              setActiveView('texteditor');
              setActiveScreen('texteditor');
            }}
            onStartSummarization={handleStartSummarization}
          />
        );
      case 'texteditor':
        return <TextEditor onAudioUpload={handleAudioUpload} />;
      case 'active':
        return (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-transparent border-2 border-primary/30 rounded-full flex items-center justify-center mb-6">
              <Mic className="w-12 h-12 text-primary animate-pulse" />
            </div>
            <h2 className="text-3xl font-bold mb-2">Active Recording</h2>
            <p className="text-muted-foreground max-w-md">
              Your meeting is currently being recorded. Use the floating button at the bottom right to pause or stop.
            </p>
          </div>
        );
      case 'recorder':
        return (
          <div className="h-full flex flex-col">
            <div className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">{t.startRecording}</h2>
              <p className="text-muted-foreground mt-2">{t.generateSummaryDesc}</p>
            </div>
            <Recorder onRecordingComplete={handleRecordingComplete} />
          </div>
        );
      case 'settings':
        return <SettingsScreen />; 
      case 'detail':
        return activeRecordingId ? (
          <RecordingDetail 
            id={activeRecordingId} 
            onBack={() => { 
              setActiveView('home'); 
              setActiveScreen('home'); 
              setShouldAutoSummarize(false); 
            }}
            onDelete={() => { 
              setActiveView('home'); 
              setActiveScreen('home'); 
              setShouldAutoSummarize(false); 
            }}
            autoSummarize={shouldAutoSummarize}
          />
        ) : (
          <Dashboard 
            onViewRecording={handleViewRecording}
            onOpenNote={(id) => {
              setActiveNoteId(id);
              setActiveView('texteditor');
              setActiveScreen('texteditor');
            }}
            onStartSummarization={handleStartSummarization}
          />
        );
      default:
        return (
          <Dashboard 
            onViewRecording={handleViewRecording}
            onOpenNote={(id) => {
              setActiveNoteId(id);
              setActiveView('texteditor');
              setActiveScreen('texteditor');
            }}
            onStartSummarization={handleStartSummarization}
          />
        );
    }
  };

  const handleViewChange = (view: any) => {
    setActiveView(view);
    setActiveScreen(view);
  };

  const isFullScreenView = activeView === 'detail' || activeView === 'texteditor' || activeView === 'settings';

  return (
    <ToastProvider>
      <SplashScreen />
      <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex-1 flex flex-col min-w-0">
          <Header onBack={handleHeaderBack} />
          
          <main className={`flex-1 ${isFullScreenView ? 'overflow-hidden p-0' : 'overflow-y-auto p-4 md:p-8'}`}>
            <div className={`${isFullScreenView ? 'max-w-none w-full h-full' : 'max-w-5xl h-full'} mx-auto`}>
              {renderView()}
            </div>
          </main>
        </div>

        {/* Floating (+) Black Button with Green Moving Border & Choice/Post Modals */}
        <CreationFloatingButton 
          onStartSummarization={handleStartSummarization}
          onOpenNewNote={() => {
            setActiveView('texteditor');
            setActiveScreen('texteditor');
          }}
        />

        {/* Bottom Recording Bar (Appears during recording but hides when inside text editor — the editor shows its own in-note recording card) */}
        {isRecording && activeView !== 'texteditor' && (
          <RecordingBottomBar 
            onSavedNote={(noteId) => {
              setActiveNoteId(noteId);
              setActiveView('texteditor');
              setActiveScreen('texteditor');
            }}
          />
        )}
      </div>
    </ToastProvider>
  );
}
