# AGENTS.md

This file guides Codex and other coding agents when working in this repository.

## Project Overview

ToolkitFree is a free, local-first processing tools website. The core product promise is:

> Your files never leave your device.

Most tools run entirely in the browser with Canvas API, WebAssembly, or client-side JavaScript libraries. The site targets a global English-speaking audience first; multilingual expansion can come later.

## Current Tool Set

- Image Converter
- Image Compressor
- Image Resizer
- Image Enhancer
- Image Collage Maker
- Image Splitter
- ID Photo Size & Print Tool
- Image Cropper
- Background Remover
- Video to GIF, WebP & APNG
- Image to PDF
- PDF Splitter & Page Extractor
- Favicon Generator
- QR Code Generator

Additional focused image and PDF utilities remain candidates for future work.

## Follow-up Backlog

- The Image Collage Maker simplification and the original site-wide quality pass are complete.
- Image Splitter and expanded Image to PDF editing landed afterward, so repeat the release checks for
  the latest build before promotion. Follow this sequence without skipping steps:
  1. Run automated UI coverage across every public page at desktop, intermediate, tablet, and mobile widths. Check layout overlap and overflow, primary interactions, uploads, downloads, browser errors, accessibility basics, and screenshots for visual review.
  2. Hand the fully tested local or preview build to the project owner for a complete manual verification pass. Do not begin promotion until the owner confirms this pass is complete.
  3. Produce a concrete promotion plan with platform order, content, landing pages, measurement, and feedback checkpoints; then execute it gradually on approved external platforms.
  4. Continue technical SEO, content SEO, GEO/answer-engine optimization, internal linking, and relevant non-spammy external link acquisition, using Search Console and Cloudflare data to adjust the plan.

## Package Manager

Use npm for this project.

- Primary lockfile: `package-lock.json`
- Do not introduce `pnpm-lock.yaml` or `pnpm-workspace.yaml` unless the project is intentionally migrated to pnpm.

## Common Commands

- `npm run dev` — start Astro dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build locally
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint
- `npm run format:check` — Prettier check
- `npm run test` — unit and algorithm validations
- `npm run check` — full local quality gate
- `npm run test:e2e` — full Chrome browser regression
- `npm run test:e2e:edge` — Edge smoke regression

Use `C:\Users\Hew\AppData\Local\OpenAI\Codex\bin\node.exe` directly if `node` or `npm` is not reliably exposed in the current shell.

## Architecture

ToolkitFree uses the Astro Islands pattern:

- Astro renders static pages.
- React components provide interactive tool islands with `client:load`.
- Tool processing happens client-side.
- Deployment target is Cloudflare Workers static assets via Wrangler.

Important directories:

- `src/pages/` — Astro pages and dynamic route variants.
- `src/components/` — React tool components and shared UI components.
- `src/data/` — tool registry, variant data, FAQ and descriptions.
- `src/lib/` — shared image processing, budgets, export helpers and pure algorithms.
- `src/layouts/` — `Layout.astro` with metadata, navigation, footer, structured data and AdSense hooks.
- `src/styles/` — global CSS and shared design tokens.
- `scripts/` — validation, quality gates, browser regression and registry sync scripts.
- `public/` — static assets, including `llms.txt` and `llms-full.txt`.
- `docs/` — local planning and verification documents. This directory is intentionally ignored by git.

## Working Rules

- Before new implementation work, inspect branch and working tree state.
- Fetch/pull remote changes first when starting new repository work.
- Read `PROJECT_STATUS.md` before planning or implementing work. It is the living handoff and the
  authoritative record of current progress, owner decisions, validation state, and next actions.
- Update `PROJECT_STATUS.md` in the same change whenever a feature, important behavior change,
  release step, major decision, deployment, or meaningful validation is completed. Keep the current
  snapshot and next actions accurate; add a concise dated entry to the recent progress log. Do not
  create a new handoff document for routine work.
- Do not mark work complete in `PROJECT_STATUS.md` until the relevant checks have actually passed.
  If work is partial or blocked, record that state and the exact continuation point.
- If the branch is dirty, diverged, or conflicted, resolve or report that state before implementing.
- Keep user changes and unrelated local files intact.
- Do not push unless the user asks.
- Do not claim a fix is complete from memory; run the relevant checks.
- Before starting preview, build, export, or browser-test services, check whether an earlier process or port is already running.

## Product and SEO Conventions

- Keep all file-content processing local to the browser.
- Be precise about privacy claims: site resources, AdSense, and background-removal model assets may still load over the network.
- Do not promise unsupported formats or guaranteed exact compression results.
- Every public tool page should have:
  - clear H1 and usage instructions;
  - accurate capability copy;
  - FAQ content;
  - structured data;
  - related internal links;
  - sitemap and LLM registry coverage.
- Prefer long-tail, practical tools over broad all-in-one editors.

## Checklist: Adding a Tool or Variant Page

SEO and GEO coverage is registry-driven. Work through this list whenever a public
page is added, renamed, or removed — several items fail the build rather than
degrade silently, and the rest are easy to forget.

1. `src/data/tool-registry.ts` — add the `ToolId`, the definition, and `lastModified`.
   Add the new id to the `related` array of at least four existing tools so the
   internal linking is bidirectional; the validator only checks that ids exist.
2. `src/components/ToolIcon.astro` — add the icon path. The `Record<ToolId, …>` map
   has no runtime fallback, so a missing key fails the production build.
3. Variant pages — add `src/data/<tool>-variants.ts` plus
   `src/pages/tools/<tool>/[variant].astro`, and point the registry `variants` at it.
   Give every variant its own title, description and FAQ; never template-fill.
4. Open Graph — add `public/social/<tool>.png` at exactly 1200×630 and pass
   `ogImage` from the page. Every route must resolve an image; the default is a
   fallback, not a target.
5. `src/components/ProcessingLimits.astro` — pick the right `profile`, or add one.
   Never mount a limits table whose rows do not apply to the tool.
6. `src/data/guide-registry.ts` — add the tool to `relatedTools` of any guide it
   belongs with, so `RelatedGuides` renders and the guide gains an inbound link.
7. Run `npm run sync:llms`. It regenerates the tool list, the grouped variant list
   and the guide list in `llms.txt` and `llms-full.txt`. Never hand-edit those
   sections. Non-indexable variants are excluded on purpose.
8. `scripts/validate-site-integrity.mjs` — update the static HTML page count. It is
   a deliberate tripwire so page-count changes are acknowledged, not a nuisance.
9. FAQ — the visible `<summary class="faq-question">` list and the `FAQPage`
   JSON-LD must match in the same order. Render both from one array.
10. `lastModified` must not predate the page source's last commit date, or
    `validate-content-freshness` fails.

Enforced automatically: llms coverage of every indexable route, sitemap parity,
canonical form, title length, Open Graph presence, FAQ/JSON-LD parity, tool
directory ordering, broken links, content freshness. Not enforced, so confirm by
hand: bidirectional `related`, and copy that is accurate rather than merely present.

## Quality Expectations

Before committing meaningful product changes, run checks proportional to the risk. For most tool work, prefer:

1. focused unit or algorithm validator;
2. `npm run check`;
3. browser regression when UI, upload, download, routing, or performance behavior changed.

Current quality gates cover TypeScript, ESLint, Prettier, production build, unit/algorithm validations, SEO registry checks, site integrity, and browser regressions.
