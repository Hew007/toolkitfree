import { useState, useCallback } from 'react';
import FileUploader from './FileUploader';
import FileList from './FileList';
import DownloadResult from './DownloadResult';

type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

interface ConvertedFile {
  name: string;
  size: number;
  url: string;
  previewUrl: string;
}

const FORMAT_LABELS: Record<OutputFormat, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
};

const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ImageConverter() {
  const [files, setFiles] = useState<File[]>([]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/png');
  const [quality, setQuality] = useState(92);
  const [converting, setConverting] = useState(false);
  const [results, setResults] = useState<ConvertedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setResults([]);
    setError(null);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const convertImage = (file: File, format: OutputFormat, quality: number): Promise<ConvertedFile> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Fill white background for JPEG (no transparency)
        if (format === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              reject(new Error('Conversion failed'));
              return;
            }

            const ext = FORMAT_EXTENSIONS[format];
            const baseName = file.name.replace(/\.[^.]+$/, '');
            const newName = baseName + ext;
            const blobUrl = URL.createObjectURL(blob);

            resolve({
              name: newName,
              size: blob.size,
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

  const handleConvert = async () => {
    if (files.length === 0) return;

    setConverting(true);
    setError(null);
    setResults([]);

    try {
      const converted = await Promise.all(
        files.map((file) => convertImage(file, outputFormat, quality))
      );
      setResults(converted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const handleDownloadAll = () => {
    results.forEach((result) => {
      const a = document.createElement('a');
      a.href = result.url;
      a.download = result.name;
      a.click();
    });
  };

  const totalOriginalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalConvertedSize = results.reduce((sum, r) => sum + r.size, 0);

  return (
    <div>
      <FileUploader
        accept="image/*"
        multiple={true}
        onFilesSelected={handleFiles}
      />

      <FileList files={files} onRemove={handleRemove} />

      {files.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                Output Format
              </label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
              >
                {Object.entries(FORMAT_LABELS).map(([mime, label]) => (
                  <option key={mime} value={mime}>{label}</option>
                ))}
              </select>
            </div>

            {outputFormat !== 'image/png' && (
              <div style={{ minWidth: '200px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Quality: {quality}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleConvert}
            disabled={converting}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
          >
            {converting ? 'Converting...' : `Convert ${files.length} image${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {error && (
        <div className="status status-error">{error}</div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem' }}>
              Results
              {totalOriginalSize > 0 && (
                <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
                  {formatSize(totalOriginalSize)} → {formatSize(totalConvertedSize)}
                  {totalConvertedSize < totalOriginalSize && (
                    <span style={{ color: '#10b981' }}>
                      {' '}(-{Math.round((1 - totalConvertedSize / totalOriginalSize) * 100)}%)
                    </span>
                  )}
                </span>
              )}
            </h3>
            {results.length > 1 && (
              <button className="btn btn-secondary" onClick={handleDownloadAll}>
                Download All
              </button>
            )}
          </div>
          {results.map((result, index) => (
            <DownloadResult key={index} {...result} />
          ))}
        </div>
      )}
    </div>
  );
}
