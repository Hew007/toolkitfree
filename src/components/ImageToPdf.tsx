import { useCallback, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import PdfPageEditor, { type PdfEditorPage } from './PdfPageEditor';
import FineTune, { FineTuneField } from './FineTune';
import ToolRunNote from './ToolRunNote';
import { ToolChoices, type ToolChoice } from './ToolChoices';
import { useAutoRun } from '../hooks/useAutoRun';
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
  autoArrangePage,
  derivePdfPages,
  fitPlacement,
  moveItemToNewPage,
  moveItemToPage,
  movePageBy,
  movePlacement,
  pixelsToMillimeters,
  removeItemFromPages,
  rotatePlacementBy,
  rotatedAspect,
  type PdfFitMode,
  type PdfOrientation,
  type PdfPageGeometry,
  type PdfPageRotation,
  type PdfPageSize,
  type PdfPlacement,
  type PdfPresetKey,
} from '../lib/image-to-pdf';

/**
 * How long input has to settle before the document is rebuilt.
 *
 * Measured against the production build in headless Chrome, timing the run
 * itself and subtracting this delay. Building from nothing — which also pays
 * for the dynamic jsPDF import — one 3000x2000 JPEG took ~220ms, three took
 * ~470ms, ten 1600x1200 photos ~580ms, and two 4000x3000 PNGs, 24 megapixels
 * and 26MB between them, ~1.17s. Rebuilding after an edit took under 25ms in
 * every one of those, because `rasterCache` below keeps the decode and the
 * JPEG re-encode — all of the cost — out of it.
 *
 * Under 25ms is the number that matters: it is what a drag or a margin change
 * actually costs, and it is cheap enough that scheduling a run by accident
 * costs nothing. That is the condition auto-running asks for, so the same
 * 320ms the other tools debounce with applies here.
 */
const PDF_DELAY_MS = 320;

/**
 * Splits `A4 (210x297mm)` into a short chip label and its dimensions as the
 * hint, so the chips stay readable without a second hand-written copy of the
 * page-size table.
 */
function splitSizeLabel(label: string): { label: string; hint: string | undefined } {
  const match = /^(.*?)\s*\((.*)\)$/.exec(label);
  return match ? { label: match[1], hint: match[2] } : { label, hint: undefined };
}

/**
 * Derived from the page-size table itself, so a chip can never offer a size the
 * exported PDF does not actually use. `fit` has no fixed dimensions, which is
 * why it is the one entry the table cannot supply.
 */
const PAGE_SIZE_CHOICES: readonly ToolChoice<PdfPageSize>[] = [
  ...Object.entries(PDF_PAGE_SIZES).map(([id, size]) => ({
    id: id as PdfPageSize,
    ...splitSizeLabel(size.label),
  })),
  { id: 'fit', label: 'Fit to image', hint: 'Page matches the image' },
];

const PAGE_SIZE_LABELS = Object.fromEntries(
  PAGE_SIZE_CHOICES.map((choice) => [choice.id, choice.label])
) as Record<PdfPageSize, string>;

/** The one-line description of the page setup, shared by the summary and the reset. */
function describeSetup(pageSize: PdfPageSize, orientation: PdfOrientation, margin: number): string {
  const size = PAGE_SIZE_LABELS[pageSize];
  if (pageSize === 'fit') return `${size} · no margin`;
  const facing = orientation === 'landscape' ? 'Landscape' : 'Portrait';
  return `${size} · ${facing} · ${margin}mm margin`;
}

/**
 * Page geometry rounded to the precision the PDF is actually written at. A
 * pointer drag produces arbitrary fractions of a millimetre; 0.01mm is ten
 * microns, far below anything a printer resolves, so keying off it means a drag
 * that ends where it began does not rebuild the document.
 */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

