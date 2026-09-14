You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
border-beam.tsx
"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Injects a block of CSS into the document head exactly once (keyed by id).
 */
function useGlobalStyles(css: string, id: string) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }, [css, id]);
}

const BORDER_BEAM_STYLES = `
@keyframes border-beam-spin {
  from {
    --angle: 0deg;
  }
  to {
    --angle: 360deg;
  }
}

@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}
`;

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  /** Match iOS-style squircle corners (requires Chrome 139+) */
  squircle?: boolean;
}

export function BorderBeam({
  className,
  size = 200,
  duration = 12,
  delay = 0,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  borderWidth = 1.5,
  squircle = false,
}: BorderBeamProps) {
  useGlobalStyles(BORDER_BEAM_STYLES, "border-beam-styles");

  const squircleStyle = squircle
    ? ({ cornerShape: "squircle" } as React.CSSProperties)
    : {};

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        className,
      )}
      style={
        {
          "--size": size,
          "--duration": `${duration}s`,
          "--delay": `-${delay}s`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--border-width": `${borderWidth}px`,
          ...squircleStyle,
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={
          {
            padding: "var(--border-width)",
            background: `
            linear-gradient(
              var(--angle, 0deg),
              transparent 0%,
              transparent 35%,
              var(--color-from) 50%,
              var(--color-to) 65%,
              transparent 80%,
              transparent 100%
            )
          `,
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            animation: `border-beam-spin var(--duration) linear infinite var(--delay)`,
            ...squircleStyle,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

export default BorderBeam;


demo.tsx
import { BorderBeam } from "@/components/ui/border-beam";

const settings = {
  size: 200,
  duration: 12,
  delay: 0,
  colorFrom: "#ffaa40",
  colorTo: "#9c40ff",
  borderWidth: 1.5,
  squircle: false,
};

export default function Demo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="relative h-[180px] w-[320px] overflow-hidden rounded-xl border bg-card">
        <BorderBeam
          size={s.size}
          duration={s.duration}
          delay={s.delay}
          colorFrom={s.colorFrom}
          colorTo={s.colorTo}
          borderWidth={s.borderWidth}
          squircle={s.squircle}
        />
      </div>
    </div>
  );
}

```

Implementation Guidelines
 1. Analyze the component structure and identify all required dependencies
 2. Review the component's argumens and state
 3. Identify any required context providers or hooks and install them
 4. Questions to Ask
 - What data/props will be passed to this component?
 - Are there any specific state management requirements?
 - Are there any required assets (images, icons, etc.)?
 - What is the expected responsive behavior?
 - What is the best place to use this component in the app?

Steps to integrate
 0. Copy paste all the code above in the correct directories
 1. Install external dependencies
 2. Fill image assets with Unsplash stock images you know exist
 3. Use lucide-react icons for svgs or logos if component requires them

