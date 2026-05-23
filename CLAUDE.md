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

## Business & Strategy

详见 `docs/` 目录下的文档。以下是关键决策摘要：

**市场定位：** 做全球英文市场（非中文）。原因：CPM差距5-10倍（美国$5-25 vs 中国$0.3-2）、Cloudflare Pages零成本、无需ICP备案、AI辅助英文内容。

**核心卖点：** "Your files never leave your device" — 纯客户端处理，隐私+零成本。

**SEO策略：**
- 不抢头部词（如"pdf to word"），打长尾词（70-80%流量来自长尾）
- 每个工具页：H1 + 工具交互区 + How-to + 功能特点 + 20-30条FAQ（FAQPage结构化数据）+ 相关工具内链
- 变体页程序化生成但内容差异化（`/en/tools/image-converter/jpg-to-png`）
- AI生成内容 + 人工审核，Google不惩罚AI内容只惩罚低质量

**变现：** Google AdSense，工具站典型RPM $3-8，美国流量$5-15。广告位：工具上方横幅、侧边栏300x250 sticky、工具下方信息流、移动端底部锚定。

**实施路线（每天2小时）：**
- Phase 1: 基础搭建（Astro项目 + 布局 + 部署）— 已完成
- Phase 2: 第一批4个图片工具 + FAQ + 教程 — 已完成
- Phase 3: 申请AdSense + 证件照工具 + QR码 — 进行中
- Phase 4: 持续扩展，每1-2周加1-2个新工具

**下一步工具方向：** 证件照制作、PDF工具（合并/拆分/压缩）、QR码生成器。不做：AI提示词工具、ChatGPT套壳、全功能图片编辑器。

**文档索引：**
- `docs/market-research.md` — 市场调研、竞争格局、收入预期
- `docs/implementation-plan.md` — 实施计划、时间线、风险应对
- `docs/seo-strategy.md` — 关键词策略、内容结构、技术SEO
- `docs/tech-stack.md` — 框架选型理由、客户端处理库、AdSense集成
