# 市场调研报告

## 一、市场选择结论

**推荐做全球市场（英文优先），而非中文市场。**

### 中文市场 vs 全球市场对比

| 维度 | 中文市场 | 全球市场（英文） |
|------|---------|----------------|
| 广告CPM | ¥2-15（~$0.3-2） | $5-25（美国流量） |
| 入门门槛 | ICP备案 + 国内服务器 + 中文广告联盟 | 注册.com域名 + Cloudflare Pages（免费）+ AdSense |
| SEO周期 | 百度沙盒期3-6个月 | Google沙盒期1-3个月 |
| 内容创作 | 中文母语，门槛低 | AI辅助写英文内容 |
| 竞争格局 | 菜鸟工具、站长工具等老牌站 + 支付宝/微信小程序 | 头部站强但长尾词空间大 |
| 收款 | 百度联盟等门槛高 | AdSense电汇到国内银行/Payoneer |
| 服务器成本 | 必须国内服务器，需付费 | Cloudflare Pages免费无限带宽 |
| 法律合规 | 个人备案有商业限制灰色地带 | 网站托管在国外，无特殊牌照要求 |

### 推荐理由

1. CPM差距巨大 — 同样1万次展示，全球收入是中国的5-10倍
2. 零服务器成本 — Cloudflare Pages免费，纯客户端处理
3. AI解决英文内容 — 不需要英文写作能力
4. 收款简单 — AdSense电汇到国内银行，或用Payoneer中转
5. 无需ICP备案
6. Google SEO对开发者国籍无歧视

---

## 二、中国开发者做全球市场的实操要点

- **开发环境**：GitHub + Cloudflare Pages可以从国内访问（可能需要VPN辅助访问Google服务）
- **收款**：AdSense支持电汇到中国银行账号；填W-8BEN表可以把美国税从30%降到10%
- **域名**：通过Cloudflare Registrar或Namecheap注册.com域名，无限制
- **内容**：用AI（Claude/ChatGPT）生成英文工具说明、FAQ、教程，人工审核准确性
- **税务**：小额海外收入需依法申报个人所得税，收入较大时可考虑注册香港公司

---

## 三、竞争格局分析

### 图片格式转换
- **主要玩家**：CloudConvert、Convertio、Online-Convert、Zamzar、FreeConvert
- **评估**：头部竞争激烈，但长尾关键词有机会（"convert webp to jpg online free"等）

### PDF转换
- **主要玩家**：iLovePDF（50-100M+月访问）、Smallpdf、PDF24、Sejda
- **评估**：竞争最激烈，不建议做"pdf to word"等头部词

### 在线图片编辑
- **主要玩家**：Photopea（7-10M月活，一个人开发）、Pixlr、Fotor、Canva
- **评估**：Photopea证明了模型可行，但全功能编辑器难以撼动

### 证件照工具
- **主要玩家**：Passport Photo Online、IDPhotoDIY、AiPassportPhoto
- **评估**：好的细分市场，意图明确，技术门槛提供护城河

### AI提示词工具
- **主要玩家**：PromptHero、PromptBase、FlowGPT、Lexica
- **评估**：市场不稳定，不推荐

---

## 四、成功案例

- **Photopea** — 一个人做的浏览器版Photoshop，年收入$1-2M+，2012年开始
- **TinyWow** — 几十个浏览器工具，纯广告变现，2023-2024快速增长
- **Remove.bg** — 单一功能（抠图），被Canva收购
- **Clipdrop** — AI图片工具，被Stability AI收购

---

## 五、失败模式

1. "Me too"站点无差异化
2. 没有护城河，纯UI包装开源库
3. 纯API套壳工具（如ChatGPT wrapper）
4. 过度广告化，杀用户体验

---

## 六、收入预期

| 指标 | 第1年 | 第2年 | 第3年 |
|------|-------|-------|-------|
| 月PV | 10K-100K | 100K-1M | 500K-5M+ |
| 月AdSense收入 | $50-1,000 | $500-10,000 | $3,000-50,000+ |

- 工具站典型RPM: $3-8
- 美国流量RPM: $5-15
- 第1年：前6个月接近零，第9-12月可能达到$200-1000/月

---

## 七、技术趋势

### 纯客户端工具的优势
1. 零服务器成本
2. 隐私卖点（"Your files never leave your device"）
3. 无基础设施复杂性
4. 无法律合规负担
5. 全球可用

### 关键技术
- **WebAssembly (WASM)**：浏览器内接近原生性能
- **Canvas API / WebGL**：图片处理
- **Web Workers**：后台线程处理
- **pdf-lib**：纯浏览器PDF处理
- **@imgly/background-removal**：客户端WASM抠图

---

## 八、SEO策略

### 关键词策略
- 不抢头部词（"pdf to word"放弃）
- 打长尾词（"convert webp to jpg online free"）
- 70-80%流量来自长尾关键词
- 程序化生成变体页

### 每个工具页内容结构
1. H1 工具名称
2. 工具交互区域
3. 使用说明（H2 "How to..."）
4. 功能特点列表
5. FAQ（带FAQPage结构化数据，20-30条）
6. 相关工具内链

### AI辅助内容
- Google不惩罚AI内容，只惩罚低质量内容
- 用AI生成工具说明、FAQ、教程
- 人工审核准确性
