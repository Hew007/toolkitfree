# ToolkitFree Project Status

Last updated: 2026-09-23
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
  Compressor was the first tool rebuilt on the reviewed interaction model (purpose presets, three
  encoded candidates, no submit step, fine-tune folded but complete). **As of 2026-09-18 all fourteen
  public tools are converted**, in three parallel batches; Background Remover and Video to GIF keep an
  explicit button by design, because a single run costs seconds to a minute. Owner review of the whole
  set is pending, and the QR Generator chips changed appearance noticeably — see the Recent Progress
  Log entry for that date.
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

- 2026-09-23 — `favicon 浏览器套件接回` / `锁文件改回公共 registry`：

  **`validate-favicon-browser.mjs` 从来没跑过。** 319 行，7 月加进来，Favicon 改造时还被认真改写过，
  但**不在 `run-browser-tests.mjs` 的清单里、全仓库零引用**，`npm run test:e2e` 从未执行它。它不是
  冗余的：**它是唯一检查"每个变体页按 URL 承诺的尺寸集打开"的地方**，包括 `/favicon-for-wordpress/`
  只出 512 那一个图标——就是 9-17 所有者拍板的那件事，此前没有任何测试守着。已验证：把 WordPress
  页的默认值改回全套，它报 `Timed out waiting for favicon-for-wordpress default run`。

  接回清单后它**立刻失败**：它等的是 `readyState` 加文件输入框存在，但 island 是服务端渲染的，输入框
  在 React hydration 之前就在了，那时设置文件触发的 `change` 没人接。改成和其余套件一样等 island 去掉
  `ssr` 标记。这正是 `TOOL_INTERACTION.md`「踩过的坑」里记的那一条——13 个套件各自手写 CDP 底座，
  同一个坑要在每个文件里分别踩一遍。

  **扫了一遍，`validate-image-splitter-browser.mjs` 是另一个中招的。** 它在 master 上就**有 3/8 的概率
  失败**（`Timed out waiting for split lines ready`），此前各批次跑它时恰好都赢了竞速。同样改法之后
  连跑 45 次通过 44 次；那 1 次失败发生在没有抓输出的一批里，之后 35 次都没能复现，**不声称已经
  归零**。现在 13 个浏览器套件都用同一种方式等 hydration。

  **锁文件 823 / 878 条 `resolved` 指向 `registry.npmmirror.com`。** npm 按实际拉取的 registry 记录
  `resolved`，锁文件最后是在配了镜像的机器上写的。任何访问不到该镜像的环境里，干净的 `npm ci` 都会
  失败——受限网络直接拒绝该主机，安装停在一半、`node_modules/.bin` 为空，下游全部跑不起来。容器重启
  后在本沙箱里实际发生过。

  只换了主机名：镜像在同样路径提供同样的 tarball，所有 `integrity` 哈希原样不动，diff 就是 823 行
  `resolved`。清空 npm 缓存、不带任何替换参数跑 `npm ci`：744 个包、零 integrity 错误、锁文件未被改写。

  **本地继续用镜像完全没问题，只是不能进提交。** 新增 `validate-lockfile-registry.mjs`，排在
  `npm run check` 第一步，报出越界主机和第一个包；对旧锁文件实测报
  `823 lockfile entries resolve outside https://registry.npmjs.org/ (registry.npmmirror.com)`，
  注释里给了一行 `sed` 的改法。

- 2026-09-23 — `Image Splitter 上传位移修掉` / `CLS 断言改成确定性` / `发现跨工具的上传位移`：

  **根因**：预览框 `.splitter-frame` 原来靠 `width: fit-content` 包住图片，图片是 `width/height: auto`。
  所以在预览的 blob 加载完成之前，框是 **0 像素高**；加载完成的一瞬间，它下面的提示、控件、how-to
  整体往下跳一个预览高度（400×300 测试图就是 300px）。这次位移记不记得上，取决于加载有没有赢过
  首次绘制——这就是它"空闲时约三分之一概率失败、负载下几乎必挂"的原因。之前说它"负载相关"是
  **框定太窄**，它在空闲机器上也会触发。

  **修法**：框的尺寸改成从已知的原图尺寸算，不再依赖图片加载——`--split-width` / `--split-height`
  两个 CSS 变量，宽度取 `min(列宽, 原图宽, 60vh × 宽高比)`，图片 `width: 100%` 加 `aspect-ratio`。
  三个上限就是原来包裹式布局施加的那三个，所以尺寸行为不变：在 1440 和 390 两个宽度下测了极小
  （200×100）、极高（1000×4000）、极宽（4000×500）、横图（3000×2000）四种形状，框与图完全重合
  （百分比定位的切割线仍对齐）、比例正确、60vh 上限成立、小图不放大、无横向溢出。

  **CPU 节流下复测**（1280×900，每档 5 次）：修复前 4× / 6× 下总值在 0.158–0.180 之间浮动，其中
  0.085 那一条就是框塌陷造成的；修复后那一条消失，总值**恒定**。

  **测试从"多半不会失败"改成"确定会失败"**：`validate-performance-browser.mjs` 里 Image Splitter 那条
  现在在 4× CPU 节流下上传，并新增一条**不依赖时序**的结构断言——上传完成后同步移除 `src`，框高度
  必须不变。验证：退回修复前的代码，**3 次全部失败**（两次死在 CLS 数值上，一次 CLS 侥幸赢了竞速，
  被结构断言拦下）；带修复 3 次全过。

  **另外发现一个跨所有工具的问题，尚未处理，需要所有者决定。** 在 1280×900 的桌面视口下，通过文件
  选择框上传之后，工作区替换上传框、把下方的 how-to / features 区块推出首屏，产生的 CLS：

  | 工具 | 上传 CLS |
  | --- | --- |
  | Image Compressor | 0.08 |
  | Image Enhancer | 0.12 |
  | Image Splitter | 0.16 |
  | Image Collage | 0.18 |
  | Image Resizer | 0.18–0.19 |
  | Image to PDF | **0.27** |

  Google 的"良好"线是 0.1，0.25 以上算"差"。**文件选择框上传大概率不会被 `hadRecentInput` 豁免**——
  用户在系统对话框里停留远超 500ms，`change` 事件触发时页面上没有近期输入。这和
  2026-08 Cloudflare 在 Image Splitter / Image to PDF 路由族上看到的 CLS 样本吻合。
  既有套件没看到它，是因为套件的默认视口里 how-to 本来就在首屏之外。

  这是一个版面取舍：要么给工具区预留接近工作区的最小高度（上传前会有一块留白），要么调整 how-to
  的位置，要么接受。**本次没动**，只修了 Image Splitter 那个确定性的、纯属实现缺陷的部分。

