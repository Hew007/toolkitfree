# ToolkitFree Project Status

Last updated: 2026-08-16
Repository: `Hew007/toolkitfree`
Primary branch: `master`
Production site: <https://toolkitfree.net/>

This is the living handoff for any GPT, Claude, coding agent, or human contributor. Read it together
with `AGENTS.md` before doing work. Update this file instead of writing a new handoff after every
task.

## Current Snapshot

- Repository baseline: local and `origin/master` include the owner-approved claims cleanup at
  `1bfca88`. The ten commits published on 2026-08-16 include nine documentation/handoff commits plus
  the claims cleanup; remote reconciliation found no remote-only commits before the push.
- Product state: the main product-quality redesign, Image Splitter, and expanded Image to PDF editor
  are complete. The full release checks passed on 2026-08-05, and the owner manually approved that
  build on 2026-08-07.
- Growth state: external promotion has **not started**. On 2026-08-15 the owner approved the WP-03
  thumbnail, all three gallery images, and the poster, but rejected the old MP4 and all three
  slideshow-like GIFs for publication. The 2026-08-16 replacement captures now use the approved
  self-created source images, and the Image Splitter plus the 21-second homepage take are accepted
  for post-production. Image to PDF still needs a short editor-action insert, and Background Remover
  needs a short post-result solid-color insert; neither requires another full recording. The local
  Background Remover now supports post-result background switching without another model run and
  has passed its focused browser regression. The owner approved the behavior and authorized the
  push on 2026-08-16; production deployment verification is the remaining gate before that insert
  is recorded. S0.5 account qualification can continue in parallel; S1 directory submissions
  remain the next external action after S0 closes.
- Release state: `verified`. The owner approved the claims cleanup, commit `1bfca88` was pushed to
  `origin/master`, and the connected Cloudflare deployment served the new copy and asset hashes on
  2026-08-16. Post-deployment checks passed for representative changed pages, sitemap, LLM registry,
  the Background Remover resource manifest, and the FFmpeg runtime manifest.
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

On 2026-08-12, the production homepage, `/tools/image-splitter/`, and `/tools/image-to-pdf/` were
spot-checked and returned HTTP 200. This was an availability check, not a rerun of the full suite.

On 2026-08-15, before replacement motion recording, public claims were reviewed and qualified across
the homepage, 13 tool families and two guides. The local result passed `npm run check` equivalently
through `scripts/run-quality-gates.mjs` (12/12 steps), including 13 unit/algorithm scripts, 72 HTML
pages, 4,292 internal links, SEO, content freshness, and zero broken links. The full Chrome regression
also passed 12/12 scripts with zero browser errors. Its responsive/accessibility sweep covered 71
public routes at widths 320, 375, 768, 1024, and 1440: 355 checks and 355 screenshots under
`docs/ui-regression/2026-08-15T02-44-15.910Z`. The owner manually approved the revised copy on
2026-08-16.

The final 2026-08-16 closeout also replaced one remaining absolute local-processing sentence in the
Image Collage interactive UI and updated the affected content dates to 2026-08-16. After that change:

- the 12-step quality gate passed, including 13 unit/algorithm scripts, SEO, content freshness,
  72 HTML pages, 4,292 internal links, and zero broken links;
- the full Chrome suite passed 12/12 scripts with zero browser errors; its responsive sweep passed
  355/355 route-width checks and saved screenshots under
  `docs/ui-regression/2026-08-16T00-24-52.197Z`;
- Edge passed its converter matrix and 355/355 responsive/accessibility assertions with zero browser
  errors. The test runner then exited nonzero only because Windows kept the isolated Edge profile
  locked during temporary-directory cleanup; the matching test-only Edge processes and directory
  were identified and removed without touching the owner's normal browser session.
- Commit `1bfca88` was pushed to `origin/master`. The connected Cloudflare deployment then served
  the new homepage wording, revised Background Remover and Image to PDF copy, new Favicon Generator
  title, updated Image Collage JavaScript hash, sitemap dates, and LLM registry. The homepage,
  representative changed pages, sitemap, LLM registry, Background Remover `resources.json`, and
  FFmpeg manifest returned HTTP 200 with their expected current content.

