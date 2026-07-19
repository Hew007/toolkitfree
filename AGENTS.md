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
- Image Cropper
- Image to PDF
- Favicon Generator
- QR Code Generator
- Background Remover
- Image Enhancer
- Image Collage Maker

In-progress planning:

- ID Photo / Passport Photo size and print-preparation tool
- Additional PDF utilities

## Follow-up Backlog

- Simplify Image Collage Maker interactions: reduce configuration up front, make defaults smarter, and optimize for a fast upload → choose simple layout → download flow.
- After the Image Collage Maker simplification is complete, follow this release and growth sequence without skipping steps:
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

## Quality Expectations

Before committing meaningful product changes, run checks proportional to the risk. For most tool work, prefer:

1. focused unit or algorithm validator;
2. `npm run check`;
3. browser regression when UI, upload, download, routing, or performance behavior changed.

Current quality gates cover TypeScript, ESLint, Prettier, production build, unit/algorithm validations, SEO registry checks, site integrity, and browser regressions.
