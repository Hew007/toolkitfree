import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import type { SetStateAction } from 'react';
import DownloadResult from './DownloadResult';
import FileUploader from './FileUploader';
import ToolRunNote from './ToolRunNote';
import { ToolChoices, type ToolChoice } from './ToolChoices';
import { useAutoRun } from '../hooks/useAutoRun';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import { allVariants } from '../data/pdf-page-variants';
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
  pages: number;
  elapsedMs: number;
}

type OutputMode = 'combined' | 'individual';

interface PdfPageExtractorProps {
  defaultMode?: OutputMode;
}

/**
 * The chips answer the same question the two variant routes answer — one file
 * or one file per page — so they are derived from the variant table rather than
 * written out a second time. That is also what keeps a variant landing page
 * honest: arriving at /split-pdf-into-pages/ lights the matching chip instead of
 * a chip quietly overriding what the URL promised.
 */
const MODE_CHOICES: readonly ToolChoice<OutputMode>[] = allVariants.map((variant) => ({
  id: variant.defaultMode,
  label: variant.modeLabel,
  hint: variant.modeHint,
}));

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (
    window.matchMedia('(max-width: 640px)').matches || (typeof memory === 'number' && memory <= 4)
  );
}

function formatElapsed(elapsedMs: number): string {
  return elapsedMs < 950 ? `${Math.round(elapsedMs)} ms` : `${(elapsedMs / 1000).toFixed(1)}s`;
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
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Choose one PDF to begin.');
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [result, setResult] = useState<PdfResult | null>(null);
  /** Changes for every successfully opened document, so the run key can name it. */
  const [sourceId, setSourceId] = useState(0);
  const sourceBytesRef = useRef<Uint8Array | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const loadGenerationRef = useRef(0);
  const objectUrls = useObjectUrlRegistry();
  const budget = useMemo(() => getPdfToolBudget(isMobileDevice()), []);

  useEffect(() => {
    return () => {
      loadGenerationRef.current += 1;
      void loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
    };
  }, []);

  const clearPages = () => {
    for (const page of pages) objectUrls.revoke(`pdf-pages:thumbnail:${page.sourceIndex}`);
    setPages([]);
    setSelected(new Set());
    setSourceId(0);
    sourceBytesRef.current = null;
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

      // The default build calls Map.prototype.getOrInsertComputed, which browsers older than
      // Chrome 141 do not implement. The legacy build ships the polyfill it needs.
      const [pdfjs, workerModule] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
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
      setSourceId(generation);
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
  };

  const applyRange = () => {
    try {
      const indexes = parsePdfPageRange(range, pages.length);
      setSelected(new Set(indexes.map((index) => pages[index].sourceIndex)));
      setError('');
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

  /** The pages that go into the download, in the order they are shown. */
  const targets = useMemo(
    () => pages.filter((page) => selected.has(page.sourceIndex)),
    [pages, selected]
  );

  // What the download depends on and nothing more: which source document, which
  // pages in which order, how far each of them is turned, and which of the two
  // outputs is wanted. Rotating a page that is not selected changes `pages` but
  // not this, so it does not rebuild anything.
  const exportKey = useMemo(
    () =>
      [
        sourceId,
        outputMode,
        targets.map((page) => `${page.sourceIndex}:${page.rotation}`).join(','),
      ].join('|'),
    [sourceId, outputMode, targets]
  );

  useAutoRun({
    key: exportKey,
    enabled: sourceId > 0 && targets.length > 0 && !loading,
    // Measured in this browser with pdf-lib on the real page: an ordinary
    // office PDF rebuilds in tens of milliseconds, and the worst case allowed by
    // the size budget is still well under a second. The extra margin over the
    // 320 ms default is for the input shape rather than the cost — these are
    // discrete clicks on page cards, and people select several in a row.
    delayMs: 400,
    onInvalidate: () => {
      objectUrls.revoke('pdf-pages:result');
      // Bail out when there is nothing to drop: removing a page re-runs this on
      // every click, and handing React the value it already holds ends the
      // update in place instead of re-rendering the whole page grid.
      setResult((current) => (current === null ? current : null));
      setExportError((current) => (current === '' ? current : ''));
    },
    run: async (isCurrent) => {
      const sourceBytes = sourceBytesRef.current;
      const currentFile = file;
      if (!currentFile || !sourceBytes || targets.length === 0) return;
      try {
        const { PDFDocument, degrees } = await import('pdf-lib');
        if (!isCurrent()) return;
        // Loaded before the timer starts so the reported time is the rebuild
        // itself, and left alone entirely when one combined PDF is wanted.
        const zipModule = outputMode === 'individual' ? await import('jszip') : null;
        if (!isCurrent()) return;

        const startedAt = performance.now();
        const source = await PDFDocument.load(Uint8Array.from(sourceBytes));
        if (!isCurrent()) return;
        let blob: Blob;
        if (zipModule === null) {
          const output = await PDFDocument.create();
          const copied = await output.copyPages(
            source,
            targets.map((page) => page.sourceIndex)
          );
          if (!isCurrent()) return;
          copied.forEach((page, index) => {
            const rotation = normalizePdfRotation(
              page.getRotation().angle + targets[index].rotation
            );
            page.setRotation(degrees(rotation));
            output.addPage(page);
          });
          const saved = await output.save({ useObjectStreams: true });
          if (!isCurrent()) return;
          blob = resultBlob(saved, 'application/pdf');
        } else {
          const zip = new zipModule.default();
          for (let index = 0; index < targets.length; index += 1) {
            const target = targets[index];
            const output = await PDFDocument.create();
            const [page] = await output.copyPages(source, [target.sourceIndex]);
            if (!isCurrent()) return;
            page.setRotation(
              degrees(normalizePdfRotation(page.getRotation().angle + target.rotation))
            );
            output.addPage(page);
            const saved = await output.save({ useObjectStreams: true });
            if (!isCurrent()) return;
            zip.file(
              `page-${String(index + 1).padStart(3, '0')}-original-${target.originalPageNumber}.pdf`,
              saved
            );
          }
          // Stored, not deflated. PDF content streams are already compressed, so
          // deflating them again buys nothing measurable — on a 20-page, 74.6 MiB
          // scanned fixture the archive came out the same 74.6 MiB either way —
          // while costing 5.1s instead of 0.7s. That difference is what decides
          // whether this output can follow the controls at all.
          const archive = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
          if (!isCurrent()) return;
          blob = archive;
        }
        const elapsedMs = performance.now() - startedAt;

        // Registered only now: `replace` revokes whatever this key held, so a
        // superseded run that registered mid-work could pull the URL out from
        // under the run that replaced it.
        const url = objectUrls.replace('pdf-pages:result', blob);
        setResult({
          name: createPdfOutputName(currentFile.name, outputMode),
          size: blob.size,
          url,
          pages: targets.length,
          elapsedMs,
        });
      } catch (thrown) {
        if (!isCurrent()) return;
        setExportError(
          thrown instanceof Error ? thrown.message : 'The selected PDF pages could not be exported.'
        );
      }
    },
  });

  /**
   * True from the moment a change invalidates the download until the rebuild
   * that replaces it lands — the debounce window included, because work is
   * already owed by then. Derived rather than stored, so a run that is
   * superseded mid-flight cannot leave the dot spinning on nothing.
   */
  const rebuilding = targets.length > 0 && result === null && exportError === '';

  const runNote = rebuilding
    ? outputMode === 'combined'
      ? 'Building the combined PDF in your browser…'
      : 'Building one PDF per page in your browser…'
    : targets.length === 0
      ? 'Select at least one page and the download appears here.'
      : result
        ? `Built in your browser in ${formatElapsed(result.elapsedMs)} from ${result.pages} page${result.pages === 1 ? '' : 's'}. The download follows the pages above; nothing was uploaded.`
        : 'The download follows the pages above. Nothing is uploaded.';

  return (
    <div className="pdf-page-tool" data-pdf-page-tool aria-busy={loading || rebuilding}>
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
          <button type="button" className="btn btn-secondary" onClick={reset} disabled={loading}>
            Choose another PDF
          </button>
        </div>
      )}

      {loading && (
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
                onClick={() => setSelected(new Set(pages.map((page) => page.sourceIndex)))}
              >
                Select all
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelected(new Set())}
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

          <div className="tool-controls">
            <ToolChoices
              name="pdf-output-mode"
              legend="How should the pages come out?"
              help="The download rebuilds itself whenever you change the selection, order, or rotation."
              choices={MODE_CHOICES}
              value={outputMode}
              onChange={(choice) => setOutputMode(choice.id)}
            />

            {exportError && (
              <div className="status status-error" role="alert">
                {exportError}
              </div>
            )}

            <ToolRunNote busy={rebuilding}>{runNote}</ToolRunNote>
          </div>
        </>
      )}

      {result && (
        <div className="conversion-result" data-pdf-page-result data-result-name={result.name}>
          <DownloadResult name={result.name} size={result.size} url={result.url} />
        </div>
      )}
    </div>
  );
}