## Current State and Exact Next Actions

Product and measurement gates are complete. The active one-week sequence for 2026-08-12 through
2026-08-18 is:

1. `in progress` — Close S0 motion assets. Directory copy is approved;
   the WP-03 thumbnail, three gallery images, and poster are owner-approved. The old 28.53-second
   MP4 and three step-based GIFs
   are rejected for publication and remain reference-only. Follow
   `docs/promotion/06-motion-recording-brief.md`. The 2026-08-16 raw-footage audit selected the
   21-second `08-18-02` homepage take for trimming and rejected the 6-second `08-21-28` take because
   it starts mid-list and opens Image Splitter. The `09-08-34` Image Splitter replacement is
   accepted. The `09-09-33` Image to PDF and `09-10-40` Background Remover replacements use the
   approved images and are usable as base footage, but the owner still needs two short inserts:
   show one visible reorder/move-to-new-page editor action for Image to PDF, and show transparent
   plus one solid-color result state for Background Remover. The latter is now supported by a local,
   browser-tested feature change that the owner approved for push on 2026-08-16; production
   deployment verification remains before recording it. Codex then edits the accepted footage into
   one 45–60 second video and three fluid GIFs.
2. `in progress` — Complete S0.5 account qualification. Reddit, Hacker News, Product Hunt, DEV, and
   YouTube accounts were registered around 2026-07-26, but profile completion, genuine participation,
   posting access, and YouTube channel/upload readiness still require owner login and confirmation.
3. `planned` — Submit the site to Uneed, SaaSHub, and AlternativeTo in that order. Codex checks the
   current rules and prepares each field set; the owner logs in, approves, and clicks submit. Record
   every result in `docs/promotion/04-measurement-log.csv`.
4. `in progress` — The 55-second YouTube storyboard, captions, title, description, UTM links, tags,
   and upload checklist are complete. The production approach changed on 2026-08-15: reuse the same
   four owner-recorded raw clips for the master video and three tool clips for replacement GIFs.
   Codex handles editing and export; the owner reviews a local cut and uploads an Unlisted copy
   before deciding whether to make it public.
5. `planned` — On 2026-08-18, review directory status, Cloudflare referrals, Search Console movement,
   and feedback, then select the first eligible community test for the following week.

Promotion plan: the operative playbook is `docs/promotion-execution-plan-2026-08-07.md`
(stages S0 asset prep → S1 directories → S2 single-community test → S3 Show HN → S4 Product Hunt →
S5 ongoing SEO/GEO), which supersedes the execution order in `docs/promotion-plan-2026-07-22.md`
while keeping that document's constraints, claims wording, and work-package definitions normative.
All external posts are published from the owner's accounts; the owner approves copy and timing for
every post. Current stage: S0 closure, with S0.5 and S1 starting in parallel. No Reddit, Show HN, or
Product Hunt launch should occur until account eligibility and owner response availability are
confirmed.

Candidate technical follow-ups (not yet scheduled):

- The `section.howto-section` on tool pages reports CLS 0.123 (17% of CLS samples "needs
  improvement"); consider reserving space for it to reach 100% good CLS.
- `verified` (resolved, no product bug): the 2026-08-08 production Background Remover failures
  occurred only in the automated Chrome session; the owner manually verified the flow works on
  production in a normal browser session on 2026-08-08. Attributed to Cloudflare bot-management
  interfering with the automated session. Automated recordings of this tool should use the local
  preview build instead.

## Analytics Baseline (2026-08-07)

Search Console (last 28 days, domain property `sc-domain:toolkitfree.net`):

- Totals: 1 click, 2 impressions, average position 118. Only query: "free online image toolkit".
- Pages with impressions: homepage (1 click / 2 impressions) plus 9 pages with 1 impression each
  (/terms, image-converter, qr-generator, image-cropper, image-enhancer, image-compressor,
  guides/image-format-comparison, image-converter/png-to-webp, image-cropper/crop-to-square).
- Indexing (last update 2026-07-24): 54 indexed, 40 not indexed — 20 page-with-redirect,
  7 discovered-not-indexed, 6 alternate-with-canonical, 5 crawled-not-indexed, 1 noindex,
  1 duplicate-canonical. The redirect and canonical buckets are largely expected
  (trailing-slash 307s and variants); the 12 discovered/crawled-not-indexed pages are worth
  rechecking after promotion starts.

Cloudflare Web Analytics (last 30 days, bots excluded):

- 40 visits, 120 page views; much of this is likely the owner's own testing (China 80 page views,
  referrer toolkitfree.net 80 / direct 40).