- 2026-09-18 — `交互改造收尾 14/14` / `QR 的 D 类判断被推翻` / `CLS 那条断言查清楚了`：

  最后 5 个工具改完，**14 个公开工具全部完成交互改造**。五个 agent 各自独立 worktree 并行，
  五次合并**零冲突**——三个 agent 共用 `validate-secondary-tools-browser.mjs`，靠"改动锁在自己那一段、
  不重排不重格式化"这一条约束撑住了。

  **B 类（自动运行）三个：**
  - **PDF Splitter**：输出跟随页码范围、页序、旋转、输出模式。附带一处关键发现——拆分导出原本用
    `DEFLATE` 打 ZIP，20 页 74.6 MiB 扫描件耗时 **5074 ms 而体积一个字节没小**（PDF 内容流本来就是
    Flate 压缩的），改成 `STORE` 是 714 ms。**这是自动运行能成立的前提**，不是顺手优化。
  - **Image to PDF**：核心是按 `(文件, 旋转)` 缓存栅格化结果，首建 0.2–1.2 s，重建 < 25 ms。
    `key` 只序列化几何与摆放，于是在全手工摆放的页面上拖边距滑块**正确地什么都不重跑**。
  - **Image Collage**：拼图跟随布局和排序。运行在离屏画布上重绘而不是读回预览画布——预览在拖拽
    重排时带着高亮浮层，那东西绝不能进下载的文件。

  **C 类（保留按钮）一个：Background Remover。** 没有引入自动运行（一次 6–25 秒）。五枚背景芯片
  全部来自 `BACKGROUND_PRESETS`，没有编造选项。触摸目标从 28px 修到 44px。
  **一处产品损失记在账上**：原来红芯片本身是红的，换成共享 `ToolPresets` 之后只剩文字——共享件没有
  per-chip 的视觉槽。可接受（颜色名无歧义，取色器仍带色），但共享件若补 `swatch` 槽，这里该第一个加回来。

  **D 类"已经正确、不要动"的判断被推翻了——QR Generator。** 核实下来**行为栏确实全对**：agent 用
  拦截 `<a download>` 取出 data URL、与同时刻预览画布逐字节比对的办法，证明了**下载的文件真的跟随
  设置**，不是"预览实时、文件不实时"。但另外三栏有真问题：
  - **冷启动约 1.2 秒的死按钮窗口**：`data-qr-ready` 报的是"有没有文本"而不是"渲染器就绪没有"，
    窗口内按钮可点但 `qrRef.current` 还是 null，点下去**不产生文件、不报错、无任何反馈**。
  - **上传 logo 后 L/M/Q/H 四枚被 `disabled`**，纠错级别被强制 H 且不可编辑——直接撞
    `TOOL_INTERACTION.md`「不能让人失去控制权」。现在仍自动写入 H，但四枚保持可点，理由放在可朗读的
    `help` 里；并修掉了"先选 Q → 传 logo → 删 logo 变成 M"的副作用（现在回到 Q，手动点过则手动值优先）。
  - **三组手写内联芯片触摸目标 24–31px**，低于「不能改变的东西」里 44px 的硬要求。换成 `ToolChoices`
    后 15 枚芯片最小高度 44px，无一低于。

  **这条教训值得记住：分类是按"行为"给的，而缺陷不一定长在行为那一栏。** "已经正确"只对了四分之一。

  **`validate-performance-browser.mjs` 的 Image Splitter CLS 断言——查清楚了。** 三个 agent 报它失败、
  一个报通过，两份结果矛盾。做了对照实验：干净 worktree 停在 `5b51ff2`、重新构建、**空闲容器**上
  `total: 0.0023` 通过；同一份构建**先把 4 核压满**再跑，是 `0.062461332290409975`，与 agent 量到的
  **十六位有效数字一字不差**。

  原因：CLS 值由几何定死（impact × distance fraction），**负载只决定这次位移记不记得上**——图片解码
  落在首次布局之后，`.splitter-frame` 的 handle、两条 hint 和 `.tool-controls` 会塌成零尺寸再弹回来。

  所以它**既不是 flaky 也不是必挂的回归**，是慢设备和冷缓存上会真实兑现的 CLS 风险；0.0601 > 0.05
  意味着那种条件下真实用户会吃到。注意本文件 2026-08-30 记着 Image Splitter 的 CLS 是专门修过、
  所有者 approve 过的（0.0839 → 0.0090）——**那次是在空闲机器上测的，塌陷路径还在**。
  **待办：在图片加载前给那几个元素预留空间。** 本批没做，避免把 Image Splitter 卷进来。

  顺带一个此前没人注意的事实：这条套件一直**中止在第 319 行**，后面的断言（Favicon、QR、背景移除的
  资源守卫，以及末尾的 `browserErrors` 汇总）**在 master 上从来没执行过**。本批集成后在空闲容器上
  第一次跑到底，全绿。

  **共享件暴露出三个缺口**（已记入 `TOOL_INTERACTION.md`，待集成方补）：`ToolChoices` / `ToolPresets`
  没有 `disabled`（对 C 类是结构性缺口，目前靠外套 `<fieldset disabled>` 绕，且探针必须写
  `matches(':disabled')`）；`ToolPresets` 没有 per-chip 视觉槽；`FineTune` 的 `onReset` 在面板收起时
  仍在 DOM 里（写断言不需要先展开）。

  **门禁**：typecheck、lint、format、13 项单测、构建、SEO 注册表（`linkedVariants: 42`）、站点完整性
  （4399 内链 / 0 断链），以及**全部 12 个浏览器套件**逐个跑过。唯一失败是
  `validate-secondary-tools-browser.mjs` 里 background removal 那一条——沙箱出网被封、
  `staticimgly.com` 返回 403、模型下不来，与改动无关，基线上就是这一条。

  **需要所有者在正常网络的机器上补验的：**
  1. Background Remover 端到端实跑，以及第一次成功抠图之后的全部断言（重组合期间不换模型、
     `colorsLocked` 序列、对象 URL 基线、线程计划上板、结果区的视觉）。期望是整条套件全绿。
  2. QR Generator 换共享芯片带来的**观感变更**：芯片从实心蓝底白字变成站点统一的浅蓝底蓝字、
     高度 24–31px → 44px、多了一行"What are you encoding?"标题和一行纠错说明。
     **工具区总高度桌面 823px → 1063px，手机 1352px → 1562px**，右侧预览栏下方留白更明显。
  3. 十四个工具的完整人工验收。

  **还有一处诚实说明**：QR 那条"冷启动窗口内按钮必须禁用"的守卫（`enabledBeforeReady === 0`）不会
  假失败，但它只在窗口存在时才咬得住，而窗口长度取决于 chunk 是否命中 HTTP 缓存（冷 1.2 s、热 34 ms）。
  agent 没有把"观察到中间态"也写成断言，因为那会 flaky——这个克制是对的，但意味着这条守卫在热缓存下
  是空转的。
