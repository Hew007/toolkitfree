import { toolRegistry, type ToolId } from '../data/tool-registry.ts';
import type { FaqItem } from '../data/content-types';

export const CHINESE_CONTENT_DATE = '2026-11-13';
export interface ChineseToolContent {
  name: string;
  description: string;
  steps: string[];
  features: string[];
  faq: FaqItem[];
}
const faq = (question: string, answer: string): FaqItem => ({ question, answer });
export const chineseTools: Record<ToolId, ChineseToolContent> = {
  'image-converter': {
    name: '图片格式转换',
    description:
      '在浏览器中将 JPG、PNG 和 WebP 图片互相转换，支持批量处理。文件内容在本机处理，其他输入格式取决于浏览器支持。',
    steps: [
      '选择一张或多张图片。',
      '选择输出格式，结果会自动更新。',
      '在微调中设置质量；需要透明背景时选择 PNG 或 WebP。',
      '检查预览和实际大小，单独下载或打包下载。',
    ],
    features: [
      '输出 JPG、PNG、WebP',
      '批量转换与 ZIP 下载',
      '实际文件大小对比',
      '透明通道支持取决于输出格式',
    ],
    faq: [
      faq(
        '转换会恢复图片清晰度吗？',
        '不会。格式转换不能恢复源文件已经丢失的细节。PNG 使用无损编码，但不能消除 JPG 原有的压缩损失。'
      ),
      faq(
        '支持 HEIC、TIFF 或 GIF 输出吗？',
        '目前不支持 HEIC 和 TIFF 解码，也不支持 GIF 输出。GIF、BMP 和 SVG 输入依赖浏览器解码；GIF 只导出静态帧。'
      ),
      faq(
        '文件会上传吗？',
        '所选文件内容在浏览器中解码和导出，不上传到 ToolkitFree 处理服务器。网站资源仍需要网络请求。'
      ),
    ],
  },
  'image-compressor': {
    name: '图片压缩',
    description:
      '调整 JPG、PNG、WebP 的质量或尺寸，比较实际输出大小。支持批量压缩和目标 KB 模式，不保证所有图片都能变小。',
    steps: [
      '选择一张或多张图片。',
      '选择网页、邮件等用途，或输入目标 KB。',
      '比较三种结果，或打开微调修改质量和最大宽度。',
      '确认实际大小后单独下载或打包为 ZIP。',
    ],
    features: [
      '用途预设与三档结果对比',
      '目标大小模式核验真实文件大小',
      '微调质量与最大宽度',
      '批量结果与独立错误提示',
    ],
    faq: [
      faq(
        '为什么 PNG 的质量设置不起作用？',
        'PNG 使用无损编码，浏览器不会使用有损质量参数。可以降低尺寸或改用 WebP；重新编码后的 PNG 也可能更大。'
      ),
      faq(
        '能保证压缩到指定大小吗？',
        '不能保证。工具在有限的质量和尺寸范围内搜索，仅当真实文件大小满足目标时标记成功，否则会明确显示最接近的结果。'
      ),
      faq(
        '压缩后尺寸会变化吗？',
        '设置最大宽度或使用目标大小搜索时可能缩小尺寸。请检查结果中的实际宽高和视觉质量。'
      ),
    ],
  },
  'image-resizer': {
    name: '图片尺寸调整',
    description: '按自定义像素或社交平台预设批量调整图片尺寸，可控制宽高比并查看输出的真实宽高。',
    steps: [
      '选择图片。',
      '选择平台尺寸或自定义宽高。',
      '根据需要开启保持比例，查看输出预览。',
      '下载单张图片或批量 ZIP。',
    ],
    features: ['常用社交平台尺寸', '自定义宽高和保持比例', '批量调整和 ZIP 下载'],
    faq: [
      faq(
        '平台预设会裁剪图片吗？',
        '默认按预设的精确宽高输出，原图比例不同时可能拉伸。启用保持比例会在目标框内等比缩放；需要裁剪构图请使用图片裁剪工具。'
      ),
      faq('放大能增加细节吗？', '不能。尺寸放大只增加像素数量，不会恢复原图中不存在的细节。'),
      faq('支持哪些图片？', '常用输入为 JPG、PNG 和 WebP，实际解码与导出能力取决于浏览器。'),
    ],
  },
  'image-enhancer': {
    name: '图片效果调整',
    description:
      '在本机实时调整亮度、对比度、饱和度、锐化、模糊和灰度。通过预览比较效果，再下载处理后的图片。',
    steps: ['选择图片。', '选择效果预设。', '在微调中修改各项数值并查看预览。', '下载满意的结果。'],
    features: ['实时效果预览', '亮度、对比度与饱和度', '锐化、模糊、灰度'],
    faq: [
      faq(
        '这是 AI 超分辨率吗？',
        '不是。这些是本地像素调整，不会生成缺失细节，也不保证修复模糊或严重曝光问题。'
      ),
      faq('可以恢复原来的设置吗？', '可以使用重置或重新选择预设，再逐项微调。'),
      faq('文件在哪里处理？', '图片像素在浏览器中处理，输出保存在你下载的位置。'),
    ],
  },
  'image-collage': {
    name: '图片拼接',
    description:
      '将 JPG、PNG、WebP 图片拼成网格、横向长图或纵向长图，在浏览器中调整间距和背景并导出。',
    steps: [
      '选择需要拼接的图片。',
      '选择网格、横向或纵向布局。',
      '调整图片顺序、间距、背景与输出设置。',
      '检查拼接预览并下载。',
    ],
    features: ['网格与长图拼接', '可调整顺序、间距和背景', '本地导出，无水印'],
    faq: [
      faq(
        '支持哪些布局？',
        '可以选择网格、横向拼接和纵向拼接。不同大小的图片会根据布局适配，导出前请查看预览。'
      ),
      faq(
        '可以无限添加图片吗？',
        '不可以。实际容量受浏览器内存、像素数量和画布尺寸限制，工具会给出容量提示。'
      ),
      faq('图片需要上传吗？', '不需要。所选图片在本机浏览器中拼接，网站资源仍通过网络加载。'),
    ],
  },
  'image-splitter': {
    name: '图片分割',
    description: '按行列或拖动分割线将一张图片切成多块，支持长图接缝检测、单块下载及 ZIP 打包。',
    steps: [
      '选择需要分割的图片。',
      '设置行列，或拖动分割线到需要的位置。',
      '检查各块预览；长截图可尝试检测接缝。',
      '单独下载图片块或打包为 ZIP。',
    ],
    features: ['可拖动的横向与纵向分割线', '长图接缝检测', '网格分割和批量 ZIP'],
    faq: [
      faq(
        '分割会缩小原图吗？',
        '分割按源图片区域导出；输出格式和质量可能改变编码。请查看每块的像素尺寸。'
      ),
      faq(
        '接缝检测总能找到正确边界吗？',
        '不能。它根据图像内容推断候选接缝，复杂背景或连续内容可能误判，请手动核对和拖动调整。'
      ),
      faq(
        '分割后能直接按纸张大小打印吗？',
        '图片块并非自动排版的打印 PDF。打印时仍需设置纸张、缩放和页边距。'
      ),
    ],
  },
  'id-photo-maker': {
    name: '证件照尺寸与排版',
    description:
      '按常见证件照尺寸调整构图，生成单张照片或打印排版。请核对签发机构要求，工具不保证照片审核通过。',
    steps: [
      '选择正面照片。',
      '选择证件尺寸或自定义尺寸。',
      '调整缩放和位置，检查头部构图。',
      '下载单张照片或打印排版，打印时使用实际大小。',
    ],
    features: ['常见证件照尺寸', '缩放和位置调整', '照片及打印排版导出'],
    faq: [
      faq(
        '生成的照片保证符合官方要求吗？',
        '不保证。尺寸只是要求的一部分；背景、表情、光照、拍摄时间和头部位置等由签发机构规定，请以官方要求为准。'
      ),
      faq(
        '如何保证打印尺寸？',
        '使用工具给出的打印版，并在打印设置中选择实际大小或 100%，关闭自动适应页面。打印后用尺子核对。'
      ),
      faq(
        '会自动更换背景吗？',
        '证件照工具主要处理构图、尺寸与排版。需要去除背景时，可先使用背景移除工具并核对结果。'
      ),
    ],
  },
  'image-cropper': {
    name: '图片裁剪',
    description: '按正方形、16:9、4:3、3:2 或自由比例裁剪图片，拖动和缩放构图后在本机导出。',
    steps: [
      '选择图片。',
      '选择裁剪比例或自由裁剪。',
      '拖动图片并调整缩放，确认保留区域。',
      '选择导出设置并下载。',
    ],
    features: ['固定比例和自由裁剪', '拖动定位与缩放', '实时裁剪预览'],
    faq: [
      faq(
        '裁剪和调整尺寸有什么区别？',
        '裁剪会移除选区以外的内容；调整尺寸改变整张图片的宽高。需要保留全部内容时请使用尺寸调整工具。'
      ),
      faq('可以移动裁剪位置吗？', '可以。拖动和缩放图片，查看预览以确认主体没有被切掉。'),
      faq(
        '如何选择适合的比例？',
        '头像常用 1:1，宽屏常用 16:9，摄影常见 4:3 或 3:2。具体上传位置仍以平台要求为准。'
      ),
    ],
  },
  'background-remover': {
    name: '图片背景移除',
    description:
      '在浏览器本机运行模型移除背景，完成后可切换透明或纯色背景。首次使用需要下载模型和运行时。',
    steps: [
      '选择主体清晰的图片。',
      '点击移除背景，等待模型加载和本地处理。',
      '检查发丝、边缘和半透明区域。',
      '选择透明或纯色背景并下载。',
    ],
    features: ['本地模型推理', '透明或纯色背景', '完成后切换背景无需重新运行模型'],
    faq: [
      faq(
        '照片会上传到服务器吗？',
        '照片像素在本机处理。模型、运行时和站点资源仍需网络下载；模型下载与文件上传不是同一回事。'
      ),
      faq(
        '为什么首次使用较慢？',
        '首次需要下载并初始化模型。处理耗时还取决于设备性能、浏览器能力和图片大小。'
      ),
      faq(
        '能完美抠出所有主体吗？',
        '不能。复杂边缘、发丝、半透明物体和主体背景相近时可能出现缺损或残留，请检查结果。'
      ),
    ],
  },
  'video-to-gif': {
    name: '视频转 GIF、WebP 与 APNG',
    description:
      '在浏览器中把短视频转换为 GIF、动态 WebP 或 APNG。可设置时段、尺寸、帧率和循环，转换前会下载 FFmpeg 运行时。',
    steps: [
      '选择短 MP4、WebM 或兼容的 MOV 视频。',
      '设置开始时间、时长、尺寸、帧率和循环。',
      '点击开始转换，保持页面打开。',
      '检查输出大小和动画效果后下载。',
    ],
    features: ['GIF、动态 WebP、APNG 输出', '时段裁剪与帧率控制', '本地 WebAssembly 转换'],
    faq: [
      faq(
        '所有 MOV 视频都能转换吗？',
        '不能保证。MOV 是容器，实际兼容性取决于内部视频编码和浏览器运行环境。'
      ),
      faq(
        '为什么输出比原视频大？',
        'GIF、WebP 和 APNG 的编码方式与视频不同，帧数、尺寸和内容复杂度都会影响体积。降低尺寸、时长或帧率可减少开销。'
      ),
      faq('会保留声音吗？', '不会。GIF、动态 WebP 和 APNG 是动画图片格式，不包含音轨。'),
    ],
  },
  'image-to-pdf': {
    name: '图片转 PDF',
    description:
      '将多张图片整理为 PDF，可调整页面顺序、旋转、拆分或合并页面，并控制纸张、方向和页边距。',
    steps: [
      '选择图片，每张图片会成为可预览的页面。',
      '调整顺序、旋转或移除页面，按需拆分和合并。',
      '选择纸张、方向和页边距，检查预览。',
      '下载生成的 PDF。',
    ],
    features: ['多图合并为 PDF', '页面排序、旋转、拆分与合并', 'A4、自适应和无边距设置'],
    faq: [
      faq('图片会变成可搜索文字吗？', '不会。本工具将图片放入 PDF 页面，不提供 OCR 文字识别。'),
      faq('图片顺序可以修改吗？', '可以。在页面编辑区调整顺序、删除或旋转页面后再导出。'),
      faq(
        'PDF 会保留透明效果吗？',
        '具体结果受图片编码和 PDF 输出方式影响，请检查页面预览和下载文件；需要确定背景颜色时应先处理图片背景。'
      ),
    ],
  },
  'pdf-splitter': {
    name: 'PDF 拆分与页面提取',
    description:
      '在浏览器中选择、排序、旋转或删除 PDF 页面，导出为一份新 PDF，或将独立页面打包为 ZIP。',
    steps: [
      '选择一份 PDF，等待本地页面预览。',
      '逐页选择或输入页码范围。',
      '调整顺序、旋转或移除页面。',
      '选择合并 PDF 或独立页面文件并下载。',
    ],
    features: ['按页码和范围选择', '页面重排和旋转', '合并文件或逐页 ZIP 输出'],
    faq: [
      faq(
        '会重新压缩页面内容吗？',
        '工具复制所选 PDF 页面，不是将页面截图再拼成 PDF；但不应依赖它保留数字签名等文档级特性。'
      ),
      faq(
        '支持密码保护的 PDF 吗？',
        '受保护或无法解析的文档可能被拒绝。请使用你有权访问的未加密副本。'
      ),
      faq('页面可以任意排序吗？', '可以。导出按编辑区中的选中页面顺序生成，下载前请核对页码。'),
    ],
  },
  'favicon-generator': {
    name: '网站图标生成',
    description:
      '从一张图片生成常用尺寸的 PNG 网站图标和 site.webmanifest。支持预览及打包下载，不生成 ICO 文件。',
    steps: [
      '选择清晰的方形图片或标志。',
      '选择所需尺寸集合。',
      '检查小尺寸图标是否仍然清楚。',
      '下载 PNG 图标与清单文件，并按网站配置引用。',
    ],
    features: ['16、32、180、192、512 像素 PNG', '网站清单文件', '图标预览与打包下载'],
    faq: [
      faq(
        '会生成 ICO 文件吗？',
        '不会。当前输出为 PNG 图标和 site.webmanifest；需要 ICO 时请使用支持 ICO 的专用工具。'
      ),
      faq(
        'WordPress 应该用多大的图标？',
        '该页面默认生成 512 × 512 PNG，便于用作站点图标。上传后仍需在 WordPress 中配置。'
      ),
      faq(
        '什么图片适合做图标？',
        '优先选择边缘清晰、结构简单、主体居中的方形图片。缩小到 16 像素后细小文字往往难以辨认。'
      ),
    ],
  },
  'qr-generator': {
    name: '二维码生成',
    description:
      '为文本、网址、Wi-Fi 和联系人生成 PNG 或 SVG 二维码，可自定义颜色和标志，下载前检查对比度并实际扫码。',
    steps: [
      '选择二维码类型并填写内容。',
      '选择颜色、尺寸和纠错等级，按需添加标志。',
      '检查预览和对比度提示，用实际设备扫码。',
      '下载 PNG 或 SVG。',
    ],
    features: ['文本、网址、Wi-Fi 与联系人', '颜色与标志自定义', 'PNG 和 SVG 导出'],
    faq: [
      faq(
        '二维码会过期吗？',
        '生成的静态二维码本身没有有效期，但链接所指向的网站或内容可能改变或失效。'
      ),
      faq(
        '添加标志会影响扫描吗？',
        '可能。标志遮挡、颜色对比度不足或尺寸太小都可能降低识别率。请用不同设备测试实际输出。'
      ),
      faq(
        '输入的 Wi-Fi 密码会上传吗？',
        '二维码内容在浏览器中生成。下载的二维码包含你填写的信息，请仅分享给合适的人。'
      ),
    ],
  },
};

