# SEO策略详细说明

## 关键词策略

### 核心原则
- **不抢头部词**（"pdf to word"、"jpg to png" 放弃 — iLovePDF、CloudConvert统治）
- **打长尾词**（低竞争、明确搜索意图）
- **70-80%的流量来自长尾关键词**

### 长尾关键词示例

#### 图片格式转换
- "convert webp to jpg online free"
- "batch convert png to webp"
- "convert heic to jpg without quality loss"
- "convert svg to png high resolution"
- "bulk image converter online"

#### 图片压缩
- "compress png to under 100kb"
- "reduce image size for email attachment"
- "compress jpeg to 50kb online"
- "optimize images for web without quality loss"

#### 图片裁剪/调整
- "resize image to 1920x1080 online free"
- "crop photo for instagram story"
- "resize image to passport photo size"
- "change image dimensions without cropping"

#### 背景移除
- "remove background from image free online"
- "make image background transparent"
- "remove white background from logo"
- "delete background from photo online"

---

## 内容策略

### 每个工具页必须包含
1. **H1** — 工具名称，含核心关键词
2. **工具交互区域** — 主功能区
3. **广告位** — 工具上方横幅 + 侧边栏 + 工具下方
4. **H2 "How to [Tool Name]"** — 使用步骤说明
5. **功能特点列表** — 为什么用这个工具
6. **FAQ** — 20-30条，带FAQPage结构化数据
7. **相关工具** — 内部链接

### FAQ的重要性
- 每条FAQ可以针对一个长尾搜索词
- FAQPage结构化数据可以赢得Google富摘要（rich snippet）
- 这是最快规模化获取长尾流量的方式

### 变体页策略
- 同一个转换器组件，创建独立页面：
  - /en/tools/image-converter/jpg-to-png
  - /en/tools/image-converter/png-to-webp
  - /en/tools/image-converter/webp-to-jpg
- 每个页面独立SEO、独立FAQ、独立URL
- 程序化生成，但内容要差异化（不同场景描述、不同FAQ）

---

## 技术SEO

### URL结构
```
/en/tools/[tool-name]
/en/tools/[tool-name]/[variant]
```
- 使用连字符，不用下划线
- 描述性但简短
- 每个工具独立页面

### Meta标签
```html
<title>Free Online Image Converter - JPG to PNG, WebP | ToolSite</title>
<meta name="description" content="Convert images between JPG, PNG, WebP formats instantly in your browser. No upload needed. 100% free and private.">
<link rel="canonical" href="https://yoursite.com/en/tools/image-converter" />
```

### Open Graph
```html
<meta property="og:title" content="Free Online Image Converter">
<meta property="og:description" content="Convert images instantly in your browser. No uploads.">
<meta property="og:type" content="website">
```

### hreflang（多语言）
```html
<link rel="alternate" hreflang="en" href="https://yoursite.com/en/tools/image-converter" />
<link rel="alternate" hreflang="zh" href="https://yoursite.com/zh/tools/image-converter" />
<link rel="alternate" hreflang="x-default" href="https://yoursite.com/en/tools/image-converter" />
```

---

## AI辅助内容

### Google立场（2024-2025）
- Google **不惩罚**AI生成的内容
- Google惩罚的是**低质量、无帮助**的内容（无论人写还是AI写）
- 重点是E-E-A-T：Experience, Expertise, Authoritativeness, Trustworthiness

### AI内容最佳实践
1. 用AI生成初稿，人工审核准确性
2. 工具类内容（使用说明、FAQ、教程）AI质量有保障
3. 不要批量生产无价值的薄内容
4. 添加独特价值（截图、实际使用示例）
5. 保持一致性风格

### 工作流
1. 用Claude生成工具描述、FAQ、教程
2. 人工审核技术准确性
3. 添加独特价值（截图、实际操作指南）
4. 用Grammarly等工具润色英文
