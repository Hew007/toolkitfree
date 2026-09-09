# ToolkitFree Project Status

Last updated: 2026-09-09
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
- Growth state: directory and YouTube promotion have started; the first community test has not yet
  been submitted. Uneed is queued; SaaSHub has at least one verified-alternative discovery surface
  while direct product-page approval remains unconfirmed; and the approved demo is Public on
  YouTube. Reddit participation is verified and the final `r/indiehackers` Image Splitter feedback
  candidate is ready for owner review. On 2026-08-15 the owner approved the WP-03
  thumbnail, all three gallery images, and the poster, but rejected the old MP4 and all three
  slideshow-like GIFs for publication. The 2026-08-16 replacement captures now use the approved
  self-created source images. All four final raw clips are accepted for post-production and copied
  under canonical names in `docs/promotion/assets/recording-raw/`: Image Splitter, Image to PDF,
  Background Remover, and the 21-second homepage take. The published Background Remover supports
  post-result background switching without another model run; the final recording demonstrates
  transparent, blue, red, and dark result backgrounds. No further owner recording is required.
  S0.5 qualification for Product Hunt, Hacker News, and DEV can continue in parallel. GSC and
  Cloudflare pre-Reddit baselines are complete. Cloudflare exposed two CLS 1 samples on the Image
  Splitter and Image-to-PDF route families. Controlled upload traces measured Image-to-PDF at
  0.0061 and Image Splitter at 0.0839; supplying the known Splitter preview dimensions reduced it to
  0.0090 (89%). The fix passed the 12-step quality gate and focused browser regressions, and the
  owner approved the local page on 2026-08-30. Commit `9f758f2` was pushed to `origin/master`; the
  connected Cloudflare deployment serves the new `ImageSplitter.BR6SFwgQ.js` asset with the fix.
  The technical release gate is complete before the Reddit feedback test.
- Release state: `verified`. The owner approved the claims cleanup, commit `1bfca88` was pushed to
  `origin/master`, and the connected Cloudflare deployment served the new copy and asset hashes on
  2026-08-16. Post-deployment checks passed for representative changed pages, sitemap, LLM registry,
  the Background Remover resource manifest, and the FFmpeg runtime manifest.
- Design direction: the owner reviewed several UI directions on 2026-08-29 and chose the warm
  neutral palette with a single indigo accent (option A). Its tokens are in `global.css` and the
  warm page ground is now applied site-wide, with the three background roles separated. The Image
  Compressor is the first tool rebuilt on the reviewed interaction model (purpose presets, three
  encoded candidates, no submit step, fine-tune folded but complete). The other thirteen tools are
  unchanged and still use the previous interaction; they inherit only the new surfaces. Owner review
  of both changes is pending.
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

On 2026-08-24, the homepage's generic crop quick path was changed to the canonical Image Cropper
route. Validation completed before owner review:

- the 12-step quality gate passed with 13 unit/algorithm scripts, 72 generated pages, 4,292 internal
  links, and zero broken or redirecting internal links;
- Chrome smoke regression passed 2/2 scripts with zero browser errors;
- the responsive/accessibility sweep passed 355/355 route-width checks across 71 routes at 320,
  375, 768, 1024, and 1440 pixels, with screenshots under
  `docs/ui-regression/2026-08-23T23-13-45.428Z`.

The owner manually approved the local preview and authorized publication. Commit `204ffa9` was
pushed to `origin/master`; the production homepage then served `Crop image online`, linked to
`/tools/image-cropper/`, and no longer served the old `Crop to square` quick-path entry.

## Current State and Exact Next Actions

Product and initial measurement gates are complete. The active sequence as of 2026-08-30 is:

1. `owner approved` — S0 motion assets are closed. Directory copy is approved;
   the WP-03 thumbnail, three gallery images, and poster are owner-approved. The old 28.53-second
   MP4 and three step-based GIFs
   are rejected for publication and remain reference-only. Follow
   `docs/promotion/06-motion-recording-brief.md`. The final accepted sources are the `09-08-34`
   Image Splitter take, `10-06-05` Image to PDF take, `10-07-48` Background Remover take, and
   `08-18-02` homepage take. Canonical copies are present in
   `docs/promotion/assets/recording-raw/`. Owner recording is complete. Codex rendered and visually
   checked the 56.67-second 1080p master plus three fluid GIFs in
   `docs/promotion/assets/final-motion/`; measured specs and the exact edit list are in
   `asset-manifest.md`. The owner approved the preferred music version on 2026-08-16; it uses Mixkit
   `Close Up` by Michael Ramir C. under
   the Mixkit Stock Music Free License; the silent master remains a fallback and full provenance is
   in `music-license-record.md`. The approved music master is now Public on YouTube; the silent
   master remains the fallback.
2. `in progress` — Complete S0.5 account qualification. Reddit is now qualified through visible,
   genuine participation. Hacker News, Product Hunt, DEV, and
   YouTube accounts were registered around 2026-07-26. YouTube channel and upload readiness are now
   confirmed; the remaining community profiles still require profile completion, genuine
   participation, and posting-access checks.
