import { useState, useCallback, useRef } from 'react';
import FileUploader from './FileUploader';

interface ProcessedFile {
  name: string;
  size: number;
  url: string;
  previewUrl: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function BackgroundRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ProcessedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState('transparent');
  const objectUrlRef = useRef<string | null>(null);

  const handleFiles = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleRemove = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    setFile(null);
    setResult(null);
    setError(null);
  }, []);

  const removeBackground = async () => {
    if (!file) return;

    setProcessing(true);
    setError(null);
    setProgress('Loading AI model...');

    try {
      // Dynamically import the background removal library
      const { removeBackground: removeBg } = await import('@imgly/background-removal');

      setProgress('Processing image...');

      const blob = await removeBg(file, {
        progress: (key: string, current: number, total: number) => {
          if (key === 'compute:inference') {
            setProgress(`AI processing: ${Math.round((current / total) * 100)}%`);
          } else if (key === 'fetch:model') {
            setProgress(`Downloading model: ${Math.round((current / total) * 100)}%`);
          }
        },
      });

      // Apply background color if not transparent
      let finalBlob = blob;
      if (bgColor !== 'transparent') {
        const img = new Image();
        const tempUrl = URL.createObjectURL(blob);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = tempUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          finalBlob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b || blob), 'image/png');
          }) || blob;
        }
        URL.revokeObjectURL(tempUrl);
      }

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const url = URL.createObjectURL(finalBlob);
      objectUrlRef.current = url;

      const baseName = file.name.replace(/\.[^.]+$/, '');
      setResult({
        name: baseName + '_no_bg.png',
        size: finalBlob.size,
        url,
        previewUrl: url,
      });
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Background removal failed');
      setProgress('');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      {!file ? (
        <FileUploader accept="image/*" multiple={false} onFilesSelected={handleFiles} />
      ) : (
        <>
          <div className="file-item" style={{ marginBottom: '1rem' }}>
            <span className="file-item-name">{file.name}</span>
            <span className="file-item-size">{formatSize(file.size)}</span>
            <button className="file-item-remove" onClick={handleRemove}>×</button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>
              Background Color
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { value: 'transparent', label: 'Transparent', color: '#fff', border: true },
                { value: '#ffffff', label: 'White', color: '#ffffff' },
                { value: '#ff0000', label: 'Red', color: '#ff0000' },
                { value: '#0000ff', label: 'Blue', color: '#0000ff' },
                { value: '#008000', label: 'Green', color: '#008000' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setBgColor(opt.value)}
                  style={{
                    padding: '0.375rem 1rem',
                    borderRadius: '6px',
                    border: bgColor === opt.value ? '2px solid #2563eb' : `1px solid #e5e7eb`,
                    background: opt.color,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    color: opt.value === '#000000' || opt.value === '#0000ff' || opt.value === '#008000' || opt.value === '#ff0000' ? 'white' : '#1f2937',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={removeBackground}
            disabled={processing}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
          >
            {processing ? 'Processing...' : 'Remove Background'}
          </button>
        </>
      )}

      {progress && <div className="status status-processing">{progress}</div>}
      {error && <div className="status status-error">{error}</div>}

      {result && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Result</h3>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            {file && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Original</div>
                <img src={URL.createObjectURL(file)} alt="Original" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '4px', border: '1px solid #e5e7eb' }} />
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Result</div>
              <img
                src={result.previewUrl}
                alt="Result"
                style={{
                  maxWidth: '200px',
                  maxHeight: '200px',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                  backgroundImage: bgColor === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : undefined,
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              />
            </div>
          </div>
          <div className="result-item">
            <div className="result-info">
              <div>
                <div className="file-item-name">{result.name}</div>
                <div className="file-item-size">{formatSize(result.size)}</div>
              </div>
            </div>
            <a href={result.url} download={result.name} className="btn btn-primary">Download</a>
          </div>
        </div>
      )}
    </div>
  );
}
