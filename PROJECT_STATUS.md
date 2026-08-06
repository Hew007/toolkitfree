# ToolkitFree Project Status

Last updated: 2026-08-07
Repository: `Hew007/toolkitfree`
Primary branch: `master`
Production site: <https://toolkitfree.net/>

This is the living handoff for any GPT, Claude, coding agent, or human contributor. Read it together
with `AGENTS.md` before doing work. Update this file instead of writing a new handoff after every
task.

## Current Snapshot

- Repository baseline: local `master` at `232c857` (`docs: add PROJECT_STATUS.md living handoff and
  maintenance rules`), one commit ahead of `origin/master` (`008d2fb`), not yet pushed. Product code
  is identical to `008d2fb`; the extra commit only adds this handoff and its maintenance rules.
- Product state: the main product-quality redesign and interaction pass is complete. The owner
  manually approved the 2026-08-01 baseline and authorized its push on 2026-08-02.
- Growth state: external promotion has **not started**. The owner resumed work on 2026-08-05.
- Release caveat: Image Splitter and the expanded Image to PDF editor landed after the last
  owner-approved baseline. The full quality and browser suites were rerun and passed on 2026-08-05
  (see Validation State), and the production deployment was spot-checked. The remaining blocker
  before promotion is the owner's focused manual pass on the latest build.
- Advertising: intentionally disabled. Do not restore AdSense scripts, placeholders, or ad-oriented
  layout without explicit owner approval. Product value and user experience come first.
- Privacy model: selected file contents are processed locally in the browser. Normal site resources,
  the Background Remover model/runtime, and the site-hosted FFmpeg runtime may still be downloaded.
  Keep public claims precise.

## Public Product Surface

Current registry-driven public tools:

1. Image Converter
2. Image Compressor
3. Image Resizer
4. Image Enhancer
5. Image Collage Maker
6. Image Splitter
7. ID Photo Size & Print Tool
8. Image Cropper
9. Background Remover
10. Video to GIF, WebP & APNG
11. Image to PDF
12. PDF Splitter & Page Extractor
13. Favicon Generator
14. QR Code Generator

The static site currently expects 72 generated HTML pages. Tool metadata, variants, navigation,
related links, sitemap entries, Open Graph coverage, FAQs, and LLM registries are governed by the
registries and validation scripts described in `AGENTS.md`.

## Important Product Decisions

- Keep file-content processing local to the browser.
- Target a global English-speaking audience first; multilingual expansion can come later.
- Do not promise complete privacy, zero network traffic, unlimited files, unsupported formats,
  guaranteed compression savings, or guaranteed exact target sizes.
- AdSense remains off until the owner decides the site and its user value are mature enough.
- Background Remover must remain on `isnet_quint8` for now. A local comparison found FP16 roughly
  67% slower and about 88 MB larger with negligible improvement on the reported missing-leg-edge
  example. The current model can still lose difficult body-edge regions; treat this as a known model
  limitation, not a solved issue.
- Background-removal model and ONNX runtime assets are self-hosted under
  `public/generated/background-removal/1.7.0/` at build/dev time. Generated binaries are ignored by
  git; `scripts/prepare-assets.mjs` prepares both FFmpeg and background-removal assets.
- Homepage tool cards use a stable equal-width layout; avoid `nth-child`-driven featured sizing.
- The homepage converter hydrates with `client:idle`; interactive tool pages generally use
  `client:load`.
- Manual owner verification is required after meaningful public UI changes and before promotion.

## Completed Product Work

### 2026-08-01 quality and UX phases

- Completed the site foundation, visual-system refinement, content/SEO accuracy improvements, and
  Image Collage Maker simplification.
- Removed or disabled the premature advertising experience.
- Added clearer tool guidance, accurate processing limits, structured-data corrections, content
  freshness checks, and stronger internal linking.
- Improved upload thumbnails and compact option controls.
- Added visible, direct resizing interaction to Image Resizer.
- Added adaptive preview sizing to Image Enhancer and Image Cropper.
- Added cropper zoom and image positioning.
- Improved ID Photo laptop layout and centered the Image to PDF page area.
- Improved Image to PDF editing and the image-tool upload/edit/download flows.

### 2026-08-02 through 2026-08-05 additions

- Added Image Splitter with freely positioned row and column split lines, focused variant pages,
  touch/scroll fixes, and stitched-image seam detection.
