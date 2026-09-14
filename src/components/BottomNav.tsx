import React from 'react';
import { useAppStore } from '../store';
import { translations } from '../translations';
import { 
  Home, 
  Mic, 
  PenTool,
  Settings
} from 'lucide-react';
import { FloatingRecorder } from './FloatingRecorder';

interface BottomNavProps {
  activeView: string;
  onViewChange: (view: any) => void;
  onStartSummarization: (id: number) => void;
}

export function BottomNav({ activeView, onViewChange, onStartSummarization }: BottomNavProps) {
  const { settings, isRecording, isAiProcessing } = useAppStore();
  const t = translations[settings.language] || translations.ar;

  const leftItems = [
    { id: 'home', icon: Home, label: t.home, disabled: isAiProcessing },
    { id: 'active', icon: Mic, label: t.activeRecording, disabled: !isRecording || isAiProcessing },
  ];

  const rightItems = [
    { id: 'texteditor', icon: PenTool, label: t.textEditor, disabled: isAiProcessing },
    { id: 'settings', icon: Settings, label: t.settings, disabled: isAiProcessing },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-between px-2 py-1 z-[90] pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      <div className="flex flex-1 justify-around">
        {leftItems.map((item) => (
          <button
            key={item.id}
            disabled={item.disabled}
            onClick={() => onViewChange(item.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[64px] ${
              activeView === item.id
                ? 'text-primary'
                : item.disabled 
                  ? 'opacity-30 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <item.icon className={`w-5 h-5 ${activeView === item.id ? 'scale-110' : ''}`} />
            <span className="text-[10px] font-medium truncate max-w-[60px]">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-shrink-0 -mt-6">
        <FloatingRecorder onStartSummarization={onStartSummarization} variant="nav" />
      </div>

      <div className="flex flex-1 justify-around">
        {rightItems.map((item) => (
          <button
            key={item.id}
            disabled={item.disabled}
            onClick={() => onViewChange(item.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[64px] ${
              activeView === item.id
                ? 'text-primary'
                : item.disabled 
                  ? 'opacity-30 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <item.icon className={`w-5 h-5 ${activeView === item.id ? 'scale-110' : ''}`} />
            <span className="text-[10px] font-medium truncate max-w-[60px]">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
