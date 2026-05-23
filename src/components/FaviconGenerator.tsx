import { useState, useCallback } from 'react';
import FileUploader from './FileUploader';

interface GeneratedIcon {
  name: string;
  size: number;
  url: string;
}

const ICON_SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function FaviconGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [icons, setIcons] = useState<GeneratedIcon[]>([]);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [zipSize, setZipSize] = useState(0);

  const handleFiles = useCallback((newFiles: File[]) => {
    const f = newFiles[0];
    setFile(f);
    setIcons([]);
    setZipUrl(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }, [previewUrl]);

  const handleRemove = useCallback(() => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setIcons([]);
    setZipUrl(null);
  }, [previewUrl]);

  const generateFavicons = async () => {
    if (!file) return;

    setProcessing(true);
    setError(null);
    setIcons([]);
    setZipUrl(null);

    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => { URL.revokeObjectURL(url); resolve(); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
        img.src = url;
      });

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const generated: GeneratedIcon[] = [];

      for (const icon of ICON_SIZES) {
        const canvas = document.createElement('canvas');
        canvas.width = icon.size;
        canvas.height = icon.size;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, icon.size, icon.size);

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to generate'))), 'image/png');
        });

        zip.file(icon.name, blob);
        generated.push({
          name: icon.name,
          size: icon.size,
          url: URL.createObjectURL(blob),
        });
      }

      // Generate site.webmanifest
      const manifest = {
        name: 'My Site',
        icons: [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
      };
      zip.file('site.webmanifest', JSON.stringify(manifest, null, 2));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      setZipUrl(URL.createObjectURL(zipBlob));
      setZipSize(zipBlob.size);
      setIcons(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setProcessing(false);
    }
  };

  const htmlSnippet = `<!-- Favicon -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;

  return (
    <div>
      {!file ? (
        <FileUploader accept="image/*" multiple={false} onFilesSelected={handleFiles} />
      ) : (
        <div>
          {/* Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            {previewUrl && (
              <img src={previewUrl} alt="Source" style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 8 }} />
            )}
            <div>
              <div style={{ fontWeight: 500 }}>{file.name}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{formatSize(file.size)}</div>
            </div>
            <button onClick={handleRemove} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}>
              Remove
            </button>
          </div>

          <button className="btn btn-primary" onClick={generateFavicons} disabled={processing} style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
            {processing ? 'Generating...' : 'Generate Favicons'}
          </button>
        </div>
      )}

      {error && <div className="status status-error">{error}</div>}

      {icons.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Generated Icons</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            {icons.map((icon) => (
              <div key={icon.name} style={{ textAlign: 'center' }}>
                <img
                  src={icon.url}
                  alt={icon.name}
                  style={{
                    width: Math.min(icon.size, 80),
                    height: Math.min(icon.size, 80),
                    objectFit: 'contain',
                    border: '1px solid #e5e7eb',
                    borderRadius: 4,
                    imageRendering: icon.size <= 32 ? 'pixelated' : 'auto',
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>{icon.size}x{icon.size}</div>
              </div>
            ))}
          </div>

          {zipUrl && (
            <div className="result-item" style={{ marginBottom: '1rem' }}>
              <div className="result-info">
                <div style={{ width: 48, height: 48, background: '#dbeafe', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}> </div>
                <div>
                  <div className="file-item-name">favicons.zip</div>
                  <div className="file-item-size">{formatSize(zipSize)} — {icons.length} icons + webmanifest</div>
                </div>
              </div>
              <a href={zipUrl} download="favicons.zip" className="btn btn-primary">Download ZIP</a>
            </div>
          )}

          {/* HTML snippet */}
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>HTML Code</h3>
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Add this to your <code>&lt;head&gt;</code> section:
            </p>
            <pre style={{
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '1rem',
              fontSize: '0.8125rem',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {htmlSnippet}
            </pre>
            <button
              className="btn btn-secondary"
              onClick={() => navigator.clipboard.writeText(htmlSnippet)}
              style={{ marginTop: '0.5rem', fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
            >
              Copy HTML
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
