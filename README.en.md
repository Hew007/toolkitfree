# ToolkitFree

[简体中文](README.md) | **English**

A free, local-first browser toolbox for images, PDFs, QR codes, ID photos, and video-to-animation conversion. Your selected files are processed by the browser on your device without uploading their contents to a processing server.

Visit [the English site](https://toolkitfree.net/) or [the Simplified Chinese site](https://toolkitfree.net/zh/).

> The site may still fetch page assets, background-removal models, and video runtimes over the network. Processing speed and capacity depend on your browser, device memory, and file sizes.

## Tools

| Tool | What it does |
| --- | --- |
| Image Converter | Convert JPG, PNG, and WebP, including batch output |
| Image Compressor | Compress by use case or target size and compare actual outputs |
| Image Resizer | Set dimensions, preserve aspect ratio, or use common platform sizes |
| Image Enhancer | Adjust brightness, contrast, saturation, and sharpness locally |
| Image Collage Maker | Arrange images in a grid or strip |
| Image Splitter | Split images using a grid or custom guides |
| ID Photo Size & Print Tool | Resize a photo and generate a printable layout |
| Image Cropper | Crop to a preset ratio or a freeform selection |
| Background Remover | Run a model in the browser and export a transparent or solid-color background |
| Video to Animation | Convert short video clips to GIF, animated WebP, or APNG |
| Image to PDF | Organize images, adjust pages, and export a PDF |
| PDF Splitter & Page Extractor | Select, reorder, and rotate pages, then export a PDF or ZIP |
| Favicon Generator | Generate PNG icons in multiple sizes and a web manifest |
| QR Code Generator | Create PNG or SVG codes for text, URLs, Wi-Fi, contacts, and more |

See each tool for supported formats and processing limits. A compression target is approximate, and background-removal results should be checked manually.

## Local development

Use **Node.js 24** and **npm**. This repository uses `package-lock.json`.

```sh
git clone https://github.com/Hew007/toolkitfree.git
cd toolkitfree
npm ci
npm run dev
```

Open the local URL printed in the terminal, usually `http://localhost:4321/`.

Development and production builds run `prepare:assets` first. It prepares FFmpeg and, when assets are missing locally, downloads background-removal models and runtimes from `staticimgly.com` into `public/generated/background-removal/1.7.0/`. A first run needs network access. Later runs can reuse the assets, and generated binaries are excluded from Git.

### Build and preview

```sh
npm run build
npm run preview
```

The static output is in `dist/`. The deployment target is Cloudflare Workers static assets, configured in [wrangler.jsonc](wrangler.jsonc). Configure your own Cloudflare account and project before deploying. `npm run build` generates the local artifacts.

### Language behavior

- English keeps the original routes. Simplified Chinese uses the `/zh/` prefix.
- On an initial visit to `/`, a browser preference of `zh` or `zh-*` selects Chinese. Other languages default to English.
- The language picker takes precedence over browser preferences and persists the selection where browser storage is available.
- Tool links that specify a language keep it. Root redirects preserve query strings and fragments.
- With JavaScript disabled, the root still serves a static English page. Interactive tools require JavaScript.

## Checks

| Command | Coverage |
| --- | --- |
| `npm run typecheck` | TypeScript types |
| `npm run typecheck:astro` | Astro pages and components |
| `npm run lint` | ESLint |
| `npm run format:check` | Formatting for configured files |
| `npm run test` | Unit tests, algorithms, and localization |
| `npm run check` | Full local checks, including build, SEO, dates, and internal links |
| `npm run test:e2e` | Full Chrome regression, including language defaults and bilingual responsiveness |
| `npm run test:e2e:zh` | Processing, downloads, and error flows for all 14 Chinese tools |
| `npm run test:e2e:edge` | Edge smoke tests |
| `npm run sync:llms` | Regenerate both language directories for LLMs from the registries |

Browser tests look for Chrome or Edge at common install locations. Set `BROWSER_PATH` to specify a binary. The scripts generate test fixtures. If `dist/` is current, pass `-- --skip-build` to reuse it. Check for existing preview or test processes and ports before starting another one.

**Multi-threaded background-removal tests need extra setup.** `astro dev` and `astro preview` do not send the cross-origin isolation headers in `public/_headers`. Serve the site from a secure context with COOP and COEP and confirm `crossOriginIsolated === true` and `typeof SharedArrayBuffer === 'function'`. See [AGENTS.md](AGENTS.md#reproducing-cross-origin-isolation-locally) for an isolated server and control test.

## Project layout

```text
src/pages/         Astro pages, tool variants, and /zh/ routes
src/components/    React tools and shared Astro / React components
src/i18n/          Chinese copy, tool translations, and default language logic
src/data/          Registries for tools, variants, and guides
src/lib/           Image, PDF, and animation processing and shared algorithms
src/layouts/       Layout, navigation, metadata, and structured data
src/styles/        Global styles and design variables
scripts/           Asset preparation, quality checks, and browser regressions
public/            Static assets, response headers, and LLM directories
docs/              Local plans and acceptance evidence, ignored by Git by default
```

Astro renders static pages and React islands provide interactivity. File processing uses Canvas, WebAssembly, and client-side JavaScript. Both languages share the processing components and algorithms.

## Contributing

Read [PROJECT_STATUS.md](PROJECT_STATUS.md) for the current state and next steps and [AGENTS.md](AGENTS.md) for project conventions. When changing tool interactions, follow [TOOL_INTERACTION.md](TOOL_INTERACTION.md).

- Maintain both languages across the interface, error messages, and accessibility labels. Preserve user input and file names as supplied.
- When adding or changing public pages, update registries, FAQs, structured data, related links, sitemaps, and the LLM directories.
- Run checks appropriate to the change and record the actual results in `PROJECT_STATUS.md`.
- Meaningful interface changes need manual acceptance by the project owner before promotion.