3. `in progress` — Uneed and SaaSHub submissions are complete. ToolkitFree was saved to Uneed's
   free queue on 2026-08-16 and the owner dashboard shows it as `Unpublished`, scheduled for
   2027-02-08. Uneed closed new free-queue entries on 2026-08-17, but its official changelog says
   products already in line keep their dates. No paid acceleration was purchased. SaaSHub supports free submission and product
   verification. SaaSHub confirmed successful submission on 2026-08-20 and states that the listing
   will appear after approval. The listing is now verified and enriched with its logo, homepage
   screenshot, Free pricing, accurate extended description, and public YouTube demo; SaaSHub's
   platform approval remains pending with an indicated wait of up to 32 days. On 2026-08-30, a
   current search result surfaced ToolkitFree in SaaSHub's `Verified Alternatives` section for
   TinyWow. This proves a public discovery surface; the direct product page could not be fetched, so
   full-page approval remains unconfirmed. AlternativeTo is
   removed from execution
   because its official eligibility rules normally exclude converters, PDF tools, QR generators,
   background removers, ID-photo generators, and collections of online tools. The owner approves
   each final external submission; record every result in `docs/promotion/04-measurement-log.csv`.
4. `complete / Public` — The approved 56.67-second music master, three GIFs, final title,
   description, UTM links, focused tags, 1280×720 three-tool YouTube thumbnail, English SRT, music
   license record, and upload checklist are complete. The exact copy/paste package is
   `docs/promotion/assets/youtube-upload/youtube-upload-package.md`. Public visibility requires a
   separate approval.
   Owner login succeeded on 2026-08-16. YouTube showed two zero-subscriber channels with the same
   visible name; the owner identified the existing channel by its ToolkitFree logo. Studio confirmed
   the target as `ToolkitFree` channel `UCzOeU_EDy79n3dmaHdmya8A`, with zero subscribers, no existing
   videos, and an available upload entry. After the owner's action-time approval and personal phone
   verification, the video was saved Unlisted on 2026-08-16 at
   `https://youtu.be/dk4mtf6H8aA`. Studio confirms the custom thumbnail, English (United States)
   timed subtitles, completed HD processing, and `No issues found` copyright result. The owner
   changed visibility to Public on 2026-08-20.
5. `Reddit eligibility rebuilding` — The owner submitted the prepared Image Splitter feedback post
   to `r/indiehackers` with the required `Self Promotion` flair on 2026-08-31. AutoModerator removed
   <https://www.reddit.com/r/indiehackers/comments/1w2wrjy/> within about one minute because the
   account has fewer than 10 comment karma in that specific community. Preserve the post; do not
   delete, appeal, edit, or repost. Continue genuine non-promotional participation until the gate is
   satisfied. The owner sent modmail on 2026-08-31 asking whether the removed attempt consumed the
   one-time self-promotion allowance and whether a retry is permitted after meeting the gate;
   response is pending. The current redesigned profile shows only 2 total site-wide karma and 12
   contributions; neither is the required community comment-karma value.

Promotion plan: the operative playbook is `docs/promotion-execution-plan-2026-08-07.md`
(stages S0 asset prep → S1 directories → S2 single-community test → S3 Show HN → S4 Product Hunt →
S5 ongoing SEO/GEO), which supersedes the execution order in `docs/promotion-plan-2026-07-22.md`
while keeping that document's constraints, claims wording, and work-package definitions normative.
All external posts are published from the owner's accounts; the owner approves copy and timing for
every post. Current stage: S0 is complete, S1 has executed its first directory set, and the S2
baseline and focused CLS work are complete. The owner approved the local fix and production serves
the new asset. The first Reddit submission was automatically removed because the account has fewer
than 10 `r/indiehackers` comment karma. Do not repost or expand to another community while rebuilding
this explicit eligibility gate. No Show HN or Product Hunt launch should occur until Reddit retry
eligibility, the one-time allowance, and owner response availability are confirmed.

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

- 2026-09-09 — `merged with master` / `revalidated`: pull request #12 (the Background Remover
  cross-origin isolation headers) landed on master, so master was merged into the resizer branch.
  Only `PROJECT_STATUS.md` conflicted — both sides had added a 2026-09-09 log entry — and the
  resolution keeps both, newest first; `public/_headers` came across cleanly and the built output
  still carries the four cross-origin header lines. Revalidated on the merged tree: all ten runnable
  gates passed, the full resizer and cropper Chrome suite passed, and the responsive/accessibility
  sweep passed (355 checks across 71 routes, zero browser errors in both).

