# 工具交互规格

ToolkitFree 每个工具页面应该怎么表现，以及让所有工具表现一致的那几个共享件。Image Compressor 和
Image Resizer 是参考实现，动手改造之前先读其中一个。

## 这是在解决什么问题

大部分工具现在是一张表单：选文件、填几个字段、按按钮、等待、拿结果。这等于让访客替工具做决定——
他们得先知道邮件附件该用多少质量、博客配图该多宽，才能让任何事情发生；而且必须在看到任何后果之前
就先承诺一个答案。

替代方案**不是"少给选项"**，而是：**一次点击就能拿到一个好的默认值，同时每一个具体数值仍然都在下面**，
并且结果跟着控件走，而不是等在按钮后面。

三个部分，按访客接触的频率排序：

1. **芯片（chips）** 回答这个工具真正在问的问题——"用来做什么？""要多大？"——一次设定所有底层数值。
2. **结果自己更新**。没有提交步骤。
3. **微调（fine-tune）** 折叠收纳芯片刚刚设定的每一个具体数值，可编辑，并且有回退路径。

## 不能改变的东西

- **不能让人失去控制权。** 预设写入的每一个值都必须仍然可见、可编辑地留在微调面板里。把控件**删掉**
  而不是**挪位置**的改造是错的。
- **表述必须准确。** 运行注记是陈述本地处理的地方。遵守 `CLAUDE.md` 的规定：不得声称"完全私密"、
  "零网络请求"、保证的压缩收益或保证的精确尺寸。工具做了什么就说什么。
- **无障碍不能退化。** `validate-responsive-accessibility-browser.mjs` 会扫 71 条路由 × 5 种宽度。
  标签必须绑定控件，焦点必须可见，忙碌状态必须能被朗读。
- **移动端要能用。** 芯片要能换行，点击区域不小于 44px，任何东西都不能靠 hover 才能被发现。

## 共享件

四个都已经在仓库里了。直接用，不要重新实现那套标记，**也不要往 `src/styles/global.css` 里加样式**
——见下面"绝对不能碰的文件"。

### `ToolChoices` —— 选择型

`src/components/ToolChoices.tsx`。单选芯片。一个常亮，它是工具对某个问题的当前答案。选中另一个就
替换掉前一个时，用这个。

```tsx
<ToolChoices
  name="compressor-purpose"
  legend="What is it for?"
  help="Choose a purpose and the settings follow. You can still change every value below."
  choices={PURPOSE_CHOICES}
  value={purposeId}
  onChange={(choice) => handlePurpose(PURPOSE_BY_ID[choice.id])}
/>
```

`choices` 要从已有的预设表 `.map` 推导出来（就放在它旁边），这样标签不会和数值脱节。参见 Image Compressor。

### `ToolPresets` —— 动作型

同一个文件。带 `aria-pressed` 的按钮。适用于"点一下写入好几个字段、然后这个芯片本身就不重要了"的场景：
某个芯片看起来是否激活，是**从那些字段推导出来的**，从不存储，所以之后手改任一字段，它自己就灭了。
参见 Image Resizer 的尺寸快捷键。

### `FineTune` —— 折叠面板

`src/components/FineTune.tsx`。`summary` 是当前数值，短到能放在收起时的那一行（"JPG · quality 80%"）。
只有在用户手动改过之后才传 `onReset`，并用 `resetLabel` 说明它退回到哪个预设。

```tsx
<FineTune summary={fineTuneSummary} onReset={tuned ? reset : undefined} resetLabel="Back to the Web page preset">
  <FineTuneField htmlFor="tool-quality" label={`Quality: ${quality}%`} hint="…">
    <input id="tool-quality" type="range" … />
  </FineTuneField>
</FineTune>
```

### `ToolRunNote` —— 那一行"刚才发生了什么"

`src/components/ToolRunNote.tsx`。忙碌时圆点会跳动。措辞由调用方决定。

A/B 类三种状态：运行中、完成（带实测耗时）、空闲（"Results follow the settings above."）。

