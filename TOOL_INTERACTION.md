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

`src/components/ToolRunNote.tsx`。忙碌时圆点会跳动。措辞由调用方决定，通常三种状态够用：运行中、
完成（带实测耗时）、空闲（"结果跟随上面的设置"）。本地处理那句话写在这里。

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

自动运行的前提是：一次运行足够便宜，误触发一次不心疼。对某些工具这个前提不成立，硬套只会让产品变差：

| 工作             | 代价       | 结论                   |
| ---------------- | ---------- | ---------------------- |
| Canvas 缩放/编码 | 几十毫秒   | 自动运行               |
| 解码源文件       | 可达数百毫秒 | 自动运行，但**必须按文件缓存** |
| PDF 页面组装     | 远小于 1 秒 | 自动运行               |
| 背景移除         | 6–25 秒    | **保留显式按钮**       |
| 视频转码（FFmpeg）| 几十秒     | **保留显式按钮**       |

注意成本结构：对以文件为输入的工具，真正贵的往往是**解码**而不是编码，而防抖消不掉它——每次重跑都
重新 `loadImage` 一遍源文件，拖拽就会卡。把解码结果按文件缓存起来（文件换了或被移除时清空），让重跑
只剩"画一个矩形再编码"。

保留按钮的工具**照样**要有芯片、微调和运行注记，只是不要自动运行那一部分。如果你分到的改造看起来
属于第二类而任务却要求自动运行，**请直接说出来，不要照做**——这是正确结果，不是失败。

另外两种情况也要保留显式控件：一次运行有用户不希望被重复触发的副作用；或者输入是一个用户还在往里
打字的文本框，中间态的值会产生令人困惑的结果。

## 工具分类

下面是每个工具的**建议**分类。**动手前先核实这个工具当前的真实形态**——如果它已经表现正确，或者分类
对它来说是错的，请回报，而不是硬套模板。

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
| ID Photo Maker    | 哪种证件（已是预设驱动，补自动运行）    |

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

- [ ] 主输出无需提交步骤即可更新（A/B 类），或保留按钮并写明理由（C 类）。
- [ ] 芯片写入的每个值都在微调面板里可见可改。没有任何控件被删掉。
- [ ] 手改过某个值之后 `onReset` 出现，并能回到那个具名预设。
- [ ] 快速连续改动不会产生过期输出。请在一次运行进行到一半时改设置来验证。
- [ ] 失效时对象 URL 被吊销；注册表的活跃计数回到基线。

**代码**

- [ ] 使用 `ToolChoices` / `ToolPresets` / `FineTune` / `ToolRunNote` / `useAutoRun`。不得重新实现
      芯片或面板的标记。
- [ ] `run` 内部每个 `await` 之后都检查了 `isCurrent()`。
- [ ] 芯片列表由已有的预设表推导，不是第二次手写一遍。
- [ ] 没有新增 `eslint-disable`。如果依赖规则在跟你较劲，那是 `key` 写错了。

**页面文案**

- [ ] 搜过一遍那个被删掉的按钮的名字。FAQ 答案和"如何使用"步骤里通常写着"选好格式后点击 Convert"
      之类的句子，按钮没了它们就是假的，而"表述必须准确"这条规则管的正是这个。工具页 `.astro` 和
      `src/data/<tool>-variants.ts` 都要看。
- [ ] **只改答案和步骤，不要改 FAQ 的问题。** `validate-seo-registry.mjs` 会拿问题去比对 JSON-LD。
- [ ] 改完跑 `npm run validate:seo` 和 `npm run validate:site`。

**门禁** —— 全部必须通过，在你的 worktree 里运行：

```
npm run typecheck && npm run lint && npm run format:check && npm run test
npx astro build
npm run validate:seo && npm run validate:site
SKIP_BUILD=1 E2E_PREVIEW_PORT=<你的> E2E_DEBUG_PORT=<你的> node scripts/run-browser-tests.mjs --only=<你的套件>.mjs
```

- [ ] 该工具自己的浏览器套件通过，且 `browserErrors: 0`。
- [ ] `validate-responsive-accessibility-browser.mjs` 通过（它覆盖所有路由）。
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
