import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import type { SetStateAction } from 'react';
import DownloadResult from './DownloadResult';
import FileUploader from './FileUploader';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import { formatSize } from '../lib/image-processing';
import {
  createPdfOutputName,
  getPdfToolBudget,
  hasPdfSignature,
  movePdfPage,
  normalizePdfRotation,
  parsePdfPageRange,
  rotatePdfPage,
  validatePdfFile,
  type PdfPageRotation,
} from '../lib/pdf-page-tools';

interface PdfPageItem {
  sourceIndex: number;
  originalPageNumber: number;
  rotation: PdfPageRotation;
  thumbnailUrl: string;
  width: number;
  height: number;
}

interface PdfResult {
  name: string;
  size: number;
  url: string;
}

type OutputMode = 'combined' | 'individual';

interface PdfPageExtractorProps {
  defaultMode?: OutputMode;
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (
    window.matchMedia('(max-width: 640px)').matches || (typeof memory === 'number' && memory <= 4)
  );
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('A PDF page preview could not be created.'));
    }, 'image/webp');
  });
}

function resultBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([Uint8Array.from(bytes).buffer], { type });
}

export default function PdfPageExtractor({ defaultMode = 'combined' }: PdfPageExtractorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PdfPageItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [range, setRange] = useState('');
  const [outputMode, setOutputMode] = useState<OutputMode>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Choose one PDF to begin.');
  const [error, setError] = useState('');
  const [result, setResult] = useState<PdfResult | null>(null);
  const sourceBytesRef = useRef<Uint8Array | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const loadGenerationRef = useRef(0);
  const objectUrls = useObjectUrlRegistry();
  const budget = useMemo(() => getPdfToolBudget(isMobileDevice()), []);
  const busy = loading || exporting;

  useEffect(() => {
    return () => {
      loadGenerationRef.current += 1;
      void loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
    };
  }, []);

  const clearResult = () => {
    objectUrls.revoke('pdf-pages:result');
    setResult(null);
  };

  const clearPages = () => {
    for (const page of pages) objectUrls.revoke(`pdf-pages:thumbnail:${page.sourceIndex}`);
    setPages([]);
    setSelected(new Set());
    sourceBytesRef.current = null;
    clearResult();
  };

  const reset = () => {
    loadGenerationRef.current += 1;
    void loadingTaskRef.current?.destroy();
    loadingTaskRef.current = null;
    clearPages();
    setFile(null);
    setRange('');
    setError('');
    setProgress(0);
    setStatus('Choose one PDF to begin.');
    setLoading(false);
    setExporting(false);
  };

  const loadPdf = async (nextFile: File) => {
    const generation = ++loadGenerationRef.current;
    void loadingTaskRef.current?.destroy();
    loadingTaskRef.current = null;
    clearPages();
    setFile(nextFile);
    setRange('');
    setError('');
    setLoading(true);
    setProgress(0.02);
    setStatus('Reading the PDF locally…');

    try {
      validatePdfFile(nextFile, budget);
      const bytes = new Uint8Array(await nextFile.arrayBuffer());
      if (!hasPdfSignature(bytes)) throw new Error('The file does not contain a valid PDF header.');
      sourceBytesRef.current = Uint8Array.from(bytes);

      const [pdfjs, workerModule] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      const loadingTask = pdfjs.getDocument({ data: Uint8Array.from(bytes) });
      loadingTaskRef.current = loadingTask;
      const pdfDocument = await loadingTask.promise;
      if (generation !== loadGenerationRef.current) {
        await loadingTask.destroy();
        return;
      }
      if (pdfDocument.numPages > budget.maxPages) {
        throw new Error(
          `This PDF has ${pdfDocument.numPages} pages. This device can process up to ${budget.maxPages} pages at once.`
        );
      }

      setStatus(`Rendering ${pdfDocument.numPages} page previews…`);
      setProgress(0.12);
      const rendered = new Array<PdfPageItem>(pdfDocument.numPages);
      let nextPageNumber = 1;
      let completed = 0;
      const renderNext = async () => {
        while (nextPageNumber <= pdfDocument.numPages) {
          const pageNumber = nextPageNumber++;
          const page = await pdfDocument.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const previewScale = Math.min(0.8, 190 / Math.max(baseViewport.width, 1));
          const viewport = page.getViewport({ scale: previewScale });
          const canvas = window.document.createElement('canvas');
          canvas.width = Math.max(1, Math.ceil(viewport.width));
          canvas.height = Math.max(1, Math.ceil(viewport.height));
          await page.render({ canvas, viewport, background: '#ffffff' }).promise;
          const thumbnail = await canvasToBlob(canvas);
          rendered[pageNumber - 1] = {
            sourceIndex: pageNumber - 1,
            originalPageNumber: pageNumber,
            rotation: 0,
            thumbnailUrl: objectUrls.replace(`pdf-pages:thumbnail:${pageNumber - 1}`, thumbnail),
            width: baseViewport.width,
            height: baseViewport.height,
          };
          page.cleanup();
          completed += 1;
          setProgress(0.12 + (completed / pdfDocument.numPages) * 0.83);
        }
      };
      await Promise.all(Array.from({ length: isMobileDevice() ? 1 : 2 }, () => renderNext()));
      if (generation !== loadGenerationRef.current) return;
      setPages(rendered);
      setSelected(new Set(rendered.map((page) => page.sourceIndex)));
      setProgress(1);
      setStatus(`${pdfDocument.numPages} pages ready. Select, reorder, rotate, or remove pages.`);
      await loadingTask.destroy();
      loadingTaskRef.current = null;
    } catch (loadError) {
      sourceBytesRef.current = null;
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'This PDF could not be opened in the browser.'
      );
      setStatus('PDF loading failed.');
      setProgress(0);
      void loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  };

  const updatePages = (nextPages: SetStateAction<PdfPageItem[]>) => {
    setPages(nextPages);
    clearResult();
  };

  const applyRange = () => {
    try {
      const indexes = parsePdfPageRange(range, pages.length);
      setSelected(new Set(indexes.map((index) => pages[index].sourceIndex)));
      setError('');
      clearResult();
    } catch (rangeError) {
      setError(rangeError instanceof Error ? rangeError.message : 'Enter a valid page range.');
    }
  };

  const togglePage = (sourceIndex: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(sourceIndex)) next.delete(sourceIndex);
      else next.add(sourceIndex);
      return next;
    });
    clearResult();
  };

  const rotatePage = (sourceIndex: number, delta: -90 | 90) => {
    updatePages((current) =>
      current.map((page) =>
        page.sourceIndex === sourceIndex
          ? { ...page, rotation: rotatePdfPage(page.rotation, delta) }
          : page
      )
    );
  };

  const removePage = (sourceIndex: number) => {
    const page = pages.find((item) => item.sourceIndex === sourceIndex);
    if (page) objectUrls.revoke(`pdf-pages:thumbnail:${page.sourceIndex}`);
    updatePages((current) => current.filter((item) => item.sourceIndex !== sourceIndex));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(sourceIndex);
      return next;
    });
  };

  const exportPages = async () => {
    const sourceBytes = sourceBytesRef.current;
    const targets = pages.filter((page) => selected.has(page.sourceIndex));
    if (!file || !sourceBytes || targets.length === 0 || busy) return;
    clearResult();
    setError('');
    setExporting(true);
    setProgress(0.05);
    setStatus(
      outputMode === 'combined'
        ? `Extracting ${targets.length} selected page${targets.length === 1 ? '' : 's'}…`
        : `Splitting ${targets.length} selected page${targets.length === 1 ? '' : 's'}…`
    );

    try {
      const { PDFDocument, degrees } = await import('pdf-lib');
      const source = await PDFDocument.load(Uint8Array.from(sourceBytes));
      let blob: Blob;
      if (outputMode === 'combined') {
        const output = await PDFDocument.create();
        const copied = await output.copyPages(
          source,
          targets.map((page) => page.sourceIndex)
        );
        copied.forEach((page, index) => {
          const rotation = normalizePdfRotation(page.getRotation().angle + targets[index].rotation);
          page.setRotation(degrees(rotation));
          output.addPage(page);
        });
        blob = resultBlob(await output.save({ useObjectStreams: true }), 'application/pdf');
      } else {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        for (let index = 0; index < targets.length; index += 1) {
          const target = targets[index];
          const output = await PDFDocument.create();
          const [page] = await output.copyPages(source, [target.sourceIndex]);
          page.setRotation(
            degrees(normalizePdfRotation(page.getRotation().angle + target.rotation))
          );
          output.addPage(page);
          zip.file(
            `page-${String(index + 1).padStart(3, '0')}-original-${target.originalPageNumber}.pdf`,
            await output.save({ useObjectStreams: true })
          );
          setProgress(0.1 + ((index + 1) / targets.length) * 0.75);
        }
        blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      }
      const name = createPdfOutputName(file.name, outputMode);
      const url = objectUrls.replace('pdf-pages:result', blob);
      setResult({ name, size: blob.size, url });
      setProgress(1);
      setStatus(
        `${targets.length} selected page${targets.length === 1 ? '' : 's'} exported successfully.`
      );
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'The selected PDF pages could not be exported.'
      );
      setStatus('PDF export failed.');
      setProgress(0);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="pdf-page-tool" data-pdf-page-tool aria-busy={busy}>
      {!file ? (
        <FileUploader
          accept="application/pdf,.pdf"
          multiple={false}
          singleFileLabel="a PDF"
          onFilesSelected={(files) => {
            if (files[0]) void loadPdf(files[0]);
          }}
        />
      ) : (
        <div className="pdf-source-summary">
          <div>
            <strong>{file.name}</strong>
            <span>{formatSize(file.size)}</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
            Choose another PDF
          </button>
        </div>
      )}

      {busy && (
        <div className="conversion-progress" role="status" aria-live="polite">
          <div
            className="conversion-progress-track is-active"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span
              className="conversion-progress-fill"
              style={{ width: `${Math.max(5, progress * 100)}%` }}
            />
          </div>
          <span>{status}</span>
        </div>
      )}

      {error && (
        <div className="status status-error" role="alert">
          {error}
        </div>
      )}

      {pages.length > 0 && (
        <>
          <div className="pdf-page-toolbar">
            <div className="pdf-range-field">
              <label htmlFor="pdf-page-range">Select page range</label>
              <div>
                <input
                  id="pdf-page-range"
                  value={range}
                  onChange={(event) => setRange(event.target.value)}
                  placeholder="Example: 1-3, 5, 8-10"
                />
                <button type="button" className="btn btn-secondary" onClick={applyRange}>
                  Apply
                </button>
              </div>
            </div>
            <div className="pdf-selection-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSelected(new Set(pages.map((page) => page.sourceIndex)));
                  clearResult();
                }}
              >
                Select all
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSelected(new Set());
                  clearResult();
                }}
              >
                Clear selection
              </button>
            </div>
          </div>

          <p className="pdf-page-help">
            {selected.size} of {pages.length} pages selected. Page ranges use the current displayed
            order. Use the controls on each page to rotate, move, or remove it.
          </p>

          <div className="pdf-page-grid" data-pdf-page-grid>
            {pages.map((page, index) => (
              <article
                key={page.sourceIndex}
                className={`pdf-page-card${selected.has(page.sourceIndex) ? ' is-selected' : ''}`}
                data-pdf-page={page.originalPageNumber}
                data-order={index + 1}
                data-rotation={page.rotation}
              >
                <label className="pdf-page-select">
                  <input
                    type="checkbox"
                    checked={selected.has(page.sourceIndex)}
                    onChange={() => togglePage(page.sourceIndex)}
                  />
                  Page {index + 1}
                </label>
                <div className="pdf-page-preview">
                  <img
                    src={page.thumbnailUrl}
                    alt={`Preview of original PDF page ${page.originalPageNumber}`}
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                  />
                </div>
                <div className="pdf-page-meta">
                  Original page {page.originalPageNumber} · {Math.round(page.width)} ×{' '}
                  {Math.round(page.height)} pt
                </div>
                <div className="pdf-page-controls">
                  <button
                    type="button"
                    aria-label={`Move page ${index + 1} earlier`}
                    disabled={index === 0}
                    onClick={() => updatePages((current) => movePdfPage(current, index, -1))}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label={`Move page ${index + 1} later`}
                    disabled={index === pages.length - 1}
                    onClick={() => updatePages((current) => movePdfPage(current, index, 1))}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    aria-label={`Rotate page ${index + 1} left`}
                    onClick={() => rotatePage(page.sourceIndex, -90)}
                  >
                    ↶
                  </button>
                  <button
                    type="button"
                    aria-label={`Rotate page ${index + 1} right`}
                    onClick={() => rotatePage(page.sourceIndex, 90)}
                  >
                    ↷
                  </button>
                  <button
                    type="button"
                    className="pdf-page-remove"
                    aria-label={`Remove page ${index + 1}`}
                    onClick={() => removePage(page.sourceIndex)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="pdf-export-panel">
            <fieldset>
              <legend>Export selected pages</legend>
              <label>
                <input
                  type="radio"
                  name="pdf-output-mode"
                  checked={outputMode === 'combined'}
                  onChange={() => {
                    setOutputMode('combined');
                    clearResult();
                  }}
                />
                One combined PDF
              </label>
              <label>
                <input
                  type="radio"
                  name="pdf-output-mode"
                  checked={outputMode === 'individual'}
                  onChange={() => {
                    setOutputMode('individual');
                    clearResult();
                  }}
                />
                One PDF per page in a ZIP
              </label>
            </fieldset>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void exportPages()}
              disabled={busy || selected.size === 0}
            >
              {exporting
                ? 'Exporting…'
                : outputMode === 'combined'
                  ? `Extract ${selected.size} page${selected.size === 1 ? '' : 's'}`
                  : `Split ${selected.size} page${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}

      {!busy && progress >= 1 && pages.length > 0 && (
        <p className="status status-success">{status}</p>
      )}
      {result && (
        <div className="conversion-result" data-pdf-page-result data-result-name={result.name}>
          <DownloadResult {...result} />
        </div>
      )}
    </div>
  );
}