- Top paths: / (50), image-resizer (10), pdf-splitter (10), qr-generator (10), image-collage (10).
- Countries: China 80, US 20, Canada 10, Japan 10. Devices: desktop 70, mobile 50.
- Performance: average page load 2,314 ms; Core Web Vitals LCP 100% good, INP 100% good, CLS 83%
  good / 17% needs improvement (debug element: `section.howto-section`, CLS 0.123).

Treat these numbers as the pre-promotion zero point: effectively no organic search presence yet.

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

- 2026-08-16 — `owner approved` / `push authorized`: Claude Code implemented post-result
  Background Remover colour switching. The transparent cutout Blob is cached after one AI run;
  transparent, preset, and custom colours now recompose the downloadable PNG locally without
  unmounting the result or rerunning the model. Recomposition locks colour inputs and Download so
  stale-colour bytes cannot be saved, decodes only a temporary ImageBitmap, revokes replaced object
  URLs, and guards stale asynchronous results. TypeScript, ESLint, Prettier, all 13 unit/algorithm
  suites, the 12-step quality gate, and the focused real-Chrome secondary-tools regression passed.
  The regression observed transparent → red → transparent with unchanged model-run count, stable
  active object-URL count, and zero browser errors. The owner manually accepted the local behavior
  and authorized a direct push to `master`; production deployment verification and the final short
  Background Remover insert follow.

- 2026-08-16 — `partially accepted` / `two short inserts required`: reviewed the owner's three
  `09:08`–`09:11` replacement recordings using metadata and interval frame sampling. All are
  readable 1920×1032 H.264 captures at approximately 30 fps and use the approved self-created
  source images. Accepted Image Splitter: it reaches detected split lines and six successful
  results. Image to PDF reaches a three-page PDF result but does not visibly demonstrate the
  required reorder or move-to-new-page editor action. Background Remover reaches the transparent
  result but then scrolls away without showing a solid-color result. Preserve both base recordings;
  only those two short missing-action inserts remain before post-production.

- 2026-08-16 — `verified` / `re-recording required`: audited all five files in the owner's Captures
  folder by metadata plus start/middle/end and interval frame sampling. Every file is readable and
  approximately 30 fps. Selected the 21-second `08-18-02` homepage take for post-production and
  rejected the 6-second `08-21-28` take. The three new tool clips demonstrate working results, but
  they use images other than the approved self-created source set; the Background Remover take also
  ends before the required transparent/solid-color comparison. Owner re-records those three tool
  clips; Codex handles all trimming, browser-chrome cropping, silent-audio removal, 30 fps
  normalization, captions, MP4 assembly, and GIF export afterward.

- 2026-08-16 — `owner approved` / `verified` / `published`: owner manually approved the revised
  public claims copy. Remote reconciliation found local `master` nine commits ahead of
  `origin/master` with zero remote-only commits. A final assistant review found and corrected one
  remaining absolute Image Collage sentence and refreshed the affected content dates. The quality
  gate, Chrome full regression, and Edge product assertions then passed with zero browser errors.
  Commit `1bfca88` was pushed to `origin/master`; the connected Cloudflare deployment served the new
  copy and asset hashes, and representative production pages plus sitemap, LLM registry, Background
  Remover resources, and FFmpeg manifest passed post-deployment checks. Motion recording is ready.

