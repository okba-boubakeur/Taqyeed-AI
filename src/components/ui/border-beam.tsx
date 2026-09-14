import React, { useEffect } from "react";
import { cn } from "../../lib/utils";

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

export interface BorderBeamProps {
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
  colorFrom = "#10b981",
  colorTo = "#3b82f6",
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
        "pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden",
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