interface PdfItem {
  id: number;
  file: File;
  previewUrl: string;
  /** Null when the file could not be decoded; such items never reach a page. */
  naturalWidth: number | null;
  naturalHeight: number | null;
  /** False for a file that failed to decode, which keeps it off every page. */
  renderable: boolean;
  decodeError: string | null;
  rotation: PdfPageRotation;
  /** Null means "let auto-layout decide"; any manual edit pins a concrete value. */
  placement: PdfPlacement | null;
  startsNewPage: boolean;
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [failures, setFailures] = useState<PdfFailure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [resultPages, setResultPages] = useState(0);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const nextId = useRef(0);
  /**
   * Rasterised images, keyed by image and quarter turn. What a page draws
   * depends on neither the placement nor the page size, so moving an image or
   * dragging the margin rebuilds the document from these instead of decoding
   * and re-encoding every source again — the expensive half of a run, and the
   * half that would otherwise make a drag cost as much as the first build.
   */
  const rasterCache = useRef(new Map<string, string>());
  const objectUrls = useObjectUrlRegistry();
  const allowedTypes = PDF_INPUT_TYPES[initialPreset.inputKind];

  // `fit` sizes each page to its own image, so a margin would be meaningless.
  const effectiveMargin = pageSize === 'fit' ? 0 : margin;

  /**
   * Whether the page setup still matches what this route arrived with. Derived
   * rather than stored, so editing a value back to the preset puts the reset
   * away again on its own.
   */
  const tuned =
    pageSize !== initialPreset.pageSize ||
    orientation !== initialPreset.orientation ||
    margin !== initialPreset.margin;

  const resetPageSetup = useCallback(() => {
    setPageSize(initialPreset.pageSize);
    setOrientation(initialPreset.orientation);
    setMargin(initialPreset.margin);
  }, [initialPreset.margin, initialPreset.orientation, initialPreset.pageSize]);

  /**
   * Drops the finished document. This fires on every settings change, which
   * during a drag means every pointer move, so each write is a bail-out:
   * handing React the value it already holds ends the update there instead of
   * costing a render per move.
   */
  const clearResult = useCallback(() => {
    objectUrls.revoke('pdf:result');
    setResultUrl((current) => (current === null ? current : null));
    setResultSize((current) => (current === 0 ? current : 0));
    setResultPages((current) => (current === 0 ? current : 0));
    setElapsedMs((current) => (current === null ? current : null));
    setFailures((current) => (current.length === 0 ? current : []));
    setError((current) => (current === null ? current : null));
    setProcessing((current) => (current ? false : current));
  }, [objectUrls]);

  const handleFiles = useCallback(
    async (newFiles: File[]) => {
      const accepted: PdfItem[] = [];
      for (const file of newFiles) {
        const id = nextId.current++;
        try {
          validateImageFile(file, { allowedTypes });
        } catch (fileError) {
          accepted.push({
            id,
            file,
            previewUrl: objectUrls.replace(`pdf:preview:${id}`, file),
            naturalWidth: null,
            naturalHeight: null,
            renderable: false,
            decodeError: getImageProcessingErrorMessage(fileError),
            rotation: 0,
            placement: null,
            startsNewPage: true,
          });
          continue;
        }
        // Decode up front so the editor can lay the page out immediately, and so a
        // broken file is reported the moment it is added rather than at convert time.
        let naturalWidth: number | null = null;
        let naturalHeight: number | null = null;
        let decodeError: string | null = null;
        try {
          const image = await loadImage(file, { allowedTypes });
          naturalWidth = image.naturalWidth;
          naturalHeight = image.naturalHeight;
        } catch (decodeFailure) {
          decodeError = getImageProcessingErrorMessage(decodeFailure);
        }
        accepted.push({
          id,
          file,
          previewUrl: objectUrls.replace(`pdf:preview:${id}`, file),
          naturalWidth,
          naturalHeight,
          renderable: naturalWidth !== null,
          decodeError,
          rotation: 0,
          placement: null,
          startsNewPage: true,
        });
      }
      setItems((current) => [...current, ...accepted]);
    },
    [allowedTypes, objectUrls]
  );