- 2026-08-15 — `verified` / `owner review pending`: qualified absolute and unsupported public claims
  across the homepage, 13 tool families, variants, and two guides before new motion recording;
  synchronized the public LLM registries; and passed the 12-step quality gate plus all 12 Chrome
  browser suites. The responsive sweep passed 355/355 route-width checks with zero browser errors.
  The copy is local and not deployed; owner manual verification remains the publication gate.

- 2026-08-15 — `owner approved` / `in progress`: owner approved the WP-03 thumbnail, three gallery
  images, and poster; rejected the old MP4 and three slideshow-like GIFs for all public use. Added a
  replacement motion-production brief that reduces owner work to four raw browser recordings;
  Codex will handle the master-video edit, subtitles, encoding, and three GIF exports. The rejected
  files remain as workflow references only. Account qualification and first directory submissions
  remain outstanding.

- 2026-08-12 — `in progress`: reconciled the living status and promotion plan with the repository
  and working materials. Confirmed local `master` is nine documentation commits ahead of
  `origin/master`, with product code unchanged from the deployed baseline; rechecked three key
  production routes (HTTP 200); recorded that all five promotion accounts exist but still need
  profile/eligibility checks; refreshed the privacy gallery to remove the obsolete advertising
  reference; added the owner review/first-week execution checklist; and completed the 55-second
  YouTube storyboard and metadata package. Also verified the three official directory entry URLs
  and prepared the shared submission fields; SaaSHub and AlternativeTo require the owner's normal
  browser session to pass Cloudflare before their current form fields can be confirmed. Next owner
  action is the short asset decision pass and account qualification check, followed by S1 directory
  submissions.

- 2026-08-09 — `verified`: reorganized `docs/`. Added `docs/README.md` (folder index and three
  maintenance rules) and `docs/archive/` for completed or superseded documents, with a README
  warning that archived status markers are unreliable — notably `id-photo/tasks/` still marks
  IDP-02…06 as "not started" although the ID Photo tool shipped and passed regression. Removed
  ~68 MB of intermediate render artifacts from `promotion/assets/wp-03/` (audio/video variants,
  duplicate renders, contact sheets), keeping the six manifest-listed finals plus the render
  scripts and production captures. `docs/` went from 618 MB to 55 MB.

- 2026-08-08 — `owner approved`: adopted a plan adjustment — register all community accounts now,
  age them 1–2 weeks with light genuine participation before any community post, and produce a
  45–60s YouTube demo video during that window as the canonical asset other channels reference
  (site remains the primary link everywhere; no YouTube embed on the site). Directory submissions
  proceed without waiting. Script and metadata are in the channel copy pack.
- 2026-08-08 — `in progress`: promotion stage S0 asset work complete — demo GIFs for Image
  Splitter, Image to PDF, and Background Remover recorded (BR on local preview after the owner
  confirmed production works and the automated-session failures were attributed to Cloudflare bot
  management); claims-facts refreshed to 14 tools / 72 pages; directory copy pack approved by the
  owner; measurement log created. GIFs are step-by-step (6–9 frames) rather than smooth screen
  recordings — owner may re-record with GifCam for final polish. Outstanding: owner review of
  WP-03 assets and the account inventory; then S1 directory submissions begin.
- 2026-08-07 — `in progress`: wrote the operative promotion execution plan
  (`docs/promotion-execution-plan-2026-08-07.md`) merging the adopted phase order with the
  2026-07-22 playbook's constraints and work packages. Stage S0 (demo GIFs, claims-facts refresh,
  directory copy pack, measurement log) started; owner to review WP-03 assets and fill the account
  inventory.
- 2026-08-07 — `verified`: collected the Search Console + Cloudflare Web Analytics baseline
  (1 click / 2 impressions in 28 days; 54 pages indexed; 40 visits in 30 days, mostly self-testing)
  and adopted the phased promotion plan. Found a CLS 0.123 candidate fix on `section.howto-section`.
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
