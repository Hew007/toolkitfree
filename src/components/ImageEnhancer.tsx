import { useState, useCallback, useRef, useEffect } from 'react';
import FileUploader from './FileUploader';

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function applySharpen(imageData: ImageData, strength: number): ImageData {
  const { data, width, height } = imageData;
  const output = new ImageData(new Uint8ClampedArray(data.length), width, height);
  const src = data;
  const dst = output.data;
  const w = width;
  const s = strength / 100;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = src[i + c];
        const neighbors = src[i - w + c] + src[i + w + c] + src[i - 1 + c] + src[i + 1 + c];
        const sharpened = center * 5 - neighbors;
        dst[i + c] = clamp(center + (sharpened - center) * s);
      }
      dst[i + 3] = src[i + 3];
    }
  }

  // Copy border pixels unchanged
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      dst[x * 4 + c] = src[x * 4 + c];
      dst[((height - 1) * w + x) * 4 + c] = src[((height - 1) * w + x) * 4 + c];
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (let c = 0; c < 4; c++) {
      dst[(y * w) * 4 + c] = src[(y * w) * 4 + c];
      dst[(y * w + w - 1) * 4 + c] = src[(y * w + w - 1) * 4 + c];
    }
  }

  return output;
}

export default function ImageEnhancer() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [blur, setBlur] = useState(0);
  const [grayscale, setGrayscale] = useState(false);
  const [format, setFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [quality, setQuality] = useState(92);
  const [downloading, setDownloading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);

  const handleFiles = useCallback((newFiles: File[]) => {
    const f = newFiles[0];
    setFile(f);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(f);
    setImageUrl(url);

    const img = new window.Image();
    img.onload = () => {
      sourceRef.current = img;
    };
    img.src = url;
  }, [imageUrl]);

  const handleRemove = useCallback(() => {
    setFile(null);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    sourceRef.current = null;
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setSharpness(0);
    setBlur(0);
    setGrayscale(false);
  }, [imageUrl]);

  const renderToCanvas = useCallback((
    targetCanvas: HTMLCanvasElement,
    source: HTMLImageElement,
    opts: { brightness: number; contrast: number; saturation: number; sharpness: number; blur: number; grayscale: boolean },
    maxWidth?: number
  ) => {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const nw = source.naturalWidth;
    const nh = source.naturalHeight;

    let drawW = nw;
    let drawH = nh;
    if (maxWidth && nw > maxWidth) {
      drawW = maxWidth;
      drawH = Math.round(nh * maxWidth / nw);
    }

    targetCanvas.width = drawW;
    targetCanvas.height = drawH;

    const filters = [
      `brightness(${1 + opts.brightness / 100})`,
      `contrast(${1 + opts.contrast / 100})`,
      `saturate(${1 + opts.saturation / 100})`,
      opts.grayscale ? 'grayscale(1)' : '',
      opts.blur > 0 ? `blur(${opts.blur}px)` : '',
    ].filter(Boolean).join(' ');

    ctx.filter = filters;
    ctx.drawImage(source, 0, 0, drawW, drawH);
    ctx.filter = 'none';

    if (opts.sharpness > 0) {
      const imageData = ctx.getImageData(0, 0, drawW, drawH);
      const sharpened = applySharpen(imageData, opts.sharpness);
      ctx.putImageData(sharpened, 0, 0);
    }
  }, []);

  useEffect(() => {
    if (!imageUrl || !sourceRef.current) return;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const source = sourceRef.current;
      if (!canvas || !source) return;

      const container = canvas.parentElement;
      const maxWidth = container ? container.clientWidth : undefined;

      renderToCanvas(canvas, source, { brightness, contrast, saturation, sharpness, blur, grayscale }, maxWidth);
    });

    return () => cancelAnimationFrame(rafRef.current);
  }, [imageUrl, brightness, contrast, saturation, sharpness, blur, grayscale, renderToCanvas]);

  const handleDownload = useCallback(async () => {
    const source = sourceRef.current;
    if (!source || !file) return;

    setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      renderToCanvas(canvas, source, { brightness, contrast, saturation, sharpness, blur, grayscale });

      const ext = format === 'image/jpeg' ? '.jpg' : format === 'image/png' ? '.png' : '.webp';
      const baseName = file.name.replace(/\.[^.]+$/, '');

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
          format,
          format === 'image/png' ? undefined : quality / 100
        );
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = baseName + '-enhanced' + ext;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }, [file, brightness, contrast, saturation, sharpness, blur, grayscale, format, quality, renderToCanvas]);

  const isModified = brightness !== 0 || contrast !== 0 || saturation !== 0 || sharpness !== 0 || blur !== 0 || grayscale;

  return (
    <div>
      {!imageUrl ? (
        <FileUploader accept="image/*" multiple={false} onFilesSelected={handleFiles} />
      ) : (
        <div>
          {/* Preview */}
          <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <canvas
              ref={canvasRef}
              style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb' }}
            />
          </div>

          {/* File info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {file?.name} — {file ? formatSize(file.size) : ''}
            </span>
            <button onClick={handleRemove} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}>
              Remove
            </button>
          </div>

          {/* Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <SliderControl label="Brightness" value={brightness} min={-100} max={100} onChange={setBrightness} />
            <SliderControl label="Saturation" value={saturation} min={-100} max={100} onChange={setSaturation} />
            <SliderControl label="Contrast" value={contrast} min={-100} max={100} onChange={setContrast} />
            <SliderControl label="Sharpness" value={sharpness} min={0} max={100} onChange={setSharpness} />
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Grayscale</label>
              <button
                onClick={() => setGrayscale(!grayscale)}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  background: grayscale ? '#2563eb' : '#f3f4f6',
                  color: grayscale ? '#fff' : '#374151',
                  border: '1px solid ' + (grayscale ? '#2563eb' : '#e5e7eb'),
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {grayscale ? 'On' : 'Off'}
              </button>
            </div>
            <SliderControl label="Blur" value={blur} min={0} max={20} onChange={setBlur} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn"
              onClick={() => { setBrightness(0); setContrast(0); setSaturation(0); setSharpness(0); setBlur(0); setGrayscale(false); }}
              disabled={!isModified}
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '0.9375rem',
                background: isModified ? '#f3f4f6' : '#f9fafb',
                color: isModified ? '#374151' : '#9ca3af',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: isModified ? 'pointer' : 'default',
              }}
            >
              Reset All
            </button>

            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              style={{ padding: '0.625rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.875rem' }}
            >
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WebP</option>
            </select>

            {format !== 'image/png' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Quality:</span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  style={{ width: '100px' }}
                />
                <span style={{ fontSize: '0.875rem', color: '#374151', minWidth: '2.5rem' }}>{quality}%</span>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleDownload}
              disabled={downloading}
              style={{ marginLeft: 'auto', padding: '0.625rem 1.5rem', fontSize: '0.9375rem' }}
            >
              {downloading ? 'Processing...' : 'Download'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SliderControl({ label, value, min, max, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8125rem', color: '#6b7280', minWidth: '2.5rem', textAlign: 'right' }}>
            {value > 0 ? `+${value}` : value}
          </span>
          {value !== min && (
            <button
              onClick={() => onChange(min)}
              style={{
                background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
                fontSize: '0.75rem', padding: 0, lineHeight: 1,
              }}
              title="Reset"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}
