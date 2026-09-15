import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Option {
  value: string;
  label: string;
  icon?: React.ElementType;
  image?: string;
  badge?: string;
}

export interface CustomSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
  direction?: 'auto' | 'up' | 'down';
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
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
  size = 'md',
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

    // Estimate menu height
    const itemHeight = size === 'lg' ? 56 : 38;
    const estimatedHeight = Math.min(options.length * itemHeight + 16, size === 'lg' ? 400 : 260);

    const shouldDropUp =
      direction === 'up' ||
      (direction !== 'down' && spaceBelow < Math.min(estimatedHeight, 220) && spaceAbove > spaceBelow);

    const menuWidth = rect.width;
    let left = rect.left;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }

    const maxHeightLimit = size === 'lg' ? 400 : 260;

    if (shouldDropUp) {
      setCoords({
        bottom: window.innerHeight - rect.top + 4,
        left,
        width: menuWidth,
        maxHeight: Math.max(120, Math.min(spaceAbove - 16, maxHeightLimit)),
        dropUp: true,
      });
    } else {
      setCoords({
        top: rect.bottom + 4,
        left,
        width: menuWidth,
        maxHeight: Math.max(120, Math.min(spaceBelow - 16, maxHeightLimit)),
        dropUp: false,
      });
    }
  }, [direction, options.length, size]);

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
        className={`w-full flex items-center justify-between gap-3 bg-muted border border-border transition-all outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer ${
          size === 'lg'
            ? 'min-h-[58px] px-4 py-3 rounded-2xl text-[16px] sm:text-[17px] font-bold text-foreground hover:bg-accent'
            : 'px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-accent'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-3 truncate">
          {selectedOption?.image ? (
            <div className={`shrink-0 flex items-center justify-center ${size === 'lg' ? 'w-9 h-9 rounded-xl bg-background/80 p-1 border border-border/60 shadow-xs' : 'w-4 h-4'}`}>
              <img src={selectedOption.image} alt="" className={`${size === 'lg' ? 'w-7 h-7' : 'w-4 h-4'} object-contain`} />
            </div>
          ) : selectedOption?.icon ? (
            <selectedOption.icon className={`${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} text-muted-foreground shrink-0`} />
          ) : null}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder || ''}
          </span>
          {selectedOption?.badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background/80 font-normal text-muted-foreground border border-border/60 shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`${size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} text-muted-foreground transition-transform duration-200 shrink-0 ${
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
                  className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden py-1.5 backdrop-blur-md"
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
                        className={`w-full flex items-center justify-between transition-colors hover:bg-muted cursor-pointer text-left rtl:text-right ${
                          size === 'lg'
                            ? 'px-4 py-3 min-h-[52px] text-[15px] sm:text-[16px] font-semibold'
                            : 'px-3 py-2 text-sm'
                        } ${
                          value === option.value
                            ? 'text-primary bg-primary/10 font-bold'
                            : 'text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          {option.image ? (
                            <div className={`shrink-0 flex items-center justify-center ${size === 'lg' ? 'w-9 h-9 rounded-xl bg-background/80 p-1 border border-border/60 shadow-xs' : 'w-4 h-4'}`}>
                              <img src={option.image} alt="" className={`${size === 'lg' ? 'w-7 h-7' : 'w-4 h-4'} object-contain`} />
                            </div>
                          ) : option.icon ? (
                            <option.icon className={`${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} text-muted-foreground shrink-0`} />
                          ) : null}
                          <span className="truncate">{option.label}</span>
                          {option.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-normal text-muted-foreground border border-border/50 shrink-0">
                              {option.badge}
                            </span>
                          )}
                        </div>
                        {value === option.value && (
                          <Check className={`${size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} text-primary shrink-0`} />
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