- 2026-09-09 — `implemented` / `checks passed` / `owner review pending`: rebuilt the Image Resizer on
  the reviewed interaction model, the second tool after the compressor. Unlike compression, resize
  output is deterministic, so the compressor's three candidates would mean nothing here; the value
  is instead knowing the real output size before downloading. Changes: a row of fit shortcuts
  (1920 / 1280 / 800 / 300 px) sets a ratio-keeping bounding box in one click, since "make it fit
  1920" is the intent most visitors arrive with, while the eleven exact platform presets stay in
  their select for anyone who needs one; the submit button is gone, with results following the
  controls debounced by 320 ms and a newer change abandoning the run in flight; output format and
  quality fold into a Fine-tune disclosure whose closed row still states both; width, height and the
  aspect-ratio switch stay visible, because they are the tool itself rather than secondary settings;
  the live preview and its drag handle are unchanged. Compressor-specific chip and status classes
  were renamed to shared `tool-chip*` / `tool-run-note` so both tools use one set. The browser
  regression lost its four `Resize 1 image` clicks and now waits on the expected output dimensions
  rather than on a result merely existing, so a leftover result from previous settings cannot
  satisfy a wait. Validation: all ten runnable gates passed; the full resizer and cropper Chrome
  suite passed, covering the seven variant pages' exact dimensions, the drag handle, the bounded
  1440x1080 case, the exact 1920x1080 case and the WebP case; the responsive/accessibility sweep
  passed (355 checks across 71 routes at 320/375/768/1024/1440, zero browser errors). Background
  removal asset preparation stays blocked in this environment, so `npm run check` still cannot
  finish its "Static runtime assets" step here.

- 2026-09-09 — `implemented` / `mechanism verified locally` / `production effect unmeasured`: the
  owner reported that Background Remover works but feels slow on the live site. Reading the installed
  `@imgly/background-removal@1.7` bundle shows why: it sets
  `ort.env.wasm.numThreads = navigator.hardwareConcurrency`, so it asks ONNX Runtime for one thread
  per core, but WASM threads need `SharedArrayBuffer`, which a browser only grants to a cross-origin
  isolated document. The site sent no `Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy`
  headers, so inference silently ran single-threaded; the library even carries a matching warning it
  only prints in debug mode. Added both headers to `public/_headers`, scoped to
  `/tools/background-remover/` alone — that route has no cross-origin subresources (model and
  runtime are self-hosted under `/generated/background-removal/1.7.0/`), and it is the only route
  under that path. Verified locally by serving `dist` with those headers and probing three routes in
  Chrome: the tool page reports `crossOriginIsolated: true` with `SharedArrayBuffer` available while
  the compressor and the homepage stay unisolated, and the page renders with zero console errors.
  All ten runnable gates passed. Not measured: the actual speed-up, because the sandbox cannot
  download the model (`staticimgly.com` 403) and cannot reach `toolkitfree.net` (the proxy rejects
  it), so the owner should compare one removal before and after deployment. Watch one thing after
  deploying: if Cloudflare Web Analytics is auto-injected, `require-corp` can block its beacon on
  this page only; if that page stops reporting visits, removing the two header lines restores it.
  WebGPU (`device: 'gpu'`) remains a further option but needs the `.jsep` runtime files added to
  `scripts/prepare-background-removal-assets.mjs`, which currently fetches only the non-jsep
  `ort-wasm-simd-threaded` pair.

- 2026-09-09 — `merged with master` / `revalidated` / `ready for owner merge`: `origin/master` had
  moved five commits ahead (Reddit promotion records, the Image Splitter CLS fix, the crop quick
  path, and an `AGENTS.md` note), so master was merged into the UI branch. Only `PROJECT_STATUS.md`
  conflicted, because both sides had appended to the same newest-first log; the resolution keeps
  every entry from both sides in date order — 39 entries in the conflicted stretch, none dropped —
  and no code file conflicted. Everything was revalidated on the merged tree: all ten runnable gates
  passed, the Chrome responsive/accessibility sweep passed (355 checks across 71 routes at
  320/375/768/1024/1440, zero browser errors), and the compressor and performance browser suites
  passed — the latter confirming master's new layout-shift assertions still hold under the new
  surfaces (Image to PDF 0.0046, Image Splitter 0.0023). Pull request #11 carries the three UI
  commits plus this merge. Background-removal asset preparation is still blocked in this environment
  (`staticimgly.com` returns 403 through the sandbox proxy), so `npm run check` cannot finish its
  "Static runtime assets" step and the background-remover browser test has not run; both still need
  a run on a normal network.

- 2026-09-06 — `implemented` / `checks passed` / `owner review pending`: lightened the two background
  fills one step after the owner found the ground too grey and the large recessed blocks too coarse.
  The page ground moves from #faf8f4 to #fcfbf7 and the sunken tone from #f0eee9 to #f5f2ec; the
  border stays at #e7e3db on purpose, because on a near-white ground the border is what still
  separates a white card from the page — lightening it too would undo the hierarchy the warm ground
  was adopted for. The worst offender was the large upload dropzone, which read as a flat grey slab
  at the previous sunken value. Roles and rule assignments are unchanged. Validation: all ten
  runnable gates passed, and the Chrome responsive/accessibility sweep passed again (355 checks
  across 71 routes at 320/375/768/1024/1440, zero browser errors). Background-removal asset
  preparation is still blocked in this environment, so `npm run check` cannot finish its
  "Static runtime assets" step and the background-remover browser test has not run; re-run both on a
  normal network before release. If the ground still reads grey on the owner's display, the knob is
  `--color-bg-secondary` alone.

