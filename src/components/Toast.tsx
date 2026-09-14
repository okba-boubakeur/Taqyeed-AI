import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, Folder, ExternalLink } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  folderPath?: string;
  filePath?: string;
  action?: ToastAction;
}

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  folderPath?: string;
  filePath?: string;
  action?: ToastAction;
}

export interface ToastContextType {
  showToast: (message: string, typeOrOptions?: ToastType | ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, typeOrOptions: ToastType | ToastOptions = 'info') => {
    const id = ++toastIdCounter;
    let type: ToastType = 'info';
    let duration = 4500;
    let folderPath: string | undefined;
    let filePath: string | undefined;
    let action: ToastAction | undefined;

    if (typeof typeOrOptions === 'string') {
      type = typeOrOptions;
    } else if (typeOrOptions && typeof typeOrOptions === 'object') {
      type = typeOrOptions.type || 'info';
      duration = typeOrOptions.duration || (typeOrOptions.folderPath || typeOrOptions.action ? 7000 : 4500);
      folderPath = typeOrOptions.folderPath;
      filePath = typeOrOptions.filePath;
      action = typeOrOptions.action;
    }

    setToasts(prev => [...prev, { id, message, type, folderPath, filePath, action }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-destructive shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-500 shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-500/30',
    error: 'border-destructive/30',
    warning: 'border-amber-500/30',
    info: 'border-sky-500/30',
  };

  const bgColors = {
    success: 'bg-emerald-500/10',
    error: 'bg-destructive/10',
    warning: 'bg-amber-500/10',
    info: 'bg-sky-500/10',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] flex flex-col items-center gap-3 max-w-sm w-[calc(100%-2.5rem)] pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`pointer-events-auto w-full flex flex-col gap-2.5 p-4 rounded-3xl border ${borderColors[toast.type]} ${bgColors[toast.type]} bg-card/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {icons[toast.type]}
                  <span className="text-sm font-bold text-foreground leading-snug break-words">
                    {toast.message}
                  </span>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground shrink-0 cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Destination Folder / File Path display */}
              {(toast.folderPath || toast.filePath) && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-background/90 border border-border/80 text-[11px] font-mono text-muted-foreground break-all">
                  <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">
                    {toast.folderPath ? `${toast.folderPath}/` : toast.filePath}
                  </span>
                </div>
              )}

              {/* Action button if provided */}
              {toast.action && (
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (toast.action?.onClick) toast.action.onClick();
                      removeToast(toast.id);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>{toast.action.label}</span>
                    {toast.action.icon || <ExternalLink className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
