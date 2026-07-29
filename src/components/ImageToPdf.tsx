import { useCallback, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import PdfPageEditor, { type PdfEditorPage } from './PdfPageEditor';
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
  movePlacement,
  pixelsToMillimeters,
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

interface PdfItem {
  id: number;
  file: File;
  previewUrl: string;
  /** Null when the file could not be decoded; such items never reach a page. */
  naturalWidth: number | null;
  naturalHeight: number | null;
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
  const nextId = useRef(0);
  const objectUrls = useObjectUrlRegistry();
  const allowedTypes = PDF_INPUT_TYPES[initialPreset.inputKind];

  // `fit` sizes each page to its own image, so a margin would be meaningless.
  const effectiveMargin = pageSize === 'fit' ? 0 : margin;

  const clearResult = useCallback(() => {
    objectUrls.revoke('pdf:result');
    setResultUrl(null);
    setResultSize(0);
    setResultPages(0);
    setFailures([]);
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
          decodeError,
          rotation: 0,
          placement: null,
          startsNewPage: true,
        });
      }
      setItems((current) => [...current, ...accepted]);
      clearResult();
      setError(null);
    },
    [allowedTypes, clearResult, objectUrls]
  );

  /** Removes an item and hands page-opening duty to whatever followed it. */
  const handleRemove = useCallback(
    (id: number) => {
      setItems((current) => {
        const index = current.findIndex((item) => item.id === id);
        if (index === -1) return current;
        objectUrls.revoke(`pdf:preview:${current[index].id}`);
        const next = current.filter((item) => item.id !== id);
        if (current[index].startsNewPage && next[index] && !next[index].startsNewPage) {
          next[index] = { ...next[index], startsNewPage: true };
        }
        return next;
      });
      setSelectedId((current) => (current === id ? null : current));
      clearResult();
    },
    [clearResult, objectUrls]
  );

  const patchItem = useCallback(
    (id: number, patch: Partial<PdfItem>) => {
      setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
      clearResult();
    },
    [clearResult]
  );

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
    const grouped = derivePdfPages(
      items.map((item) => ({ ...item, renderable: item.naturalWidth !== null }))
    );
    return grouped.map((groupItems) => {
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

  /** Moves an image onto another page; `targetPageIndex === pages.length` opens a new one. */
  const handleMoveToPage = useCallback(
    (id: number, targetPageIndex: number) => {
      setItems((current) => {
        const index = current.findIndex((item) => item.id === id);
        if (index === -1) return current;
        const moving = current[index];

        const withoutItem = current.filter((item) => item.id !== id);
        // Whatever followed the moved image may now need to open its page.
        if (moving.startsNewPage && withoutItem[index] && !withoutItem[index].startsNewPage) {
          withoutItem[index] = { ...withoutItem[index], startsNewPage: true };
        }

        const targetPage = pages[targetPageIndex];
        if (!targetPage) {
          // Dropped past the last page: give it a page of its own at the end.
          return [...withoutItem, { ...moving, startsNewPage: true, placement: null }];
        }

        const lastOnTarget = targetPage.items[targetPage.items.length - 1];
        const insertAt = withoutItem.findIndex((item) => item.id === lastOnTarget.id) + 1;
        const next = [...withoutItem];
        next.splice(insertAt, 0, { ...moving, startsNewPage: false, placement: null });
        return next;
      });
      clearResult();
    },
    [clearResult, pages]
  );

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
      clearResult();
    },
    [clearResult, findContext]
  );

  const decodeFailures = items.filter((item) => item.decodeError !== null);

  const handleConvert = async () => {
    if (pages.length === 0) return;
    setProcessing(true);
    setError(null);
    clearResult();

    try {
      const { jsPDF } = await import('jspdf');
      let doc: import('jspdf').jsPDF | null = null;
      const nextFailures: PdfFailure[] = [];
      let renderedPages = 0;

      for (const page of pages) {
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
          const source = items.find((item) => item.id === entry.id);
          if (!source) continue;
          try {
            const image = await loadImage(source.file, { allowedTypes });
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
            doc.addImage(
              canvas.toDataURL('image/jpeg', 0.92),
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

      setFailures(nextFailures);
      if (doc === null) {
        setError('No valid images were available to create the PDF.');
        return;
      }

      const blob = doc.output('blob');
      if (blob.type !== 'application/pdf') {
        throw new Error('The browser did not create a valid PDF Blob.');
      }
      setResultUrl(objectUrls.replace('pdf:result', blob));
      setResultSize(blob.size);
      setResultPages(renderedPages);
    } catch (conversionError) {
      setError(
        conversionError instanceof Error ? conversionError.message : 'PDF conversion failed.'
      );
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div>
              <label
                htmlFor="pdf-page-size"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '0.25rem',
                }}
              >
                Page Size
              </label>
              <select
                id="pdf-page-size"
                data-testid="pdf-page-size"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(event.target.value as PdfPageSize);
                  clearResult();
                }}
                style={{ width: '100%' }}
              >
                <option value="a4">{PDF_PAGE_SIZES.a4.label}</option>
                <option value="letter">{PDF_PAGE_SIZES.letter.label}</option>
                <option value="fit">Fit to Image</option>
              </select>
            </div>
            {pageSize !== 'fit' && (
              <div>
                <label
                  htmlFor="pdf-orientation"
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Orientation
                </label>
                <select
                  id="pdf-orientation"
                  data-testid="pdf-orientation"
                  value={orientation}
                  onChange={(event) => {
                    setOrientation(event.target.value as PdfOrientation);
                    clearResult();
                  }}
                  style={{ width: '100%' }}
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            )}
            {pageSize !== 'fit' && (
              <div>
                <label
                  htmlFor="pdf-margin"
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Margin: {margin}mm
                </label>
                <input
                  id="pdf-margin"
                  data-testid="pdf-margin"
                  type="range"
                  min="0"
                  max="30"
                  value={margin}
                  onChange={(event) => {
                    setMargin(Number(event.target.value));
                    clearResult();
                  }}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>

          <PdfPageEditor
            pages={pages}
            margin={effectiveMargin}
            selectedId={selectedId}
            disabled={processing}
            onSelect={setSelectedId}
            onPlacementChange={(id, placement) => patchItem(id, { placement })}
            onRotate={handleRotate}
            onFit={handleFit}
            onRemove={handleRemove}
            onMoveToPage={handleMoveToPage}
            onReorderWithinPage={handleReorderWithinPage}
          />

          {selectedFile && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              Selected: {selectedFile.file.name} ({formatSize(selectedFile.file.size)})
            </p>
          )}

          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: '1rem',
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              data-testid="pdf-convert"
              onClick={handleConvert}
              disabled={processing || pages.length === 0}
              style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
            >
              {processing
                ? 'Converting...'
                : `Create PDF · ${pages.length} page${pages.length === 1 ? '' : 's'}`}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setItems((current) => current.map((item) => ({ ...item, placement: null })));
                clearResult();
              }}
              disabled={processing}
            >
              Reset layout
            </button>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.75rem' }}>
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
            <button type="button" onClick={handleDownload} className="btn btn-primary">
              Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
