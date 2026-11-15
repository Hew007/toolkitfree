# ToolkitFree

免费的本地优先浏览器工具箱，提供图片处理、PDF、二维码、证件照和视频转动画工具。
所选文件内容在设备上的浏览器中处理，无需上传到处理服务器。

访问：[英文站](https://toolkitfree.net/) · [简体中文站](https://toolkitfree.net/zh/)

> 本地处理不代表没有网络请求。页面资源、背景移除模型及视频转换运行时仍可能通过网络加载。
> 实际处理容量和速度取决于设备内存、浏览器及文件大小。

## 工具

| 工具               | 主要用途                                     |
| ------------------ | -------------------------------------------- |
| 图片格式转换       | 转换 JPG、PNG、WebP，支持批量输出            |
| 图片压缩           | 按用途或目标大小压缩，比较实际输出大小       |
| 图片尺寸调整       | 自定义宽高、保持比例及常用平台尺寸           |
| 图片效果调整       | 亮度、对比度、饱和度、锐化等本地调整         |
| 图片拼接           | 将多张图片排成网格或长图                     |
| 图片分割           | 按网格或自定义分割线切图                     |
| 证件照尺寸与打印   | 调整照片尺寸并生成打印排版                   |
| 图片裁剪           | 按预设比例或自由选区裁剪                     |
| 背景移除           | 在浏览器中运行模型，输出透明或纯色背景       |
| 视频转动画         | 将短视频转换为 GIF、动态 WebP 或 APNG        |
| 图片转 PDF         | 整理图片、调整页面并导出 PDF                 |
| PDF 拆分与页面提取 | 选择、排序、旋转页面并导出 PDF 或 ZIP        |
| 网站图标生成       | 生成多尺寸 PNG 图标和网站清单文件            |
| 二维码生成         | 为文本、网址、Wi-Fi、联系人等生成 PNG 或 SVG |

格式支持和处理限制以各工具页面的说明为准；压缩结果不保证达到指定大小，背景移除结果也需要人工检查。

## 本地开发

使用 **Node.js 24** 和 **npm**。仓库以 `package-lock.json` 为依赖锁文件。

```sh
git clone https://github.com/Hew007/toolkitfree.git
cd toolkitfree
npm ci
npm run dev
```

打开终端显示的本地地址，通常为 `http://localhost:4321/`。

`dev` 和 `build` 会先执行 `prepare:assets`：准备 FFmpeg，并在本地缺少资源时从
`staticimgly.com` 下载背景移除模型与运行时至 `public/generated/background-removal/1.7.0/`。
首次运行需要网络，已准备好的资源可以复用；生成的二进制文件不纳入 Git。

### 构建与预览

```sh
npm run build
npm run preview
```

静态产物位于 `dist/`。部署目标为 Cloudflare Workers 静态资源，配置见
[wrangler.jsonc](wrangler.jsonc)。部署前需要配置自己的 Cloudflare 账户和目标项目；
`npm run build` 仅生成本地产物。

### 语言行为

- 英文使用原有地址，简体中文使用 `/zh/` 前缀。
- 从根入口 `/` 首次访问时，浏览器首选语言为 `zh` 或 `zh-*` 则进入中文，其他语言默认英文。
- 页面顶部支持切换语言；手动选择优先并在浏览器允许时保存。
- 明确指定语言的工具深链保留链接语言，根入口跳转保留查询参数和锚点。
- 禁用 JavaScript 时，根入口仍提供静态英文页面；交互工具需要 JavaScript。

## 验证

| 命令                      | 检查内容                                          |
| ------------------------- | ------------------------------------------------- |
| `npm run typecheck`       | TypeScript 类型                                   |
| `npm run typecheck:astro` | Astro 页面与组件                                  |
| `npm run lint`            | ESLint                                            |
| `npm run format:check`    | 配置范围内的代码格式                              |
| `npm run test`            | 单元、算法与本地化验证                            |
| `npm run check`           | 完整本地质量门禁，含构建、SEO、日期与内链检查     |
| `npm run test:e2e`        | Chrome 完整浏览器回归，含默认语言与双语响应式检查 |
| `npm run test:e2e:zh`     | 14 个中文工具的处理、下载与异常流程               |
| `npm run test:e2e:edge`   | Edge 冒烟回归                                     |
| `npm run sync:llms`       | 从注册表同步两种语言的 LLM 目录                   |

浏览器测试需要安装 Chrome 或 Edge；工具会查找常见安装位置，也可以用 `BROWSER_PATH`
指定可执行文件。测试夹具由脚本生成。已有最新 `dist/` 时，可给浏览器测试命令追加
`-- --skip-build` 来复用构建产物。启动预览或测试前应检查已有进程及端口，避免重复启动。

**背景移除的多线程测试需要额外环境。** `astro dev` 和 `astro preview` 不会发送
`public/_headers` 中的跨源隔离响应头。普通本地预览不能证明多线程路径正常；
必须在可信来源下提供 COOP/COEP 响应头，并确认 `crossOriginIsolated === true` 与
`typeof SharedArrayBuffer === 'function'`。隔离服务示例和对照测试要求见
[AGENTS.md](AGENTS.md#reproducing-cross-origin-isolation-locally)。

## 项目结构

```text
src/pages/         Astro 页面、工具变体和 /zh/ 路由
src/components/    React 工具及共享 Astro/React 组件
src/i18n/          中文内容、交互翻译和浏览器默认语言逻辑
src/data/          工具、变体、指南等注册表
src/lib/           图片/PDF/动画处理与共享算法
src/layouts/       页面框架、导航、元数据和结构化数据
src/styles/        全局样式及设计变量
scripts/           资源准备、质量门禁和浏览器回归
public/            静态资源、响应头及 LLM 目录
docs/              本地规划和验收证据，默认被 Git 忽略
```

Astro 输出静态页面，React islands 提供交互；文件内容处理使用 Canvas、WebAssembly
及客户端 JavaScript。英文与中文共用处理组件和算法。

## 参与开发

开始前阅读 [PROJECT_STATUS.md](PROJECT_STATUS.md) 获取当前状态和下一步，
再阅读 [AGENTS.md](AGENTS.md) 了解仓库规则。修改工具交互时遵循
[TOOL_INTERACTION.md](TOOL_INTERACTION.md)。

- 同时维护中英文界面、错误提示和无障碍标签，保留用户输入与文件名原文。
- 新增或修改公开页面时同步注册表、FAQ、结构化数据、相关链接、sitemap 与 LLM 目录。
- 按修改风险运行对应验证，并在 `PROJECT_STATUS.md` 记录实际结果。
- 有意义的界面改动在推广前还需要项目所有者完成手工验收。
