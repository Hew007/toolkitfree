# ToolkitFree Project Status

Last updated: 2026-08-05
Repository: `Hew007/toolkitfree`
Primary branch: `master`
Production site: <https://toolkitfree.net/>

This is the living handoff for any GPT, Claude, coding agent, or human contributor. Read it together
with `AGENTS.md` before doing work. Update this file instead of writing a new handoff after every
task.

## Current Snapshot

- Repository baseline inspected for this handoff: local `master` was clean and synchronized with
  `origin/master` at `008d2fb` (`refactor(test): 自动生成测试fixtures并提取浏览器查找逻辑`).
  The intended local changes after that inspection are this file plus the maintenance instructions
  in `AGENTS.md` and `CLAUDE.md`; inspect `git status` for the live state.
- Product state: the main product-quality redesign and interaction pass is complete. The owner
  manually approved the 2026-08-01 baseline and authorized its push on 2026-08-02.
- Growth state: external promotion has **not started**. The owner paused further work on 2026-08-05
  because the current AI quota was exhausted.
- Release caveat: public product changes landed after the last owner-approved baseline, notably Image
  Splitter and the expanded Image to PDF editor. Before promotion, rerun the complete current quality
  and browser suites and hand the latest production build to the owner for a focused manual pass.
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

- Date: 2026-08-01
- Quality gates: 11/11 passed.
- Browser suites: 11/11 passed in Chrome with zero browser errors.
- Responsive/accessibility sweep: 66 public routes at widths 320, 375, 768, 1024, and 1440;
  330 screenshots generated.
- Site integrity at that baseline: 67 HTML pages and 3,766 internal links, with zero broken or
  redirecting internal links.
- Owner manually approved that baseline before it was pushed.

This evidence predates Image Splitter and the latest Image to PDF work. The current repository has
focused tests for those additions, but this file does not claim that a fresh full-suite and owner
manual pass has been completed at `008d2fb`.

## Current Pause and Exact Resume Point

Do not start external promotion or make speculative product changes while the owner has paused work.

When the owner resumes:

1. Fetch/pull and inspect the current branch and working tree.
2. Confirm the latest commit is deployed successfully to <https://toolkitfree.net/> and that static
   Background Remover and FFmpeg assets load from the intended site paths.
3. Run `npm run check`.
4. Run `npm run test:e2e` and, when relevant, `npm run test:e2e:edge`.
5. Give the owner a focused manual checklist covering Image Splitter, the expanded Image to PDF
   editor, uploads/downloads, laptop layout, mobile layout, and Background Remover loading.
6. Only after the owner approves the latest build, collect a fresh Search Console and Cloudflare Web
   Analytics baseline.
7. Produce a concrete promotion plan with platform order, content, target landing pages,
   measurements, and feedback checkpoints. Obtain approval before posting externally.
8. Continue technical SEO, content SEO, GEO/answer-engine optimization, internal linking, and
   relevant non-spammy link acquisition based on measured data.

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