- 2026-09-06 — `implemented` / `checks passed, one environment gap` / `owner review pending`:
  finished applying palette A by moving the page ground to the warm tint site-wide. This needed the
  background tokens to be separated into three roles, because one token was previously doing three
  jobs: `--color-bg` is now only the surface of raised things (cards, panels, header),
  `--color-bg-secondary` is only the page ground (`html`), and `--color-surface-sunken` is only for
  recessed things. Twenty-one rules were reassigned accordingly. Sunken now: the upload dropzone,
  secondary-button hover, file and result thumbnails, the segmented-control track, the resizer and
  cropper preview stages, the collage preview panel and its ordering rows, the homepage info band,
  the footer, and the tool-card and popular-path hovers. Raised white surfaces now: the animation
  settings panel, both PDF page panels, the compact dropzone, the related-guides callout, the spec
  section, and the homepage primary tool panel; the guides callout also lost a leftover cool blue
  border. Without this split those elements would have matched the new page ground exactly and
  disappeared — the secondary-button hover in particular would have given no feedback at all.
  Validation: LLM registry, TypeScript, Astro check, ESLint, Prettier, production build (72 pages),
  static asset size, all 13 unit suites, SEO registry, content freshness, and site integrity all
  passed. The Chrome responsive/accessibility sweep passed again after the change (355 checks across
  71 routes at 320/375/768/1024/1440, zero browser errors). Before/after captures of the homepage,
  compressor, cropper, and mobile homepage were reviewed. Still unverified in this environment:
  background-removal asset preparation remains blocked (`staticimgly.com` returns 403 through the
  sandbox proxy), so `npm run check` cannot finish its "Static runtime assets" step and the
  background-remover browser test has not run. Re-run `npm run check` and the full `npm run test:e2e`
  on a normal network before release.

- 2026-08-31 — `Reddit newcomer research completed`: reviewed current Reddit Help documentation for
  karma, Poster Eligibility, Post Check, post types, flair, AutoModerator, modmail, spam, vote
  manipulation, formatting, sorting, account status, and `r/indiehackers`' latest posting guidance.
  Added `docs/promotion/10-reddit-newcomer-guide.md` with a glossary, safe participation practices,
  moderation states, self-promotion controls, one-page preflight, and the ToolkitFree-specific
  recovery plan. The research confirms that Post Check is advisory, eligibility can include
  subreddit comment karma, and submission success does not prove public visibility.

- 2026-08-31 — `Reddit eligibility screenshot reviewed`: the owner profile shows 2 total Karma and
  12 Contributions, not 10 `r/indiehackers` comment karma. A newly added community comment showed
  score 1 and one view, which is not evidence of earned karma. Revised the reusable-process record
  to distinguish contribution volume, total karma, default self-votes, and subreddit comment karma;
  future participation must prioritize specific useful replies without links or solicitation.

- 2026-08-31 — `Reddit modmail sent` / `response pending`: owner acknowledged the community-karma
  rule, stated that no repost would occur before meeting it, and asked whether the automated removal
  consumed the one-time self-promotion allowance. This is a clarification request, not evidence that
  the post will be restored. Keep the removed post unchanged while waiting.

- 2026-08-31 — `Reddit removal reason confirmed` / `subreddit karma gate`: the owner found the
  AutoModerator notification for post `1w2wrjy`. It says the account has fewer than 10 comment karma
  in `r/indiehackers` and identifies the rule as an anti-spam mechanism. The post URL is preserved.
  Account age and visible participation were insufficient evidence of eligibility; the next step is
  genuine community participation, followed by modmail confirmation that a retry is allowed.

- 2026-08-31 — `Reddit submitted` / `removed by moderators` / `reason pending`: owner submitted the
  prepared Image Splitter feedback post to `r/indiehackers` with `Self Promotion` flair, tracked
  link, disclosure, feedback questions, and media. Within about one minute the post displayed
  `Sorry, this post has been removed by the moderators of r/indiehackers.` The screenshot shows
  score 1 and 0 comments but no reason. Do not delete, edit, appeal, cross-post, or repost until the
  post URL and any moderator/AutoModerator explanation are captured.

- 2026-08-30 — `pushed` / `production asset verified` / `Image Splitter CLS fix`: commit `9f758f2`
  was pushed to `origin/master`. A cache-bypassed production page references
  `ImageSplitter.BR6SFwgQ.js`; the immutable asset returns HTTP 200 and contains the intrinsic
  preview width/height output. The normal page briefly returned the previous cached HTML, so later
  Cloudflare field samples remain the recovery checkpoint, but the deployment gate is complete.

