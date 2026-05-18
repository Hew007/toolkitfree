import { useState, useCallback } from 'react';
import FileUploader from './FileUploader';
import FileList from './FileList';

interface ResizedFile {
  name: string;
  originalSize: number;
  newSize: number;
  dimensions: string;
  url: string;
  previewUrl: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const PRESETS: Record<string, { width: number; height: number; label: string }> = {
  custom: { width: 0, height: 0, label: 'Custom' },
  instagram_post: { width: 1080, height: 1080, label: 'Instagram Post (1080×1080)' },
  instagram_story: { width: 1080, height: 1920, label: 'Instagram Story (1080×1920)' },
  facebook_cover: { width: 820, height: 312, label: 'Facebook Cover (820×312)' },
  twitter_header: { width: 1500, height: 500, label: 'Twitter/X Header (1500×500)' },
  youtube_thumbnail: { width: 1280, height: 720, label: 'YouTube Thumbnail (1280×720)' },
  full_hd: { width: 1920, height: 1080, label: 'Full HD (1920×1080)' },
  hd: { width: 1280, height: 720, label: 'HD (1280×720)' },
  thumbnail: { width: 300, height: 300, label: 'Thumbnail (300×300)' },
};

export default function ImageResizer() {
  const [files, setFiles] = useState<File[]>([]);
  const [preset, setPreset] = useState('custom');
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [maintainRatio, setMaintainRatio] = useState(true);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [quality, setQuality] = useState(92);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ResizedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setResults([]);
    setError(null);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    if (value !== 'custom' && PRESETS[value]) {
      setWidth(PRESETS[value].width);
      setHeight(PRESETS[value].height);
    }
  };

  const handleWidthChange = (value: number) => {
    setWidth(value);
    if (maintainRatio && files.length > 0) {
      // Simple ratio won't be perfect without knowing original, but we keep it simple
    }
    setPreset('custom');
  };

  const handleHeightChange = (value: number) => {
    setHeight(value);
    setPreset('custom');
  };

  const resizeImage = (file: File): Promise<ResizedFile> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        let targetW = width;
        let targetH = height;

        if (maintainRatio && preset === 'custom') {
          const ratio = img.naturalWidth / img.naturalHeight;
          if (targetW / targetH > ratio) {
            targetW = Math.round(targetH * ratio);
          } else {
            targetH = Math.round(targetW / ratio);
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        if (format === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetW, targetH);
        }

        ctx.drawImage(img, 0, 0, targetW, targetH);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              reject(new Error('Resize failed'));
              return;
            }

            const ext = format === 'image/jpeg' ? '.jpg' : format === 'image/png' ? '.png' : '.webp';
            const baseName = file.name.replace(/\.[^.]+$/, '');
            const blobUrl = URL.createObjectURL(blob);

            resolve({
              name: baseName + ext,
              originalSize: file.size,
              newSize: blob.size,
              dimensions: `${targetW}×${targetH}`,
              url: blobUrl,
              previewUrl: blobUrl,
            });
          },
          format,
          format === 'image/png' ? undefined : quality / 100
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load image: ${file.name}`));
      };

      img.src = url;
    });
  };

  const handleResize = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setError(null);
    setResults([]);

    try {
      const resized = await Promise.all(files.map(resizeImage));
      setResults(resized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resize failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <FileUploader accept="image/*" multiple={true} onFilesSelected={handleFiles} />
      <FileList files={files} onRemove={handleRemove} />

      {files.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Preset</label>
              <select value={preset} onChange={(e) => handlePresetChange(e.target.value)} style={{ width: '100%' }}>
                {Object.entries(PRESETS).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Width (px)</label>
              <input type="number" value={width} onChange={(e) => handleWidthChange(Number(e.target.value))} min={1} max={10000}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.875rem' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Height (px)</label>
              <input type="number" value={height} onChange={(e) => handleHeightChange(Number(e.target.value))} min={1} max={10000}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.875rem' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} style={{ width: '100%' }}>
                <option value="image/jpeg">JPG</option>
                <option value="image/png">PNG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.875rem' }}>
              <input type="checkbox" checked={maintainRatio} onChange={(e) => setMaintainRatio(e.target.checked)} /> Maintain aspect ratio
            </label>
          </div>

          {format !== 'image/png' && (
            <div style={{ maxWidth: '300px', marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Quality: {quality}%</label>
              <input type="range" min="10" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
            </div>
          )}

          <button className="btn btn-primary" onClick={handleResize} disabled={processing}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
            {processing ? 'Resizing...' : `Resize ${files.length} image${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {error && <div className="status status-error">{error}</div>}

      {results.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Results</h3>
          {results.map((result, index) => (
            <div key={index} className="result-item">
              <div className="result-info">
                <img src={result.previewUrl} alt={result.name} className="result-preview" />
                <div>
                  <div className="file-item-name">{result.name}</div>
                  <div className="file-item-size">{result.dimensions} — {formatSize(result.newSize)}</div>
                </div>
              </div>
              <a href={result.url} download={result.name} className="btn btn-primary">Download</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
