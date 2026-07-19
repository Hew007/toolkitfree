import { useEffect, useRef, useState } from 'react';
import type { CropRect, SourceSize } from '../lib/id-photo';

interface IdPhotoEditorProps {
  imageUrl: string;
  source: SourceSize;
  crop: CropRect;
  ratio: number;
  headHeightRange: { minRatio: number; maxRatio: number } | null;
  onCropChange: (crop: CropRect) => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  crop: CropRect;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function boundedCrop(crop: CropRect, source: SourceSize): CropRect {
  const width = clamp(crop.width, 1, source.width);
  const height = clamp(crop.height, 1, source.height);
  return {
    width,
    height,
    x: clamp(crop.x, 0, source.width - width),
    y: clamp(crop.y, 0, source.height - height),
  };
}

export default function IdPhotoEditor({
  imageUrl,
  source,
  crop,
  ratio,
  headHeightRange,
  onCropChange,
}: IdPhotoEditorProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [display, setDisplay] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => setDisplay({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const zoom = (multiplier: number) => {
    const width = clamp(crop.width * multiplier, 1, source.width);
    const height = width / ratio;
    const safeHeight = height > source.height ? source.height : height;
    const safeWidth = safeHeight * ratio;
    onCropChange(
      boundedCrop(
        {
          width: safeWidth,
          height: safeHeight,
          x: crop.x + (crop.width - safeWidth) / 2,
          y: crop.y + (crop.height - safeHeight) / 2,
        },
        source
      )
    );
  };

  const move = (x: number, y: number) => onCropChange(boundedCrop({ ...crop, x, y }, source));

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      crop,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || display.width <= 0 || display.height <= 0)
      return;
    const sourcePerDisplayX = drag.crop.width / display.width;
    const sourcePerDisplayY = drag.crop.height / display.height;
    move(
      drag.crop.x - (event.clientX - drag.startX) * sourcePerDisplayX,
      drag.crop.y - (event.clientY - drag.startY) * sourcePerDisplayY
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey
      ? Math.max(10, Math.round(crop.width / 20))
      : Math.max(1, Math.round(crop.width / 100));
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoom(0.9);
      return;
    }
    if (event.key === '-') {
      event.preventDefault();
      zoom(1.1);
      return;
    }
    const direction = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    move(crop.x + direction[0], crop.y + direction[1]);
  };

  const headGuideHeight = headHeightRange
    ? (headHeightRange.minRatio + headHeightRange.maxRatio) / 2
    : null;

  return (
    <section aria-label="Photo positioning" style={{ marginBottom: '1.5rem' }}>
      {/* The 2D positioning region is intentionally keyboard focusable as one composite control. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={viewportRef}
        data-testid="id-photo-editor"
        role="group"
        aria-label="Position the photo. Use arrow keys to move it; use plus and minus to zoom."
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        style={{
          position: 'relative',
          width: 'min(100%, 420px)',
          aspectRatio: `${ratio}`,
          overflow: 'hidden',
          background: '#e5e7eb',
          border: '2px solid #111827',
          borderRadius: '8px',
          cursor: 'grab',
          touchAction: 'none',
          outlineOffset: '3px',
        }}
      >
        <img
          src={imageUrl}
          alt="Original positioned for the selected ID size"
          draggable={false}
          style={{
            position: 'absolute',
            width: `${(source.width / crop.width) * 100}%`,
            height: `${(source.height / crop.height) * 100}%`,
            maxWidth: 'none',
            left: `${(-crop.x / crop.width) * 100}%`,
            top: `${(-crop.y / crop.height) * 100}%`,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              borderLeft: '1px dashed rgba(255,255,255,.9)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              borderTop: '1px dashed rgba(255,255,255,.9)',
            }}
          />
          {headGuideHeight && (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: '15%',
                  left: 0,
                  right: 0,
                  borderTop: '2px solid rgba(251,191,36,.95)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: `${15 + headGuideHeight * 100}%`,
                  left: 0,
                  right: 0,
                  borderTop: '2px solid rgba(251,191,36,.95)',
                }}
              />
            </>
          )}
        </div>
      </div>
      <p
        id="id-photo-position-help"
        style={{ margin: '0.6rem 0 0', color: '#4b5563', fontSize: '0.875rem' }}
      >
        Drag to position. Use the buttons or + / − keys to zoom; arrow keys move the photo. The
        centre and amber lines are manual framing guides, not face detection.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={() => zoom(1.1)}>
          Zoom out
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => zoom(0.9)}>
          Zoom in
        </button>
      </div>
    </section>
  );
}