- 2026-09-17 — `删掉 23.9 MB 从没被下载过的 WASM` / `favicon-for-wordpress 维持 1 个图标`：

  **23.9 MB 的死重量。** `dist/_astro/ort-wasm-simd-threaded.jsep-*.wasm` 每次发布都上线，**从来没有
  任何人下载过**，而且它一个人就占满了 `validate-static-asset-sizes.mjs` 那条 24 MiB 红线的 95%。

  来源：`onnxruntime-web@1.21` 的浏览器默认入口本身就是 JSEP（带 WebGPU）那份构建，它在两处
  `new URL("…jsep.wasm", import.meta.url)` 兜底里写了自己的二进制文件名，Vite 看见就把 23.9 MB 打包
  进产物。**第一次尝试用 `resolve.alias` 把 `onnxruntime-web/webgpu` 指回 `onnxruntime-web` 失败了**，
  因为两份 bundle 引用的是同一个 JSEP 文件——问题从来不在 `/webgpu` 这个子路径上。

  为什么能确认没人下载：`@imgly/background-removal` 在建 session 前**总是**先设
  `ort.env.wasm.wasmPaths`（见其 `index.mjs` 的 `createOnnxSession`），指向它自己从
  `/generated/background-removal/1.7.0/` 取回来拼成的 blob URL，而那里我们自托管的是**非 JSEP**的
  `ort-wasm-simd-threaded.wasm`——因为我们从不传 `device: 'gpu'`。两处兜底因此都是死路：一处挂在
  `!wasm.wasmPaths` 后面，另一处挂在缺少 `locateFile` 后面，而 `locateFile` 正是 `wasmPaths` 提供的。

  做法：`astro.config.mjs` 里加一个 Vite 插件，把那个文件名改写成 Vite 资源扫描器不认的表达式
  （运行时取值不变，只是不再触发产出）。**关键一点是插件必须同时注册到 `vite.worker.plugins`**——
  worker 打包走的是**独立的插件管线**，`vite.plugins` 到不了那里，而拉进 ORT 的正是 background-removal
  worker；只注册到 `vite.plugins` 时文件原样还在。

  代价说清楚：如果将来哪次改动真的走到那两处兜底（换了 device，或者不再设 `wasmPaths`），它会去取一个
  现在 404 的地址。那是响亮的失败而不是静默的错误，但确实是失败，改到那里的人必须回头看这段。

  结果：`dist` 从 73 MB 降到 50 MB，最大单文件变成 9.78 MiB 的 FFmpeg core。

  **补上校验**：`validate-static-asset-sizes.mjs` 现在额外要求 `dist/_astro` 里不出现任何 `.wasm`——
  本站要跑的 WASM 都是自托管在 `/generated/` 下按需取、分块缓存的，落在 Vite 产物目录里的只会是依赖
  替我们声明、我们替它发布的东西。**已验证这条检查会失败**：往 `dist/_astro` 放一个假的 `.wasm`，门禁
  立刻报出文件名。原来那条 24 MiB 大小红线没动——它拦的是别的东西，而且在没有完整 background-removal
  资源的环境里无法重新标定。

  **`/favicon-for-wordpress/` 维持默认只出 1 个图标**（所有者决定，不改代码）。页面文案本来就把这件事
  说清楚了：WordPress 只要一张 ≥512×512 的站点图标，其余尺寸由它自己生成，需要更多可以切换尺寸集。
  上一条日志里"仍未决定"的项到此关闭。

  验证：typecheck、lint、format、13 项单测、构建、SEO 注册表（`linkedVariants: 42`）、站点完整性
  （4399 内链 / 0 断链）、静态资源门禁全部通过。**两处未能在本沙箱验证**，需要所有者机器上补：
  一是 `npm run build` 的完整形态——沙箱出网被挡，`staticimgly.com` 返回 403，
  `prepare-background-removal-assets.mjs` 下不来资源，本次是用 `npx astro build` 绕过 prebuild 构建的；
  二是 Background Remover 的端到端实跑，同样因为下不来模型。`validate-content-freshness.mjs` 在本沙箱
  必然失败，那是新克隆导致所有源文件 mtime 都是今天，与本次改动无关。

- 2026-09-17 — `变体页入口` / `25 个孤儿页修复` / `校验盲区补上`：所有者问"那个 WordPress 变体页
  从哪进去"——答案是**进不去**。查下来问题远比一个页面大：全站 48 个变体页，**25 个从自己那一簇之外
  没有任何入链**，只能靠直接敲 URL 或读 sitemap 到达。favicon-generator（4/4）、pdf-splitter（2/2）、
  video-to-gif（2/2）三个工具是全军覆没；9 个有变体的工具里，**只有 2 个的父页面链了自己的变体**。

  这条线解释了之前那份外部审计说的"薄变体 GSC 抓过后明确不收"：它们不只内容薄，**还是孤儿页**。
  内容薄 + 零入链是最差的组合，PROJECT_STATUS 里记的 7 个 discovered-not-indexed 和 5 个
  crawled-not-indexed 大概率就是这批。

  Image Cropper 和 Image Splitter 本来就有卡片区，做对了——但那是**两份手写实现**，其余七个什么都
  没有。新建共享组件 `ToolVariantLinks.astro`，九个工具页全部接上，包括把原有那两份手写的也迁过来，
  避免再养出一个"同一个模式两份实现"。描述来源做成回调，因为 `src/data/*-variants.ts` 有三种形状：
  多数是 `variantData` 记录、converter 是扁平的 `descriptions` 映射、pdf-page 和 animation 把描述挂
  在变体自身。归一化这三个文件会波及本次改动之外的代码，所以由调用方做查找。

  每个工具的标题和引导语是**分别写的**，不是套模板——它是访客在做选择时读的东西，"Variants"这种
  内部概念不该出现在页面上。

  非索引变体被跳过：converter 有 6 个 `availability !== 'supported'` 的变体，它们是有意不进 sitemap 的
  （已确认带 `noindex, follow`），不能因为要补入链就把它们当成目的地链出去。

  **校验盲区**：`validate-seo-registry.mjs` 早就对 guide 强制要求 ≥2 条上下文入链，**却从没对 variant
  做过任何这类检查**——规则已经存在、已经被认为是对的，只是没应用到变体页上，所以 25 个孤儿页一路
  绿灯上了线。现在每个可索引变体都必须能从自己的工具页链到（`linkedVariants: 42`）。**已验证这条
  检查会失败**：删掉 favicon 页的入口区，门禁报出
  `favicon-generator must link its png-to-favicon variant from the tool page`。

  结果：42 个可索引变体全部有父页面入链，各工具数量与 sitemap 逐一对齐；站内链接从 4366 涨到 4399，
  零断链。门禁：typecheck、lint、format、13 项单测、构建、SEO 注册表、站点完整性，以及 71 路由 ×
  5 宽度的 responsive/a11y 套件，全部通过，`browserErrors` 为 0。截图确认桌面和手机上卡片区正常渲染。

  `/favicon-for-wordpress/` 默认只出 1 个图标那件事**仍未决定**——现在它终于能从站内点进去了，
  建议所有者实际看过效果再定。