  /** Removes an item and hands page-opening duty to whatever followed it. */
  const handleRemove = useCallback(
    (id: number) => {
      setItems((current) => {
        if (!current.some((item) => item.id === id)) return current;
        objectUrls.revoke(`pdf:preview:${id}`);
        return removeItemFromPages(current, id);
      });
      setSelectedId((current) => (current === id ? null : current));
    },
    [objectUrls]
  );

  /** Drops every image and result so the next PDF starts from an empty editor. */
  const handleStartOver = useCallback(() => {
    setItems([]);
    setSelectedId(null);
    clearResult();
    rasterCache.current.clear();
    objectUrls.revokePrefix('pdf:preview:');
  }, [clearResult, objectUrls]);

  const patchItem = useCallback((id: number, patch: Partial<PdfItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const pageGeometry = useCallback(
    (first: PdfItem): PdfPageGeometry => {
      if (pageSize === 'fit') {
        const width = pixelsToMillimeters(first.naturalWidth!);
        const height = pixelsToMillimeters(first.naturalHeight!);
        return first.rotation % 180 === 0 ? { width, height } : { width: height, height: width };
      }
      const fixed = PDF_PAGE_SIZES[pageSize];
      return orientation === 'landscape'
        ? { width: fixed.height, height: fixed.width }
        : { width: fixed.width, height: fixed.height };
    },
    [orientation, pageSize]
  );

  /**
   * Groups items into pages and resolves every placement. Manual placements are
   * clamped onto the current page so changing page size never strands an image.
   */
  const pages = useMemo<PdfEditorPage[]>(() => {
    return derivePdfPages(items).map((groupItems) => {
      const geometry = pageGeometry(groupItems[0]);
      const aspects = groupItems.map((item) =>
        rotatedAspect(item.naturalWidth!, item.naturalHeight!, item.rotation)
      );
      const auto = autoArrangePage(geometry, effectiveMargin, aspects);
      return {
        geometry,
        items: groupItems.map((item, index) => ({
          id: item.id,
          name: item.file.name,
          previewUrl: item.previewUrl,
          rotation: item.rotation,
          aspect: aspects[index],
          placement: item.placement ? movePlacement(item.placement, 0, 0, geometry) : auto[index],
        })),
      };
    });
  }, [effectiveMargin, items, pageGeometry]);

  const findContext = useCallback(
    (id: number) => {
      for (const [pageIndex, page] of pages.entries()) {
        const entry = page.items.find((item) => item.id === id);
        if (entry) return { pageIndex, page, entry };
      }
      return null;
    },
    [pages]
  );

  const handleRotate = useCallback(
    (id: number, delta: -90 | 90) => {
      const context = findContext(id);
      if (!context) return;
      const rotated = rotatePlacementBy(
        context.entry.placement,
        context.entry.rotation,
        delta,
        context.page.geometry
      );
      patchItem(id, { rotation: rotated.rotation, placement: rotated.placement });
    },
    [findContext, patchItem]
  );

  const handleFit = useCallback(
    (id: number, mode: PdfFitMode) => {
      const context = findContext(id);
      if (!context) return;
      const source = items.find((item) => item.id === id);
      if (!source) return;
      patchItem(id, {
        placement: fitPlacement(
          context.page.geometry,
          context.entry.aspect,
          effectiveMargin,
          mode,
          source.naturalWidth ?? undefined,
          source.naturalHeight ?? undefined
        ),
      });
    },
    [effectiveMargin, findContext, items, patchItem]
  );

  /**
   * Re-pages an image and lets auto-layout place it again, since a placement
   * pinned to its old page would land arbitrarily on the new one.
   */
  const repage = useCallback((id: number, shuffle: (current: PdfItem[]) => PdfItem[]) => {
    setItems((current) =>
      shuffle(current).map((item) => (item.id === id ? { ...item, placement: null } : item))
    );
  }, []);

  /** Combines an image onto another page; `targetPageIndex === pages.length` opens a new one. */
  const handleMoveToPage = useCallback(
    (id: number, targetPageIndex: number) => {
      repage(id, (current) => moveItemToPage(current, id, targetPageIndex));
    },
    [repage]
  );

  /** Splits an image back out onto a page of its own at the given boundary. */
  const handleMoveToNewPage = useCallback(
    (id: number, gapIndex: number) => {
      repage(id, (current) => moveItemToNewPage(current, id, gapIndex));
    },
    [repage]
  );

  /** Reorders whole pages, leaving every placement on them untouched. */
  const handleMovePage = useCallback((pageIndex: number, delta: -1 | 1) => {
    setItems((current) => movePageBy(current, pageIndex, delta));
  }, []);

  /** Swaps two neighbours on the same page, leaving page membership untouched. */
  const handleReorderWithinPage = useCallback(
    (id: number, direction: -1 | 1) => {
      const context = findContext(id);
      if (!context) return;
      const within = context.page.items.findIndex((item) => item.id === id);
      const neighbour = context.page.items[within + direction];
      if (!neighbour) return;

      setItems((current) => {
        const from = current.findIndex((item) => item.id === id);
        const to = current.findIndex((item) => item.id === neighbour.id);
        if (from === -1 || to === -1) return current;
        const next = [...current];
        // `startsNewPage` belongs to the slot, not the image, so it stays put.
        next[from] = { ...current[to], startsNewPage: current[from].startsNewPage };
        next[to] = { ...current[from], startsNewPage: current[to].startsNewPage };
        return next;
      });
    },
    [findContext]
  );

  const decodeFailures = items.filter((item) => item.decodeError !== null);

  /**
   * Everything the exported document depends on, and nothing else. Page size,
   * orientation and margin are absent on purpose: they reach the PDF only
   * through the geometry and the placements they produce, both of which are
   * already here — so nudging the margin slider on a page whose images are all
   * placed by hand correctly rebuilds nothing. Ids identify the files because
   * `nextId` never hands the same one out twice.
   */
  const settingsKey = useMemo(
    () =>
      JSON.stringify(
        pages.map((page) => [
          round(page.geometry.width),
          round(page.geometry.height),
          page.items.map((entry) => [
            entry.id,
            entry.rotation,
            round(entry.placement.x),
            round(entry.placement.y),
            round(entry.placement.width),
            round(entry.placement.height),
          ]),
        ])
      ),
    [pages]
  );

  // No submit step: the document follows the pages above it.
  useAutoRun({
    key: settingsKey,
    enabled: pages.length > 0,
    delayMs: PDF_DELAY_MS,
    onInvalidate: clearResult,
    run: async (isCurrent) => {
      const layout = pages;
      const sources = items;
      if (layout.length === 0) return;
      setProcessing(true);
      const startedAt = performance.now();

      // Forget rasters for images that have been removed or turned since, so the
      // cache cannot outgrow the editor it belongs to.
      const live = new Set(
        layout.flatMap((page) => page.items.map((entry) => `${entry.id}:${entry.rotation}`))
      );
      for (const cached of [...rasterCache.current.keys()]) {
        if (!live.has(cached)) rasterCache.current.delete(cached);
      }

      try {
        const { jsPDF } = await import('jspdf');
        if (!isCurrent()) return;

        let doc: import('jspdf').jsPDF | null = null;
        const nextFailures: PdfFailure[] = [];
        let renderedPages = 0;

        for (const page of layout) {
          const { width, height } = page.geometry;
          // jsPDF swaps the format whenever it disagrees with the orientation
          // ('portrait' forces width <= height). Deriving the orientation from the
          // geometry keeps the format untouched, so the page matches the preview.
          const pageOrientation = width > height ? 'landscape' : 'portrait';
          if (doc === null) {
            doc = new jsPDF({ orientation: pageOrientation, unit: 'mm', format: [width, height] });
          } else {
            doc.addPage([width, height], pageOrientation);
          }
          renderedPages += 1;

          for (const entry of page.items) {
            const source = sources.find((item) => item.id === entry.id);
            if (!source) continue;
            const cacheKey = `${entry.id}:${entry.rotation}`;
            try {
              let raster = rasterCache.current.get(cacheKey);
              if (raster === undefined) {
                const image = await loadImage(source.file, { allowedTypes });
                if (!isCurrent()) return;
                const quarter = entry.rotation % 180 !== 0;
                const canvas = document.createElement('canvas');
                canvas.width = quarter ? image.naturalHeight : image.naturalWidth;
                canvas.height = quarter ? image.naturalWidth : image.naturalHeight;
                const context = getCanvas2dContext(canvas);
                // Flatten alpha onto white, since the page is encoded as JPEG.
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                // Bake the quarter turn into the raster so addImage only ever gets a
                // plain rectangle — jsPDF's own rotation argument is anchored awkwardly.
                context.translate(canvas.width / 2, canvas.height / 2);
                context.rotate((entry.rotation * Math.PI) / 180);
                context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
                raster = canvas.toDataURL('image/jpeg', 0.92);
                rasterCache.current.set(cacheKey, raster);
              }
              doc.addImage(
                raster,
                'JPEG',
                entry.placement.x,
                entry.placement.y,
                entry.placement.width,
                entry.placement.height
              );
            } catch (imageError) {
              nextFailures.push({
                name: source.file.name,
                message: getImageProcessingErrorMessage(imageError),
              });
            }
          }
        }

        if (doc === null) {
          if (!isCurrent()) return;
          setFailures(nextFailures);
          setError('No valid images were available to create the PDF.');
          setProcessing(false);
          return;
        }

        const blob = doc.output('blob');
        if (blob.type !== 'application/pdf') {
          throw new Error('The browser did not create a valid PDF Blob.');
        }
        // Registered only once this run is confirmed current. `replace` revokes
        // whatever the key already held, so a superseded run that registered its
        // blob anyway would pull the URL out from under the fresher result that
        // is already on screen and leave the download pointing at nothing.
        if (!isCurrent()) return;
        setFailures(nextFailures);
        setResultUrl(objectUrls.replace('pdf:result', blob));
        setResultSize(blob.size);
        setResultPages(renderedPages);
        setElapsedMs(Math.round(performance.now() - startedAt));
        setProcessing(false);
      } catch (conversionError) {
        if (!isCurrent()) return;
        setError(
          conversionError instanceof Error ? conversionError.message : 'PDF conversion failed.'
        );
        setProcessing(false);
      }
    },
  });

  const handleDownload = () => {
    if (!resultUrl) return;
    try {
      downloadUrl(resultUrl, 'converted-images.pdf');
    } catch (downloadError) {
      setError(getImageProcessingErrorMessage(downloadError));
    }
  };

  const selectedFile =
    selectedId === null ? null : (items.find((item) => item.id === selectedId) ?? null);

  return (
    <div
      data-pdf-preset={defaultPreset}
      data-page-size={pageSize}
      data-orientation={orientation}
      data-margin={margin}
      aria-busy={processing}
    >
      {processing && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Creating PDF.
        </div>
      )}
      <FileUploader
        accept={allowedTypes.join(',')}
        multiple={true}
        budgetProfile="pdf"
        currentFiles={items.map(({ file }) => file)}
        onFilesSelected={handleFiles}
      />

      {items.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <div className="tool-controls">
            <ToolChoices
              name="pdf-page-size"
              legend="Page size"
              help="Every page takes this size. Orientation and margin are in Fine-tune below, and the PDF follows all of them."
              choices={PAGE_SIZE_CHOICES}
              value={pageSize}
              onChange={(choice) => setPageSize(choice.id)}
            />

            <FineTune
              summary={describeSetup(pageSize, orientation, margin)}
              onReset={tuned ? resetPageSetup : undefined}
              resetLabel={`Back to this page's setup \u00b7 ${describeSetup(
                initialPreset.pageSize,
                initialPreset.orientation,
                initialPreset.margin
              )}`}
            >
              <FineTuneField
                htmlFor="pdf-orientation"
                label="Orientation"
                hint="Which way round a fixed page size is turned."
                hidden={pageSize === 'fit'}
              >
                <select
                  id="pdf-orientation"
                  data-testid="pdf-orientation"
                  value={orientation}
                  onChange={(event) => setOrientation(event.target.value as PdfOrientation)}
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </FineTuneField>

              <FineTuneField
                htmlFor="pdf-margin"
                label={`Margin: ${margin}mm`}
                hint="The blank border automatic placement leaves around the page. An image you have moved or resized yourself stays where you put it."
                hidden={pageSize === 'fit'}
              >
                <input
                  id="pdf-margin"
                  data-testid="pdf-margin"
                  type="range"
                  min="0"
                  max="30"
                  value={margin}
                  onChange={(event) => setMargin(Number(event.target.value))}
                />
              </FineTuneField>
            </FineTune>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <PdfPageEditor
              pages={pages}
              margin={effectiveMargin}
              selectedId={selectedId}
              // Never disabled: the document follows the editor now, so locking
              // it while a rebuild is in flight would fight the next edit — and
              // would drop keyboard focus out of the image being moved.
              disabled={false}
              onSelect={setSelectedId}
              onPlacementChange={(id, placement) => patchItem(id, { placement })}
              onRotate={handleRotate}
              onFit={handleFit}
              onRemove={handleRemove}
              onMoveToPage={handleMoveToPage}
              onMoveToNewPage={handleMoveToNewPage}
              onMovePage={handleMovePage}
              onReorderWithinPage={handleReorderWithinPage}
            />
          </div>

          {selectedFile && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: '#6b665c' }}>
              Selected: {selectedFile.file.name} ({formatSize(selectedFile.file.size)})
            </p>
          )}

