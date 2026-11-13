import type { Locale } from './locale';
import { localizeErrorMessage } from './errors.ts';

// Only use this catalog at product-copy rendering boundaries, never on user data.
const messages: Record<string, string> = {
  'Photos and email. Transparency is filled with white.': '适合照片和邮件。透明区域填充为白色。',
  'Lossless pixels, and transparency is kept.': '无损保存像素，并保留透明区域。',
  'Web pages. Lossy encoding that keeps transparency.': '适合网页。有损编码，并保留透明区域。',
  'Converting images.': '正在转换图片。',
  'Accepted input:': '支持的输入格式：',
  'Convert to': '转换为',
  'Pick the format you need. Conversion follows your choice, and the exact values stay editable below.':
    '选择所需格式后自动转换，也可在下方修改具体参数。',
  'Applies to JPG and WebP. Higher keeps more detail and writes a larger file.':
    '适用于 JPG 和 WebP。数值越高，保留的细节越多，文件也越大。',
  'Output Quality': '输出质量',
  'PNG is lossless, so it has no quality setting. Every decoded pixel is written out unchanged.':
    'PNG 使用无损编码，没有质量设置。解码后的每个像素都将原样保存。',
  'Converting in your browser…': '正在浏览器中转换…',
  'Results follow the settings above. Nothing is uploaded.':
    '结果会随上方设置自动更新，图片不会上传。',
  'JPG or JPEG': 'JPG 或 JPEG',
  'JPG, PNG, or WebP': 'JPG、PNG 或 WebP',
  'Web page': '网页',
  'Fast pages, up to 1600 px wide': '适合快速加载的网页，宽度不超过 1600 像素',
  'Email attachment': '邮件附件',
  'Smaller files that still read well': '缩小文件，保留清晰可读的内容',
  'Chat and messaging': '聊天与消息',
  'Quick to send on mobile data': '适合使用移动网络快速发送',
  Print: '打印',
  'Keeps the original dimensions': '保留原始尺寸',
  'Exact size in KB': '指定目标大小（KB）',
  'Bounded search for a size you set': '在限定范围内尝试达到目标大小',
  Smaller: '更小',
  'Lowest file size. Soft edges when zoomed in.': '文件最小，放大后边缘可能较柔和。',
  Balanced: '均衡',
  'The size this purpose is tuned for.': '采用适合当前用途的文件大小。',
  Sharper: '更清晰',
  'Keeps more detail, and stays the largest.': '保留更多细节，文件也最大。',
  'No smaller result was found; original kept.': '未找到更小的结果，已保留原文件。',
  'File size reduced.': '文件已缩小。',
  'Dimensions changed, but the output file is larger than the original.':
    '图片尺寸已改变，但输出文件比原文件大。',
  'original width': '原始宽度',
  'Compressing images.': '正在压缩图片。',
  'What is it for?': '图片用在哪里？',
  'Choose a purpose and the settings follow. You can still change every value below.':
    '选择用途后自动应用设置，也可在下方修改每个参数。',
  'Target size': '目标大小',
  'Target Size (KB)': '目标大小（KB）',
  'Quality and dimensions are searched within bounds. Each result says whether the target was actually met.':
    '在限定范围内调整质量和尺寸，每项结果都会注明是否达到目标大小。',
  'Pick a result': '选择结果',
  'Working…': '处理中…',
  'Select to encode': '选择后生成',
  'Applies to JPG and WebP. PNG is lossless, so its candidates differ by width instead.':
    '适用于 JPG 和 WebP。PNG 使用无损编码，其候选结果通过不同宽度来控制大小。',
  'Compression Quality': '压缩质量',
  'Starting max width': '起始最大宽度',
  'Starting Max Width': '起始最大宽度',
  'Original width': '原始宽度',
  'Encoding in your browser…': '正在浏览器中编码…',
  'Large batch: only the selected candidate is encoded automatically. Choosing another one encodes it.':
    '批量文件较多时，仅自动生成选中的候选结果。选择其他候选后会开始生成。',
  Download: '下载',
  'Fit 1920 px': '限制为 1920 像素',
  'Web pages and large screens': '网页和大屏幕',
  'Fit 1280 px': '限制为 1280 像素',
  'Blog posts and documents': '博客文章和文档',
  'Fit 800 px': '限制为 800 像素',
  'Email and chat': '邮件和聊天',
  'Fit 300 px': '限制为 300 像素',
  'Thumbnails and avatars': '缩略图和头像',
  'Resizing images.': '正在调整图片尺寸。',
  'Live resize preview': '尺寸调整实时预览',
  'Live preview': '实时预览',
  'Drag to change output dimensions': '拖动以调整输出尺寸',
  'Drag the lower-right handle or enter exact pixel values.':
    '拖动右下角的手柄，或输入精确的像素值。',
  'Common sizes. Each one keeps the aspect ratio and fits the image inside the value.':
    '常用尺寸均保持宽高比，将图片缩放至指定范围内。',
  'Platform size': '平台尺寸',
  'Max width (px)': '最大宽度（像素）',
  'Width (px)': '宽度（像素）',
  'Max height (px)': '最大高度（像素）',
  'Height (px)': '高度（像素）',
  'Maintain aspect ratio': '保持宽高比',
  'Each image fits inside the maximum width and height without stretching.':
    '每张图片保持比例，缩放至最大宽度和高度范围内。',
  'The exact width and height are used; the image may be stretched.':
    '使用指定的宽度和高度，图片可能被拉伸。',
  'Output format': '输出格式',
  'PNG is lossless, so quality does not apply to it.': 'PNG 使用无损编码，不受质量参数影响。',
  'Resizing in your browser…': '正在浏览器中调整尺寸…',
  ', edited': '，已编辑',
  'Opening the image safely...': '正在安全地打开图片…',
  'Enhanced image preview': '增强后的图片预览',
  'Remove image': '移除图片',
  'The preview is drawn at': '预览尺寸为',
  'so it stays smooth while you drag. The download below is rendered at the full':
    '，以便拖动时保持流畅。下方下载文件按完整尺寸生成：',
  'Which correction?': '需要哪种调整？',
  'Pick a correction and every slider follows it. You can still change each value below.':
    '选择调整方案后自动设置各滑块，也可在下方逐项修改。',
  Brightness: '亮度',
  Saturation: '饱和度',
  Contrast: '对比度',
  Sharpness: '锐度',
  'Emphasizes edges that are already there. It cannot recover detail the source does not have.':
    '增强图片中已有的边缘，无法恢复原图中不存在的细节。',
  Blur: '模糊',
  Grayscale: '灰度',
  On: '开启',
  Off: '关闭',
  'Rendering the full-size image in your browser…': '正在浏览器中生成完整尺寸图片…',
  'The file below follows the settings above. Nothing is uploaded.':
    '下方文件会随上方设置自动更新，图片不会上传。',
  'Rendering enhanced image.': '正在生成增强后的图片。',
  Result: '结果',
  Reset: '重置',
  Auto: '自动',
  'Best fit for your images': '自动选择适合图片的布局',
  Grid: '网格',
  'Column count in Fine-tune': '可在微调中设置列数',
  'Side by side': '横向拼接',
  'Left to right': '从左到右',
  'Vertical stitch': '纵向拼接',
  'Top to bottom': '从上到下',
  'original size': '原始尺寸',
  'Opening images locally…': '正在本地打开图片…',
  'images ready': '张图片已就绪',
  'Auto recommends': '自动推荐',
  'Start over': '重新开始',
  'Your collage': '你的拼图',
  'Image collage preview. Drag a picture onto another position to swap them.':
    '拼图预览。将图片拖到另一位置即可交换。',
  'Drag a picture onto another position to swap them.': '将图片拖到另一位置即可交换。',
  'Collage settings': '拼图设置',
  'How should the images sit together?': '图片如何排列？',
  'Pick an arrangement and the collage follows. Every exact value stays in Fine-tune below.':
    '选择排列方式后自动更新拼图，可在下方微调中修改具体参数。',
  'Back to the recommended settings': '恢复推荐设置',
  Columns: '列数',
  'Used by the Grid arrangement.': '用于网格排列。',
  'PNG — best quality': 'PNG — 最佳质量',
  'JPG — smaller file': 'JPG — 文件更小',
  'WebP — modern and compact': 'WebP — 现代紧凑格式',
  'Applies to JPG and WebP. PNG is lossless, so it has no quality setting.':
    '适用于 JPG 和 WebP。PNG 使用无损编码，没有质量设置。',
  'Image fit': '图片适配',
  'Show the full image': '显示完整图片',
  'Fill each tile': '填满每个格子',
  'Keep original size': '保留原始尺寸',
  'Tile width': '格子宽度',
  'Tile height': '格子高度',
  Gap: '间距',
  'Outer margin': '外边距',
  'Corner radius': '圆角半径',
  Background: '背景',
  'Building the collage file in your browser…': '正在浏览器中生成拼图文件…',
  'Results follow the settings above.': '结果会随上方设置自动更新。',
  'updating…': '更新中…',
  'Download collage': '下载拼图',
  'Selected image content is processed locally and is not sent to ToolkitFree for processing.':
    '所选图片内容在本地处理，不会发送至 ToolkitFree 进行处理。',
  'Collage images': '拼图图片',
  'Reorder or remove images': '调整图片顺序或移除图片',
  'Optional · drag directly on the preview for a quick swap':
    '可选操作 · 也可直接在预览中拖动图片快速交换',
  Remove: '移除',
  '2 across': '横向 2 份',
  '2 down': '纵向 2 份',
  'Same as input': '与输入一致',
  'The image could not be split. Please try another file.': '无法分割此图片，请尝试其他文件。',
  'No usable gutter was found. This works on images whose pieces are separated by a plain strip running the full width or height; place the lines by hand instead.':
    '未找到可用的间隔。自动检测适用于各部分之间存在贯穿图片宽度或高度的纯色间隔的图片；请手动放置分割线。',
  'Check them and move any line that sits in the wrong place.':
    '请检查分割线，并移动位置不合适的线。',
  'There is no room for another split line along that edge.': '该方向已没有空间添加分割线。',
  Vertical: '垂直',
  Horizontal: '水平',
  'lines (': '分割线 (',
  'Add line': '添加分割线',
  No: '暂无',
  'lines yet.': '分割线。',
  'an image': '图片',
  'Choose a different image': '选择其他图片',
  'Drag a line to move it, or type an exact position below. Arrow keys nudge a focused line by one pixel, Shift and an arrow key by ten.':
    '拖动分割线，或在下方输入精确位置。选中分割线后，方向键每次移动 1 像素，Shift + 方向键每次移动 10 像素。',
  'JPG output is re-encoded, which adds a second round of lossy compression.':
    'JPG 输出会重新编码，产生第二轮有损压缩。',
  'Start from an even grid': '从均匀网格开始',
  'A grid sets the split lines for you. Every line stays draggable, and each value is in Fine-tune below.':
    '网格会自动设置分割线。每条线均可拖动，也可在下方微调中修改数值。',
  'Place the lines for me': '自动放置分割线',
  'Looking for seams...': '正在查找接缝…',
  'Detect split lines': '检测分割线',
  'Distribute evenly': '均匀分布',
  'Detect split lines looks for the plain strips that separate the pictures in a stitched image and puts a line in each one. It cannot find a seam that is not there, and every line it places stays editable. Distribute evenly respaces the lines you already have.':
    '“检测分割线”会查找拼接图片之间的纯色间隔，并在其中放置可编辑的分割线；不存在间隔时无法识别接缝。“均匀分布”会重新均匀排列已有的分割线。',
  Rows: '行数',
  'Outer margin (px)': '外边距（像素）',
  'Pixels skipped at every outside edge, for a picture that already has a border.':
    '从图片四周跳过的像素数，适用于已有边框的图片。',
  'Discard at each line (px)': '每条线处丢弃的宽度（像素）',
  'Each line drops a band this wide instead of cutting at a single point.':
    '每条分割线会丢弃指定宽度的条带，而非只在一点切开。',
  'Same as input keeps PNG and WebP sources lossless; a JPG source stays JPG.':
    '“与输入一致”会对 PNG 和 WebP 使用无损输出；JPG 仍输出为 JPG。',
  'Cutting the pieces in your browser…': '正在浏览器中分割图片…',
  'The pieces follow the split lines above. The image is not uploaded for processing.':
    '分割结果会随上方分割线自动更新，图片不会上传处理。',
  'Splitting the image.': '正在分割图片。',
  'Looking for the seams.': '正在查找接缝。',
  'Crop preview': '裁剪预览',
  'Crop selection': '裁剪选区',
  'Arrow keys move the crop. Hold Alt + arrows to resize; Shift uses larger steps.':
    '方向键移动裁剪框；Alt + 方向键调整大小；按住 Shift 可增大步长。',
  'Crop shape': '裁剪形状',
  'The crop box takes this shape. Drag or nudge it to choose the area — the file below follows it.':
    '裁剪框会采用所选形状。拖动或微移选择区域，下方文件会自动更新。',
  'Crop:': '裁剪：',
  'Preview zoom': '预览缩放',
  'Zoom out': '缩小预览',
  Out: '缩小',
  'Zoom in': '放大预览',
  In: '放大',
  'Cropping in your browser…': '正在浏览器中裁剪…',
  'The cropped file follows the crop box above. Nothing is uploaded.':
    '裁剪文件会随上方裁剪框自动更新，图片不会上传。',
  'Cropping image.': '正在裁剪图片。',
  Original: '原图',
  'Keep the image as it is': '保持图片原样',
  'Photo boost': '照片增强',
  'Lift a flat phone photo': '改善平淡的手机照片',
  'Low light': '弱光修复',
  'Open up an underexposed shot': '提亮曝光不足的照片',
  'Document scan': '文档扫描',
  'Cleaner paper, harder text': '净化纸张背景，增强文字清晰度',
  'Black and white': '黑白',
  'Grayscale with a contrast lift': '灰度处理并增强对比度',
  Soften: '柔化',
  'Ease harsh detail and noise': '柔化生硬的细节与噪点',
  Custom: '自定义',
  'Instagram Post (1080x1080)': 'Instagram 帖子（1080×1080）',
  'Instagram Story (1080x1920)': 'Instagram 快拍（1080×1920）',
  'Facebook Cover (820x312)': 'Facebook 封面（820×312）',
  'Twitter/X Header (1500x500)': 'Twitter/X 头图（1500×500）',
  'YouTube Thumbnail (1280x720)': 'YouTube 缩略图（1280×720）',
  'LinkedIn Post (1200x627)': 'LinkedIn 帖子（1200×627）',
  'TikTok Cover (1080x1920)': 'TikTok 封面（1080×1920）',
  'Full HD (1920x1080)': '全高清（1920×1080）',
  'HD (1280x720)': '高清（1280×720）',
  'Thumbnail (300x300)': '缩略图（300×300）',
  Free: '自由比例',
  lossless: '无损',
  'files:': '个文件：',
  to: '至',
  piece: '份',
  s: '',
  'across,': '列，',
  'down.': '行。',
  vertical: '垂直',
  horizontal: '水平',
  'side by side': '横向拼接',
  'vertical stitch': '纵向拼接',
  grid: '网格',
};