**C 类不能照抄那句空闲态**——保留了按钮的工具，结果并不跟随设置，那句话是假的。C 类的空闲态要说清楚
两件事：哪些东西确实实时跟随（尺寸、帧数、预检结论），以及转换仍然是单独一步、大概多久。

本地处理那句话写在这里。

### `.tool-controls` —— 控件列

芯片组、微调面板、运行注记三者自身都没有外边距，直接堆叠会贴在一起。把它们放进
`<div className="tool-controls">` 即可，不要自己内联 `display:grid`。

### `useAutoRun` —— 重跑循环

`src/hooks/useAutoRun.ts`。两条保证，合起来才能取代提交按钮：

- **防抖**，所以拖动滑块只安排一次运行，而不是四十次。
- **令牌守卫**，所以被取代的运行会自我放弃，而不是和更新的那次抢着写同一份状态。

```tsx
useAutoRun({
  key: settingsKey,                    // 序列化输出真正依赖的量；绝不能用对象引用
  enabled: files.length > 0,
  delayMs: 320,
  onInvalidate: () => {                // 同步执行，在延迟之前，每次 key 变化都跑
    objectUrls.revokePrefix('result:');
    // 编辑器型工具里它一次拖拽会跑几十次，所以必须便宜且幂等。用兜底写法：
    // 传入 React 已经持有的值会就地终止更新，于是每次 pointermove 只有一次渲染。
    setResults((current) => (current.length === 0 ? current : []));
  },
  run: async (isCurrent) => {
    const output = await doTheWork();
    if (!isCurrent()) return;          // 每个 await 之后都必须有
    setResults(output);
  },
});
```

**对象 URL 必须在令牌检查通过之后才注册，绝不能在工作过程中注册。**`objectUrls.replace(key, blob)`
是对共享状态的写入——它会吊销这个 key 原本持有的 URL。如果在编码每个文件时就顺手注册，一个被取代
的运行可以先吊销新运行的 URL、装上自己的，然后才走到守卫处自我放弃，页面上留下的就是一个指向已
不存在的 blob 的 `src`。先把 blob 收集起来，过了 `isCurrent()` 再统一注册。

**每个 `await` 之后的 `if (!isCurrent()) return;` 不是可选项。** 漏掉它产生的 bug 只在"输入到来的速度
快过工作完成的速度"时才会出现——过期结果覆盖新鲜结果——而那恰好是没人盯得够仔细、抓不住它的时候。

**`onInvalidate` 在 `enabled === false` 时照样会跑。** effect 里先调 `onInvalidate`，再 `if (!enabled) return`。
这个顺序是对的——失效就该失效——但它意味着 `onInvalidate` 不能用来清那些"输入没了也该留着"的状态。
在 `onInvalidate` 里清错误信息，会把"文件加载失败"的报错连同结果一起抹掉：加载失败时输入被清空、
key 变了、`enabled` 变假，而 invalidate 仍然触发。把这类状态和结果分开存。

**busy 必须从"产物欠着没有"推出来，不能从"有没有运行在跑"推出来。** 存一个 `setBusy(true)` / `finally
setBusy(false)` 的标志位在自动运行下有死角：只要 `enabled` 在运行途中翻假（用户清空选择、换了文件、
删掉最后一个选中项），就**没有新运行接手来清这个标志**，而旧运行因为 `isCurrent()` 为假不敢清——
点会永远转下去。判据不是"用户点了哪个按钮"，是"`enabled` 会不会在运行途中变假"；只要会，存储式标志
就是错的。派生写法长这样：`busy = 有输入 && 结果为空 && 没有错误`。

`key` 要序列化的是**输出真正依赖的量，不是控件的当前值**。两者经常不同：裁剪框是浮点矩形，但输出
只依赖取整后的像素矩形，照字面写会让每一次亚像素抖动都重跑一遍；PNG 无损，所以质量滑块不该进 PNG
的 key。