- 2026-08-30 — `owner approved` / `Image Splitter CLS fix`: owner manually checked the fixed local
  Image Splitter and authorized the push. The remaining technical gate is commit, push, connected
  Cloudflare deployment, and production asset verification before the Reddit submission.

- 2026-08-30 — `Image Splitter CLS fix verified locally` / `owner preview pending`: added intrinsic
  width and height to the known-dimension Splitter preview so the browser reserves its aspect ratio
  before image decode. Controlled upload CLS fell from 0.0839 to 0.0090 (89%); Image-to-PDF remained
  at 0.0061. The performance regression now records layout-shift sources and enforces a 0.05
  Splitter ceiling. The 12-step quality gate and complete Image Splitter browser workflow passed,
  including upload, seam detection, four-piece ZIP output, balanced object-URL cleanup, and zero
  browser errors. The change is local, not owner-approved, committed, pushed, or deployed; owner
  preview is the next gate.

- 2026-08-30 — `pre-Reddit Cloudflare baseline collected` / `CLS verification gate`: authenticated
  Cloudflare Web Analytics reported 2 bot-excluded visits and 2 page views for the past 24 hours,
  one each on Image Splitter and Image-to-PDF no-margin, from Bing and Yahoo. LCP and INP were 100%
  good on two samples, but both CLS samples scored 1 and were poor, with
  `#main-content > div.container` as the debug element. Updated the growth report, measurement log,
  Reddit experiment, and reusable-skill evidence. Because Image Splitter is the planned Reddit
  landing page, publication is paused until the small-sample signal is reproduced and fixed or
  disproven.

- 2026-08-30 — `pre-Reddit GSC baseline collected` / `Cloudflare sign-in required`: after the
  owner foregrounded GSC, a fresh read-only Chrome tab returned the complete three-month Search
  Console snapshot for 2026-05-28 through 2026-08-27: 2 clicks, 558 impressions, 0.4% CTR, average
  position 86.7; 54 indexed and 49 not indexed; Sitemap `Success` with 65 discovered pages. Saved
  `docs/growth-reports/2026-08-30.md` and filled the Reddit experiment baseline. Cloudflare opened
  its sign-in page in the active Chrome session, so no current visitor/performance value is claimed;
  owner login is the remaining pre-post measurement gate.

- 2026-08-30 — `pre-Reddit GSC read blocked` / `owner foreground required`: Chrome discovery
  confirmed an authenticated `Performance on Search results` tab for the `sc-domain:toolkitfree.net`
  property. A full DOM read and a lighter visible screenshot both timed out before returning any
  metric, without reloading or modifying the page. Recorded the attempt in the measurement ledger,
  Reddit experiment report, and reusable-skill evidence log. No current GSC value is claimed; the
  next attempt requires the owner to place that tab in the foreground.

- 2026-08-30 — `S2 evidence record prepared` / `not posted`: audited promotion measurement
  readiness and found there was no single report for the planned Reddit checkpoints. Added
  `docs/promotion/reports/reddit-image-splitter-feedback-2026.md` with the experiment hypothesis,
  pre-publication GSC/Cloudflare fields, exact publication record, moderation state,
  24-hour/7-day/14-day checkpoints, feedback coding, attribution-strength rules, and reusable-skill
  extraction. Updated the owner checklist and docs index to current S2 state and recorded the
  package as `experiment-ready-not-posted`; no external action occurred.

- 2026-08-30 — `operating documents reconciled` / `S2 remains pending`: corrected the promotion
  account inventory and operative execution plan, which still described Reddit participation,
  YouTube upload, directory submission, and the original `r/InternetIsBeautiful` default as future
  work. They now match observed state: Reddit and YouTube qualified, the demo Public, Uneed queued,
  SaaSHub publicly discoverable but direct approval unconfirmed, AlternativeTo rejected on fit, and
  the `r/indiehackers` Image Splitter package ready but not posted. The next sequence is a fresh
  GSC/Cloudflare baseline, owner publication, then 24-hour/7-day/14-day measurement.

- 2026-08-30 — `directory state rechecked` / `evidence recorded`: current SaaSHub search results
  surfaced ToolkitFree as a verified TinyWow alternative, establishing at least one public discovery
  surface while leaving direct-page approval unconfirmed. Uneed's official 2026-08-17 changelog says
  its free queue is now closed to new products but existing entries keep their assigned dates, so
  ToolkitFree's earlier 2027-02-08 slot remains the operative state. Added both observations to the
  measurement log and promotion-skill evidence log with explicit evidence-strength labels.

- 2026-08-30 — `promotion-system capture started` / `long-term goal active`: owner requested that
  the entire ToolkitFree promotion process become the evidence base for a reusable product-promotion
  tool or Codex skill after this campaign. Added
  `docs/promotion/09-promotion-skill-evidence-log.md` with the capture schema, evidence collected so
  far, provisional workflow, safety guardrails, missing evidence, and final acceptance criteria.
  `AGENTS.md` now requires promotion state, measurement, and reusable-process evidence to be updated
  after every meaningful action. No generic skill has been created yet; it will be derived from real
  outcomes rather than the current plan alone.

