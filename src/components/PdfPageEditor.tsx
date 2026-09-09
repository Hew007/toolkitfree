import { Fragment, useRef, useState } from 'react';
import {
  MIN_PLACEMENT_MM,
  movePlacement,
  scalePlacement,
  type PdfFitMode,
  type PdfPageGeometry,
  type PdfPageRotation,
  type PdfPlacement,
  type PdfScaleHandle,
} from '../lib/image-to-pdf';

export interface PdfEditorItem {
  id: number;
  name: string;
  previewUrl: string;
  rotation: PdfPageRotation;
  /** Resolved placement in millimetres — auto-arranged or manually set. */
  placement: PdfPlacement;
  aspect: number;
}

export interface PdfEditorPage {
  geometry: PdfPageGeometry;
  items: PdfEditorItem[];
}

interface PdfPageEditorProps {
  pages: PdfEditorPage[];
  margin: number;
  selectedId: number | null;
  disabled: boolean;
  onSelect: (id: number | null) => void;
  onPlacementChange: (id: number, placement: PdfPlacement) => void;
  onRotate: (id: number, delta: -90 | 90) => void;
  onFit: (id: number, mode: PdfFitMode) => void;
  onRemove: (id: number) => void;
  /** Combines an image onto another page; the target is a 0-based page index. */
  onMoveToPage: (id: number, pageIndex: number) => void;
  /** Splits an image onto a page of its own at the boundary before `gapIndex`. */
  onMoveToNewPage: (id: number, gapIndex: number) => void;
  onMovePage: (pageIndex: number, delta: -1 | 1) => void;
  onReorderWithinPage: (id: number, direction: -1 | 1) => void;
}

interface DragState {
  pointerId: number;
  itemId: number;
  handle: PdfScaleHandle | 'move';
  startX: number;
  startY: number;
  startPlacement: PdfPlacement;
  aspect: number;
  pageIndex: number;
}

/**
 * Where a dragged image would land: onto an existing page, combining it with
 * what is already there, or into the boundary between two pages, where it
 * becomes a page of its own.
 */
type DropTarget = { kind: 'page'; index: number } | { kind: 'gap'; index: number };

const CORNERS: readonly PdfScaleHandle[] = ['nw', 'ne', 'sw', 'se'];

const CORNER_STYLE: Record<PdfScaleHandle, { left?: string; top?: string; cursor: string }> = {
  nw: { left: '0%', top: '0%', cursor: 'nwse-resize' },
  ne: { left: '100%', top: '0%', cursor: 'nesw-resize' },
  sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
  se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
};

function formatPlacement(placement: PdfPlacement, rotation: PdfPageRotation): string {
  const round = (value: number) => value.toFixed(1);
  return [
    round(placement.x),
    round(placement.y),
    round(placement.width),
    round(placement.height),
    rotation,
  ].join(',');
}