`runNow` 用于**追加**到当前结果而非替换它的旁支动作（Image Compressor 用它多编码一张候选卡）。它不
使任何东西失效——但这是双刃的：令牌回答的是"设置变了没有"，不是"我是不是唯一在跑的那个"，所以一次
`runNow` 和一次防抖运行可以同时存活。**两个同时存活的运行必须写入不同的产物。**两次写入同一个
object-URL 键会互相吊销，页面上已渲染的 `src` 就会指向一个被吊销的 blob。要在 `onInvalidate` 里——
也就是设置变更还在被处理的那一刻——决定这次调度的运行要产出什么，而不是在触发时重新读取选中项，
否则两次运行可能收敛到同一份工作上。

## 什么时候**不该**自动运行

自动运行的前提是：一次运行足够便宜，误触发一次不心疼。判据是这句话，**不是某个秒数**——下面的数字是
实测值，会随机器变化，但"一次误触发值不值得付账"这个判断不会。对某些工具这个前提不成立，硬套只会
让产品变差：

| 工作             | 代价       | 结论                   |
| ---------------- | ---------- | ---------------------- |
| Canvas 缩放/编码 | 几十毫秒   | 自动运行               |
| 解码源文件       | 可达数百毫秒 | 自动运行，但**必须按文件缓存** |
| 全分辨率重绘     | 6 Mpx 约 195 ms | **预览按预览分辨率算，导出才按全分辨率** |
| 平铺切片（N 块） | 与 N **无关**，随总像素走 | 自动运行 |
| PDF 页面组装     | 随**拷贝字节数**走，约 8–17 ms/MiB；首建含动态 import 可达 ~1 s | 自动运行，但见下面两条 |
| 背景移除         | 6–25 秒    | **保留显式按钮**       |
| 视频转码（FFmpeg）| 常见 2–15 秒，合法最坏约 1 分钟，外加一次性 10 MB 引擎下载 / 32 MB wasm 堆 | **保留显式按钮** |

**成本要按"这次运行碰了多少像素"算，不是按"产出几个文件"算。** 这一条被踩过：本文件曾假设切成 N 块
就是 N 倍代价，于是把 Image Splitter 标成最可能推翻分类的那个。实测是错的——切片合起来正好覆盖原图
一次，所以 4 块和 9 块几乎同价（4000×3000 源：376 ms vs 368 ms），144 块也只有 1.3 s。产出多份产物
本身不贵，**同一批像素被重复处理才贵**。

**PDF 那一行的结论成立，但理由不是表里那个数。** 两个工具分别实测过：PDF Splitter 的 40 页纯文本
（48 ms）比 4 页图片（91 ms）还快一半——页数不是代价，字节才是；Image to PDF 的首建在 2×12 Mpx PNG
上是 ~1.17 s，已经不算"远小于 1 秒"。**成立是因为反复发生的是重建而不是首建**：Image to PDF 按
`(文件, 旋转)` 缓存栅格化后的 JPEG data URL，于是重建 < 25 ms，拖边距滑块既不解码也不重编码。没有
这层缓存，表里的结论会把工具拖垮。

**不要对已经压过的数据再压一遍。** PDF Splitter 的拆分导出原本用 `compression: 'DEFLATE'` 打 ZIP，
20 页 74.6 MiB 扫描件耗时 5074 ms 而**体积一个字节都没小**——PDF 内容流本来就是 Flate 压缩的。改成
`STORE` 是 714 ms。纯文本 PDF 上 deflate 能省 4.5%，代价是 52 ms vs 5 ms。这类"顺手压一下"的默认值
足以让一个本该自动运行的工具掉进"保留按钮"那一类。

还有一种和解码并列的成本陷阱：**每次重跑都按导出分辨率重算**。Image Enhancer 的解码本来就只做一次、
不是瓶颈，真正会卡住拖动的是"每动一下滑块就把 6 Mpx 全图重新锐化一遍"。做法是两套像素预算：预览受
**列宽和面积双重**限制（只限宽不够——1000×20000 的全景图缩到 700px 列宽仍有 9.8 Mpx），导出才走全
分辨率。实测桌面端预览 46.5 万像素 17 ms、导出 600 万像素 195 ms，差 12.9 倍；手机端差 67 倍。

