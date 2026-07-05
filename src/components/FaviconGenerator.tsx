import { useState, useCallback } from 'react';
import FileUploader from './FileUploader';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  downloadUrl,
  exportCanvas,
  formatSize,
  getCanvas2dContext,
  getImageProcessingErrorMessage,
  loadImage,
  validateImageFile,
} from '../lib/image-processing';
import { calculateSquareContainRect } from '../lib/favicon';

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

export default function FaviconGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [icons, setIcons] = useState<GeneratedIcon[]>([]);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [zipSize, setZipSize] = useState(0);
  const objectUrls = useObjectUrlRegistry();

  const clearGeneratedUrls = useCallback(() => {
    objectUrls.revokePrefix('icon:');
    objectUrls.revoke('zip');
  }, [objectUrls]);

  const handleFiles = useCallback(
    (newFiles: File[]) => {
      const f = newFiles[0];
      if (!f) return;

      try {
        validateImageFile(f);
        clearGeneratedUrls();
        setFile(f);
        setIcons([]);
        setZipUrl(null);
        setZipSize(0);
        setError(null);
        setPreviewUrl(objectUrls.replace('preview', f));
      } catch (err) {
        setError(getImageProcessingErrorMessage(err));
      }
    },
    [clearGeneratedUrls, objectUrls]
  );

  const handleRemove = useCallback(() => {
    objectUrls.revokeAll();
    setFile(null);
    setPreviewUrl(null);
    setIcons([]);
    setZipUrl(null);
    setZipSize(0);
    setError(null);
  }, [objectUrls]);

  const generateFavicons = async () => {
    if (!file) return;

    setProcessing(true);
    setError(null);
    setIcons([]);
    setZipUrl(null);
    setZipSize(0);
    clearGeneratedUrls();

    try {
      const img = await loadImage(file);

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const generated: GeneratedIcon[] = [];

      for (const icon of ICON_SIZES) {
        const canvas = document.createElement('canvas');
        canvas.width = icon.size;
        canvas.height = icon.size;
        const ctx = getCanvas2dContext(canvas);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, icon.size, icon.size);
        const placement = calculateSquareContainRect(
          img.naturalWidth,
          img.naturalHeight,
          icon.size
        );
        ctx.drawImage(img, placement.x, placement.y, placement.width, placement.height);

        const blob = await exportCanvas(canvas, 'image/png');

        zip.file(icon.name, blob);
        generated.push({
          name: icon.name,
          size: icon.size,
          url: objectUrls.replace(`icon:${icon.name}`, blob),
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
      setZipUrl(objectUrls.replace('zip', zipBlob));
      setZipSize(zipBlob.size);
      setIcons(generated);
    } catch (err) {
      clearGeneratedUrls();
      setError(getImageProcessingErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadZip = () => {
    if (!zipUrl) return;
    try {
      downloadUrl(zipUrl, 'favicons.zip');
    } catch (err) {
      setError(getImageProcessingErrorMessage(err));
    }
  };

  const htmlSnippet = `<!-- Favicon -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;

  return (
    <div data-favicon-output="png-only" aria-busy={processing}>
      {!file ? (
        <FileUploader
          accept="image/jpeg,image/png,image/webp"
          multiple={false}
          budgetProfile="favicon"
          onFilesSelected={handleFiles}
        />
      ) : (
        <div>
          {/* Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Source"
                style={{
                  width: 80,
                  height: 80,
                  objectFit: 'contain',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                }}
              />
            )}
            <div>
              <div style={{ fontWeight: 500 }}>{file.name}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{formatSize(file.size)}</div>
            </div>
            <button
              onClick={handleRemove}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Remove
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={generateFavicons}
            disabled={processing}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
          >
            {processing ? 'Generating...' : 'Generate Favicons'}
          </button>
          <p style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.8125rem' }}>
            Non-square images are centered with transparent padding. This tool creates PNG icons,
            not an .ico file.
          </p>
        </div>
      )}

      {processing && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Generating favicon files.
        </div>
      )}
      {error && (
        <div className="status status-error" role="alert">
          {error}
        </div>
      )}

      {icons.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Generated Icons</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            {icons.map((icon) => (
              <div
                key={icon.name}
                data-favicon-icon={icon.name}
                data-size={icon.size}
                style={{ textAlign: 'center' }}
              >
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
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {icon.size}x{icon.size}
                </div>
              </div>
            ))}
          </div>

          {zipUrl && (
            <div
              className="result-item"
              data-favicon-zip-url={zipUrl}
              style={{ marginBottom: '1rem' }}
            >
              <div className="result-info">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    background: '#dbeafe',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                  }}
                >
                  {' '}
                </div>
                <div>
                  <div className="file-item-name">favicons.zip</div>
                  <div className="file-item-size">
                    {formatSize(zipSize)} — {icons.length} icons + webmanifest
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleDownloadZip}>
                Download ZIP
              </button>
            </div>
          )}

          {/* HTML snippet */}
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>HTML Code</h3>
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Add this to your <code>&lt;head&gt;</code> section:
            </p>
            <pre
              style={{
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '1rem',
                fontSize: '0.8125rem',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
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
