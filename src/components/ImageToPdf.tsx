import { useState, useCallback } from 'react';
import FileUploader from './FileUploader';
import FileList from './FileList';

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

type PageSize = 'a4' | 'letter' | 'fit';
type Orientation = 'portrait' | 'landscape';

const PAGE_SIZES: Record<string, { w: number; h: number; label: string }> = {
  a4: { w: 210, h: 297, label: 'A4 (210×297mm)' },
  letter: { w: 215.9, h: 279.4, label: 'Letter (8.5×11")' },
};

export default function ImageToPdf({ defaultFormat }: { defaultFormat?: string } = {}) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [margin, setMargin] = useState(10);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);

  const handleFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => {
      const combined = [...prev, ...newFiles];
      // Generate previews for new files
      newFiles.forEach((f) => {
        const url = URL.createObjectURL(f);
        setPreviews((p) => [...p, url]);
      });
      return combined;
    });
    setResultUrl(null);
    setError(null);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      if (prev[index]) URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleConvert = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setError(null);
    setResultUrl(null);

    try {
      const { jsPDF } = await import('jspdf');

      const isLandscape = orientation === 'landscape';
      let doc: InstanceType<typeof jsPDF>;

      if (pageSize === 'fit') {
        // Create doc based on first image size, will add pages for each
        const firstImg = await loadImage(files[0]);
        const isLand = firstImg.width > firstImg.height;
        doc = new jsPDF({ orientation: isLand ? 'landscape' : 'portrait', unit: 'mm', format: [pxToMm(firstImg.width), pxToMm(firstImg.height)] });
      } else {
        const size = PAGE_SIZES[pageSize];
        doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: [size.w, size.h] });
      }

      for (let i = 0; i < files.length; i++) {
        if (i > 0) {
          if (pageSize === 'fit') {
            const img = await loadImage(files[i]);
            const isLand = img.width > img.height;
            doc.addPage([pxToMm(img.width), pxToMm(img.height)], isLand ? 'landscape' : 'portrait');
          } else {
            const size = PAGE_SIZES[pageSize];
            doc.addPage([size.w, size.h], isLandscape ? 'landscape' : 'portrait');
          }
        }

        const img = await loadImage(files[i]);
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const m = pageSize === 'fit' ? 0 : margin;

        const availW = pageWidth - m * 2;
        const availH = pageHeight - m * 2;

        const imgRatio = img.width / img.height;
        let drawW: number, drawH: number;

        if (availW / availH > imgRatio) {
          drawH = availH;
          drawW = drawH * imgRatio;
        } else {
          drawW = availW;
          drawH = drawW / imgRatio;
        }

        const x = m + (availW - drawW) / 2;
        const y = m + (availH - drawH) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

        doc.addImage(dataUrl, 'JPEG', x, y, drawW, drawH);
      }

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultSize(blob.size);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setProcessing(false);
    }
  };

  function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Failed to load: ${file.name}`)); };
      img.src = url;
    });
  }

  function pxToMm(px: number): number {
    return px * 0.264583;
  }

  return (
    <div>
      <FileUploader accept="image/*" multiple={true} onFilesSelected={handleFiles} />
      <FileList files={files} onRemove={handleRemove} />

      {files.length > 0 && !resultUrl && (
        <div style={{ marginTop: '1.5rem' }}>
          {/* Preview thumbnails */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {previews.map((src, i) => (
              <img key={i} src={src} alt={files[i]?.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Page Size</label>
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSize)} style={{ width: '100%' }}>
                <option value="a4">{PAGE_SIZES.a4.label}</option>
                <option value="letter">{PAGE_SIZES.letter.label}</option>
                <option value="fit">Fit to Image</option>
              </select>
            </div>

            {pageSize !== 'fit' && (
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Orientation</label>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)} style={{ width: '100%' }}>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            )}

            {pageSize !== 'fit' && (
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Margin: {margin}mm</label>
                <input type="range" min="0" max="30" value={margin} onChange={(e) => setMargin(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            )}
          </div>

          <button className="btn btn-primary" onClick={handleConvert} disabled={processing} style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
            {processing ? 'Converting...' : `Convert ${files.length} image${files.length > 1 ? 's' : ''} to PDF`}
          </button>
        </div>
      )}

      {error && <div className="status status-error">{error}</div>}

      {resultUrl && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Result</h3>
          <div className="result-item">
            <div className="result-info">
              <div style={{ width: 48, height: 48, background: '#fef3c7', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📄</div>
              <div>
                <div className="file-item-name">converted-images.pdf</div>
                <div className="file-item-size">{formatSize(resultSize)} — {files.length} page{files.length > 1 ? 's' : ''}</div>
              </div>
            </div>
            <a href={resultUrl} download="converted-images.pdf" className="btn btn-primary">Download PDF</a>
          </div>
        </div>
      )}
    </div>
  );
}