注意成本结构：对以文件为输入的工具，真正贵的往往是**解码**而不是编码，而防抖消不掉它——每次重跑都
重新 `loadImage` 一遍源文件，拖拽就会卡。把解码结果按文件缓存起来（文件换了或被移除时清空），让重跑
只剩"画一个矩形再编码"。

保留按钮的工具**照样**要有芯片、微调和运行注记，只是不要自动运行那一部分。如果你分到的改造看起来
属于第二类而任务却要求自动运行，**请直接说出来，不要照做**——这是正确结果，不是失败。

另外两种情况也要保留显式控件：一次运行有用户不希望被重复触发的副作用；或者输入是一个用户还在往里
打字的文本框，中间态的值会产生令人困惑的结果。

关于后一种：`useNumberDraft` 每敲一个合法字符就提交一次，所以数字输入框会为中间值排一次运行——
输入 "45" 可能先为 "4" 触发一次。在便宜的工具上被 320 ms 防抖吸收掉，无害；但一个运行昂贵的工具
如果用了 `useNumberDraft`，必须单独想清楚这件事。

**一个产出多份产物的工具，要给每份产物各自的 `key` 和各自的运行。** ID Photo 同时产出证件照和打印
底片：底片永远是 PNG，所以下载格式和 JPG 质量一个字节都影响不到它，这两个值就不进底片的 key。
于是拖质量滑块只重编 11 KB 的照片，2.6 MB 的 A4 底片纹丝不动。两份产物写不同的 object-URL 键，
"两个同时存活的运行必须写入不同产物"这条也就自然满足了。

## 工具分类

下面是每个工具的**建议**分类。**动手前先核实这个工具当前的真实形态**——如果它已经表现正确，或者分类
对它来说是错的，请回报，而不是硬套模板。

**芯片的选项必须来自已有的数据，不能凭空造。** 这一条被踩过：本文件曾把 ID Photo 的芯片写成"护照、
签证、身份证之类"，但预设表里根本没有签证和身份证条目，只有三个有官方来源的可选项。造一枚"签证"
芯片 = 编造一个没有来源的证件尺寸，正是 `CLAUDE.md` 禁止的过度声称。**任务描述里举的例子是示意，
不是清单**——以代码里的表为准，表里没有就别加，需要新增是内容任务不是交互任务。同理，任务描述里
说的某个控件可能**根本不存在**（ID Photo 的"底色"就不存在），不存在就不要发明一个。

**芯片不得覆盖变体页面已经钉死的值。** 很多工具有变体路由（`/png-to-webp/`、`/crop-to-square/`、
`/video-to-webp/`），URL 本身就是这个页面对访客的承诺。一个标着"邮件附件"的芯片如果顺手把输出格式
改掉，那条落地页的承诺就被悄悄毁了，而且没有任何测试会报警。芯片要么就是变体已经在回答的那个维度
（于是变体入口只是点亮对应的那一枚），要么必须正交于它。

### A 类 —— 芯片 + 自动运行 + 微调

| 工具              | 芯片回答的问题                          |
| ----------------- | --------------------------------------- |
| Image Converter   | 转成什么格式，用来做什么                |
| Image Enhancer    | 要哪种修正——滑块归入微调面板            |
| Favicon Generator | 要哪一套尺寸                            |
| ID Photo Maker    | 哪种证件 —— 只有表里已有来源的那几种（**已完成**）      |

### B 类 —— 自动运行，不新增芯片

编辑器形态的工具，直接操作本身已经是界面了。收益在于输出跟随画布，而不是等在按钮后面。

"不新增芯片"指的是**不要新增一个这个工具本来没在问的问题**，不是"不许用共享芯片组件"。如果这个工具
已经有一排手写的、样式内联的芯片复刻（Image Cropper 的比例按钮就是），换成 `ToolChoices` 是对的——
代码验收本来就要求不得重新实现芯片的标记。换过去不会多问一个问题，只会让触摸目标、换行和标签推导
都变正确。

| 工具                     | 说明                       |
| ------------------------ | -------------------------- |
| Image Cropper            | 结果跟随裁剪框             |
| Image Splitter           | 切片跟随分割线             |
| Image Collage            | 拼图跟随布局和排序         |
| Image to PDF             | 文档跟随页面列表           |
| PDF Splitter / Extractor | 输出跟随页码范围和旋转     |

