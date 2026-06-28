import { useCallback, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  downloadUrl,
  formatSize,
  getCanvas2dContext,
  getImageProcessingErrorMessage,
  loadImage,
  validateImageFile,
} from '../lib/image-processing';
import {
  PDF_INPUT_TYPES,
  PDF_PAGE_SIZES,
  PDF_PRESETS,
  calculatePdfPlacement,
  pixelsToMillimeters,
  type PdfOrientation,
  type PdfPageSize,
  type PdfPresetKey,
} from '../lib/image-to-pdf';

interface PdfItem {
  id: number;
  file: File;
  previewUrl: string;
}

interface PdfFailure {
  name: string;
  message: string;
}

interface ImageToPdfProps {
  defaultPreset?: PdfPresetKey;
}

export default function ImageToPdf({ defaultPreset = 'default' }: ImageToPdfProps) {
  const initialPreset = PDF_PRESETS[defaultPreset];
  const [items, setItems] = useState<PdfItem[]>([]);
  const [pageSize, setPageSize] = useState<PdfPageSize>(initialPreset.pageSize);
  const [orientation, setOrientation] = useState<PdfOrientation>(initialPreset.orientation);
  const [margin, setMargin] = useState<number>(initialPreset.margin);
  const [processing, setProcessing] = useState(false);
  const [failures, setFailures] = useState<PdfFailure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [resultPages, setResultPages] = useState(0);
  const nextId = useRef(0);
  const objectUrls = useObjectUrlRegistry();
  const allowedTypes = PDF_INPUT_TYPES[initialPreset.inputKind];

  const clearResult = useCallback(() => {
    objectUrls.revoke('pdf:result');
    setResultUrl(null);
    setResultSize(0);
    setResultPages(0);
    setFailures([]);
  }, [objectUrls]);

  const handleFiles = useCallback((newFiles: File[]) => {
    const accepted: PdfItem[] = [];
    const rejected: PdfFailure[] = [];
    for (const file of newFiles) {
      try {
        validateImageFile(file, { allowedTypes });
        const id = nextId.current++;
        accepted.push({
          id,
          file,
          previewUrl: objectUrls.replace(`pdf:preview:${id}`, file),
        });
      } catch (fileError) {
        rejected.push({ name: file.name, message: getImageProcessingErrorMessage(fileError) });
      }
    }
    setItems((current) => [...current, ...accepted]);
    clearResult();
    setFailures(rejected);
    setError(null);
  }, [allowedTypes, clearResult, objectUrls]);

  const handleRemove = useCallback((index: number) => {
    setItems((current) => {
      const item = current[index];
      if (item) objectUrls.revoke(`pdf:preview:${item.id}`);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
    clearResult();
  }, [clearResult, objectUrls]);

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    clearResult();
  };

  const getPageOptions = (image: HTMLImageElement) => {
    if (pageSize === 'fit') {
      const width = pixelsToMillimeters(image.naturalWidth);
      const height = pixelsToMillimeters(image.naturalHeight);
      return {
        width,
        height,
        orientation: width > height ? 'landscape' as const : 'portrait' as const,
      };
    }
    const fixed = PDF_PAGE_SIZES[pageSize];
    return {
      width: fixed.width,
      height: fixed.height,
      orientation,
    };
  };

  const handleConvert = async () => {
    if (items.length === 0) return;
    setProcessing(true);
    setError(null);
    clearResult();

    try {
      const decoded = await Promise.allSettled(
        items.map(async (item) => ({
          item,
          image: await loadImage(item.file, { allowedTypes }),
        }))
      );
      const valid: { item: PdfItem; image: HTMLImageElement }[] = [];
      const nextFailures: PdfFailure[] = [];
      decoded.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') {
          valid.push(outcome.value);
        } else {
          nextFailures.push({
            name: items[index].file.name,
            message: getImageProcessingErrorMessage(outcome.reason),
          });
        }
      });
      setFailures(nextFailures);

      if (valid.length === 0) {
        setError('No valid images were available to create the PDF.');
        return;
      }

      const { jsPDF } = await import('jspdf');
      const firstPage = getPageOptions(valid[0].image);
      const doc = new jsPDF({
        orientation: firstPage.orientation,
        unit: 'mm',
        format: [firstPage.width, firstPage.height],
      });

      for (let index = 0; index < valid.length; index += 1) {
        const { image } = valid[index];
        const page = getPageOptions(image);
        if (index > 0) {
          doc.addPage([page.width, page.height], page.orientation);
        }

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageMargin = pageSize === 'fit' ? 0 : margin;
        const placement = calculatePdfPlacement(
          pageWidth,
          pageHeight,
          image.naturalWidth,
          image.naturalHeight,
          pageMargin
        );
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = getCanvas2dContext(canvas);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        doc.addImage(
          dataUrl,
          'JPEG',
          placement.x,
          placement.y,
          placement.width,
          placement.height
        );
      }

      const blob = doc.output('blob');
      if (blob.type !== 'application/pdf') {
        throw new Error('The browser did not create a valid PDF Blob.');
      }
      setResultUrl(objectUrls.replace('pdf:result', blob));
      setResultSize(blob.size);
      setResultPages(valid.length);
    } catch (conversionError) {
      setError(conversionError instanceof Error ? conversionError.message : 'PDF conversion failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    try {
      downloadUrl(resultUrl, 'converted-images.pdf');
    } catch (downloadError) {
      setError(getImageProcessingErrorMessage(downloadError));
    }
  };

  return (
    <div data-pdf-preset={defaultPreset} data-page-size={pageSize} data-orientation={orientation} data-margin={margin}>
      <FileUploader accept={allowedTypes.join(',')} multiple={true} onFilesSelected={handleFiles} />

      {items.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
            {items.map((item, index) => (
              <div key={item.id} className="file-item" data-pdf-file={item.file.name} data-order={index + 1}>
                <img src={item.previewUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="file-item-name">{index + 1}. {item.file.name}</div>
                  <div className="file-item-size">{formatSize(item.file.size)}</div>
                </div>
                <button type="button" aria-label={`Move ${item.file.name} up`} onClick={() => moveItem(index, -1)} disabled={index === 0} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>Up</button>
                <button type="button" aria-label={`Move ${item.file.name} down`} onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>Down</button>
                <button type="button" aria-label={`Remove ${item.file.name}`} className="file-item-remove" onClick={() => handleRemove(index)}>x</button>
              </div>
            ))}
          </div>

          {!resultUrl && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label htmlFor="pdf-page-size" style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Page Size</label>
                  <select id="pdf-page-size" data-testid="pdf-page-size" value={pageSize} onChange={(event) => { setPageSize(event.target.value as PdfPageSize); clearResult(); }} style={{ width: '100%' }}>
                    <option value="a4">{PDF_PAGE_SIZES.a4.label}</option>
                    <option value="letter">{PDF_PAGE_SIZES.letter.label}</option>
                    <option value="fit">Fit to Image</option>
                  </select>
                </div>
                {pageSize !== 'fit' && (
                  <div>
                    <label htmlFor="pdf-orientation" style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Orientation</label>
                    <select id="pdf-orientation" data-testid="pdf-orientation" value={orientation} onChange={(event) => { setOrientation(event.target.value as PdfOrientation); clearResult(); }} style={{ width: '100%' }}>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                )}
                {pageSize !== 'fit' && (
                  <div>
                    <label htmlFor="pdf-margin" style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Margin: {margin}mm</label>
                    <input id="pdf-margin" data-testid="pdf-margin" type="range" min="0" max="30" value={margin} onChange={(event) => { setMargin(Number(event.target.value)); clearResult(); }} style={{ width: '100%' }} />
                  </div>
                )}
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1rem' }}>
                Images are added to the PDF in the order shown above. Transparent pixels are placed on white before PDF encoding.
              </p>
              <button type="button" className="btn btn-primary" onClick={handleConvert} disabled={processing} style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
                {processing ? 'Converting...' : `Convert ${items.length} image${items.length > 1 ? 's' : ''} to PDF`}
              </button>
            </>
          )}
        </div>
      )}

      {failures.map((failure) => (
        <div key={`${failure.name}:${failure.message}`} className="status status-error" data-pdf-error={failure.name}>
          <strong>{failure.name}:</strong> {failure.message}
        </div>
      ))}
      {error && <div className="status status-error">{error}</div>}

      {resultUrl && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Result</h3>
          <div className="result-item" data-pdf-result data-pdf-url={resultUrl} data-pages={resultPages} data-size={resultSize}>
            <div className="result-info">
              <div>
                <div className="file-item-name">converted-images.pdf</div>
                <div className="file-item-size">{formatSize(resultSize)} - {resultPages} page{resultPages > 1 ? 's' : ''}</div>
              </div>
            </div>
            <button type="button" onClick={handleDownload} className="btn btn-primary">Download PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}
