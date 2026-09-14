import React, { useState, useRef, useCallback } from 'react';
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import { AlignLeft, AlignCenter, AlignRight, Trash2 } from 'lucide-react';

function ResizableImageComponent(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const [isResizing, setIsResizing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [currentDisplayWidth, setCurrentDisplayWidth] = useState<number>(node.attrs.width || 360);
  const imageRef = useRef<HTMLImageElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);
  const resizeDirectionRef = useRef<'right' | 'left'>('right');

  const width = node.attrs.width || 360;
  const alignment = node.attrs.alignment || 'center';

  const handleResizeStart = useCallback(
    (direction: 'right' | 'left') => (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      resizeDirectionRef.current = direction;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      startXRef.current = clientX;
      startWidthRef.current = imageRef.current ? imageRef.current.offsetWidth : width;

      const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
        const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const deltaX = currentX - startXRef.current;
        const signedDelta = resizeDirectionRef.current === 'right' ? deltaX : -deltaX;
        const newWidth = Math.max(120, Math.min(850, startWidthRef.current + signedDelta));
        const rounded = Math.round(newWidth);
        setCurrentDisplayWidth(rounded);
        updateAttributes({ width: rounded });
      };

      const handleEnd = () => {
        setIsResizing(false);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    },
    [updateAttributes, width]
  );

  const applyPresetWidth = (presetWidth: number) => {
    setCurrentDisplayWidth(presetWidth);
    updateAttributes({ width: presetWidth });
  };

  const justifyClass =
    alignment === 'left'
      ? 'justify-start'
      : alignment === 'right'
      ? 'justify-end'
      : 'justify-center';

  return (
    <NodeViewWrapper className={`my-4 flex ${justifyClass} select-none`} data-drag-handle>
      <div
        className={`relative inline-block group rounded-2xl transition-all ${
          selected || showControls || isResizing
            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
            : ''
        }`}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => !isResizing && setShowControls(false)}
        onClick={() => setShowControls((prev) => !prev)}
      >
        {/* Floating Bubble Controls Toolbar */}
        {(showControls || selected || isResizing) && (
          <div
            className="absolute -top-12 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-xl border border-border px-2 py-1 rounded-2xl shadow-2xl flex items-center gap-1.5 z-40 pointer-events-auto select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Width Percentage Presets */}
            <div className="flex items-center gap-1 pr-1 border-r border-border/80">
              <button
                type="button"
                onClick={() => applyPresetWidth(180)}
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  width <= 220
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title="Small (25%)"
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => applyPresetWidth(360)}
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  width > 220 && width <= 440
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title="Medium (50%)"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => applyPresetWidth(540)}
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  width > 440 && width <= 620
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title="Large (75%)"
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => applyPresetWidth(760)}
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  width > 620
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title="Full Width (100%)"
              >
                100%
              </button>
            </div>

            {/* Alignment Options */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => updateAttributes({ alignment: 'left' })}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  alignment === 'left'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title="Align Left"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => updateAttributes({ alignment: 'center' })}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  alignment === 'center'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title="Align Center"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => updateAttributes({ alignment: 'right' })}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  alignment === 'right'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title="Align Right"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="w-[1px] h-4 bg-border/80 mx-0.5" />

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => deleteNode()}
              className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
              title="Delete image"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Live Size Badge during resizing */}
        {isResizing && (
          <div className="absolute top-3 right-3 bg-black/80 text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded-md z-40 backdrop-blur-sm pointer-events-none">
            {currentDisplayWidth}px
          </div>
        )}

        {/* The Image Element */}
        <img
          ref={imageRef}
          src={node.attrs.src}
          alt={node.attrs.alt || 'Note Image'}
          style={{ width: `${width}px`, maxWidth: '100%', height: 'auto' }}
          className="rounded-xl shadow-xs object-contain block select-none"
          draggable={false}
        />

        {/* Interactive Corner Resize Handles */}
        {(showControls || selected || isResizing) && (
          <>
            {/* Bottom-Right Handle */}
            <div
              onMouseDown={handleResizeStart('right')}
              onTouchStart={handleResizeStart('right')}
              style={{ touchAction: 'none' }}
              className="absolute -bottom-2.5 -right-2.5 w-6 h-6 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center cursor-se-resize hover:scale-125 active:scale-95 transition-transform z-30"
              title="Drag to resize"
            >
              <div className="w-2 h-2 border-r-2 border-b-2 border-current transform rotate-45" />
            </div>

            {/* Bottom-Left Handle */}
            <div
              onMouseDown={handleResizeStart('left')}
              onTouchStart={handleResizeStart('left')}
              style={{ touchAction: 'none' }}
              className="absolute -bottom-2.5 -left-2.5 w-6 h-6 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center cursor-sw-resize hover:scale-125 active:scale-95 transition-transform z-30"
              title="Drag to resize"
            >
              <div className="w-2 h-2 border-l-2 border-b-2 border-current transform -rotate-45" />
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  name: 'image',

  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 360,
        renderHTML: (attributes) => ({
          width: attributes.width,
        }),
      },
      alignment: {
        default: 'center',
        renderHTML: (attributes) => ({
          'data-alignment': attributes.alignment,
        }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

export default ResizableImage;
