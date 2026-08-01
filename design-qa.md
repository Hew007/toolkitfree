# Design QA — UX implementation batches 1–2

## Scope

This review covers the approved interaction improvements implemented across both batches:

- image thumbnails in shared upload lists;
- segmented compression-mode controls;
- viewport-adaptive Image Enhancer and Image Cropper previews;
- direct-manipulation Image Resizer preview;
- Image Cropper zoom and desktop workspace;
- compact two-column ID Photo workspace;
- centered Image to PDF page previews;
- one accessible native file input per uploader.

Background-removal model evaluation is intentionally outside this implementation scope.

## Visual truth and test state

- Viewport: 1366 × 768 CSS pixels for direct comparison.
- Browser: in-app browser using the production preview build.
- State: the same portrait image was uploaded to every image tool.
- Source screenshots: `docs/ux-audit-2026-08-01/01-compressor-uploaded.png` through `06-image-to-pdf-uploaded.png`.
- Implementation screenshots: `docs/ux-audit-2026-08-01/after/01-compressor-after.png` through `08-id-photo-workspace.png`.
- Resizer drag-fix comparison:
  - `docs/ux-audit-2026-08-01/after/09a-resizer-before-drag.png`
  - `docs/ux-audit-2026-08-01/after/09b-resizer-after-drag.png`

The relevant source and implementation screenshots were opened together and compared at the same viewport and uploaded-image state.

## Full-view comparison

### Image Compressor and shared uploads

- Uploaded files now show a thumbnail, name, size, and explicit Remove action.
- Both compression modes remain visible and require one click to switch.
- File selection exposes one accessible native input while retaining the existing visual treatment.

### Image Enhancer

- Preview height now follows the available viewport instead of using one fixed desktop cap: `clamp(400px, calc(100dvh - 300px), 640px)`.
- At 1366 × 768 the measured preview height is 468 px, increased from approximately 338 px, while the adjustment controls begin immediately below the preview.
- Images remain contained and the source/export resolution is unchanged.

### Image Resizer

- The large upload dropzone collapses after selection, leaving more room for the task.
- A live preview and current output dimensions appear beside the settings.
- The original second-batch implementation changed the output numbers during a proportional drag but kept the preview frame at a fixed visual width because its CSS size depended only on aspect ratio.
- The preview frame now scales from a normalized initial display size according to the selected output dimensions. At the comparison viewport, changing from 800 × 600 to 1000 × 750 grows the rendered frame from 320 × 246.15 px to 400.4 × 307.69 px.
- A real Chrome pointer drag is covered by the focused regression and must increase both the numeric dimensions and the rendered frame dimensions.
- Aspect-ratio behavior and manual fields remain synchronized with the visual preview.
- Oversized previews scroll inside the preview stage instead of overflowing the page.

### Image Cropper

- Desktop now uses a two-column workspace: preview on the left and controls/action on the right.
- Preview zoom supports 100–200%, Out/In buttons, and a range control.
- At 110%, the image grows inside the bounded preview and uses an internal scrollbar rather than widening the page.
- The primary Crop Image action is fully visible in the initial 768 px-high viewport.

### ID Photo Size & Print Tool

- Repeated explanatory badges were consolidated and the editor/settings now share a compact two-column workspace.
- Settings use three columns where space allows.
- The primary preparation action remains visible at the bottom of the settings panel while the panel scrolls.
- The layout stacks cleanly at tablet and mobile widths.

### Image to PDF

- The page preview is centered within the editor region instead of aligning to the left.

## Accessibility and interaction checks

- Compression modes use native radio inputs inside a labelled fieldset.
- File selection uses one native file input with a visible focus state.
- Thumbnail alternative text uses the uploaded filename.
- Cropper zoom has button and range alternatives; Resizer direct manipulation retains editable numeric fields.
- Upload, removal, mode switching, resizing, zoom, cropping, enhancement, PDF editing, processing, and downloads are covered by browser regression checks.
- No browser console errors were observed.

## Automated verification

- Full local quality gate: passed, including type checking, lint, formatting, production build, unit checks, SEO checks, and integrity checks.
- Chrome browser coverage: passed across the complete suite. Responsive/accessibility coverage checked 66 public routes at 320, 375, 768, 1024, and 1440 px (330 page-width combinations).
- Focused Resizer/Cropper Chrome regression: passed after the drag-visibility fix, including the new rendered-frame growth assertions.
- The final PDF-page scenario was rerun independently after a test-runner close-target shutdown flake and passed.
- Browser errors: 0.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: Cropper intentionally shows an internal horizontal scrollbar when the user zooms beyond the fitted preview; the page itself does not overflow.

## Comparison history

- P1 found: Resizer proportional dragging updated the width and height fields but caused no visible preview-size change.
- Fix: replace the aspect-ratio-only frame sizing with a normalized pixel-to-display scale; bound oversized previews inside a scrollable stage.
- Post-fix evidence: the same 1366 × 768 uploaded-image view visibly grows from the `09a` capture to the `09b` capture, and the focused real-pointer browser regression passes with zero browser errors.
- Remaining actionable P0/P1/P2 findings: none.

## Final result

passed