          <div className="tool-controls">
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setItems((current) => current.map((item) => ({ ...item, placement: null })))
                }
              >
                Reset layout
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="pdf-clear-all"
                onClick={handleStartOver}
              >
                Clear all
              </button>
            </div>

            <ToolRunNote busy={processing}>
              {processing
                ? 'Building the PDF in your browser\u2026'
                : elapsedMs !== null
                  ? `Built ${resultPages} page${resultPages === 1 ? '' : 's'} in your browser in ${(
                      elapsedMs / 1000
                    ).toFixed(1)}s. Nothing was uploaded.`
                  : 'The PDF follows the pages above. Nothing is uploaded.'}
            </ToolRunNote>
          </div>

          <p style={{ fontSize: '0.8125rem', color: '#6b665c', marginTop: '0.75rem' }}>
            The exported PDF matches the preview above. Transparent pixels are placed on white
            before PDF encoding.
          </p>
        </div>
      )}

      {decodeFailures.map((item) => (
        <div
          key={item.id}
          className="status status-error"
          role="alert"
          data-pdf-error={item.file.name}
        >
          <strong>{item.file.name}:</strong> {item.decodeError}{' '}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', marginLeft: '0.5rem' }}
            onClick={() => handleRemove(item.id)}
          >
            Remove
          </button>
        </div>
      ))}
      {failures.map((failure) => (
        <div
          key={`${failure.name}:${failure.message}`}
          className="status status-error"
          role="alert"
          data-pdf-error={failure.name}
        >
          <strong>{failure.name}:</strong> {failure.message}
        </div>
      ))}
      {error && (
        <div className="status status-error" role="alert">
          {error}
        </div>
      )}

      {resultUrl && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Result</h3>
          <div
            className="result-item"
            data-pdf-result
            data-pdf-url={resultUrl}
            data-pages={resultPages}
            data-size={resultSize}
          >
            <div className="result-info">
              <div>
                <div className="file-item-name">converted-images.pdf</div>
                <div className="file-item-size">
                  {formatSize(resultSize)} - {resultPages} page{resultPages > 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleDownload} className="btn btn-primary">
                Download PDF
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="pdf-start-over"
                onClick={handleStartOver}
              >
                Start new PDF
              </button>
            </div>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#6b665c', margin: '0.5rem 0 0' }}>
            Download it before starting a new PDF — the file is held in this tab only.
          </p>
        </div>
      )}
    </div>
  );
}
