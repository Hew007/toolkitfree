# 实施计划

## 技术栈

| 组件 | 选择 | 理由 |
|------|------|------|
| 框架 | Astro + React Islands | 零JS默认、SEO极佳、岛架构适合工具页 |
| 图片处理 | Canvas API + browser-image-compression | 零依赖，纯浏览器 |
| PDF处理 | pdf-lib + PDF.js | 纯浏览器，MIT协议 |
| 抠图/背景移除 | @imgly/background-removal | 客户端WASM，无需服务器 |
| 图片裁剪 | Cropper.js | 成熟稳定 |
| 多语言 | Astro i18n（先做/en/，后续加/zh/） | 可扩展 |
| 部署 | Cloudflare Pages | 免费无限带宽、全球CDN |
| 广告 | Google AdSense | 手动广告位 + Auto Ads |
| 内容创作 | Claude/ChatGPT 生成英文FAQ、教程、工具说明 | AI辅助，人工审核 |

**核心理念：纯客户端处理** — 用户文件不上传服务器，零服务器成本，"Your files never leave your device"作为隐私卖点。

---

## URL结构

```
/en/tools/image-converter
/en/tools/image-compressor
/en/tools/image-resizer
/en/tools/background-remover
/en/tools/id-photo-maker
（后续扩展）
/zh/tools/image-converter
```

---

## 广告位布局

1. 工具上方 — 横幅广告（响应式）
2. 桌面端侧边栏 — 300x250，sticky
3. 工具与说明之间 — 信息流广告
4. 移动端底部锚定 — AdSense Auto Ads 自动处理

---

## 实施路线图

### Phase 1: 基础搭建（2-3周）
- [ ] 注册.com域名（Cloudflare Registrar）
- [ ] 初始化 Astro 项目，搭建基础布局（Header/Footer/导航/侧边栏）
- [ ] 配置英文i18n（/en/前缀）
- [ ] 创建 AdSense 组件（先不激活，等内容够了再申请）
- [ ] 部署到 Cloudflare Pages
- [ ] 创建工具页模板（SEO meta、JSON-LD结构化数据、FAQ模板、广告位占位）

### Phase 2: 第一批工具（4-6周）
按每天2小时 + 周末的节奏：
- [ ] 图片格式转换器（JPG↔PNG↔WebP↔AVIF，批量支持）~1周
- [ ] 图片压缩器 ~3-4天
- [ ] 图片裁剪/调整大小 ~3-4天
- [ ] 背景移除工具（@imgly/background-removal）~1周
- [ ] 每个工具：英文版 + AI生成的FAQ（20-30条）+ 使用教程 + 相关工具推荐
- [ ] 注册 Google Search Console，提交 sitemap

### Phase 3: 申请AdSense + 证件照工具（3-4周）
- [ ] 确保有10-15个高质量工具页面后申请 AdSense
- [ ] 证件照制作（背景检测、标准尺寸、换底色，覆盖各国证件规格）~2周
- [ ] QR码生成器 ~3天
- [ ] 优化广告位布局

### Phase 4: 持续扩展 + 优化（持续）
- [ ] 每1-2周添加1-2个新工具
- [ ] 监控 Google Search Console 数据，发现新的长尾关键词机会
- [ ] 根据实际搜索数据优化已有页面
- [ ] 有稳定流量后，加 /zh/ 中文版扩展
- [ ] A/B测试广告位布局
- [ ] 考虑添加PDF相关工具（合拆、压缩、转图片，用pdf-lib）

---

## 投入产出预期（每天2小时）

| 时间节点 | 预期状态 |
|---------|---------|
| 第1个月末 | 网站上线，3-5个工具，开始被Google索引 |
| 第3个月末 | 8-12个工具，开始有少量自然搜索流量 |
| 第6个月末 | 15-20个工具，月访问量数千，可能开始有AdSense收入 |
| 第12个月末 | 30+工具，月访问量数万-数十万，月收入$200-1000 |
| 第24个月末 | 50+工具，域名有权威度，月收入$1K-10K |

---

## 关键风险与应对

| 风险 | 应对 |
|------|------|
| SEO见效慢（前6个月收入接近零） | 耐心坚持，同时在Reddit/Product Hunt等社区分享工具引流 |
| 大站碾压 | 避开头部关键词，打长尾+批量+客户端隐私差异化 |
| AdSense审核不通过 | 先有10-15个高质量原创工具页再申请 |
| 客户端处理能力有限 | 重处理用WASM（如抠图），其余用Canvas API |
| 竞争者模仿 | 持续迭代工具数量和质量，建立品牌和域名权重 |
| 英文内容质量 | AI生成 + 人工审核，工具类内容不需要创意写作 |

---

## 工具优先级

### 第一批上线
1. 图片格式转换器（批量支持）— 需求大，长尾词多，纯Canvas实现
2. 图片压缩器 — 需求明确，客户端实现简单
3. 图片裁剪/调整大小 — 开发简单，变体页多
4. 背景移除工具 — AI热度高，差异化明显

### 第二批扩展
5. 证件照制作 — 高意图，技术有门槛
6. PDF工具（合并、拆分、压缩、转图片）
7. QR码生成器 — 需求大，实现简单
8. 颜色工具 — 开发者和设计师需求

### 不推荐
- AI提示词工具（市场不稳定）
- 纯ChatGPT套壳工具（无技术壁垒）
- 全功能图片编辑器（Photopea、Canva不可撼动）