### C 类 —— 只加芯片和运行注记，保留显式按钮

| 工具                     | 原因                                   |
| ------------------------ | -------------------------------------- |
| Background Remover       | 每次 6–25 秒；背景色已经是芯片形态      |
| Video to GIF / WebP/APNG | FFmpeg 转码以几十秒计                   |

### D 类 —— 已经正确，不要动

QR Generator 已是实时渲染、没有提交按钮。确认后停手即可。

## 验收标准

每一次改造交回之前，下面全部都要满足。

**行为**

- [ ] **可下载的产物**无需提交步骤即可更新（A/B 类），或保留按钮并写明理由（C 类）。说"产物"而不是
      "输出"，是因为本来就有实时预览的编辑器型工具容易误判：Image Enhancer 的预览一直是实时的，
      藏在按钮后面的是**文件**。判断标准是那个能下载的东西跟不跟随设置，不是屏幕上有没有动静。
- [ ] 芯片写入的每个值都在微调面板里可见可改。没有任何控件被删掉。
- [ ] 手改过某个值之后 `onReset` 出现，并能回到那个具名预设。
- [ ] （A/B 类）快速连续改动不会产生过期输出。请在一次运行进行到一半时改设置来验证。
- [ ] （A/B 类）失效时对象 URL 被吊销；注册表的活跃计数回到基线。
- [ ] （C 类）屏幕上不会挂着一个和上方控件不匹配的下载链接；并且改设置**不会**偷偷开工——用"资源
      请求数不变"之类的方式证明它。**作废不是唯一的正确答案。** Background Remover 改背景色走的是本地
      重组合：拿缓存的抠图结果**就地更新**，不碰模型，`downloadReady` 里带上 `result.color === bgColor`
      就保证了链接和控件永远一致。这比作废更好，不要为了套这一条把它改坏。真正该作废的是换文件。
- [ ] （C 类）证明"不会偷偷开工"要用 `PerformanceObserver({ type: 'resource' })`，**不要只数
      `getEntriesByType('resource').length`**——resource buffer 有上限，满了之后长度不再增长，断言会
      白白通过。计数可以给人看，判据得是 observer。

**代码**

- [ ] 使用 `ToolChoices` / `ToolPresets` / `FineTune` / `ToolRunNote` / `useAutoRun`（C 类不用最后
      那个）。不得重新实现芯片或面板的标记，也不要内联控件列的排版——用 `.tool-controls`。
- [ ] `run` 内部每个 `await` 之后都检查了 `isCurrent()`。
- [ ] 芯片列表由已有的预设表推导，不是第二次手写一遍。
- [ ] 没有新增 `eslint-disable`。如果依赖规则在跟你较劲，那是 `key` 写错了。
- [ ] **传给 `BatchResultsSummary` 的 `successes` / `failures` 必须是稳定引用。** 它以数组身份为准
      判断"结果换了一批"，所以在 JSX 里内联写 `.map()` 会让它每次渲染都以为结果变了——拖拽时等于
      每一帧取消一次用户的下载。直接传 state，派生的要 `useMemo`。

**页面文案**

- [ ] 搜过一遍那个被删掉的按钮的名字。FAQ 答案和"如何使用"步骤里通常写着"选好格式后点击 Convert"
      之类的句子，按钮没了它们就是假的，而"表述必须准确"这条规则管的正是这个。工具页 `.astro` 和
      `src/data/<tool>-variants.ts` 都要看。
- [ ] **只改答案和步骤，不要改 FAQ 的问题。** `validate-seo-registry.mjs` 会拿问题去比对 JSON-LD。
- [ ] 改完跑 `npm run validate:seo` 和 `npm run validate:site`。**但要知道它们不读散文**——一句
      "点击 Convert" 就算全站校验全绿也照样是假的，只有人读一遍才能发现。

**看一眼页面**

- [ ] 上传一个真实文件之后截图，桌面（1440）和手机（390）各一张。控件区在选文件之前根本不渲染，
      所以空页面的截图没有意义。