- 2026-09-17 — `线上故障` / `第二次撤掉隔离头` / `根因仍未查明`：所有者报告 Background Remover 线上
  报错 `The background removal worker stopped unexpectedly`，后面没有任何细节——`ErrorEvent.message`
  为空，是 **worker 进程被浏览器杀掉**的特征，不是 worker 内部抛异常（那样会带上消息）。而且这是**两次
  尝试都死了**：多线程那次死了之后，单线程兜底重试也死了，用户才会看到最终报错。

  先排除的：从 PR #20 到 `35f0013`，**没有任何提交碰过这个工具的代码**——`background-remover.ts`、
  worker、组件、`_headers`、`wrangler.jsonc` 全部零改动，worker 产物 hash 仍是 `2po4Cew3`，字节级
  相同。构建自洽，worker 动态 import 的两个 ort chunk 都在，148 文件 / 73 MB 远低于 Cloudflare 限制。
  所有者在线上实测：`crossOriginIsolated: true`、`resources.json` 完整返回——**隔离生效、模型资源
  部署正常**，"资源缺失"的假设排除。

  关键的新事实：这台机器 **20 核**，而 PR #18 当初验证"多线程能跑通"是在 **16 核**那台上。不是同一台。
  按 `plannedThreadCount(20, true)` 算请求的是 4 线程，和 16 核那台一样——所以线程数不是差异所在。
  **隔离 + 多线程这条路，在两台未经调优的机器上都把工具搞死了，只在当初调优的那一台上好使过。**

  兜底为什么救不了：它只能接住**抛异常**的运行。浏览器直接杀掉 worker 进程时，error 事件不带消息，
  也没有任何东西还活着可以重试进去——PR #18 自己的提交信息当时就写明了这一点。

  隔离头第二次撤掉。`_headers` 里的注释现在完整记录了四个阶段（重复规则→生效即崩→限线程+兜底→
  在 20 核上再次崩溃），以及"兜底接不住进程被杀"这个结构性原因，并写明：**在有人能复现并解释这次
  崩溃之前**这条路由保持不隔离——"在新硬件上复现不出来"不算解释。

  验证方式本身也修了一处：复用的探针脚本**自己会发隔离头**（早先为测试改的），所以它报 `isolated:
  true` 说明不了任何事。去掉之后重测，构建产物确认 `crossOriginIsolated: false`、`SharedArrayBuffer`
  不可用。构建产物里隔离头数量为 0。

  仍然缺的是所有者浏览器控制台的红色报错——特别是有没有出现
  `[toolkitfree] background removal failed on 4 threads, retrying single-threaded` 这行 warn。
  它在，就证明确实走到了兜底；不在，说明故障发生在这条路径之外，那是另一个方向。

- 2026-09-16 — `外部审计复核` / `修掉两条真问题`：外部给的六条里，核实后**两条成立、两条已知且不在
  仓库、一条不成立、一条是有意为之**。

  **成立并已修：站点级 Organization 描述是旧的。** 上次做身份收敛时我只改了首页 `WebSite.publisher`
  和 About 的 `mainEntity`，**漏了 `Layout.astro` 里那份每页都输出的 `orgSchema`**——它自带一句
  "Free online image tools ... editing images in your browser"，于是首页上同时存在两个 Organization
  节点、描述互相矛盾，比只有一份过期的更糟：爬虫拿到的是同一实体的两种说法。现在 `orgSchema` 从
  `SITE_ORGANIZATION` 展开、只补一个 `logo`，全站 71 页的 Organization 描述已核实为同一份。

  **成立并已修：sitemap 的 lastmod 与页面自述日期矛盾。** Privacy 和 Terms 页面上写着
  "Last updated: August 1, 2026"，sitemap 却停在 5 月 20/22 日。两处都是手工维护、分在不同文件里，
  漂移是必然的。日期已对齐，并给 `validate-seo-registry.mjs` 加了一条检查：任何自述 "Last updated"
  的页面，其日期必须与 sitemap 报告的 `lastmod` 一致。**已验证这条检查会失败**——故意把 terms 改回
  5 月，门禁报出 `/terms states "Last updated: August 1, 2026" but the sitemap reports 2026-05-22`。

  **不成立：无斜杠主页应当 301 到 `/`。** `https://toolkitfree.net` 与 `https://toolkitfree.net/`
  按 RFC 3986 是**同一个 URL**（http(s) 的空路径等价于 `/`），200 是正确行为，没有可重定向的对象。

  **已知且不在仓库：路径无斜杠的 307。** 查证了 Cloudflare 文档：Workers 静态资源的
  `html_handling`（含 `force-trailing-slash`）**只会发 307，没有配置项能改成 301**。唯一办法是
  Cloudflare 控制台的 Redirect Rule——它在 Worker 之前执行，可用动态表达式
  `concat(http.request.uri.path, "/")` 指定 301。这条只能由项目所有者在控制台做。

  **有意为之：sitemap 不收录 `llms.txt`。** sitemap 是给可索引 HTML 页面的，而
  `validate-seo-registry.mjs` 的逻辑正是"拿所有可索引路由去比对 llms 的覆盖"，把覆盖文件本身放进被
  覆盖的路由集会让这个校验自指。入口已通过页脚（每页）、`robots.txt` 注释、About 页三处提供。

  联系邮箱仍是 Gmail，外部审计自己也认为不是硬伤，未改。

  门禁：typecheck、lint、format、13 项单测、构建、SEO 注册表（新增 `datedPages: 2`）、站点完整性，
  以及 71 路由 × 5 宽度的 responsive/a11y 套件，全部通过，`browserErrors` 为 0。