- Expanded Image to PDF with page splitting/merging, reordering, deletion, and editor clearing.
- Added generated browser-test fixtures and shared browser discovery so tests do not depend on
  untracked local fixture files.

## Validation State

Last fully documented whole-site pass:

- Date: 2026-08-05, at `232c857` (product code identical to `008d2fb`).
- Production deployment spot-check: homepage, sitemap, `/tools/image-splitter/`,
  `/tools/image-to-pdf/`, the Background Remover asset manifest, and the FFmpeg runtime manifest all
  returned 200 on <https://toolkitfree.net/>; the deployed pages contain the newest Image Splitter
  seam-detection and Image to PDF split/reorder/clear features.
- `npm run check`: 12/12 quality gate steps passed, including 46 seam-detection assertions.
- `npm run test:e2e` (Chrome, full): 12/12 scripts passed with zero browser errors.
- `npm run test:e2e:edge` (Edge, smoke): 2/2 scripts passed with zero browser errors.
- Responsive/accessibility sweep: 71 public routes at widths 320, 375, 768, 1024, and 1440;
  355 checks and 355 screenshots (`docs/ui-regression/2026-08-05T13-48-46.081Z`).
- Site integrity: 72 HTML pages and 4,292 internal links, with zero broken or redirecting internal
  links.

The owner manually approved this build on 2026-08-07; it is now the last owner-approved state.

## Current State and Exact Next Actions

Steps 1–4 of the previous resume plan were completed on 2026-08-05: the tree was inspected, the
production deployment was spot-checked, and the full quality plus browser suites passed (see
Validation State). The remaining sequence is:

1. `owner approved` — On 2026-08-07 the owner completed the focused manual pass on the latest build
   (Image Splitter with seam detection, the expanded Image to PDF editor, uploads/downloads, laptop
   and mobile layout, Background Remover loading) and approved it.
2. `in progress` — Collect a fresh Search Console and Cloudflare Web Analytics baseline.
3. `in progress` — Produce a concrete promotion plan with platform order, content, target landing
   pages, measurements, and feedback checkpoints. Obtain approval before posting externally.
4. Continue technical SEO, content SEO, GEO/answer-engine optimization, internal linking, and
   relevant non-spammy link acquisition based on measured data.

External promotion may begin only after the owner approves the concrete promotion plan in step 3.

## Suggested First Promotion Candidates

These are planning candidates, not approved external actions:

- Image Compressor: broad practical demand and a simple value proposition.
- Image Converter and its focused format variants: strong long-tail search coverage.
- Image Splitter: differentiated workflow with stitched-image seam detection.
- Background Remover: attractive demo value, with careful wording around model download and edge
  accuracy.

## Maintenance Protocol

After every completed feature or important change, update this file in the same commit:

1. Change `Last updated`.
2. Rewrite **Current Snapshot** and **Current Pause and Exact Resume Point** if the state or next
   action changed.
3. Update **Validation State** with commands actually run and their results.
4. Record durable product decisions under **Important Product Decisions**.
5. Add one concise dated item to **Recent Progress Log** below.
6. Keep only the latest 20 routine log entries; preserve older information only when it remains a
   durable decision or affects unfinished work.

Use explicit states: `planned`, `in progress`, `blocked`, `implemented but unverified`, `verified`,
or `owner approved`. Never infer owner approval.

## Recent Progress Log

- 2026-08-07 — `owner approved`: the owner completed the manual checklist pass on the 2026-08-05
  validated build and approved it. Next: analytics baseline and an approved promotion plan.
- 2026-08-05 — `verified`: reran the full release checks at `232c857` — production deployment
  spot-check, `npm run check` (12/12), Chrome full e2e (12/12, zero browser errors), and Edge smoke
  (2/2). Handed the owner a manual checklist; owner approval is still pending.
- 2026-08-05 — `verified`: synchronized local `master` to `008d2fb`; created this living handoff and
  made its maintenance mandatory in `AGENTS.md`. No product behavior changed.
- 2026-08-05 — `verified`: test fixtures became generated assets and browser discovery was shared.
- 2026-08-04 — `implemented`: Image to PDF gained split/merge, reorder, delete, and clear workflows.
- 2026-08-04 — `implemented`: Image Splitter gained stitched-image seam detection and associated
  focused validation.
- 2026-08-02 — `owner approved`: the 2026-08-01 product-quality baseline passed manual review and
  was pushed to `master`.
- 2026-08-01 — `verified`: the documented whole-site quality and responsive browser pass completed
  with zero browser errors.
