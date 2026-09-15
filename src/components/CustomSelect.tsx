import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Option {
  value: string;
  label: string;
  icon?: React.ElementType;
}

export interface CustomSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
  direction?: 'auto' | 'up' | 'down';
  placeholder?: string;
  disabled?: boolean;
}

interface DropdownCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  dropUp: boolean;
}

export function CustomSelect({
  value,
  options,
  onChange,
  className = "",
  direction = "auto",
  placeholder,
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<DropdownCoords | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();

    // If trigger button has scrolled completely offscreen, close menu
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Estimate menu height (~38px per option + 12px padding)
    const estimatedHeight = Math.min(options.length * 38 + 12, 260);

    const shouldDropUp =
      direction === 'up' ||
      (direction !== 'down' && spaceBelow < Math.min(estimatedHeight, 220) && spaceAbove > spaceBelow);

    const menuWidth = rect.width;
    let left = rect.left;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }

    if (shouldDropUp) {
      setCoords({
        bottom: window.innerHeight - rect.top + 4,
        left,
        width: menuWidth,
        maxHeight: Math.max(120, Math.min(spaceAbove - 16, 260)),
        dropUp: true,
      });
    } else {
      setCoords({
        top: rect.bottom + 4,
        left,
        width: menuWidth,
        maxHeight: Math.max(120, Math.min(spaceBelow - 16, 260)),
        dropUp: false,
      });
    }
  }, [direction, options.length]);

  useEffect(() => {
    if (!isOpen) return;

    updateCoords();

    const handleScrollOrResize = () => {
      updateCoords();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updateCoords]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-all outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon && (
            <selectedOption.icon className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder || ''}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && coords && (
              <>
                {/* Transparent backdrop for outside tap/click */}
                <div
                  className="fixed inset-0 z-[9998] cursor-default bg-transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                />

                {/* Floating Dropdown Menu */}
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, scale: 0.96, y: coords.dropUp ? 4 : -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: coords.dropUp ? 4 : -4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  style={{
                    position: 'fixed',
                    ...(coords.dropUp ? { bottom: coords.bottom } : { top: coords.top }),
                    left: coords.left,
                    width: coords.width,
                    maxHeight: coords.maxHeight,
                    zIndex: 9999,
                  }}
                  className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden py-1 backdrop-blur-md"
                  dir={document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr'}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="overflow-y-auto scrollbar-thin"
                    style={{ maxHeight: Math.max(80, coords.maxHeight - 8) }}
                  >
                    {options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onChange(option.value);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-muted cursor-pointer text-left rtl:text-right ${
                          value === option.value
                            ? 'text-primary bg-primary/10 font-semibold'
                            : 'text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {option.icon && (
                            <option.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate">{option.label}</span>
                        </div>
                        {value === option.value && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
