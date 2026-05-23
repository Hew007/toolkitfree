import { useState, useCallback, useRef, useEffect } from 'react';
import FileUploader from './FileUploader';

interface CropResult {
  name: string;
  originalSize: number;
  newSize: number;
  dimensions: string;
  url: string;
  previewUrl: string;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AspectPreset {
  ratio: number | null;
  label: string;
}

const ASPECT_PRESETS: AspectPreset[] = [
  { ratio: null, label: 'Free' },
  { ratio: 1, label: '1:1' },
  { ratio: 16 / 9, label: '16:9' },
  { ratio: 4 / 3, label: '4:3' },
  { ratio: 3 / 2, label: '3:2' },
  { ratio: 9 / 16, label: '9:16' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

interface DragState {
  handle: DragHandle;
  startX: number;
  startY: number;
  startRect: CropRect;
}

export default function ImageCropper({ defaultAspectRatio }: { defaultAspectRatio?: number | null } = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [aspectRatio, setAspectRatio] = useState<number | null>(defaultAspectRatio ?? null);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/png');
  const [quality, setQuality] = useState(92);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CropResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [displayScale, setDisplayScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const handleFiles = useCallback((newFiles: File[]) => {
    const f = newFiles[0];
    setFile(f);
    setResult(null);
    setError(null);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(f);
    setImageUrl(url);
  }, [imageUrl]);

  const handleRemove = useCallback(() => {
    setFile(null);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setImgSize({ w: 0, h: 0 });
    setCropRect({ x: 0, y: 0, w: 0, h: 0 });
    setResult(null);
  }, [imageUrl]);

  // When image loads, set initial crop rect
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current) return;
    const nw = imageRef.current.naturalWidth;
    const nh = imageRef.current.naturalHeight;
    setImgSize({ w: nw, h: nh });

    // Compute display scale
    const container = containerRef.current;
    if (container) {
      const maxW = container.clientWidth;
      const scale = Math.min(1, maxW / nw);
      setDisplayScale(scale);
    }

    // Initialize crop rect: full image or aspect-ratio centered
    const ratio = aspectRatio;
    let cw: number, ch: number;
    if (ratio) {
      if (nw / nh > ratio) {
        ch = nh;
        cw = Math.round(ch * ratio);
      } else {
        cw = nw;
        ch = Math.round(cw / ratio);
      }
    } else {
      cw = nw;
      ch = nh;
    }
    setCropRect({
      x: Math.round((nw - cw) / 2),
      y: Math.round((nh - ch) / 2),
      w: cw,
      h: ch,
    });
  }, [aspectRatio]);

  // Re-apply aspect ratio when it changes
  useEffect(() => {
    if (!imgSize.w || !imgSize.h) return;
    const ratio = aspectRatio;
    const nw = imgSize.w;
    const nh = imgSize.h;
    let cw: number, ch: number;
    if (ratio) {
      if (nw / nh > ratio) {
        ch = nh;
        cw = Math.round(ch * ratio);
      } else {
        cw = nw;
        ch = Math.round(cw / ratio);
      }
    } else {
      cw = nw;
      ch = nh;
    }
    setCropRect({
      x: Math.round((nw - cw) / 2),
      y: Math.round((nh - ch) / 2),
      w: cw,
      h: ch,
    });
  }, [aspectRatio, imgSize]);

  // Mouse/touch drag handlers
  const getPointerPos = (e: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent) => {
    if ('touches' in e) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  };

  const handlePointerDown = (handle: DragHandle, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getPointerPos(e);
    dragRef.current = { handle, startX: pos.x, startY: pos.y, startRect: { ...cropRect } };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      ev.preventDefault();
      const p = getPointerPos(ev);
      const dx = (p.x - dragRef.current.startX) / displayScale;
      const dy = (p.y - dragRef.current.startY) / displayScale;
      const sr = dragRef.current.startRect;
      const nw = imgSize.w;
      const nh = imgSize.h;
      const ratio = aspectRatio;

      let newRect: CropRect = { ...sr };

      if (dragRef.current.handle === 'move') {
        newRect.x = Math.max(0, Math.min(nw - sr.w, sr.x + dx));
        newRect.y = Math.max(0, Math.min(nh - sr.h, sr.y + dy));
      } else {
        let { x, y, w, h } = sr;

        switch (dragRef.current.handle) {
          case 'nw':
            x = sr.x + dx; y = sr.y + dy; w = sr.w - dx; h = sr.h - dy;
            break;
          case 'ne':
            y = sr.y + dy; w = sr.w + dx; h = sr.h - dy;
            break;
          case 'sw':
            x = sr.x + dx; w = sr.w - dx; h = sr.h + dy;
            break;
          case 'se':
            w = sr.w + dx; h = sr.h + dy;
            break;
          case 'n':
            y = sr.y + dy; h = sr.h - dy;
            break;
          case 's':
            h = sr.h + dy;
            break;
          case 'w':
            x = sr.x + dx; w = sr.w - dx;
            break;
          case 'e':
            w = sr.w + dx;
            break;
        }

        if (ratio) {
          if (['n', 's'].includes(dragRef.current.handle!)) {
            w = h * ratio;
          } else if (['e', 'w'].includes(dragRef.current.handle!)) {
            h = w / ratio;
          } else {
            // Corner: use the larger delta to determine
            if (Math.abs(dx) > Math.abs(dy)) {
              h = w / ratio;
            } else {
              w = h * ratio;
            }
          }
          // Re-center for nw/ne/sw/se
          if (dragRef.current.handle === 'nw') {
            x = sr.x + sr.w - w;
            y = sr.y + sr.h - h;
          } else if (dragRef.current.handle === 'ne') {
            y = sr.y + sr.h - h;
          } else if (dragRef.current.handle === 'sw') {
            x = sr.x + sr.w - w;
          }
        }

        // Clamp minimum size
        if (w < 10) w = 10;
        if (h < 10) h = 10;

        // Clamp to image bounds
        if (x < 0) { w += x; x = 0; }
        if (y < 0) { h += y; y = 0; }
        if (x + w > nw) w = nw - x;
        if (y + h > nh) h = nh - y;

        newRect = { x, y, w, h };
      }

      setCropRect(newRect);
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove as EventListener);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove as EventListener);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove as EventListener);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove as EventListener, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  const handleCrop = async () => {
    if (!file || !imageUrl) return;

    setProcessing(true);
    setError(null);

    try {
      const img = new window.Image();
      img.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
      });

      const { x, y, w, h } = cropRect;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Crop failed'))),
          format,
          format === 'image/png' ? undefined : quality / 100
        );
      });

      const ext = format === 'image/jpeg' ? '.jpg' : format === 'image/png' ? '.png' : '.webp';
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const blobUrl = URL.createObjectURL(blob);

      setResult({
        name: baseName + '-cropped' + ext,
        originalSize: file.size,
        newSize: blob.size,
        dimensions: `${Math.round(w)}×${Math.round(h)}`,
        url: blobUrl,
        previewUrl: blobUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop failed');
    } finally {
      setProcessing(false);
    }
  };

  const d = displayScale;
  const cr = cropRect;

  return (
    <div>
      {!imageUrl ? (
        <FileUploader accept="image/*" multiple={false} onFilesSelected={handleFiles} />
      ) : (
        <div>
          {/* Crop area */}
          <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', marginBottom: '1rem', userSelect: 'none' }}>
            <img
              ref={imageRef}
              src={imageUrl}
              onLoad={handleImageLoad}
              alt="Crop preview"
              style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
              draggable={false}
            />
            {cr.w > 0 && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                {/* Dark overlay */}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <defs>
                    <mask id="crop-mask">
                      <rect width="100%" height="100%" fill="white" />
                      <rect x={cr.x * d} y={cr.y * d} width={cr.w * d} height={cr.h * d} fill="black" />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />
                </svg>

                {/* Crop box */}
                <div
                  style={{
                    position: 'absolute',
                    left: cr.x * d,
                    top: cr.y * d,
                    width: cr.w * d,
                    height: cr.h * d,
                    border: '2px solid #fff',
                    boxSizing: 'border-box',
                    cursor: 'move',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                  }}
                  onMouseDown={(e) => handlePointerDown('move', e)}
                  onTouchStart={(e) => handlePointerDown('move', e)}
                >
                  {/* Rule of thirds grid */}
                  <div style={{ position: 'absolute', left: '33.33%', top: 0, width: '1px', height: '100%', background: 'rgba(255,255,255,0.4)' }} />
                  <div style={{ position: 'absolute', left: '66.66%', top: 0, width: '1px', height: '100%', background: 'rgba(255,255,255,0.4)' }} />
                  <div style={{ position: 'absolute', top: '33.33%', left: 0, height: '1px', width: '100%', background: 'rgba(255,255,255,0.4)' }} />
                  <div style={{ position: 'absolute', top: '66.66%', left: 0, height: '1px', width: '100%', background: 'rgba(255,255,255,0.4)' }} />

                  {/* Corner handles */}
                  {(['nw', 'ne', 'sw', 'se'] as DragHandle[]).map((pos) => {
                    const posStyles: Record<string, React.CSSProperties> = {
                      nw: { top: -5, left: -5, cursor: 'nwse-resize' },
                      ne: { top: -5, right: -5, cursor: 'nesw-resize' },
                      sw: { bottom: -5, left: -5, cursor: 'nesw-resize' },
                      se: { bottom: -5, right: -5, cursor: 'nwse-resize' },
                    };
                    return (
                      <div
                        key={pos!}
                        onMouseDown={(e) => handlePointerDown(pos, e)}
                        onTouchStart={(e) => handlePointerDown(pos, e)}
                        style={{
                          position: 'absolute',
                          width: 10,
                          height: 10,
                          background: '#fff',
                          border: '2px solid #2563eb',
                          borderRadius: 2,
                          ...posStyles[pos!],
                        }}
                      />
                    );
                  })}

                  {/* Edge handles */}
                  {(['n', 's', 'e', 'w'] as DragHandle[]).map((pos) => {
                    const isVertical = pos === 'n' || pos === 's';
                    const posStyles: Record<string, React.CSSProperties> = {
                      n: { top: -4, left: '50%', marginLeft: -15, width: 30, height: 8, cursor: 'ns-resize' },
                      s: { bottom: -4, left: '50%', marginLeft: -15, width: 30, height: 8, cursor: 'ns-resize' },
                      e: { right: -4, top: '50%', marginTop: -15, width: 8, height: 30, cursor: 'ew-resize' },
                      w: { left: -4, top: '50%', marginTop: -15, width: 8, height: 30, cursor: 'ew-resize' },
                    };
                    return (
                      <div
                        key={pos!}
                        onMouseDown={(e) => handlePointerDown(pos, e)}
                        onTouchStart={(e) => handlePointerDown(pos, e)}
                        style={{
                          position: 'absolute',
                          background: 'rgba(255,255,255,0.8)',
                          border: '1px solid #2563eb',
                          borderRadius: 2,
                          ...posStyles[pos!],
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* File info + remove */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {file?.name} — {imgSize.w}×{imgSize.h} — {file ? formatSize(file.size) : ''}
              </span>
              <button onClick={handleRemove} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}>
                Remove
              </button>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Aspect Ratio</label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {ASPECT_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setAspectRatio(p.ratio)}
                    className="btn"
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.8125rem',
                      background: aspectRatio === p.ratio ? '#2563eb' : '#f3f4f6',
                      color: aspectRatio === p.ratio ? '#fff' : '#374151',
                      border: '1px solid ' + (aspectRatio === p.ratio ? '#2563eb' : '#e5e7eb'),
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} style={{ padding: '0.375rem', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>

            {format !== 'image/png' && (
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Quality: {quality}%</label>
                <input type="range" min="10" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} style={{ width: '120px' }} />
              </div>
            )}

            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginLeft: 'auto' }}>
              Crop: {Math.round(cr.w)}×{Math.round(cr.h)}
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleCrop} disabled={processing} style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
            {processing ? 'Cropping...' : 'Crop Image'}
          </button>
        </div>
      )}

      {error && <div className="status status-error">{error}</div>}

      {result && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Result</h3>
          <div className="result-item">
            <div className="result-info">
              <img src={result.previewUrl} alt={result.name} className="result-preview" />
              <div>
                <div className="file-item-name">{result.name}</div>
                <div className="file-item-size">{result.dimensions} — {formatSize(result.newSize)}</div>
              </div>
            </div>
            <a href={result.url} download={result.name} className="btn btn-primary">Download</a>
          </div>
        </div>
      )}
    </div>
  );
}