// Each variant describes its own destination and limitations, while processing parameters stay in the original registry.
export const chineseVariants: Record<string, { name: string; description: string }> = {
  'jpg-to-png': {
    name: 'JPG 转 PNG',
    description:
      '将 JPG 解码为像素后导出 PNG，适合需要无损后续保存的场景；不会恢复 JPG 已经丢失的细节。',
  },
  'png-to-jpg': {
    name: 'PNG 转 JPG',
    description: '将 PNG 转为适合照片分享的 JPG。JPG 不支持透明通道，请检查转换后的背景和质量。',
  },
  'webp-to-jpg': {
    name: 'WebP 转 JPG',
    description:
      '将 WebP 图片转为兼容性广泛的 JPG，适合不接受 WebP 的上传入口；透明区域无法保留为透明。',
  },
  'jpg-to-webp': {
    name: 'JPG 转 WebP',
    description: '将 JPG 转为 WebP，比较实际文件大小和视觉质量；转换不保证比源图更小。',
  },
  'png-to-webp': {
    name: 'PNG 转 WebP',
    description: '将 PNG 转为支持透明通道的 WebP，调整质量并检查细节；有损输出可能改变像素。',
  },
  'webp-to-png': {
    name: 'WebP 转 PNG',
    description: '将 WebP 转为 PNG，适合需要 PNG 输入或保留透明通道的流程；输出可能比原文件大。',
  },
  'heic-to-jpg': {
    name: 'HEIC 转 JPG：兼容性说明',
    description: '当前转换器未实现 HEIC 解码。请先在设备相册中导出 JPG，再使用本地图片工具。',
  },
  'tiff-to-jpg': {
    name: 'TIFF 转 JPG：兼容性说明',
    description: '当前转换器未实现 TIFF 解码。请先使用支持 TIFF 的软件导出 JPG、PNG 或 WebP。',
  },
  'png-to-gif': {
    name: 'PNG 转 GIF：兼容性说明',
    description:
      '当前图片转换器不支持 GIF 输出，仅导出 JPG、PNG 和 WebP。制作动画请查看视频转动画工具。',
  },
  'gif-to-png': {
    name: 'GIF 转 PNG',
    description: '浏览器成功解码 GIF 后可导出一张静态 PNG；动画不会保留，解码能力取决于浏览器。',
  },
  'bmp-to-png': {
    name: 'BMP 转 PNG',
    description: '在支持 BMP 解码的浏览器中转为 PNG；部分 BMP 编码变体可能无法打开。',
  },
  'svg-to-png': {
    name: 'SVG 转 PNG',
    description:
      '把浏览器可渲染的 SVG 栅格化为 PNG。外部资源和部分 SVG 特性可能无法呈现，请核对预览。',
  },
  'compress-png': {
    name: 'PNG 图片压缩',
    description:
      '重新编码 PNG 或降低图片尺寸。PNG 不使用有损质量滑块，文件不保证变小；需要进一步缩小时可比较 WebP。',
  },
  'compress-jpg': {
    name: 'JPG 图片压缩',
    description:
      '通过调整 JPG 质量与最大宽度减小文件，比较三档输出的真实大小和细节，支持批量下载。',
  },
  'compress-for-email': {
    name: '邮件附件图片压缩',
    description:
      '按邮件用途预设压缩图片，比较结果与邮箱附件限制。邮件总附件限额需以提供商要求为准。',
  },
  'compress-for-web': {
    name: '网页图片压缩',
    description:
      '为网页加载选择合理的图片尺寸和质量。以页面实际展示宽度为参考，并核对下载文件的体积。',
  },
  'compress-for-whatsapp': {
    name: 'WhatsApp 图片压缩',
    description:
      '使用聊天用途预设准备图片，兼顾分享体积和可读性。WhatsApp 仍可能在发送时再次处理图片。',
  },
  'compress-to-100kb': {
    name: '图片压缩至 100 KB',
    description:
      '默认目标为 100 KB，工具在有限范围内搜索质量和尺寸。仅在实际输出不超过目标时标记达标，否则显示最接近的结果。',
  },
  'resize-for-instagram': {
    name: 'Instagram 图片尺寸调整',
    description:
      '默认生成 1080 × 1080 像素的方形帖子图片。默认精确缩放可能拉伸原图，可启用保持比例或先裁剪。',
  },
  'resize-for-facebook': {
    name: 'Facebook 封面尺寸调整',
    description:
      '默认设置为 820 × 312 像素的封面尺寸。不同设备可能显示不同裁剪范围，请保留重要内容的安全边距。',
  },
  'resize-for-twitter': {
    name: 'Twitter / X 头图尺寸调整',
    description:
      '默认设置为 1500 × 500 像素。原图比例不一致时可选择保持比例，上传前检查头像覆盖区域。',
  },
  'resize-for-youtube': {
    name: 'YouTube 缩略图尺寸调整',
    description:
      '默认生成 1280 × 720 像素缩略图。检查小尺寸下的主体与文字可读性，以及平台当前的上传限制。',
  },
  'resize-for-linkedin': {
    name: 'LinkedIn 图片尺寸调整',
    description: '默认设置为 1200 × 627 像素的帖子图片。可更改精确尺寸或保持原图比例。',
  },
  'resize-for-tiktok': {
    name: 'TikTok 封面尺寸调整',
    description:
      '默认设置为 1080 × 1920 像素的竖图。重要内容应避开界面覆盖区，并在上传后核对显示效果。',
  },
  'resize-to-1920x1080': {
    name: '图片调整为 1920 × 1080',
    description:
      '生成全高清 16:9 尺寸的图片。默认精确缩放可能拉伸非 16:9 原图，保持比例会将图片适配到目标框内。',
  },
  'crop-to-square': {
    name: '图片裁剪为正方形',
    description: '以 1:1 比例裁剪头像或方形配图，拖动主体位置并缩放，确认四周内容后下载。',
  },
  'crop-to-16-9': {
    name: '图片裁剪为 16:9',
    description: '为宽屏展示裁剪 16:9 图片。调整主体位置，避免重要内容被上下裁掉。',
  },
  'crop-to-4-3': {
    name: '图片裁剪为 4:3',
    description: '以 4:3 比例重新构图，适合常见照片和展示画面。裁剪会移除选区外像素。',
  },
  'crop-to-3-2': {
    name: '图片裁剪为 3:2',
    description: '以常见摄影比例 3:2 裁剪图片，拖动并缩放以保留主体。输出前检查构图。',
  },
  'free-crop': {
    name: '图片自由裁剪',
    description: '不固定宽高比例，按需要调整裁剪区域。适合移除多余边缘和准备自定义构图。',
  },
  'split-into-2': {
    name: '图片分成两半',
    description: '默认一行两列，把图片左右分成两块。可拖动中间分割线改变边界，或改为上下分割。',
  },
  'split-into-4': {
    name: '图片分成四块',
    description: '默认两行两列生成四块图片。可拖动分割线改变区域大小，按顺序单独下载或打包。',
  },
  'instagram-grid': {
    name: 'Instagram 九宫格分割',
    description:
      '默认三行三列生成九张图片。发布顺序和平台个人主页的显示比例会影响拼接效果，请先确认布局。',
  },
  'split-for-printing': {
    name: '图片分块打印',
    description:
      '默认两行两列分割大图，便于分别打印。此工具导出图片块，不自动设置纸张尺寸、物理缩放或拼接重叠区。',
  },
  'jpg-to-pdf': {
    name: 'JPG 转 PDF',
    description: '将一张或多张 JPG 排列为 PDF 页面，可修改顺序、旋转和页边距；不进行文字识别。',
  },
  'png-to-pdf': {
    name: 'PNG 转 PDF',
    description: '将 PNG 图片整理为可预览的 PDF 页面，检查背景与页面缩放后导出。',
  },
  'image-to-a4-pdf': {
    name: '图片转 A4 PDF',
    description:
      '默认使用 A4 纸张，将图片适配到页面中，可调整方向和页边距。打印时仍需核对打印机缩放设置。',
  },
  'multiple-images-to-pdf': {
    name: '多张图片合并 PDF',
    description: '将多张图片组合为一份 PDF，逐页调整顺序、旋转或移除，下载前检查完整页面列表。',
  },
  'image-to-pdf-no-margin': {
    name: '图片转无边距 PDF',
    description: '默认选择无边距预设。PDF 页面不留边距不代表打印机能无边距打印，请检查打印机能力。',
  },
  'photo-to-pdf': {
    name: '照片转 PDF',
    description:
      '将照片整理为便于保存和分享的 PDF，调整页面顺序和纸张设置；不会提高照片原有清晰度。',
  },
  'extract-pages-from-pdf': {
    name: '提取 PDF 页面',
    description: '选择页码或范围，将选中页面按编辑顺序导出为一份新 PDF，可在导出前旋转或移除页面。',
  },
  'split-pdf-into-pages': {
    name: 'PDF 拆分为独立页面',
    description: '把每个选中页面导出为一份独立 PDF，再打包成 ZIP，适合逐页分发或归档。',
  },
  'png-to-favicon': {
    name: 'PNG 生成网站图标',
    description: '从 PNG 生成多种尺寸的 PNG 网站图标，透明素材适合保留无背景标志；不输出 ICO。',
  },
  'jpg-to-favicon': {
    name: 'JPG 生成网站图标',
    description:
      '将 JPG 缩放为常用网站图标尺寸，原有背景会保留。输出为 PNG，建议选择主体清楚的方形图片。',
  },
  'logo-to-favicon': {
    name: '标志生成网站图标',
    description: '将标志制作成网站图标，重点检查 16 和 32 像素下的辨识度，避免复杂细节和细小文字。',
  },
  'favicon-for-wordpress': {
    name: 'WordPress 网站图标',
    description:
      '默认生成 512 × 512 PNG，作为 WordPress 站点图标使用。下载后需在 WordPress 中上传并完成配置。',
  },
  'video-to-webp': {
    name: '视频转动态 WebP',
    description:
      '将短视频转换为动态 WebP，可设置时段、帧率、尺寸和质量。请确认接收平台支持动态 WebP。',
  },
  'video-to-apng': {
    name: '视频转 APNG',
    description:
      '将短视频转换为全彩动画 PNG，适合需要 APNG 的场景。文件可能较大，可降低尺寸、时长或帧率。',
  },
};

for (const tool of toolRegistry) {
  for (const variant of tool.variants) {
    if (!chineseVariants[variant.slug]) throw new Error(`Missing Chinese variant: ${variant.slug}`);
  }
}

export const chineseGuideLabels: Record<string, { title: string; description: string }> = {
  'image-format-comparison': {
    title: 'JPG、PNG 与 WebP 格式对比',
    description: '根据照片、透明背景和网页展示需求选择图片格式，理解质量与体积的取舍。',
  },
  'reduce-image-size': {
    title: '如何减小图片文件大小',
    description: '按用途调整尺寸、格式和质量，比较真实输出，避免无效压缩和过度损失细节。',
  },
  'social-media-image-sizes': {
    title: '社交平台图片尺寸指南',
    description: '查看常用社交平台图片预设，理解保持比例、裁剪和界面安全区域的区别。',
  },
};