- 2026-08-30 — `S2 final candidate prepared` / `owner review required`: revised the first Reddit
  test from product-collection promotion into a narrow Image Splitter critique request with three
  concrete questions, one precise local-processing statement, one maker disclosure, and a dedicated
  `image_splitter_feedback_2026` UTM campaign. Reconfirmed the production landing page returns HTTP
  200 and the approved 960×540, 13.99-second GIF is 2.52 MiB, contains no browser chrome or personal
  data, and reaches six downloadable pieces. No Reddit post was submitted.

- 2026-08-30 — `S2 participation verified` / `ready for first feedback post`: owner-provided
  Reddit profile screenshots verified at least eight visible, non-promotional contributions across
  `r/indiehackers`, `r/SideProject`, `r/linuxmint`, and `r/Wechat`. Three planned substantive
  comments are visible, one discussion produced a natural follow-up reply, and the captured items
  show no removal, collapse, or negative-score signal. Rechecked `r/indiehackers` rules: one
  self-promotion post is permitted with the `Self Promotion` flair only for feedback and critique,
  not advertising. The account is now ready for the prepared Image Splitter feedback post; no post
  has been submitted by Codex.

- 2026-08-29 — `implemented` / `checks passed, two environment gaps` / `owner review pending`: adopted
  the warm-neutral palette (option A) as the site's design tokens and rebuilt the Image Compressor
  interaction as the first pilot of the reviewed UI direction. Palette: `--color-bg-secondary`
  #faf8f4, borders #e7e3db, text #1b1a17 / #4a463e / #6b665c, accent #2450d0 with soft tint
  #eef2fe, plus new `--color-surface-sunken` #f0eee9 for work surfaces, `--color-line`, and
  `--color-caution`; 32 hardcoded cool values in `global.css` and 63 in components were retuned to
  match. The page ground itself is still white — turning it to #faf8f4 needs a deliberate pass over
  the panels that currently use `--color-bg-secondary` as their own surface, so it was left out of
  this change.
  Compressor interaction: purpose presets (Web page, Email attachment, Chat and messaging, Print,
  Exact size in KB) replace the raw mode radios; the quality purposes now produce three encoded
  candidates (Smaller / Balanced / Sharper) whose labels carry the real output size; the submit
  button is gone, because local processing needs no round trip — results are debounced by 320 ms and
  a newer change abandons the previous run. Quality and maximum width remain, folded into a
  Fine-tune disclosure whose closed row still states the current values, with one tap back to the
  preset. Lossless PNG candidates vary by width instead of quality, since quality does nothing
  there. Each source file is decoded once and encoded once per candidate. Batches over 6 files or
  30 MB encode only the selected candidate and offer the others on demand. The exact-size purpose
  keeps the previous bounded search and its honest target-met / target-not-met wording unchanged.
  Validation: LLM registry, TypeScript, Astro check, ESLint, Prettier, production build (72 pages),
  static asset size, all 13 unit suites, SEO registry, content freshness (after bumping the
  compressor's `lastModified` to 2026-08-29), and site integrity all passed. Chrome browser
  regression passed for the compressor, batch download, converter, and the full
  responsive/accessibility sweep (355 checks across 71 routes at 320/375/768/1024/1440, zero
  browser errors). Two steps could not run in this environment and remain unverified here: the
  background-removal asset preparation is blocked because `staticimgly.com` returns 403 through the
  sandbox proxy, so `npm run check` cannot complete its "Static runtime assets" step and the
  background-remover browser test was not run; the remaining browser suites were run individually
  with `--skip-build` against the build produced above. Re-run `npm run check` and the full
  `npm run test:e2e` on a normal network before release. Note for that run: `package-lock.json`
  resolves 823 packages to `registry.npmmirror.com`, which the sandbox proxy also blocks.
  Follow-ups the owner should decide on: whether to move encoding into a Web Worker (the pilot
  recompresses on the main thread, which can stutter while dragging the quality slider on a large
  batch), whether to apply the warm page ground site-wide, and which tool gets the same treatment
  next.

- 2026-08-24 — `S2 participation plan prepared` / `owner posting`: confirmed the Reddit
  account is signed in, has a Create Post entry, and is joined to `r/indiehackers`, `r/SideProject`,
  and `r/isthisAI`. Live rules make `r/InternetIsBeautiful` a poor fit because of its 90/10
  self-promotion rule and additional collection/business-tool restrictions. Selected
  `r/indiehackers` conditionally: its rules allow one `Self Promotion` post for feedback and
  critique rather than advertising. Prepared a narrow Image Splitter feedback package at
  `docs/promotion/07-reddit-indiehackers-package.md`. The owner confirmed there is no prior
  non-promotional activity, so prepared a five-comment, seven-day genuine participation sequence at
  `docs/promotion/08-reddit-participation-plan.md`. No Reddit draft, upload, comment, or post was
  created by Codex; the owner will post only comments that accurately reflect their own view.

- 2026-08-24 — `owner approved` / `verified` / `published` / `Image Cropper internal-link consolidation`: the homepage quick path
  now targets the canonical `/tools/image-cropper/` route with generic crop-intent anchor text; the
  square variant remains public and linked from the cropper page. The 12-step quality gate passed,
  including 72 generated pages, 4,292 internal links, and zero broken or redirecting internal links.
  Chrome smoke regression also passed both scripts: the converter matrix reported zero browser
  errors and the responsive/accessibility sweep passed 355/355 route-width checks across 71 routes
  at 320, 375, 768, 1024, and 1440 pixels with zero browser errors. The owner approved the local
  preview and authorized publication. Commit `204ffa9` was pushed to `origin/master`; production
  now serves the canonical cropper quick path and no longer serves the old square-crop entry.

- 2026-08-21 — `Cloudflare snapshot collected` / `decision unchanged`: after the owner signed in,
  collected the past-24-hours traffic overview: 847 requests, 97 visits, 20.54% cache hit rate,
  1.66 MB served, 201 2xx, 64 3xx, 582 4xx, and zero 5xx. The stream is bot/scanner-heavy—one IP
  generated 475 requests and leading agents include Amazon, OpenAI, Perplexity, Google-Extended, and
  Claude bots—so requests are not treated as human traffic. Detailed Web Analytics page views,
  referrers, and Core Web Vitals remain unavailable because that dashboard page repeatedly timed out.
  The canonical Image Cropper internal-link hypothesis remains the selected low-risk test.

- 2026-08-20 — `superseded by 2026-08-24 verification` / `Image Cropper internal-link consolidation`: changed
  the homepage quick path from the square-crop variant to the canonical `/tools/image-cropper/`
  route with generic crop-intent anchor text. The square variant remains public and linked from the
  cropper page. The later verification entry records the completed checks.

- 2026-08-20 — `growth report collected` / `next SEO task selected`: archived the first live growth
  report at `docs/growth-reports/2026-08-20.md`. GSC's 2026-05-19 through 2026-08-18 range reports
  3 clicks, 950 impressions, 0.3% CTR, and average position 88.2; the canonical Image Cropper page
  accounts for 642 impressions. Cloudflare was initially unavailable because Chrome was not signed
  in; the 2026-08-21 supplemental snapshot above now records the available traffic overview.
  The sole next implementation task is to route the homepage's generic crop quick path to the
  canonical Image Cropper page, then observe 14–28 days.

- 2026-08-20 — `SaaSHub verified and enriched` / `pending platform approval`: completed the free
  product verification and saved the approved logo, homepage screenshot, Free pricing, extended
  description, `Open Source: No`, and the Public YouTube demo. SaaSHub confirms the video in the
  product's Videos list and indicates platform approval may take up to 32 days. No paid promotion
  or expert-voting action was taken.

- 2026-08-20 — `S1 SaaSHub submitted` / `pending approval`: SaaSHub confirmed that ToolkitFree was
  submitted successfully and will appear online after approval. Relevant competitors and categories
  were assigned during the submission flow. Product verification and listing enrichment remain.

- 2026-08-20 — `YouTube Public` / `owner confirmed`: owner changed the approved ToolkitFree demo
  at `https://youtu.be/dk4mtf6H8aA` from Unlisted to Public. SaaSHub is the next S1 directory
  submission.

- 2026-08-16 — `S1 started` / `rules verified`: rechecked official Uneed, SaaSHub, and
  AlternativeTo submission rules. Uneed remains first via its free queue, SaaSHub remains second
  with free product verification, and AlternativeTo is skipped because its current official
  eligibility rules explicitly exclude the principal ToolkitFree product types and online-tool
  collections. No directory submission has been finalized; Uneed is the current action-time gate.

- 2026-08-16 — `S1 Uneed submitted`: owner completed the final Uneed save after the listing fields
  were corrected. The product now appears under `Unpublished (1)` with a scheduled date of
  2027-02-08, confirming entry into the free queue. No paid acceleration was purchased; SaaSHub is
  the next directory action.

- 2026-08-16 — `published Unlisted` / `verified`: after explicit action-time owner approval, saved
  the approved 56.67-second music master to the confirmed ToolkitFree channel as Unlisted at
  `https://youtu.be/dk4mtf6H8aA`. Studio confirms the approved custom thumbnail, English (United
  States) timed subtitles, completed HD processing, and `No issues found` copyright check. The
  channel content table reports `Unlisted`; no Public publication occurred.

- 2026-08-16 — `upload in progress` / `owner verification required`: after explicit owner approval,
  Codex transmitted the approved 56.67-second music master to the confirmed ToolkitFree channel and
  filled the approved title and 1,405-character description. YouTube assigned video ID
  `dk4mtf6H8aA` and kept the draft Private. At the latest observed state the transfer was 82% and
  YouTube required one-time phone verification before accepting the custom thumbnail. Codex stopped
  before any phone-number or code entry; the owner must complete that verification, after which the
  exact continuation point is thumbnail, audience, English SRT, checks, and Unlisted visibility.

- 2026-08-16 — `verified` / `ready for Unlisted upload confirmation`: the owner selected the
  logo-bearing ToolkitFree channel. YouTube Studio confirmed channel ID
  `UCzOeU_EDy79n3dmaHdmya8A`, zero subscribers, no existing videos, and a working upload entry. The
  final video, thumbnail, SRT, and field package are ready. No file has been transmitted to YouTube;
  action-time owner confirmation is required before the Unlisted upload.

- 2026-08-16 — `owner action required`: verified that the owner can sign in to YouTube and that a
  channel-selection flow is available. The account presents two zero-subscriber channels with the
  same visible `ToolkitFree` name, and the page exposes no safe readable identifier for choosing
  between them. No channel was selected and no upload occurred. Owner selection of the intended
  channel is the exact continuation point.

- 2026-08-16 — `verified` / `ready for owner login`: completed the YouTube upload package for the
  owner-approved music master. Codex produced a 1280×720, 123,214-byte three-tool thumbnail from the
  accepted real recordings, an English SRT aligned to the 56.67-second edit, and a final copy/paste
  field package covering title, description, four UTM links, focused tags, audience, language,
  category, visibility, music checks, and signed-out review. Current YouTube Help was checked for
  title/description limits, thumbnail format, upload flow, and Unlisted behavior. No upload occurred;
  owner login/channel confirmation and the final Unlisted upload action are next.

- 2026-08-16 — `owner approved`: the owner reviewed and approved the 56.67-second master with the
  low-volume Mixkit `Close Up` soundtrack. This music version is now the publication candidate; the
  verified silent master remains a fallback. S0 visual and motion asset preparation is complete.
  No upload or external publishing action has occurred.

- 2026-08-16 — `verified` / `owner review required`: added a licensed music review version of the
  56.67-second master while preserving the silent cut. The selected track is Mixkit `Close Up` by
  Michael Ramir C., licensed for online video and advertising under the Mixkit Stock Music Free
  License. The video stream was copied without re-encoding; the AAC stereo track uses -7 dB gain,
  1.2-second fade-in, and 2-second fade-out, measuring -24.7 dB mean and -7.0 dB peak. The completed
  file fully decodes, and source URL, official license, restrictions, and SHA-256 hashes are retained
  in `docs/promotion/assets/final-motion/music-license-record.md`. No upload occurred.

- 2026-08-16 — `verified` / `owner review required`: Claude Code prepared the repeatable motion
  post-production pipeline, then Codex recalibrated every cut from dense frame inspection and
  rendered the accepted footage. The local review package contains a 56.67-second 1920×1080 H.264
  master with no audio plus 960×540 looping GIFs for Image Splitter (2.52 MiB), Image to PDF
  (1.81 MiB), and Background Remover (0.99 MiB). Contact-sheet QA confirmed the browser chrome is
  removed, key controls and results remain visible, captions do not obscure the demonstrations,
  and the Background Remover sequence shows transparent, blue, and red results without a second
  model run. No upload or external publishing action was taken; owner approval is the next gate.

- 2026-08-16 — `recording accepted` / `post-production ready`: reviewed the owner's final Image to
  PDF and Background Remover captures using metadata and interval frame sampling. The PDF capture
  uses the approved three images, demonstrates the edited page structure and move-to-new-page flow,
  and reaches a three-page PDF result. The Background Remover capture uses the approved product
  image and demonstrates transparent, blue, red, and dark backgrounds on one processed cutout with
  a downloadable result. Both are readable 1920×1032 H.264 recordings at approximately 30 fps.
  Together with the accepted Image Splitter and homepage takes, all four clips were copied without
  altering the originals to `docs/promotion/assets/recording-raw/` using the canonical filenames.
  No further owner recording is required; master-video and GIF editing are next.

- 2026-08-16 — `owner approved` / `verified` / `published`: Claude Code implemented post-result
  Background Remover colour switching. The transparent cutout Blob is cached after one AI run;
  transparent, preset, and custom colours now recompose the downloadable PNG locally without
  unmounting the result or rerunning the model. Recomposition locks colour inputs and Download so
  stale-colour bytes cannot be saved, decodes only a temporary ImageBitmap, revokes replaced object
  URLs, and guards stale asynchronous results. TypeScript, ESLint, Prettier, all 13 unit/algorithm
  suites, the 12-step quality gate, and the focused real-Chrome secondary-tools regression passed.
  The regression observed transparent → red → transparent with unchanged model-run count, stable
  active object-URL count, and zero browser errors. The owner manually accepted the local behavior
  and authorized a direct push to `master`. Commit `e201773` was pushed to `origin/master`; the
  connected Cloudflare deployment now serves `BackgroundRemover.PTNqNSl1.js` with HTTP 200, and the
  published bundle contains the recomposition and model-run guards. The final short Background
  Remover insert is ready to record.

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
