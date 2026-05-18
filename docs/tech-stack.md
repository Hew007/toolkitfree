# 技术栈详细说明

## 框架选型

### 为什么选 Astro + React Islands

| 框架 | SEO | 性能 | 多页工具站开发速度 | 交互性 | 包体积 |
|------|-----|------|-------------------|--------|--------|
| **Astro** | 极佳（默认SSG，零JS） | 最佳（岛架构） | 极佳 | 好（React/Vue/Svelte Islands） | 最小 |
| Next.js | 极佳（SSG/SSR） | 好（但带React运行时） | 好 | 极佳（React全量hydration） | 较大 |
| Nuxt | 极佳（SSG/SSR） | 好 | 好 | 极佳（Vue） | 中等 |
| 纯HTML/JS | 好（但需手动） | 最佳（如果做好） | 慢（一切手动） | 手动 | 最小 |

Astro的"岛架构"天然适合工具网站：每个工具是独立的交互岛，周围的页面内容（导航、描述、FAQ）零JS。

---

## 客户端处理库

### 图片格式转换
- **Canvas API**（原生）— JPG、PNG、WebP，零依赖
- **browser-image-compression** — 格式检测和压缩
- 高级格式（AVIF、HEIC）考虑 libvips-wasm

### PDF处理
- **pdf-lib** — 创建、修改、合并、拆分PDF，浏览器全支持，MIT协议
- **PDF.js**（Mozilla）— 渲染/显示PDF，提取文本

### 图片编辑
- **Cropper.js** — 裁剪、旋转、缩放，最流行的裁剪库

### 抠图/背景移除
- **@imgly/background-removal** — WASM + ONNX模型，完全客户端，~40MB模型首次下载后缓存

---

## 部署

### Cloudflare Pages
- 免费无限带宽
- 全球CDN（边缘网络最大）
- 支持Astro官方适配
- Cloudflare Workers可做边缘计算（100K免费请求/天）
- Cloudflare R2存储（免费10GB）

### 替代方案对比
| 功能 | Vercel | Cloudflare Pages | Netlify |
|------|--------|-----------------|---------|
| 免费带宽 | 100GB/月 | **无限** | 100GB/月 |
| 免费构建 | 6000min/月 | 5000/月 | 300min/月 |
| 中国可访问 | 被封 | 大部分可用 | 被封 |

---

## AdSense集成

### Astro组件示例
```astro
---
interface Props {
  slot: string;
  format?: 'auto' | 'rectangle' | 'horizontal';
}
const { slot, format = 'auto' } = Astro.props;
---
<ins class="adsbygoogle"
  style="display:block"
  data-ad-client="ca-pub-XXXXXXXXXXXX"
  data-ad-slot={slot}
  data-ad-format={format}
  data-full-width-responsive="true"
/>
<script is:inline>
  (adsbygoogle = window.adsbygoogle || []).push({});
</script>
```

### 广告位布局
1. 工具上方 — 横幅（728x90 / 响应式）
2. 侧边栏 — 300x250，sticky
3. 工具与说明之间 — 信息流广告
4. 移动端底部锚定 — AdSense Auto Ads

### 注意事项
- 不要在工具操作区内放广告（干扰用户）
- 不要用插页广告
- 懒加载below-fold广告位
- 检查Core Web Vitals

---

## SEO技术实现

### JSON-LD结构化数据
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Image Converter",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Any",
  "offers": { "@type": "Offer", "price": "0" }
}
```

### FAQ结构化数据（争取富摘要）
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How to convert WebP to JPG?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Upload your WebP file, select JPG as output format, and click Convert..."
      }
    }
  ]
}
```

### i18n结构
- /en/ — 英文（首先）
- /zh/ — 中文（后续）
- hreflang标签告知Google语言版本