- [ ] 手机那张要专门看：芯片是否整齐、微调摘要行有没有错位、点击区域够不够大。
- [ ] 浏览器套件全绿不等于观感正确。试点三个工具就是套件全绿、页面上写着假话、手机布局是坏的。

**门禁** —— 全部必须通过，在你的 worktree 里运行：

**`npx astro build` 必须排在 `npm run test` 前面**——`validate-image-converter.mjs` 读 `dist/`，没构建过
就会报 `jpg-to-png should be built`，那是假失败，两个 agent 先后踩过。

```
npx astro build
npm run typecheck && npm run lint && npm run format:check && npm run test
npm run validate:seo && npm run validate:site
SKIP_BUILD=1 E2E_PREVIEW_PORT=<你的> E2E_DEBUG_PORT=<你的> node scripts/run-browser-tests.mjs --only=<你的套件>.mjs
```

- [ ] 该工具自己的浏览器套件通过，且 `browserErrors: 0`。
- [ ] `validate-responsive-accessibility-browser.mjs` 通过（它覆盖所有路由）。
- [ ] **你的工具不止出现在"你的"套件里。** 动手前先 `grep -rn "<你的路由>" scripts/*.mjs`。
      `validate-batch-download-browser.mjs` 就同时驱动 converter、compressor 和 resizer；删掉一个提交
      按钮会让它在一个你根本没看过的文件里挂掉。grep 到的每个套件都要跑、都要改。
- [ ] 已有断言是被**更新**，不是被删除。原本点击提交按钮的测试，现在应改为等待预期输出。因为按钮
      没了就删掉断言是不可接受的——它保护的东西依然需要被保护。
- [ ] 自动运行会让"活跃对象 URL 数"这类测试常量变化，这是正常的。但改动这类数字时，**必须能用
      "多了/少了哪一份具体产物"解释清楚**，并把这句解释写成注释。解释不清的变化就是泄漏，不是预期。
- [ ] 加一条"不许倒退"的断言：页面上不得再出现那个提交按钮。否则以后有人把它加回来，没有任何测试
      会反对。

**回报内容**

- 这个工具最终属于哪一类，是否和分配一致。
- 芯片回答的是什么问题，为什么是这几个选项。
- 你选择**不做**的事情，以及原因。

## 共享件的已知缺口

这些是改造过程中撞出来的，**由集成方处理，不要在 worktree 里自己补**。

- **`ToolChoices` / `ToolPresets` 没有 `disabled`。** 对 C 类是结构性缺口——保留按钮的工具天然有
  "运行中锁住控件"这个状态。目前的绕法是在外面套 `<fieldset className="tool-chip-group" disabled>`，
  代价有两个：`.tool-chip` 没有 `:disabled` 样式，锁定态只能靠内联 opacity 表达；而且**测试探针必须写
  `el.matches(':disabled')` 而不是 `el.disabled`**——disabled fieldset 不会给后代 button 设自己的属性。
- **`ToolPresets` 没有 per-chip 的视觉槽。** Background Remover 原来的背景色芯片**本身就是那个颜色**，
  换到共享件之后只剩文字。这是换件带来的唯一一处产品损失，记在账上：共享件若加 `swatch` 槽，这里
  应该第一个加回来。（连带 `backgroundLabelColor()` 目前是孤儿函数，只剩单测在用，先留着。）
- **`FineTune` 的 `onReset` 在面板收起时仍在 DOM 里。** 它渲染在 `<details>` 内部，收起只是不可见——
  写断言时 `querySelector('.fine-tune-reset')` 拿得到、`.click()` 也能触发，不需要先展开面板。

## 踩过的坑

- **写浏览器探针时注意 island 是 SSR 的。** QR Generator 的 `#qr-text` 在 hydration **之前**就存在。
  如果在 hydration 前用原生 setter 写 textarea 的值，会污染 React 的 value tracker，此后再写**相同**的
  值不会触发 `onChange`，页面看起来像"输入无效"。既有套件因为 `navigate()` 会等 `astro-island[ssr]`
  消失所以不受影响，自己临时写探针时才会踩。
