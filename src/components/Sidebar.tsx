import React from 'react';
import { useAppStore } from '../store';
import { translations } from '../translations';
import { 
  Home, 
  Mic, 
  PenTool, 
  Settings,
  ChevronLeft, 
  ChevronRight,
  PlusCircle
} from 'lucide-react';
import { motion } from 'motion/react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: any) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { settings, isSidebarCollapsed, setSidebarCollapsed, isRecording, isAiProcessing } = useAppStore();
  const t = translations[settings.language] || translations.ar;

  const menuItems = [
    { id: 'home', icon: Home, label: t.home, disabled: isAiProcessing },
    { id: 'active', icon: Mic, label: t.activeRecording, disabled: !isRecording || isAiProcessing },
    { id: 'texteditor', icon: PenTool, label: t.textEditor, disabled: isAiProcessing },
    { id: 'settings', icon: Settings, label: t.settings, disabled: isAiProcessing },
  ];

  return (
    <motion.div
      animate={{ width: isSidebarCollapsed ? 80 : 260 }}
      className="hidden md:flex bg-sidebar border-r border-sidebar-border flex-col h-full relative transition-all duration-300 ease-in-out"
    >
      <div className="p-6 flex items-center justify-between overflow-hidden">
        {!isSidebarCollapsed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md relative overflow-hidden bg-primary/5">
              <img src="/logo.svg" alt="Taqyeed AI Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-bold text-2xl tracking-tight text-foreground truncate">{t.appName}</h1>
          </motion.div>
        )}
        {isSidebarCollapsed && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto shadow-md relative overflow-hidden bg-primary/5">
            <img src="/logo.svg" alt="Taqyeed AI Logo" className="w-full h-full object-contain" />
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            disabled={item.disabled}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group relative ${
              activeView === item.id
                ? 'bg-primary text-primary-foreground'
                : item.disabled 
                  ? 'opacity-30 cursor-not-allowed'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <item.icon className={`w-5 h-5 shrink-0 ${activeView === item.id ? '' : 'group-hover:scale-110 transition-transform'}`} />
            {!isSidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="font-medium truncate"
              >
                {item.label}
              </motion.span>
            )}
            {isSidebarCollapsed && (
              <div className="absolute left-full ml-4 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {item.label}
              </div>
            )}
          </button>
        ))}
      </nav>

      <button
        onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-sidebar border border-sidebar-border rounded-full flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent shadow-sm z-10"
      >
        {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </motion.div>
  );
}
