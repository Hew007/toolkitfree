# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ToolkitFree — free, local-first processing tools. All operations run entirely in the browser (Canvas API + WebAssembly), no server uploads. Global audience first, multi-language later. Currently focused on image tools, with plans to expand to more categories.

**Tools:** Image Converter (JPG/PNG/WebP), Image Compressor, Image Resizer, Background Remover (WebAssembly via @imgly/background-removal).

**Contact:** hnhw182@gmail.com

## Commands

- `npm run dev` — start local dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build locally

No test runner, linter, or formatter is configured. No CI/CD pipeline.

## Architecture

**Astro Islands** pattern: Astro generates static HTML pages. React components are the interactive "islands," hydrated client-side via `client:load`.

**Key directories:**
- `src/pages/` — Astro pages and dynamic route variants (`[variant].astro` with `getStaticPaths()`)
- `src/components/` — React (`.tsx`) components; shared ones are `FileUploader`, `FileList`, `DownloadResult`
- `src/data/` — Variant definitions, FAQ data, descriptions for converter and resizer tools
- `src/layouts/` — `Layout.astro` provides header, nav, footer, SEO meta, Schema.org structured data, AdSense
- `src/styles/` — Single `global.css` with CSS custom properties
- `public/` — Static assets including `llms.txt` / `llms-full.txt` (LLM-readable site descriptions)

**Deployment:** Cloudflare Workers static assets via Wrangler (`wrangler.jsonc` → `dist/`).

## Patterns & Conventions

- **Image processing:** Canvas API — `URL.createObjectURL` → draw to off-screen canvas → `canvas.toBlob()` → download link. `formatSize()` helper is duplicated per tool component.
- **Styling:** CSS custom properties in `global.css` + heavy inline styles in React components. BEM-like class naming (`.tool-card`, `.btn-primary`).
- **State:** Local `useState` only. No global state, no context providers.
- **SEO:** Every tool page includes canonical URL, Open Graph, Twitter Cards, Schema.org (WebApplication, FAQPage, BreadcrumbList), and cross-links to related tools. Guide pages exist for SEO content marketing.
- **Dynamic routes:** Variant pages (e.g., "JPG to PNG") use `getStaticPaths()` to pre-generate all pages at build time. Variant data lives in `src/data/*-variants.ts`.
- **FAQ:** Server-rendered `<details>/<summary>` elements in Astro pages; a separate `Faq.tsx` React component exists but is not widely used.
- **i18n:** Configured in `astro.config.mjs` for `en` (default) and `zh` locales, though content is currently English-only.
- **No external API calls.** The only external resources are Google AdSense and the WASM model fetch for background removal.