- 2026-09-14 — `第二批四个工具改造` / `已集成`：Image Enhancer、Favicon Generator、ID Photo Maker
  （A 类）和 Image Splitter（B 类）由四个并行 agent 完成并合入。**改造进度 5/14 → 9/14。**

  四个 agent 中途被会话用量上限同时掐断（HTTP 429），worktree 完好但都没提交。用 SendMessage 带着
  原有上下文恢复，四个都从断点续上并完成 —— 冷启动会把它们各自做过的实测数据全部作废。这条路验证
  可行，代价可控。

  **这一批最有价值的产出是它们驳回了任务描述里的错误**，而不是照做：

  - **ID Photo**：任务里说预设表在 `src/lib/id-photo.ts`（实际在 `src/data/id-photo-presets.ts`）、
    芯片做成"护照/签证/身份证"（表里**没有**签证和身份证，只有三个有官方来源的可选项）、"底色归入
    微调面板"（**压根没有底色控件**）。它拒绝造一枚"签证"芯片——编造一个没有来源的证件尺寸正是
    `CLAUDE.md` 禁止的过度声称。三处我都核实了，它是对的。
  - **Image Splitter**：任务里假设"切 N 块 = N 倍代价"，因此把它标成最可能推翻分类的那个。**实测是
    错的**——切片合起来正好覆盖原图一次，4 块 376 ms、9 块 368 ms（9 块反而略快），144 块 1.3 s。
    成本随总像素走，与产出文件数无关。B 类成立，全自动运行，无需阈值或降级按钮。
  - **Favicon**：任务里要求"确保变体入口带进来的默认值仍然生效"——四个变体页原本一个 prop 都没传，
    这条要求是空的。任务里举例的"只要 .ico"芯片也不可实现，这个工具不产出 `.ico`。
  - 任务里说 `validate-batch-download-browser.mjs` 驱动 image-splitter，实际 **0 处引用**。

  实测数据（都写进了规格）：Enhancer 预览 46.5 万像素 17 ms vs 导出 600 万像素 195 ms，相差 12.9 倍
  （手机 67 倍），且只限宽度不够——1000×20000 全景图缩到 700px 列宽仍有 9.8 Mpx，必须加面积上限。
  Favicon 一次产 5 个图标平在 10–15 ms，不随输入变大。ID Photo 证件照 3.1 ms、A4@600DPI 底片最坏
  272 ms，两者都自动运行，但**分开建 key**：底片永远是 PNG，所以下载格式和 JPG 质量不进它的 key，
  拖质量滑块只重编 11 KB 照片、2.6 MB 底片纹丝不动。

  集成时处理的问题：删掉 `.id-photo-actions`（`position: sticky` 的死规则，按钮删除后它把次要动作
  悬浮在芯片行上方，盖住页面最重要的控件）；给 `BatchResultsSummary` 补上引用稳定性契约的说明——
  它以数组身份判断"结果换了一批"，内联 `.map()` 会让拖拽时每帧取消一次用户的下载（Splitter 撞上并
  已 memo 化；其余三个传的是 state，当前安全）。**没有改成内容签名**：两次运行可能产出同名不同字节
  的文件，签名会漏掉真正的变化并归档过期 blob。

  截图验收再次抓到套件抓不到的问题：Enhancer 的 FAQ 还写着已不存在的"Reset all"按钮、每个滑块的
  重置在手机上渲染成光秃秃的 `Reset`（靠 `aria-label` 才知道重置什么）；Splitter 的运行注记把 26 ms
  显示成"0.0s"（读起来像失败）、输出格式下拉框因未用 `FineTuneField` 而只有 36 px 高。

  **需要所有者决定的一件事**：Favicon agent 把 `/favicon-for-wordpress/` 的默认输出从 5 个图标改成
  1 个（仅 512），理由是该页 FAQ 原文就写着"you only need the 512x512 file"，并同步改了文案。行为
  与文案一致、不是偷改，但这**改变了一个已索引落地页默认交付什么**，属于产品判断。一行可改回。

  门禁：typecheck、lint、format、13 项单测、构建、SEO 注册表、站点完整性，以及**全部 12 个可运行的
  浏览器套件**，全部通过，`browserErrors` 均为 0。第 13 个 `validate-secondary-tools-browser.mjs`
  仍因沙箱连不上 `staticimgly.com` 跑不了——Enhancer 和 Favicon 的断言都在失败点之前，两个 agent
  都按要求明确声明了"不报成通过"，并各自用截断副本取得了正面证据。

- 2026-09-14 — `对外身份` / `llms.txt 可发现性`：外部 SEO 审计的六条里，核实后三条成立、一条部分
  成立、一条基本不成立、一条无法从这个沙箱验证（出口代理拦了 toolkitfree.net，www 和 301 的实际
  行为只能由项目所有者在线上确认）。本次实现其中两条。

  **对外身份（审计第 3 条，部分成立）。** 审计说描述还写着"只有图片工具"——这条是错的，Organization
  的 description 早就是"images, PDFs, QR codes, ID photos, and animated media"。真正缺的是身份：
  全仓库 `sameAs` 零处，Organization 只有 name/url/description 三个字段。现在补上运营者
  `ruofeng_x`、对外邮箱（本来就已明文挂在 About 页上，写进 schema 不增加新暴露）、以及 YouTube 频道
  的 `sameAs`。定义收敛到 `src/data/organization.ts` 一处，首页 `WebSite.publisher` 和 About 的
  `AboutPage.mainEntity` 都引用它，避免两处漂移。About 页同时加了"Who Runs ToolkitFree"一节——
  光有 schema 而页面上没有任何佐证，实体识别是站不住的。

  **Dev.to 的 `sameAs` 没有加。** 仓库里没有记录 handle，而 `sameAs` 是一条"此站与该主页同属一个
  运营者"的可被核查的声明，指向一个不存在的主页比不写更糟。等所有者给出确切 URL，加进
  `organization.ts` 的数组即可，一行。

  **llms.txt 可发现性（审计第 4 条，成立）。** 此前 `robots.txt`、sitemap、页脚、About 全站 grep
  零处引用——文件写得不错但没有任何入口。现在页脚每页一个链接、`robots.txt` 以注释指明两个文件
  （robots 没有对应的标准指令）、About 页给出面向助手的说明。**没有把 llms.txt 放进 sitemap.xml**：
  sitemap 是给可索引 HTML 页面的，而 `validate-seo-registry.mjs` 正是拿可索引路由去比对 llms 覆盖，
  把它自己放进去会让这个校验自指。审计这一小条不采纳。

  门禁：typecheck、lint、format、13 项单测、构建、SEO 注册表、站点完整性，以及 71 路由 × 5 宽度的
  responsive/a11y 套件，全部通过，`browserErrors` 为 0。内部链接从 4292 涨到 4366（页脚每页多一个
  llms.txt 链接），零断链。

- 2026-09-13 — `视觉验收` / `修掉三处只有看页面才能发现的问题`：前一条记的是门禁和代码审查，但
  页面长什么样一直没人看过。补做了截图验收（桌面 1440 / 手机 390，上传真实文件后拍控件区），发现
  三处自动化完全抓不到的问题：

  - **Image Converter 的"如何使用"步骤还写着 Click "Convert"**，主页面一处、`[variant].astro` 一处
    （覆盖 9 个变体页）。改造 agent 修了 FAQ 答案却漏了同一个文件里的 `<ol>`。`validate-seo` 和
    `validate-site` 都不读散文，所以全绿也说明不了这句话是真是假。
  - **微调摘要行在手机上排版错乱，是集成方自己引入的回归。** 上一条把窄屏 `display:none` 改成换行时
    没有一并重置 `justify-content: space-between`——摘要换行后那一行只剩箭头和 "Fine-tune" 两个元素，
    被撑到了两端。
  - **带提示语的芯片在手机上三种宽度参差不齐。** 改为窄屏下占满整行，用 `:has(.tool-chip-hint)` 限定
    ——没有提示语的短芯片（裁剪比例那六枚）保持原宽，否则六行 "1:1" 比参差更糟。

  结论记在这里：**这三个工具的浏览器套件此前全绿，但页面上写着一句假话、手机布局是坏的。**
  自动化能证明行为正确，证明不了观感正确；后面九个工具的验收必须包含截图这一步。

  重跑门禁：typecheck、lint、format、13 项单测、构建、SEO、站点完整性，以及 responsive/a11y、
  converter、resizer/cropper、compressor 四个浏览器套件，全部通过，`browserErrors` 均为 0。