type MessagePattern = readonly [RegExp, (...captures: string[]) => string];
const patterns: readonly MessagePattern[] = [
  [
    /^(Converted|Encoded|Resized|Rendered|Cropped) in your browser in ([\d.]+)s\. Nothing was uploaded\.$/,
    (verb, time) =>
      `已在浏览器中${({ Converted: '转换', Encoded: '编码', Resized: '调整尺寸', Rendered: '生成', Cropped: '裁剪' } as Record<string, string>)[verb]}，用时 ${time} 秒。图片未上传。`,
  ],
  [
    /^Back to the (.+) (default|preset|grid)$/,
    (label, kind) =>
      `恢复${imageText(label, 'zh')}${kind === 'grid' ? '网格' : kind === 'default' ? '默认设置' : '预设'}`,
  ],
  [/^Quality:? ([\d.]+)%$/, (quality) => `质量：${quality}%`],
  [/^quality ([\d.]+)%$/, (quality) => `质量 ${quality}%`],
  [/^Target ([\d.]+) KB$/, (size) => `目标 ${size} KB`],
  [/^max width (\d+) px$/, (width) => `最大宽度 ${width} 像素`],
  [
    /^Already within the ([\d.]+) KB target; original kept\.$/,
    (size) => `原文件已在 ${size} KB 目标范围内，已保留。`,
  ],
  [
    /^Target met: (.+) is within ([\d.]+) KB\.$/,
    (size, target) => `已达到目标：${size} 不超过 ${target} KB。`,
  ],
  [
    /^Target not met after (\d+) attempts; original kept because no smaller result was found\.$/,
    (count) => `尝试 ${count} 次后未达到目标，且未找到更小的结果，已保留原文件。`,
  ],
  [
    /^Target not met after (\d+) attempts; closest result kept\.$/,
    (count) => `尝试 ${count} 次后未达到目标，已保留最接近目标的结果。`,
  ],
  [/^\| quality (\d+)%$/, (quality) => ` | 质量 ${quality}%`],
  [/^\| (\d+) attempts?$/, (count) => ` | 尝试 ${count} 次`],
  [
    /^Each image fits inside (\d+) × (\d+) without stretching, so one side can come out smaller\.$/,
    (width, height) => `每张图片保持比例缩放至 ${width} × ${height} 范围内，其中一边可能更小。`,
  ],
  [
    /^Each image comes out at exactly (\d+) × (\d+)\. One of another shape is stretched; tick Maintain aspect ratio to keep its proportions\.$/,
    (width, height) =>
      `每张图片精确输出为 ${width} × ${height}。不同比例的图片会被拉伸；勾选“保持宽高比”可保留比例。`,
  ],
  [/^Preview of ([\s\S]+) at the selected dimensions$/, (name) => `${name} 按所选尺寸的预览`],
  [/^Preview of ([\s\S]+) with split lines$/, (name) => `${name} 的分割线预览`],
  [/^Move ([\s\S]+) earlier$/, (name) => `将 ${name} 前移`],
  [/^Move ([\s\S]+) later$/, (name) => `将 ${name} 后移`],
  [
    /^([\s\S]+) moved to position (\d+)\.$/,
    (name, position) => `已将 ${name} 移至第 ${position} 个位置。`,
  ],
  [/^(\d+) × (\d+)px output$/, (width, height) => `输出 ${width} × ${height} 像素`],
  [/^Recommended: (.+)$/, (layout) => `推荐：${imageText(layout, 'zh')}`],
  [/^(\d+) columns?$/, (count) => `${count} 列`],
  [
    /^Collage file ready(?: in ([\d.]+)s)?\. It is rebuilt whenever the layout, the order, or a setting changes\.$/,
    (seconds) =>
      `拼图文件已生成${seconds ? `，用时 ${seconds} 秒` : ''}。布局、顺序或设置变化后会自动重新生成。`,
  ],
  [
    /^(Vertical|Horizontal) line (\d+) \(px from (left|top)\)$/,
    (axis, index, edge) =>
      `${axis === 'Vertical' ? '垂直' : '水平'}分割线 ${index}（距${edge === 'left' ? '左侧' : '顶部'}的像素数）`,
  ],
  [
    /^Remove (vertical|horizontal) line (\d+)$/,
    (axis, index) => `移除${axis === 'vertical' ? '垂直' : '水平'}分割线 ${index}`,
  ],
  [
    /^(Vertical|Horizontal) line (\d+) at (\d+) pixels\. Use the arrow keys to move it\.$/,
    (axis, index, position) =>
      `${axis === 'Vertical' ? '垂直' : '水平'}分割线 ${index}，位于 ${position} 像素处。使用方向键移动。`,
  ],
  [
    /^Cut (\d+) pieces? in your browser in (.+)\. The image was not uploaded for processing\.$/,
    (count, elapsed) =>
      `已在浏览器中分割为 ${count} 份，用时 ${elapsed.replace(/ms$/, ' 毫秒').replace(/s$/, ' 秒')}。图片未上传处理。`,
  ],
  [/^(\d+)px border$/, (size) => `${size} 像素边框`],
  [/^(\d+)px discarded$/, (size) => `丢弃 ${size} 像素`],
  [
    /^Placed (\d+) split lines?: (\d+) vertical, (\d+) horizontal(?:, discarding (\d+)px at each)?(?:, inside a (\d+)px border)?\. Check them and move any line that sits in the wrong place\.$/,
    (count, vertical, horizontal, gutter, margin) =>
      `已放置 ${count} 条分割线：${vertical} 条垂直线、${horizontal} 条水平线${gutter ? `，每条线处丢弃 ${gutter} 像素` : ''}${margin ? `，保留 ${margin} 像素边框以内的区域` : ''}。请检查并移动位置不合适的线。`,
  ],
  [
    /^The remaining (-?\d+)px cannot be divided into (\d+) pieces\. Reduce the margin, the gap, or the number of pieces\.$/,
    (size, pieces) => `剩余 ${size} 像素无法分为 ${pieces} 份。请减小外边距、间距或分割份数。`,
  ],
  [
    /^A piece along the (width|height) would be empty\. Move the split lines apart, or reduce the margin or the gap\.$/,
    (axis) =>
      `沿${axis === 'width' ? '宽度' : '高度'}方向的某个分块将为空。请拉开分割线，或减小外边距与间距。`,
  ],
  [
    /^A split cannot produce more than (\d+) pieces\.$/,
    (count) => `一次最多可分割为 ${count} 份。`,
  ],
  [
    /^(Source width|Source height|Buffer width|Buffer height|Length|Piece count|Gutter|Margin|Cut \d+) must be a safe integer of at least (\d+)\.$/,
    (field, minimum) =>
      `${({ 'Source width': '原图宽度', 'Source height': '原图高度', 'Buffer width': '缓冲区宽度', 'Buffer height': '缓冲区高度', Length: '长度', 'Piece count': '分割份数', Gutter: '间隔', Margin: '外边距' } as Record<string, string>)[field] ?? `分割线 ${field.slice(4)}`}必须为不小于 ${minimum} 的安全整数。`,
  ],
  [/^Cut index (\d+) is out of range\.$/, (index) => `分割线索引 ${index} 超出范围。`],
  [
    /^The grayscale buffer holds (\d+) bytes but (\d+)×(\d+) needs (\d+)\.$/,
    (actual, width, height, expected) =>
      `灰度缓冲区包含 ${actual} 字节，而 ${width}×${height} 需要 ${expected} 字节。`,
  ],
];

export function imageText<T>(value: T, locale: Locale): T {
  if (locale !== 'zh' || typeof value !== 'string') return value;
  const key = value.trim().replace(/\s+/g, ' ');
  if (messages[key] !== undefined) return messages[key] as T;
  for (const [pattern, translate] of patterns) {
    const match = value.match(pattern) ?? value.trim().match(pattern);
    if (match) return translate(...match.slice(1)) as T;
  }
  if (key.includes(' · '))
    return key
      .split(' · ')
      .map((part) => imageText(part, locale))
      .join(' · ') as T;
  if (key.startsWith('· ')) return ` · ${imageText(key.slice(2), locale)}` as T;
  return localizeErrorMessage(value, locale) as T;
}

export function imageChoices<T extends { label: string; hint?: string }>(
  values: readonly T[],
  locale: Locale
): T[] {
  return values.map((entry) => ({
    ...entry,
    label: imageText(entry.label, locale),
    hint: imageText(entry.hint, locale),
  }));
}