export default function PdfPageEditor({
  pages,
  margin,
  selectedId,
  disabled,
  onSelect,
  onPlacementChange,
  onRotate,
  onFit,
  onRemove,
  onMoveToPage,
  onMoveToNewPage,
  onMovePage,
  onReorderWithinPage,
}: PdfPageEditorProps) {
  const dragRef = useRef<DragState | null>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const listRef = useRef<HTMLDivElement | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  /** Millimetres per CSS pixel for a page, read live so resizes need no observer. */
  const millimetresPerPixel = (pageIndex: number, geometry: PdfPageGeometry): number => {
    const element = pageRefs.current.get(pageIndex);
    if (!element) return 0;
    const bounds = element.getBoundingClientRect();
    return bounds.width > 0 ? geometry.width / bounds.width : 0;
  };

  /**
   * Resolves the pointer to a drop target. Landing inside a page combines the
   * image with it; landing in the space between pages inserts it as its own
   * page there. Pointers well outside the list drop nothing at all.
   */
  const dropUnderPointer = (clientX: number, clientY: number): DropTarget | null => {
    const list = listRef.current;
    if (!list) return null;
    // A little slack so a drag that overshoots the edge still resolves.
    const slack = 32;
    const listBounds = list.getBoundingClientRect();
    if (
      clientX < listBounds.left - slack ||
      clientX > listBounds.right + slack ||
      clientY < listBounds.top - slack ||
      clientY > listBounds.bottom + slack
    ) {
      return null;
    }

    const rects = [...pageRefs.current.entries()]
      .sort(([left], [right]) => left - right)
      .map(([index, element]) => ({ index, bounds: element.getBoundingClientRect() }));

    for (const { index, bounds } of rects) {
      if (
        clientX >= bounds.left &&
        clientX <= bounds.right &&
        clientY >= bounds.top &&
        clientY <= bounds.bottom
      ) {
        return { kind: 'page', index };
      }
    }

    // Not on a page: the boundary is the one just above the first page that
    // still starts below the pointer, or the very last boundary.
    const next = rects.find(({ bounds }) => clientY < bounds.top);
    return { kind: 'gap', index: next ? next.index : rects.length };
  };

  const beginDrag = (
    event: React.PointerEvent,
    item: PdfEditorItem,
    pageIndex: number,
    handle: PdfScaleHandle | 'move'
  ) => {
    if (disabled) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(item.id);
    setDragging(handle === 'move');
    dragRef.current = {
      pointerId: event.pointerId,
      itemId: item.id,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startPlacement: item.placement,
      aspect: item.aspect,
      pageIndex,
    };
  };

  const continueDrag = (event: React.PointerEvent, geometry: PdfPageGeometry) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const scale = millimetresPerPixel(drag.pageIndex, geometry);
    if (scale <= 0) return;

    const deltaX = (event.clientX - drag.startX) * scale;
    const deltaY = (event.clientY - drag.startY) * scale;

    if (drag.handle === 'move') {
      onPlacementChange(drag.itemId, movePlacement(drag.startPlacement, deltaX, deltaY, geometry));
      const target = dropUnderPointer(event.clientX, event.clientY);
      // Dropping back onto the page it came from is a plain move, not a re-page.
      setDropTarget(
        target && target.kind === 'page' && target.index === drag.pageIndex ? null : target
      );
      return;
    }

    onPlacementChange(
      drag.itemId,
      scalePlacement(
        drag.startPlacement,
        drag.handle,
        deltaX,
        deltaY,
        drag.aspect,
        geometry,
        MIN_PLACEMENT_MM
      )
    );
  };

  const endDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    const target = dropTarget;
    setDropTarget(null);
    setDragging(false);
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.handle !== 'move' || target === null) return;

    if (target.kind === 'page') {
      if (target.index === drag.pageIndex) return;
      onMoveToPage(drag.itemId, target.index);
      setAnnouncement(`Combined onto page ${target.index + 1}.`);
      return;
    }
    onMoveToNewPage(drag.itemId, target.index);
    setAnnouncement(`Moved to a new page ${target.index + 1}.`);
  };

  const splitToNewPage = (id: number, pageIndex: number) => {
    onMoveToNewPage(id, pageIndex + 1);
    setAnnouncement('Moved to a page of its own.');
  };

  const handleKeyDown = (
    event: React.KeyboardEvent,
    item: PdfEditorItem,
    pageIndex: number,
    geometry: PdfPageGeometry
  ) => {
    if (disabled) return;
    const step = event.shiftKey ? 10 : 1;

    if (event.key === '[' || event.key === ']') {
      event.preventDefault();
      onRotate(item.id, event.key === ']' ? 90 : -90);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onRemove(item.id);
      return;
    }
    if (event.altKey && event.key === 'Enter') {
      event.preventDefault();
      splitToNewPage(item.id, pageIndex);
      return;
    }
    if (event.altKey && (event.key === 'PageUp' || event.key === 'PageDown')) {
      event.preventDefault();
      const target = event.key === 'PageUp' ? pageIndex - 1 : pageIndex + 1;
      if (target < 0 || target > pages.length) return;
      onMoveToPage(item.id, target);
      setAnnouncement(`Combined onto page ${target + 1}.`);
      return;
    }
    if (event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      onReorderWithinPage(item.id, event.key === 'ArrowUp' ? -1 : 1);
      return;
    }

    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!direction) return;
    event.preventDefault();

    if (event.altKey) {
      // Alt turns the arrows into a scale gesture via the south-east handle.
      onPlacementChange(
        item.id,
        scalePlacement(
          item.placement,
          'se',
          direction[0] * step,
          direction[1] * step,
          item.aspect,
          geometry,
          MIN_PLACEMENT_MM
        )
      );
      return;
    }
    onPlacementChange(
      item.id,
      movePlacement(item.placement, direction[0] * step, direction[1] * step, geometry)
    );
  };

  if (pages.length === 0) return null;

  /** The boundary before page `gapIndex`; dropping here makes a page of its own. */
  const renderGap = (gapIndex: number) => {
    const active = dropTarget?.kind === 'gap' && dropTarget.index === gapIndex;
    return (
      <div
        className="pdf-page-gap"
        data-pdf-page-gap={gapIndex}
        data-visible={dragging ? 'true' : undefined}
        data-active={active ? 'true' : undefined}
        aria-hidden="true"
      >
        <span>{active ? 'Drop here as its own page' : 'New page'}</span>
      </div>
    );
  };

  return (
    <section aria-label="Page layout" data-pdf-page-count={pages.length}>
      <p style={{ margin: '0 0 0.75rem', color: '#6b665c', fontSize: '0.8125rem' }}>
        Drag an image to move it and drag a corner to resize. Drop it on another page to combine the
        two, or drop it in the space between pages to give it a page of its own. With an image
        focused: arrows move, Alt+arrows resize, <kbd>[</kbd> / <kbd>]</kbd> rotate, Ctrl+arrows
        reorder, Alt+PageUp / PageDown combine onto the previous or next page, Alt+Enter splits it
        onto a new page.
      </p>

      <div className="pdf-page-list" ref={listRef}>
        {pages.map((page, pageIndex) => {
          const isDropTarget = dropTarget?.kind === 'page' && dropTarget.index === pageIndex;
          return (
            <Fragment key={pageIndex}>
              {renderGap(pageIndex)}
              <div className="pdf-page-shell">
                <div className="pdf-page-heading">
                  <span>
                    Page {pageIndex + 1} of {pages.length}
                  </span>
                  <span className="pdf-page-heading-actions">
                    <span>
                      {page.geometry.width.toFixed(0)} x {page.geometry.height.toFixed(0)} mm
                    </span>
                    <button
                      type="button"
                      className="pdf-page-move"
                      data-pdf-page-up={pageIndex + 1}
                      aria-label={`Move page ${pageIndex + 1} earlier`}
                      disabled={disabled || pageIndex === 0}
                      onClick={() => {
                        onMovePage(pageIndex, -1);
                        setAnnouncement(`Page moved to position ${pageIndex}.`);
                      }}
                    >
                      &uarr;
                    </button>
                    <button
                      type="button"
                      className="pdf-page-move"
                      data-pdf-page-down={pageIndex + 1}
                      aria-label={`Move page ${pageIndex + 1} later`}
                      disabled={disabled || pageIndex === pages.length - 1}
                      onClick={() => {
                        onMovePage(pageIndex, 1);
                        setAnnouncement(`Page moved to position ${pageIndex + 2}.`);
                      }}
                    >
                      &darr;
                    </button>
                  </span>
                </div>

                <div
                  ref={(element) => {
                    if (element) pageRefs.current.set(pageIndex, element);
                    else pageRefs.current.delete(pageIndex);
                  }}
                  data-pdf-page={pageIndex + 1}
                  className="pdf-page-canvas"
                  onPointerMove={(event) => continueDrag(event, page.geometry)}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: `${page.geometry.width} / ${page.geometry.height}`,
                    background: '#ffffff',
                    border: isDropTarget ? '2px solid #2563eb' : '1px solid #ddd8ce',
                    boxShadow: isDropTarget
                      ? '0 0 0 4px rgba(37,99,235,.15)'
                      : '0 1px 3px rgba(0,0,0,.1)',
                    touchAction: 'none',
                    overflow: 'hidden',
                  }}
                >
                  {margin > 0 && (
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: `${(margin / page.geometry.width) * 100}%`,
                        right: `${(margin / page.geometry.width) * 100}%`,
                        top: `${(margin / page.geometry.height) * 100}%`,
                        bottom: `${(margin / page.geometry.height) * 100}%`,
                        border: '1px dashed #cbd5e1',
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {page.items.map((item) => {
                    const selected = item.id === selectedId;
                    const quarter = item.rotation % 180 !== 0;
                    return (
                      // The image box is a composite control: it is draggable with a pointer and
                      // fully operable from the keyboard via the handler above.
                      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                      <div
                        key={item.id}
                        role="group"
                        tabIndex={disabled ? -1 : 0}
                        aria-label={`${item.name} on page ${pageIndex + 1}. Arrows move, Alt plus arrows resize, brackets rotate.`}
                        data-pdf-file={item.name}
                        data-pdf-placement={formatPlacement(item.placement, item.rotation)}
                        onFocus={() => onSelect(item.id)}
                        onKeyDown={(event) => handleKeyDown(event, item, pageIndex, page.geometry)}
                        onPointerDown={(event) => beginDrag(event, item, pageIndex, 'move')}
                        style={{
                          position: 'absolute',
                          left: `${(item.placement.x / page.geometry.width) * 100}%`,
                          top: `${(item.placement.y / page.geometry.height) * 100}%`,
                          width: `${(item.placement.width / page.geometry.width) * 100}%`,
                          height: `${(item.placement.height / page.geometry.height) * 100}%`,
                          outline: selected ? '2px solid #2563eb' : '1px solid rgba(0,0,0,.15)',
                          outlineOffset: 0,
                          cursor: disabled ? 'default' : 'grab',
                          touchAction: 'none',
                        }}
                      >
                        <img
                          src={item.previewUrl}
                          alt=""
                          draggable={false}
                          style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            // A quarter turn swaps the axes, so the pre-rotation box
                            // must be sized against the opposite edge of its container.
                            width: quarter
                              ? `${(item.placement.height / item.placement.width) * 100}%`
                              : '100%',
                            height: quarter
                              ? `${(item.placement.width / item.placement.height) * 100}%`
                              : '100%',
                            maxWidth: 'none',
                            objectFit: 'fill',
                            transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                            userSelect: 'none',
                            pointerEvents: 'none',
                          }}
                        />

                        {selected &&
                          !disabled &&
                          CORNERS.map((corner) => (
                            <span
                              key={corner}
                              data-pdf-handle={corner}
                              onPointerDown={(event) => beginDrag(event, item, pageIndex, corner)}
                              style={{
                                position: 'absolute',
                                left: CORNER_STYLE[corner].left,
                                top: CORNER_STYLE[corner].top,
                                width: 12,
                                height: 12,
                                marginLeft: -6,
                                marginTop: -6,
                                background: '#ffffff',
                                border: '2px solid #2563eb',
                                borderRadius: 2,
                                cursor: CORNER_STYLE[corner].cursor,
                                touchAction: 'none',
                              }}
                            />
                          ))}
                      </div>
                    );
                  })}
                </div>

                {page.items.some((item) => item.id === selectedId) && !disabled && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.375rem',
                      flexWrap: 'wrap',
                      marginTop: '0.5rem',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onRotate(selectedId!, -90)}
                    >
                      Rotate left
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onRotate(selectedId!, 90)}
                    >
                      Rotate right
                    </button>
                    {(['fit', 'fill', 'actual'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => onFit(selectedId!, mode)}
                      >
                        {mode === 'fit'
                          ? 'Fit page'
                          : mode === 'fill'
                            ? 'Fill page'
                            : 'Actual size'}
                      </button>
                    ))}
                    {page.items.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        data-testid="pdf-split-page"
                        onClick={() => splitToNewPage(selectedId!, pageIndex)}
                      >
                        Move to new page
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onRemove(selectedId!)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </Fragment>
          );
        })}
        {renderGap(pages.length)}
      </div>

      <p aria-live="polite" className="visually-hidden">
        {announcement}
      </p>
    </section>
  );
}