- 2026-09-13 — `试点三个工具改造` / `已集成` / `规格已按反馈修订`：Image Converter（A 类）、
  Image Cropper（B 类）、Video to GIF（C 类）由三个并行 agent 在各自 worktree 完成并合入。刻意先派
  三个而不是十二个，一类一个，检验的是规格本身能不能被执行——事实证明这个决定是对的，下面每一条
  都是在三个上发现、而不是在十二个上发现的。

  三次改造本身都达标：Converter 用格式芯片 + 自动运行，且没有动任何变体页钉死的输出格式；Cropper
  的结果跟随裁剪框，解码结果按文件缓存后，实测 1.2 秒拖拽 48 次 pointermove 期间编码 0 次、松手后
  恰好 1 次；Video to GIF 实测转码 2.2–15.3 秒后确认 C 类判断成立，保留按钮，只把零成本的算术
  （输出尺寸、帧数、预算预检）做成实时——其中预检前移是净收益，原来要等 10 MB 引擎下载完才会告诉
  用户这组设置超预算。

  集成时发现并修复的问题，全部不是 agent 能从自己的任务里看到的：

  - **`FineTuneField` 的 `hidden` 不生效**（共享件 bug，由 C 类 agent 回报）。`.fine-tune-field` 的
    `display: grid` 是类选择器，优先级高过 UA 样式表的 `[hidden]`，所以 Resizer 选 PNG 时质量滑块
    一直在显示。这是改造前就存在的缺陷，被共享件原样继承。已加 `.fine-tune-field[hidden]`。
  - **Compressor 在工作过程中注册对象 URL**（由 A 类 agent 回报，在集成方自己写的代码里）。
    `objectUrls.replace` 会吊销该 key 原有的 URL，所以被取代的运行能先吊销新运行的 URL、再自我放弃，
    页面上留下指向已吊销 blob 的 `src`。注册改到令牌检查之后。
  - **删掉一个提交按钮会打挂别的套件。** `validate-batch-download-browser.mjs` 和
    `validate-performance-browser.mjs` 都驱动 converter，都还在点那个不存在的按钮。两个都修了，并把
    原来的点击辅助函数换成一条防倒退断言：这些路由上不得再出现提交按钮。
  - **`.gitignore` 不忽略 `node_modules` 符号链接**（`node_modules/` 带斜杠只匹配目录），而 worktree
    的依赖正是符号链接，`git add -A` 会把它暂存进去。去掉斜杠。
  - **`eslint .` 会走进 `.claude/worktrees/`**，报出 14085 个不属于任何人 diff 的错误。已 ignore。
  - **微调摘要行在窄屏被 `display: none`**，等于手机上看不到当前值，与规格承诺矛盾。改为换行到下一行。

  `TOOL_INTERACTION.md` 按这些反馈修订：对象 URL 必须在令牌检查之后注册（不只是 `runNow` 的问题）；
  `key` 序列化的是输出真正依赖的量而非控件当前值；解码成本必须按文件缓存；`onInvalidate` 在编辑器型
  工具里一次拖拽跑几十次，必须便宜且幂等；芯片不得覆盖变体页面钉死的值；B 类的"不加芯片"指不新增
  问题、不是禁用共享组件；改造必须同步修 FAQ 与步骤文案里描述已删按钮的句子；验收清单区分 A/B 类与
  C 类；转码成本表换成实测数字，并把判据从秒数改成"误触发值不值得付账"；新增共享类 `.tool-controls`
  （两个 agent 独立提出同一需求）；以及"先 grep 所有套件"这一条。

  门禁：typecheck、lint、format、13 项单测、构建、SEO 注册表、站点完整性全部通过；12 个浏览器套件
  全部通过、`browserErrors` 均为 0。第 13 个 `validate-secondary-tools-browser.mjs` 仍因沙箱连不上
  `staticimgly.com` 跑不了。

  剩余九个工具尚未改造。试点暴露的规格缺口已经补上，可以放大批次。

- 2026-09-13 — `合并 master` / `修掉 agent worktree 污染 lint`：#20 合入 master 后，把 master 合进
  foundation 分支。照例只有 `PROJECT_STATUS.md` 冲突——两边都往同一个倒序日志顶部追加——全部条目按
  日期保留，没有丢弃。

  合完暴露出一个真问题：`npm run lint` 报了 14085 个错。不是代码的问题。子 agent 的 worktree 建在
  `.claude/worktrees/agent-*`，也就是**仓库目录内部**，每个都是完整检出，带自己生成的 `.astro` 类型
  和软链过去的 `node_modules`，于是主检出跑 `eslint .` 会走进这三个目录，报出一堆不属于任何人 diff
  的错误。`eslint.config.js` 的 ignores 里加上 `.claude/**`。worktree 里面的 agent 不受影响（worktree
  不嵌套），受影响的只有主检出——但那正是集成时要跑门禁的地方。

  合并后完整门禁通过：typecheck、lint、format、13 项单测、构建、SEO 注册表、站点完整性。

- 2026-09-13 — `规则` / `文档语言`：项目说明文档改用中文，规则写进 `CLAUDE.md` 与 `AGENTS.md`。
  边界是明确的，因为搞错代价很大：**网站上任何访客能读到的文案、代码注释与标识符、提交信息与 PR
  正文，一律保持英文**。站点面向英语受众，代码库通篇英文注释，中途混入中文只会让它前后不一致。
  已有的英文段落不回头翻译，按需改动时再换。`TOOL_INTERACTION.md` 已整篇改为中文——它是接下来十二
  次改造要反复读的文件，是这条规则最该先落地的地方。本条之后的日志也用中文。

- 2026-09-13 — `foundation` / `ready for parallel work`: the interaction redesign had reached two of
  fourteen tools — Image Compressor and Image Resizer had intent chips, auto-run and a folded
  fine-tune panel; the other twelve were still fill-in-then-submit. Rolling that out twelve more
  times needed a written contract first, or twelve conversions would have produced twelve dialects.

  `TOOL_INTERACTION.md` is that contract, and the shared pieces it names now exist:
  `ToolChoices` / `ToolPresets` (selection chips and action chips), `FineTune` / `FineTuneField`,
  `ToolRunNote`, and the `useAutoRun` hook that carries the debounce and the run-token discipline —
  the part that is easy to leave out, since a superseded run overwriting fresh results only misbehaves
  when input arrives faster than the work completes. Both reference tools were migrated onto them, so
  the API is proven against two real cases rather than specified in the abstract; their browser suites
  pass unchanged, which is what says the refactor changed no behaviour.

  The spec is deliberately not a template to apply everywhere. It records which tools must keep an
  explicit button — Background Remover at 6-25s a run, Video to GIF at tens of seconds — because
  auto-run assumes starting a run by accident is free, and says that reporting a wrong assignment is
  a correct outcome rather than a failure. It also fixes the two things that would otherwise make
  parallel work cost more than it saves: `global.css` and this file are integration-owned, so no
  conversion touches them, and browser tests take their ports from `E2E_PREVIEW_PORT` /
  `E2E_DEBUG_PORT` so concurrent runs cannot collide.

  Gates on this change: typecheck, lint, format, 13 unit scripts, build, SEO registry, site
  integrity, and the compressor, resizer/cropper and batch-download browser suites, all passing with
  zero browser errors.