- **`validate-performance-browser.mjs` 的 Image Splitter CLS 断言对机器负载敏感。** 空闲容器上
  `total: 0.0023` 通过；把 4 核压满再跑就是 `0.062461332290409975`，**十六位有效数字可复现**。原因是
  CLS 值由几何定死（impact × distance fraction），负载只决定这次位移记不记得上：图片解码落在首次布局
  之后，`.splitter-frame` 的 handle、两条 hint 和 `.tool-controls` 会塌成零尺寸再弹回来。**所以它既不是
  flaky 也不是必挂的回归**——是慢设备和冷缓存上会真实兑现的 CLS 风险。多个 agent 同时跑浏览器时它必挂，
  看到它不要去改断言，也不要归咎于自己的改动。
- **`git stash` 不会带走 `dist/`。** 做基线对照必须重新 `npx astro build`，否则是拿新产物测旧源码。

## 任务描述里出过的错

到目前为止集成方写的任务描述里有**八处**没核实就写下的东西，全部被 agent 拒绝执行并回报——这是正确
反应，记在这里是为了让下一批知道**任务描述不是权威，代码才是**：

1. ID Photo 的芯片写成"护照、签证、身份证"，预设表里根本没有签证和身份证。
2. ID Photo 的"底色"控件不存在。
3. 预设表路径写错。
4. 声称 batch-download 驱动 image-splitter（实际 0 处引用）。
5. "N 片 = N 倍成本"的成本模型，实测是假的。
6. 把 `PdfPageEditor.tsx` 说成 PDF Splitter 的组件（它是 Image to PDF 的）。
7. 说 Image to PDF 有"手写芯片复刻"（实际是两个内联 `<select>` 加一个 `range`）。
8. 说 Background Remover 的"背景色已经是芯片形态"——形态对，但触摸目标 28px 不达标。

还有一类不算错但会误导的：说"`src/data/` 里的变体/FAQ 数据也要看"，而 QR Generator 根本没有那类文件。

## 绝对不能碰的文件

这些由集成方独占。在 worktree 里改它们必然产生合并冲突，而十二个这样的冲突就是并行工作的全部成本：

- `src/styles/global.css` —— 需要新的共享类？请提出来，不要自己加。工具自己的布局写在已经以该工具
  命名的那个区块里。
- `PROJECT_STATUS.md` —— 由集成方为整批写一条记录。
- `src/data/tool-registry.ts`、`src/data/guide-registry.ts`、`llms.txt`、`llms-full.txt` —— 本次不新增
  也不重命名任何公开页面，所以这些都不该变动。
- 其他工具的组件，以及上面那四个共享件。在共享件里发现了 bug？回报，不要在自己的 worktree 里改。

## 端口

浏览器测试绑定固定端口。在 worktree 里要传自己的：

```
E2E_PREVIEW_PORT=43xx E2E_DEBUG_PORT=92xx
```

用任务里分配给你的那一对。两个 agent 撞同一个端口，产生的失败看起来会像产品 bug。

## worktree 注意事项

- worktree 里没有依赖，也没有生成的 Astro 类型。先 `ln -s <主仓库>/node_modules "$PWD/node_modules"`
  再 `npx astro sync`，否则 typecheck 会报一堆 `TS2307`。
- **基线分支是会动的。** 集成方会往它上面推提交（合并 master、修共享件），而 worktree 之间共享 ref，
  所以它可能在你干活途中前进。不要用 `git reset --soft` 去追它——那会把别人的提交卷进你的工作树。
  用 rebase，并在 rebase 之后把所有门禁重跑一遍。
- 容器里 Chrome 以 root 运行，跑浏览器测试必须传 `BROWSER_PATH=/tmp/chrome-shim.sh`。
- 跑完 responsive 套件后删掉它生成的 `docs/ui-regression/<时间戳>/` 和 `test-fixtures/`。

## 语言

本文件以及项目内的其他说明文档使用中文（见 `AGENTS.md`「文档语言」）。**代码注释、标识符，以及网站
上任何面向访客的文案，一律保持英文**——站点面向英语受众。
