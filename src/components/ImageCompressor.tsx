import { useState, useCallback } from 'react';
import FileUploader from './FileUploader';
import FileList from './FileList';

interface CompressedFile {
  name: string;
  originalSize: number;
  compressedSize: number;
  url: string;
  previewUrl: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ImageCompressor() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(80);
  const [maxWidth, setMaxWidth] = useState(0);
  const [compressing, setCompressing] = useState(false);
  const [results, setResults] = useState<CompressedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setResults([]);
    setError(null);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const compressImage = (file: File): Promise<CompressedFile> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (maxWidth > 0 && width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const isPng = file.type === 'image/png';
        const format = isPng ? 'image/png' : 'image/jpeg';

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              reject(new Error('Compression failed'));
              return;
            }

            const blobUrl = URL.createObjectURL(blob);
            resolve({
              name: file.name,
              originalSize: file.size,
              compressedSize: blob.size,
              url: blobUrl,
              previewUrl: blobUrl,
            });
          },
          format,
          isPng ? undefined : quality / 100
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load image: ${file.name}`));
      };

      img.src = url;
    });
  };

  const handleCompress = async () => {
    if (files.length === 0) return;

    setCompressing(true);
    setError(null);
    setResults([]);

    try {
      const compressed = await Promise.all(files.map(compressImage));
      setResults(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed');
    } finally {
      setCompressing(false);
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

  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0);

  return (
    <div>
      <FileUploader accept="image/*" multiple={true} onFilesSelected={handleFiles} />
      <FileList files={files} onRemove={handleRemove} />

      {files.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
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
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                Lower = smaller file, higher = better quality
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                Max Width (px)
              </label>
              <select
                value={maxWidth}
                onChange={(e) => setMaxWidth(Number(e.target.value))}
              >
                <option value={0}>Original</option>
                <option value={3840}>3840 (4K)</option>
                <option value={1920}>1920 (Full HD)</option>
                <option value={1280}>1280 (HD)</option>
                <option value={800}>800</option>
                <option value={400}>400</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleCompress}
            disabled={compressing}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
          >
            {compressing ? 'Compressing...' : `Compress ${files.length} image${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {error && <div className="status status-error">{error}</div>}

      {results.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem' }}>
              Results
              {totalOriginal > 0 && (
                <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
                  {formatSize(totalOriginal)} → {formatSize(totalCompressed)}
                  <span style={{ color: '#10b981' }}>
                    {' '}(-{Math.round((1 - totalCompressed / totalOriginal) * 100)}%)
                  </span>
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
            <div key={index} className="result-item">
              <div className="result-info">
                <img src={result.previewUrl} alt={result.name} className="result-preview" />
                <div>
                  <div className="file-item-name">{result.name}</div>
                  <div className="file-item-size">
                    {formatSize(result.originalSize)} → {formatSize(result.compressedSize)}
                    <span style={{ color: '#10b981' }}>
                      {' '}(-{Math.round((1 - result.compressedSize / result.originalSize) * 100)}%)
                    </span>
                  </div>
                </div>
              </div>
              <a href={result.url} download={result.name} className="btn btn-primary">
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