- 2026-09-12 — `observability` / `reviewed`: the threading fix and the header restore were reviewed
  against a fresh clone. The diagnosis holds and the gates pass here — typecheck, lint, format, all
  13 unit scripts, and eleven of the twelve browser suites; the built `_headers` carries exactly one
  rule for the tool route, and a headless Chrome load behind a server that sends the two headers
  reports `crossOriginIsolated: true` with `SharedArrayBuffer` available and a clean console.
  `validate-secondary-tools-browser.mjs` is the one failure and it is environmental: the sandbox
  cannot reach `staticimgly.com`, so the model never downloads and removal reports
  `Resource metadata not found`.

  One real gap came out of that review and is fixed here. The timing line logged
  `hardwareConcurrency` — what the machine has — but never the thread count the run actually asked
  for, and a fallback to one thread is invisible in the result, since the cutout is correct either
  way. A future report of "still slow" would not have said whether four threads lost to contention
  or the single-threaded retry had quietly taken over, which is the same ambiguity that let the
  sixteen-thread defect survive two releases. `removeBackgroundInWorker` now returns
  `{ blob, threads, fellBack }`; the timing log and `data-background-threads` /
  `data-background-fell-back` carry both, the failure log reports the planned count, and the browser
  suite asserts the contract (exactly one thread and no fallback when the page is not isolated,
  within the measured cap when it is).

  Two smaller things from the same review: the inference watchdogs are now named constants with the
  reasoning for the 90s threaded budget written down — it is roughly fifteen times the measured
  4-thread time, the model resizes input to a fixed size so inference does not grow with the image,
  and a hang and mere slowness are deliberately treated alike because they are indistinguishable
  from outside the worker — and `runBackgroundWorker` now rejects an already-aborted signal itself
  instead of relying on every caller to check first, since `addEventListener('abort')` never fires
  on a signal that has already aborted.

  Still open for the owner: after this deploys, check whether Cloudflare Web Analytics still records
  pageviews for `/tools/background-remover/`. COEP `require-corp` blocks cross-origin subresources
  and the analytics beacon is injected at the edge, so it may go dark on that one route. It cannot
  be verified locally — the built HTML references no cross-origin host. If it does go dark, that is
  the price of isolation and belongs in this file as a decision rather than being rediscovered later.

- 2026-09-12 — `browser regression` / `fixed`: `npm run test:e2e` had been red on master since
  2026-09-09. `validate-batch-download-browser.mjs` failed at `Resize 2 images button`, and the
  cause was a stale test rather than a product defect: `54e9774` deliberately removed the Image
  Resizer's submit button ("No submit button: results follow the controls, debounced"), matching the
  compressor. That commit updated `validate-resizer-cropper-browser.mjs` but missed the second place
  that clicked the button, here. The click is replaced by the wait on
  `[data-batch-success-count="2"]` the compressor section already uses. Full Chrome regression now
  passes end to end: 12 scripts, `browserErrors: 0` throughout, and the resized ZIP still contains
  both `photo.jpg` and `sample.jpg`.

- 2026-09-12 — `threaded inference` / `verified on the machine that broke` / `headers restored`:
  the sixteen-core machine that broke under isolation ran the fixed build with COOP/COEP genuinely
  in effect — `crossOriginIsolated` true, `SharedArrayBuffer` available, `hardwareConcurrency` 16 —
  and the tool completed upload to output: **inference 5.98s, total 9.4s**, against the **24.2s**
  inference that same machine recorded single-threaded (`e4bf91a`). Roughly four times faster, and
  the 5.98s is itself the proof that threading engaged: the single-threaded fallback would have
  landed near 24s, so it never fired. Stage order was
  `runtime:808, model-download:2389, model-initialization:90, inference:5984, model-initialization:120, compose:3`.

  That was the one blocker, so `public/_headers` sends the two isolation headers again, on a single
  `/tools/background-remover/*` rule. The comment there now carries the whole history — duplicate
  rules, the outright failure, the thread-count defect, and this verification — plus the
  one-rule-only trap, since that mistake is what hid the real problem the first time.

  Caveat worth keeping honest: this run exercised the **fixed** configuration, where sixteen cores
  ask for four threads. It confirms the route is safe to isolate now; it does not independently
  prove the original failure was the sixteen-thread request, because the unfixed build was never
  re-run on that machine. The thread-count sweep is the evidence for that, and it is circumstantial
  rather than a reproduction.

  Testing note: these headers cannot be exercised through `astro dev` or `astro preview`, and a LAN
  address cannot be isolated either — cross-origin isolation additionally requires a secure context,
  which plain `http://` on a LAN IP is not. Use `127.0.0.1` on the machine under test, or Chrome's
  `--unsafely-treat-insecure-origin-as-secure` / the matching `chrome://flags` entry. `AGENTS.md`
  has the server.

- 2026-09-12 — `threaded inference` / `partially diagnosed` / `verified on four cores` /
  `headers still off`: the multi-threaded path was finally exercised for real. `npm run build` plus
  a local static server sending COOP/COEP (the repro in `AGENTS.md`) put Chrome 152 on Windows into
  `crossOriginIsolated: true` with `SharedArrayBuffer` available, and the tool ran upload-to-output
  correctly: a clean cutout, fully transparent corners, 37.6% opaque against 60.5% transparent. So
  on this hardware the threaded path is not broken — it is what it was supposed to be, roughly twice
  the speed of one thread. **The owner's original failure was not reproduced.** That machine has
  sixteen cores; the one available here has four, and no amount of forcing the thread count
  reproduced a failure — only slowness.

  What the run did expose is a real defect that fully explains why sixteen cores would be the worst
  case. `@imgly/background-removal` sets `ort.env.wasm.numThreads` to
  `navigator.hardwareConcurrency` itself and exposes no override. Sweeping the thread count against
  one image on four cores: **1 thread 17.9s, 2 threads 8.8s, 4 threads 11.6s, 8 threads 13.8s,
  16 threads 25.9s, 32 threads 27.1s.** Past a couple of threads it loses to contention, and at
  sixteen — exactly what a sixteen-core visitor asks for — it is *slower than not threading at all*.
  Every count completed; none threw. Control, same build and image without the headers:
  single-threaded inference 14.0s against 8.8s isolated, which is what proves the threading was
  genuinely engaging rather than silently falling back.

  Two fixes landed, neither of which is "turn threading off":
  - `plannedThreadCount` (`src/lib/background-remover.ts`, unit-tested in
    `validate-secondary-tools.mjs`) asks for half the logical cores, capped at 4 and floored at 2,
    and says 1 when the document is not isolated, since the runtime is single-threaded there anyway.
    Four cores now ask for 2 — the measured optimum — and sixteen ask for 4 instead of 16. The
    worker applies it by redefining `navigator.hardwareConcurrency` on its own scope, which is the
    only seam the library leaves.
  - A threaded attempt that fails for anything other than the user canceling is retried
    automatically on a single thread, and the threaded attempt gets a shorter inference watchdog
    (90s against 180s) because the library reports `compute:inference` exactly once, so that one
    timer has to cover the whole inference. Verified by fault injection: with the threaded attempt
    forced to throw, the retry produced a byte-identical cutout, the user saw no error, and the
    console carried `background removal failed on 2 threads, retrying single-threaded`. A worker
    that dies now also reports the `ErrorEvent` message and location instead of only "stopped
    unexpectedly".

  `public/_headers` still does **not** send COOP/COEP, and that is deliberate. The fallback makes
  the worst case equal to today's speed rather than a broken tool, but it cannot catch a failure
  that kills the renderer outright — an out-of-memory tab crash runs no JavaScript. Restoring the
  headers is therefore `blocked` on one thing: running the repro on the sixteen-core machine that
  broke, capturing either a success or the real error text, which has never been captured. Procedure
  for that machine: `npm run build`, serve `dist/` with both headers, confirm `crossOriginIsolated`
  is `true`, run one photo end to end, and read `[toolkitfree] background removal timing` (success,
  with the per-stage breakdown) or `[toolkitfree] background removal failed` plus any
  `retrying single-threaded` warning. WebGPU stays parked until that is settled.

