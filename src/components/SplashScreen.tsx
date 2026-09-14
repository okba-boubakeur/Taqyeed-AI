import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import OrbConverge from './originkit/ui/particle-tether';

interface SplashScreenProps {
  duration?: number;
  onFinish?: () => void;
}

export function SplashScreen({ duration = 2200, onFinish }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onFinish]);

  const handleDismiss = () => {
    setIsVisible(false);
    onFinish?.();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="app-splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          onClick={handleDismiss}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 select-none overflow-hidden cursor-pointer"
        >
          {/* Subtle Ambient Radial Highlight */}
          <div 
            className="absolute w-80 h-80 rounded-full blur-3xl pointer-events-none -z-10"
            style={{
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.04) 60%, transparent 80%)'
            }}
          />

          {/* Particle Tether Loader (White Dots on App Green Screen) */}
          <div className="relative flex flex-col items-center justify-center">
            <OrbConverge
              width={280}
              height={280}
              dotColor="#ffffff"
              density={240}
              dotSize={95}
              speed={60}
              spinTurns={1}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
