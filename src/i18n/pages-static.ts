export interface ChineseSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
  links?: Array<{ href: string; label: string }>;
}
export interface ChineseArticle {
  title: string;
  description: string;
  sections: ChineseSection[];
  faq?: Array<{ question: string; answer: string }>;
}
export const chineseArticles: Record<string, ChineseArticle> = {
  about: {
    title: '关于 ToolkitFree',
    description:
      '免费的浏览器图片、PDF、二维码、证件照和动画工具。所选文件内容在设备本地处理，网站资源和可选模型仍通过网络加载。',
    sections: [
      {
        heading: '你的浏览器就是工具箱',
        paragraphs: [
          'ToolkitFree 提供免费的浏览器工具，在你的设备上处理所选文件内容，不把文件上传到 ToolkitFree 进行处理。工具无需注册账户，页面仍会加载提供服务所需的网站资源。',
          '当前工具涵盖图片转换与编辑、PDF 创建与页面提取、二维码、证件照尺寸与排版、网站图标，以及短视频转动画。',
        ],
      },
      {
        heading: '基本原则',
        items: [
          '免费使用，无需工具账户',
          '所选文件内容不上传进行处理',
          '清楚说明浏览器和设备限制',
          '根据设备检查文件、像素、页面、帧数与内存开销',
          '输出不添加水印',
          '适用于现代桌面与移动浏览器',
        ],
      },
      {
        heading: '如何工作',
        paragraphs: [
          '文件处理使用 Canvas、客户端 JavaScript、WebAssembly 和浏览器 API。容量取决于设备内存、编码支持和浏览器限制。背景移除需要下载模型，视频转换会按需加载由网站托管的 FFmpeg 运行时。',
        ],
      },
      {
        heading: '后续方向',
        paragraphs: [
          '我们继续关注实用的浏览器工具、更清楚的兼容性说明、更好的移动端操作和有验证依据的改进。网站现在提供英文与简体中文，可以通过页面上的语言入口切换。',
        ],
      },
      {
        heading: '隐私边界',
        paragraphs: [
          '所选文件内容在本机处理，不由 ToolkitFree 收集或存储用于处理。网站托管、流量统计以及可选模型或运行时下载仍涉及网络请求。',
        ],
        links: [
          { href: '/privacy-policy/', label: '阅读隐私政策' },
          { href: '/terms/', label: '阅读服务条款' },
        ],
      },
      {
        heading: '谁在维护 ToolkitFree',
        paragraphs: [
          'ToolkitFree 由独立开发者 ruofeng_x 创建和维护，不隶属于任何公司，也没有团队运营。每个工具在你的浏览器中运行，无需由服务器承担文件处理。',
          '你可以在 ToolkitFree 的 YouTube 频道查看工具演示。面向 AI 助手的 llms.txt 提供站点摘要，llms-full.txt 提供工具与指南的完整索引。',
        ],
        links: [
          {
            href: 'https://www.youtube.com/channel/UCzOeU_EDy79n3dmaHdmya8A',
            label: 'ToolkitFree YouTube 频道',
          },
          { href: '/llms.txt', label: 'llms.txt' },
          { href: '/llms-full.txt', label: 'llms-full.txt' },
        ],
      },
      {
        heading: '联系我们',
        paragraphs: ['欢迎反馈问题、使用体验或新工具建议。'],
        links: [
          { href: 'mailto:hnhw182@gmail.com', label: 'hnhw182@gmail.com' },
          { href: '/contact/', label: '联系页面' },
        ],
      },
    ],
  },
  contact: {
    title: '联系 ToolkitFree',
    description: '向 ToolkitFree 反馈问题、功能建议、使用体验或合作需求。',
    sections: [
      {
        heading: '通过邮件联系',
        paragraphs: [
          '有疑问、使用反馈、故障报告或新工具想法，欢迎告诉我们。邮件是联系 ToolkitFree 的首选方式。我们会阅读每封邮件，并尽力在 48 小时内回复。',
        ],
        links: [{ href: 'mailto:hnhw182@gmail.com', label: 'hnhw182@gmail.com' }],
      },
      {
        heading: '欢迎提供这些信息',
        items: [
          '遇到的问题和可复现步骤',
          '新工具或功能改进建议',
          '现有工具的使用反馈',
          '合作需求',
          '隐私或安全方面的问题',
        ],
      },
      {
        heading: '联系前可以先查看',
        paragraphs: [
          '具体工具的常见问题可能已有答案。涉及网站的数据处理和使用规则，可先阅读下面的页面。',
        ],
        links: [
          { href: '/privacy-policy/', label: '隐私政策' },
          { href: '/terms/', label: '服务条款' },
        ],
      },
    ],
  },
  'privacy-policy': {
    title: '隐私政策',
    description: '了解 ToolkitFree 如何处理所选文件内容、网站访问数据、资源请求及第三方服务信息。',
    sections: [
      {
        heading: '概述',
        paragraphs: [
          'ToolkitFree（“我们”）提供免费的浏览器图片、PDF、二维码、证件照和动画工具。本隐私政策说明你使用 toolkitfree.net 时信息的处理方式。',
        ],
      },
      {
        heading: '本地文件处理',
        paragraphs: [
          '用于转换、编辑或导出的文件，在你的浏览器内通过客户端 JavaScript、Canvas、WebAssembly 或浏览器 API 处理。ToolkitFree 不会将这些文件上传到处理服务器，也不会存储处理文件的副本。',
          '网站仍通过网络请求加载站点资源。背景移除会下载浏览器模型和运行时，动画转换按需下载网站托管的 FFmpeg 运行时。ToolkitFree 当前不加载广告脚本。',
        ],
      },
      {
        heading: '可能收集的信息',
        paragraphs: ['访问网站时，基础设施可能自动收集以下访问相关信息：'],
        items: ['浏览器类型和版本', '操作系统', '访问的页面与停留时间', '来源网站'],
      },
      {
        heading: 'Cookie 与类似技术',
        paragraphs: [
          'ToolkitFree 当前不使用广告 Cookie。网站基础设施可能使用必要存储或 Cookie，用于网站交付、安全或浏览器功能。Cloudflare Web Analytics 可能收集网站使用情况的汇总信息，不接收你选择用于处理的文件。',
        ],
      },
      {
        heading: '第三方服务',
        paragraphs: [
          '我们可能使用会处理访问相关信息的第三方服务。这些服务按各自隐私政策处理信息。',
        ],
        items: [
          'Cloudflare：网站托管、CDN、安全和网站分析',
          'Google Search Console：汇总搜索表现报告',
        ],
      },
      {
        heading: '信息安全',
        paragraphs: [
          '我们采取合理措施保护信息，但互联网传输没有任何方式可以保证百分之百安全，我们不能保证绝对安全。',
        ],
      },
      {
        heading: '儿童隐私',
        paragraphs: ['本网站不面向 13 岁以下儿童。我们不会有意收集 13 岁以下儿童的个人信息。'],
      },
      {
        heading: '政策更新',
        paragraphs: [
          '我们可能不时更新隐私政策，并通过在本页发布新版政策和修改“最近更新”日期说明变更。',
        ],
      },
      {
        heading: '联系我们',
        paragraphs: ['如果你对隐私政策有疑问，请通过邮件或联系页面与我们联系。'],
        links: [
          { href: 'mailto:hnhw182@gmail.com', label: 'hnhw182@gmail.com' },
          { href: '/contact/', label: '联系页面' },
        ],
      },
    ],
  },
  terms: {
    title: '服务条款',
    description: 'ToolkitFree 免费浏览器工具的使用规则、本地处理边界、责任说明和联系信息。',
    sections: [
      {
        heading: '1. 接受条款',
        paragraphs: [
          '访问或使用 ToolkitFree（“本服务”）表示你同意遵守这些条款。如不同意，请勿使用本服务。我们保留随时更新条款的权利；变更后继续使用表示接受修订后的条款。',
        ],
      },
      {
        heading: '2. 服务说明',
        paragraphs: [
          'ToolkitFree 提供免费的浏览器图片、PDF、二维码、证件照和动画工具。所选文件内容使用 Canvas、JavaScript、WebAssembly 和浏览器 API 在浏览器内处理，不上传到 ToolkitFree 进行处理。',
        ],
      },
      {
        heading: '3. 隐私与数据处理',
        paragraphs: [
          'ToolkitFree 不收集或存储所选处理文件的内容。临时解码数据、预览和输出 URL 在会话期间存在于浏览器内存中，并随结果被替换、移除或页面关闭而释放。',
          '网站仍为托管、站点资源、Cloudflare 流量统计以及可选模型或运行时下载发起网络请求。这些服务可能独立于所选文件处理网站访问信息。ToolkitFree 当前不加载广告脚本。',
        ],
        links: [{ href: '/privacy-policy/', label: '查看隐私政策' }],
      },
      {
        heading: '4. 隐私权利与责任',
        paragraphs: [
          '隐私权利和义务因地区而异。第三方托管与分析服务遵循各自的条款和隐私政策。对于与 ToolkitFree 访问相关的信息问题或请求，请通过本页联系方式联系。',
          '本地文件处理减少了 ToolkitFree 经手的用户文件数据，但并不意味着网站免于所有隐私或消费者保护要求。',
        ],
      },
      {
        heading: '5. 知识产权',
        paragraphs: [
          'ToolkitFree 的内容、品牌和代码属于 ToolkitFree 或其许可方。你可以将工具用于个人或商业用途，但未经事先书面许可，不得复制、重新分发或转售 ToolkitFree 网站、代码或品牌。',
        ],
      },
      {
        heading: '6. 合理使用',
        paragraphs: [
          '你同意不将本服务用于违法目的，或以损坏、禁用、削弱服务的方式使用。你对使用工具处理的文件内容负责，并须确保拥有处理这些文件的合法权利。',
        ],
      },
      {
        heading: '7. 保证免责声明',
        paragraphs: [
          '本服务按“现状”和“可用状态”提供，不作任何明示或默示保证，包括但不限于适销性、特定用途适用性和不侵权的默示保证。我们不保证服务不中断、无错误或不含有害组件。',
        ],
      },
      {
        heading: '8. 责任限制',
        paragraphs: [
          '在适用法律允许的最大范围内，ToolkitFree 不对因使用或无法使用本服务而产生的间接、附带、特殊、后果性或惩罚性损害，以及数据、利润或收入损失承担责任。',
        ],
      },
      {
        heading: '9. 第三方服务',
        paragraphs: [
          '本服务可能链接第三方网站，并使用隐私政策中列出的基础设施服务。第三方拥有各自的条款和隐私政策，ToolkitFree 不对其做法负责。',
        ],
      },
      {
        heading: '10. 服务变更',
        paragraphs: [
          '我们保留随时修改、暂停或停止部分服务的权利，无需事先通知。我们也可能定期更新服务条款。本页顶部的“最近更新”日期表示最近修订时间。',
        ],
      },
      {
        heading: '11. 适用法律',
        paragraphs: [
          '这些服务条款受适用的国际法律管辖并据此解释。因本条款或服务使用产生的争议，应通过善意协商解决。',
        ],
      },
      {
        heading: '12. 联系方式',
        paragraphs: ['如果对这些服务条款有疑问，请通过以下方式联系。'],
        links: [
          { href: 'mailto:hnhw182@gmail.com', label: 'hnhw182@gmail.com' },
          { href: '/contact/', label: '联系页面' },
        ],
      },
    ],
  },
  'guides/image-format-comparison': {
    title: 'JPG、PNG 与 WebP：如何选择图片格式',
    description:
      '比较照片、透明图形与网页场景中的图片格式选择，理解有损编码、无损编码、兼容性和体积之间的取舍。',
    sections: [
      {
        heading: '快速比较',
        items: [
          'JPG：常用于照片，有损压缩，不支持透明通道。',
          'PNG：无损编码，支持透明，适合文字、截图和清晰边缘；照片文件通常较大。',
          'WebP：支持有损或无损编码与透明通道；文件大小依赖内容、编码方式与质量。旧软件可能不兼容。',
        ],
      },
      {
        heading: '什么时候选择 JPG',
        paragraphs: [
          '照片含大量连续色调时，可以通过 JPG 的质量设置在细节与体积之间取舍。邮件附件和只接受 JPG 的上传入口通常适合该格式。',
          '降低质量可能出现块状或边缘伪影。反复将 JPG 解码再以有损格式导出会累积损失，编辑时尽量保留原始文件。',
        ],
        links: [
          { href: '/tools/image-converter/png-to-jpg/', label: 'PNG 转 JPG' },
          { href: '/tools/image-converter/webp-to-jpg/', label: 'WebP 转 JPG' },
        ],
      },
      {
        heading: '什么时候选择 PNG',
        paragraphs: [
          '需要透明背景、准确保留截图文字和硬边缘时可选择 PNG。PNG 编码不增加有损压缩，但把 JPG 转成 PNG 并不能恢复已丢失的细节。',
          'PNG 的质量滑块通常不起作用。想减小文件，应检查图片尺寸是否超出实际用途，或在可以接受有损输出时比较 WebP。',
        ],
        links: [
          { href: '/tools/image-converter/jpg-to-png/', label: 'JPG 转 PNG' },
          { href: '/tools/image-compressor/compress-png/', label: 'PNG 压缩' },
        ],
      },
      {
        heading: '什么时候选择 WebP',
        paragraphs: [
          '网页图片可以尝试 WebP，并与 JPG 或 PNG 的真实输出比较。WebP 可以保留透明通道，但具体导出是否有损取决于实现与设置，不能只凭扩展名判断画质。',
          '上传到第三方平台前先确认格式支持；面向旧环境的网站可以通过 picture 元素提供回退格式。',
        ],
        links: [
          { href: '/tools/image-converter/jpg-to-webp/', label: 'JPG 转 WebP' },
          { href: '/tools/image-converter/png-to-webp/', label: 'PNG 转 WebP' },
        ],
      },
      {
        heading: '一个实用的选择流程',
        items: [
          '先确认接收方允许的格式。',
          '需要透明时优先比较 PNG 和 WebP。',
          '照片无需透明时比较 JPG 和 WebP。',
          '用实际展示尺寸导出，并放大检查边缘和文字。',
          '以下载文件的真实体积和预览为依据，不套用固定压缩率。',
        ],
        links: [
          { href: '/tools/image-converter/', label: '打开图片转换工具' },
          { href: '/tools/image-compressor/', label: '比较图片压缩结果' },
          { href: '/guides/reduce-image-size/', label: '继续阅读：减小图片大小' },
        ],
      },
    ],
    faq: [
      {
        question: 'PNG 一定比 JPG 清晰吗？',
        answer:
          'PNG 使用无损编码，但源图质量决定细节上限。把已经有损压缩的 JPG 转成 PNG 不会恢复细节。',
      },
      {
        question: 'WebP 一定更小吗？',
        answer: '不一定。内容、尺寸、质量和编码模式都会影响体积，请比较实际输出。',
      },
      {
        question: '社交平台应该使用什么格式？',
        answer:
          '先查看具体上传入口允许的格式。JPG 和 PNG 通常兼容性较广，但平台可能再次压缩或转换，上传后仍需核对。',
      },
    ],
  },
  'guides/reduce-image-size': {
    title: '如何减小图片文件大小',
    description:
      '从实际用途出发调整图片尺寸、质量和格式，比较输出体积，处理邮件附件、网页图片与目标 KB 限制。',
    sections: [
      {
        heading: '先分清像素尺寸和文件体积',
        paragraphs: [
          '像素尺寸是宽 × 高，例如 1920 × 1080；文件体积是 KB 或 MB。同样尺寸的图片，因为内容、格式和质量不同，文件大小也会不同。',
          '上传限制可能同时约束尺寸、体积和格式。先查清要求，再选择调整方式，避免反复处理。',
        ],
      },
      {
        heading: '第一步：缩小不需要的像素尺寸',
        paragraphs: [
          '如果图片只在网页中显示 800 像素宽，直接使用数千像素的原图往往没有必要。缩小尺寸可以减少处理和传输开销，但会丢弃像素。',
          '保持比例可避免拉伸；需要精确的展示比例时先裁剪，再调整尺寸。',
        ],
        links: [
          { href: '/tools/image-resizer/', label: '调整图片尺寸' },
          { href: '/tools/image-cropper/', label: '裁剪构图' },
        ],
      },
      {
        heading: '第二步：比较格式和质量',
        paragraphs: [
          '照片可以比较 JPG 和 WebP；带透明背景或文字截图可以比较 PNG 与 WebP。质量不是可跨格式比较的统一分数。',
          '从较高质量开始逐步降低，查看文字、头发、边缘和渐变。PNG 不使用有损质量参数，调低质量不一定使它变小。',
        ],
        links: [
          { href: '/tools/image-converter/', label: '转换格式' },
          { href: '/guides/image-format-comparison/', label: '阅读格式选择指南' },
        ],
      },
      {
        heading: '第三步：按实际大小核验目标',
        paragraphs: [
          '如果需要 100 KB 等硬性限制，可以使用目标大小模式。工具在有限的质量和尺寸范围内搜索，只有真实输出文件满足上限时才标记达标。',
          '无法满足时会显示最接近的结果；不要只看预设名称，也不要把预估体积当作实际结果。',
        ],
        links: [{ href: '/tools/image-compressor/compress-to-100kb/', label: '尝试 100 KB 目标' }],
      },
      {
        heading: '邮件与网页场景',
        items: [
          '邮件：检查所有附件的总大小，以及邮件服务商的实际限制。',
          '网页：以真实展示尺寸准备图片，兼顾高像素密度屏幕，不盲目使用原图。',
          '聊天：平台可能再次压缩，下载文件符合限制并不保证发送后完全不变。',
          '批量：先用少量代表图片比较效果，再处理整个批次。',
        ],
        links: [
          { href: '/tools/image-compressor/compress-for-email/', label: '邮件附件压缩' },
          { href: '/tools/image-compressor/compress-for-web/', label: '网页图片压缩' },
        ],
      },
      {
        heading: '为什么有时会变大',
        paragraphs: [
          '已被高效编码的源图，重新编码后可能更大；将有损图片改成 PNG 也常增大体积。内容中的噪声、细节与透明度都会影响结果。',
          '保留原始文件，比较真实输出体积和清晰度，只有符合用途时才使用新文件。',
        ],
        links: [{ href: '/tools/image-compressor/', label: '打开图片压缩工具' }],
      },
    ],
    faq: [
      {
        question: '能在完全不损失质量的情况下大幅压缩吗？',
        answer:
          '不能普遍保证。无损重新编码的收益取决于源文件，缩小尺寸会丢弃像素，有损压缩会改变细节。',
      },
      {
        question: '降低 JPG 质量会改变宽高吗？',
        answer:
          '仅调整编码质量通常不会改变宽高，但设置最大宽度或使用目标大小模式时可能缩小尺寸。请查看结果。',
      },
      {
        question: '已经压缩过还需要再压一次吗？',
        answer:
          '如果已满足用途，反复压缩可能只有画质损失而没有明显体积收益。优先使用原始文件重新生成所需版本。',
      },
    ],
  },
  'guides/social-media-image-sizes': {
    title: '社交平台图片尺寸指南',
    description:
      '查看 Instagram、Facebook、X、YouTube、LinkedIn 和 TikTok 的常用尺寸参考，了解裁剪、比例与安全区域。',
    sections: [
      {
        heading: '使用这些尺寸前',
        paragraphs: [
          '以下是本站提供的常用尺寸参考，不代表平台永久不变的上传规范。不同入口和设备会改变显示裁剪，最终请以平台当前的上传提示和预览为准。',
          '尺寸预设默认输出精确宽高，原图比例不同时可能拉伸。启用保持比例会在目标框内等比缩放；需要填满固定比例的画面时，先裁剪构图。',
        ],
      },
      {
        heading: 'Instagram',
        items: [
          '方形帖子：1080 × 1080 像素（1:1）',
          '竖向帖子参考：1080 × 1350 像素（4:5）',
          '横向帖子参考：1080 × 608 像素',
          '快拍 / Reels 画面：1080 × 1920 像素（9:16）',
          '头像参考：320 × 320 像素，注意圆形裁剪',
        ],
        links: [
          { href: '/tools/image-resizer/resize-for-instagram/', label: '使用 Instagram 方形预设' },
          { href: '/tools/image-splitter/instagram-grid/', label: '制作九宫格图片' },
        ],
      },
      {
        heading: 'Facebook',
        items: [
          '封面参考：820 × 312 像素',
          '头像参考：170 × 170 像素',
          '帖子图片参考：1200 × 630 像素',
          '活动封面参考：1920 × 1005 像素',
          '快拍参考：1080 × 1920 像素',
        ],
        paragraphs: ['桌面与手机封面的可见区域可能不同，将重要信息放在中央并检查两种预览。'],
        links: [
          { href: '/tools/image-resizer/resize-for-facebook/', label: '使用 Facebook 封面预设' },
        ],
      },
      {
        heading: 'Twitter / X',
        items: [
          '头图：1500 × 500 像素',
          '信息流图片参考：1600 × 900 像素（16:9）',
          '头像参考：400 × 400 像素',
        ],
        paragraphs: ['头图可能被头像或界面覆盖，重要内容要避开边缘和左下方覆盖区域。'],
        links: [{ href: '/tools/image-resizer/resize-for-twitter/', label: '使用 X 头图预设' }],
      },
      {
        heading: 'YouTube',
        items: [
          '缩略图参考：1280 × 720 像素（16:9）',
          '频道横幅参考：2560 × 1440 像素',
          '频道头像参考：800 × 800 像素',
        ],
        paragraphs: [
          '横幅在不同屏幕上有不同可见区域。缩略图应在较小显示尺寸下仍可识别，文件大小上限以当前上传入口为准。',
        ],
        links: [
          { href: '/tools/image-resizer/resize-for-youtube/', label: '使用 YouTube 缩略图预设' },
        ],
      },
      {
        heading: 'LinkedIn',
        items: [
          '帖子预设：1200 × 627 像素',
          '个人背景图参考：1584 × 396 像素',
          '头像参考：400 × 400 像素',
        ],
        paragraphs: ['个人主页、公司主页和信息流的图片入口并不相同，请确认使用场景。'],
        links: [
          { href: '/tools/image-resizer/resize-for-linkedin/', label: '使用 LinkedIn 帖子预设' },
        ],
      },
      {
        heading: 'TikTok',
        items: ['竖向封面预设：1080 × 1920 像素（9:16）', '头像使用方形源图，并检查圆形显示'],
        paragraphs: ['重要主体和文字应避开应用按钮、说明文字和安全区域边缘。'],
        links: [{ href: '/tools/image-resizer/resize-for-tiktok/', label: '使用 TikTok 封面预设' }],
      },
      {
        heading: '发布前检查',
        items: [
          '确认像素尺寸、宽高比、文件格式和大小。',
          '检查头像圆形裁剪、横幅覆盖区与移动端预览。',
          '保留高质量原图，避免多次有损编码。',
          '发布后重新查看实际显示效果，平台可能再次压缩。',
        ],
        links: [
          { href: '/tools/image-resizer/', label: '自定义图片尺寸' },
          { href: '/tools/image-cropper/', label: '调整裁剪构图' },
          { href: '/tools/image-compressor/', label: '控制文件体积' },
        ],
      },
    ],
    faq: [
      {
        question: '使用这些尺寸就一定不会裁剪吗？',
        answer: '不一定。不同设备、入口和展示位置可能使用不同裁剪规则，上传后仍需查看平台预览。',
      },
      {
        question: '如何避免图片被拉伸？',
        answer: '保持比例可避免拉伸；如果必须填满精确宽高，先按目标比例裁剪，再缩放到目标尺寸。',
      },
      {
        question: '社交平台会重新压缩图片吗？',
        answer: '可能。本站控制的是导出文件，无法保证第三方平台保留相同编码和质量。',
      },
    ],
  },
};