- 2026-09-11 — `production regression` / `reverted` / `diagnosis pending`: with the duplicate-header
  fix (#16) live, cross-origin isolation was genuinely in effect on `/tools/background-remover/` for
  the first time, and the owner reported the tool failing outright — not slow, unusable. Isolation
  is what grants `SharedArrayBuffer`, so this was the first run that actually took ONNX Runtime's
  multi-threaded path; something on that path fails on real hardware. A slow tool beats a broken
  one, so the two isolation headers are removed from `public/_headers` and the route is back on the
  single-threaded path that worked. The comment there now records what was tried, that it broke, and
  the duplicate-rule trap to avoid if it is ever restored.

  The regression was also undiagnosable from the UI, which is its own defect:
  `getImageProcessingErrorMessage` collapses everything that is not an `ImageProcessingError` into
  one generic sentence, so the real failure — the worker does forward it — reached nobody. The
  Background Remover now keeps the friendly headline but shows the underlying message beneath it
  when it has nothing more specific to say, and logs the error at `console.error` with
  `crossOriginIsolated` and `hardwareConcurrency` alongside. Next step before any second attempt at
  threads: get that underlying message from a failing run, since the threaded path cannot be
  exercised in this sandbox (the IMG.LY model host is unreachable here, so the assets never
  download). Until then the threading work is parked, and WebGPU stays parked with it.

- 2026-09-11 — `merged with master` / `revalidated`: pull request #15 (the readable timing log and
  the summed repeated stages) landed on master, so master was merged into the isolation-fix branch.
  Only `PROJECT_STATUS.md` conflicted, as before — both sides had appended 2026-09-11 entries — and
  all three are kept, newest first; `BackgroundRemover.tsx` came across cleanly. Revalidated on the
  merged tree: the built `_headers` carries exactly one rule for the tool route, the timing line is
  still logged at `info`, a Chrome probe against the build reports `crossOriginIsolated: true` with
  `SharedArrayBuffer` available on that route while the compressor and the homepage stay unisolated,
  and all ten runnable gates passed.

- 2026-09-11 — `root cause found` / `fixed` / `reproduced both ways` / `owner verification pending`:
  the cross-origin isolation shipped in #12 never took effect, and the timing work explains why. Two
  machines both reported `crossOriginIsolated: false` — a 4-core machine spent 40.3 s on inference
  and a 16-core machine 24.2 s, a gap that matches single-core speed rather than core count, so
  neither was threading. Inspecting the live response showed the headers were in fact being sent,
  but **twice each**: `public/_headers` carried both `/tools/background-remover/` and
  `/tools/background-remover/*`, both rules matched the same URL, and a browser joins repeated
  values into `same-origin, same-origin`, which is not a valid value — so it falls back to
  unsafe-none and the page is not isolated at all. The headers were present and worthless. This also
  answers an open question: a static-assets-only Worker does honour `_headers`. Reproduced both
  directions locally against the same build before changing anything: duplicated headers give
  `crossOriginIsolated: false`, a single pair gives `true`. The redundant exact-path rule is removed,
  the wildcard already covers the trailing-slash URL, and the file now carries a comment recording
  the trap so the rule is not re-added. All ten runnable gates passed. The owner should re-check
  `crossOriginIsolated` after deployment and re-run the same image: the thread count should finally
  be in play, and only then is it worth deciding on WebGPU.

- 2026-09-11 — `fixed` / `checks passed`: the timing breakdown added on 2026-09-09 never reached the
  owner, because it was logged with `console.debug`, which Chrome hides behind the Verbose log level
  that is off by default — the same trap the removal library fell into with its own cross-origin
  warning, and the exact mistake that had just been diagnosed. Raised to `console.info`, with a
  comment recording why so it is not tidied back. No other behavior changed. The already-deployed
  build can still be read without this fix, since the stages are mirrored onto the DOM:
  `document.querySelector('[data-background-timing]').dataset.backgroundTiming`. All ten runnable
  gates passed.

- 2026-09-11 — `measured` / `direction decided`: the owner ran one real removal and read the stage
  breakdown off the DOM: runtime 147 ms, model download 1303 ms, model initialisation 76 ms,
  inference 40342 ms, a second initialisation 137 ms, composition 3 ms — about 42 seconds in total,
  with inference at 96% of it. That settles the open question: WebGPU is the only lever worth
  pulling, since optimising everything else could save at most 4%. It also refutes the earlier
  hypothesis that the full-resolution composition might dominate — it costs 3 ms. The run also
  exposed a flaw in the instrumentation itself: the worker reports `model-initialization` twice, once
  on either side of inference, and the console line keyed the stages into an object, so the later
  entry silently replaced the earlier one. Stage totals are now summed per stage and the raw ordered
  list is logged alongside them. Still unknown and needed before the WebGPU work: whether
  `crossOriginIsolated` is actually true on the owner's machine, and how many threads
  `navigator.hardwareConcurrency` reports — 40 seconds is slow enough to suspect the headers are not
  reaching the browser at all.

- 2026-09-09 — `implemented` / `checks passed` / `numbers not yet collected`: after the cross-origin
  isolation headers shipped, the owner reported Background Remover felt slightly faster but could not
  tell how much. The tool reported progress stages but no durations, so nothing could be compared
  between runs. Added per-stage timing: each stage the worker reports is closed out when the next one
  begins, the local composition is timed separately from the model work, and the finished run shows
  its total in the same one-line form the compressor and resizer use. The full breakdown goes to
  `console.debug` under `[toolkitfree] background removal timing`, together with
  `crossOriginIsolated` and `hardwareConcurrency`, so a run can be compared against another machine
  or another runtime; the stages are also mirrored onto `data-background-timing` for future
  regressions. This is measurement only — no processing behavior changed. It matters because threads
  accelerate inference alone, while decoding and the final full-resolution composition stay
  single-threaded: without the split, a modest total says nothing about whether WebGPU would be worth
  the extra runtime files. Validation: all ten runnable gates passed and the responsive/accessibility
  sweep passed (355 checks across 71 routes, zero browser errors). The timings themselves cannot be
  produced in this environment, since the model still cannot be downloaded here; the owner needs to
  run one removal and read the console line.

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
