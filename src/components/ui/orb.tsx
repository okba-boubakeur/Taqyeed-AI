import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface OrbProps {
  agentState?: 'thinking' | 'talking' | 'idle';
  className?: string;
}

export function Orb({ agentState = 'idle', className }: OrbProps) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <motion.div
        animate={{
          scale: agentState === 'talking' ? [1, 1.2, 1] : 1,
          opacity: agentState === 'thinking' ? [0.5, 1, 0.5] : 1,
        }}
        transition={{
          duration: agentState === 'talking' ? 0.5 : 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={cn(
          "w-full h-full rounded-full bg-gradient-to-tr from-primary to-chart-2 blur-[2px]",
          agentState === 'thinking' && "animate-pulse"
        )}
      />
      <div className="absolute inset-1 rounded-full bg-background/20 backdrop-blur-sm" />
    </div>
  );
}
