import { useI18n } from './react';
import type { ReactNode } from 'react';
import { localizeErrorMessage } from './errors';

// Translate presentation text only; file names, form values, and processing IDs stay unchanged.
const messages: Record<string, string> = {
  'The local conversion engine manifest failed after three download attempts.':
    '转换引擎资源清单在三次下载尝试后仍失败，请检查网络连接后重试。',
  'The compressed conversion engine failed after three download attempts.':
    '压缩转换引擎在三次下载尝试后仍失败，请检查网络连接后重试。',
  'The local conversion engine script failed after three download attempts.':
    '转换引擎脚本在三次下载尝试后仍失败，请检查网络连接后重试。',
  'Could not encode a temporary frame.': '无法编码临时动画帧，请降低输出尺寸或选择其他文件后重试。',
  'The background removal worker stopped unexpectedly.':
    '抠图后台任务意外停止，请检查设备可用内存或尝试较小的图片后重试。',
  'The background removal worker could not start; its script failed to load.':
    '抠图后台任务无法启动，因为运行脚本加载失败。请检查网络连接后重新加载页面。',
  'Length must be zero or greater.': '长度不能小于零。',
  'Source width must be greater than zero.': '原图宽度必须大于零。',
  'Source height must be greater than zero.': '原图高度必须大于零。',
  'Minimum head height must be greater than zero.': '最小头部高度必须大于零。',
  'Maximum head height must be greater than zero.': '最大头部高度必须大于零。',
  'Dimension must be greater than zero.': '尺寸必须大于零。',
  'Head height range must fit within the photo height.': '头部高度范围不能超出照片高度。',
  'Background removal failed.': '抠图失败。',
  Letter: 'Letter 美式信纸',
  John: '小明',
  Doe: '王',
  'Favicon dimensions must be greater than zero.': '网站图标尺寸必须大于零。',
  'Page and image dimensions must be greater than zero.': '页面和图片尺寸必须大于零。',
  'Margin must be zero or greater.': '边距不能小于零。',
  'Margin leaves no drawable page area.': '当前边距未留下可绘制的页面区域。',
  'Pixel dimension must be greater than zero.': '像素尺寸必须大于零。',
  'Image dimensions must be greater than zero.': '图片尺寸必须大于零。',
  'Aspect ratio must be greater than zero.': '宽高比必须大于零。',
  'Actual size needs the natural pixel dimensions.': '使用实际尺寸需要图片的原始像素尺寸。',
  'DPI must be greater than zero.': 'DPI 必须大于零。',
  'Target ratio must be greater than zero.': '目标宽高比必须大于零。',
  'Gap must be zero or greater.': '间距不能小于零。',
  'Margins leave no printable area.': '当前边距未留下可打印的区域。',
  'The photo does not fit on the paper.': '此纸张无法容纳照片。',
  Green: '绿色',
  'Downloading AI model': '正在下载 AI 模型',
  'Removing background': '正在移除背景',
  'Initializing AI model': '正在初始化 AI 模型',
  'One combined PDF': '合并为一个 PDF',
  'The selected pages, in order, in a single new file.': '将选中页面按顺序合并到一个新文件中。',
  'Separate page files': '每页单独导出',
  'One PDF per selected page, delivered in a ZIP.': '每个选中页面生成一个 PDF，打包为 ZIP 下载。',
  'Choose a valid PDF file.': '请选择有效的 PDF 文件。',
  'The selected PDF is empty.': '所选 PDF 为空。',
  'This PDF has no pages.': '此 PDF 不包含任何页面。',
  'Enter page numbers such as 1-3, 5, 8-10.': '请输入页码，例如 1-3, 5, 8-10。',
  'Choose an MP4, WebM, MOV, GIF, animated WebP, or APNG file.':
    '请选择 MP4、WebM、MOV、GIF、动态 WebP 或 APNG 文件。',
  'The source video is longer than 5 minutes.': '源视频时长超过 5 分钟。',
  'The source dimensions exceed 3840 × 2160.': '源文件尺寸超过 3840 × 2160。',
  'This size, frame rate, and duration combination exceeds the browser memory budget.':
    '当前尺寸、帧率与时长的组合超出了浏览器内存预算。',
  'The conversion engine download made no progress for 60 seconds. Check your connection and try again.':
    '转换引擎下载已 60 秒没有进展，请检查网络连接后重试。',
  'The conversion engine download was interrupted. Check your connection and try again.':
    '转换引擎下载中断，请检查网络连接后重试。',
  'A local conversion engine part exceeded its declared size.':
    '本地转换引擎的某个组件超出声明大小。',
  'A local conversion engine part was downloaded incompletely.':
    '本地转换引擎的某个组件下载不完整。',
  'The downloaded part failed its transfer integrity check.': '下载组件的传输完整性校验失败。',
  'A local conversion engine part failed after three download attempts.':
    '本地转换引擎的某个组件在三次下载尝试后仍失败。',
  'The local conversion engine failed its integrity check.': '本地转换引擎的完整性校验失败。',
  'The compressed conversion engine bundle is unavailable.': '压缩转换引擎包不可用。',
  'The compressed conversion engine failed its transfer integrity check.':
    '压缩转换引擎的传输完整性校验失败。',
  'This browser cannot decode animated WebP frames for conversion.':
    '此浏览器无法解码动态 WebP 帧进行转换。',
  'This browser does not expose animated WebP decoding.': '此浏览器不提供动态 WebP 解码能力。',
  'Animated WebP input capability could not be confirmed.': '无法确认动态 WebP 输入支持情况。',
  'Could not prepare an animated WebP frame.': '无法准备动态 WebP 帧。',
  'Animated WebP input is not supported in this browser.': '此浏览器不支持动态 WebP 输入。',
  'This is a static WebP. Use the Image Converter instead.':
    '这是一张静态 WebP，请使用图片格式转换工具。',
  Square: '方形',
  Rounded: '圆角',
  Dots: '圆点',
  Classy: '经典',
  'Extra Round': '大圆角',
  'The logo could not be read.': '无法读取标志图片。',
  Colors: '颜色',
  Foreground: '前景色',
  Background: '背景',
  'Increase foreground/background contrast to enable downloads. Current ratio:':
    '请提高前景与背景的对比度后再下载。当前对比度：',
  'Dot Style': '码点样式',
  'Logo (optional)': '标志图片（可选）',
  'Upload Logo': '选择标志图片',
  Logo: '标志图片',
  'Size:': '大小：',
  'Remove logo': '移除标志图片',
  'Error Correction': '纠错等级',
  'A logo covers part of the code, so High (H) is set for you. You can still choose another level.':
    '标志图片会遮住部分二维码，因此已自动设为高纠错等级（H）。你仍可选择其他等级。',
  'Higher levels keep the code scannable when it is damaged or partly covered, and make it denser.':
    '较高等级有助于识别受损或被部分遮挡的二维码，同时也会使码点更密集。',
  'Text / URL': '文本 / 网址',
  vCard: '电子名片',
  Email: '电子邮件',
  Phone: '电话',
  SMS: '短信',
  'What are you encoding?': '二维码包含什么内容？',
  'Text or URL': '文本或网址',
  'Enter text or URL...': '输入文本或网址…',
  Security: '加密方式',
  None: '无',
  'Network Name (SSID)': '网络名称（SSID）',
  Password: '密码',
  'WiFi password': 'WiFi 密码',
  'Hidden network': '隐藏网络',
  'First Name': '名',
  'Last Name': '姓',
  Company: '公司',
  'Job Title': '职位',
  Developer: '开发工程师',
  Website: '网站',
  'Email Address': '电子邮箱',
  Subject: '主题',
  'Email subject': '邮件主题',
  Body: '正文',
  'Email body...': '邮件正文…',
  'Phone Number': '电话号码',
  Message: '消息',
  'Your message...': '输入消息…',
  'Download PNG': '下载 PNG',
  'Download SVG': '下载 SVG',
  'This content could not be drawn as a QR code. Try shortening it, or lower the error correction level in Fine-tune.':
    '无法为这些内容生成二维码。请缩短内容，或在微调中降低纠错等级。',
  'Drawing your QR code…': '正在生成二维码…',
  'Scan with your phone camera to test': '请用手机相机扫描测试',
  'Downloads are disabled until color contrast is improved.': '提高颜色对比度后才能下载。',
  'Enter content to generate a QR code': '输入内容即可生成二维码',
  'Loading background removal runtime': '正在加载抠图运行环境',
  'Enter a color like #ff7a45.': '请输入类似 #ff7a45 的颜色值。',
  'Background removal was canceled.': '已取消抠图。',
  'Image processing failed. Please try another file.': '图片处理失败，请尝试其他文件。',
  'Background removal could not finish. On first use, check your connection and available device memory, then retry.':
    '未能完成抠图。首次使用时，请检查网络连接与设备可用内存后重试。',
  Transparent: '透明',
  'Transparent · PNG alpha': '透明 · PNG 透明通道',
  'Original preview': '原图预览',
  White: '白色',
  Blue: '蓝色',
  Red: '红色',
  Dark: '深色',
  Black: '黑色',
  'Pick what goes behind the cutout. Choosing one never starts the AI model — open Fine-tune for any other color.':
    '选择抠图后的背景。切换背景不会启动 AI 模型；其他颜色可在微调中设置。',
  'Custom background color': '自定义背景色',
  'Any color, including ones the presets above do not offer. Picking one clears the preset selection.':
    '可设置任意颜色，包括预设中没有的颜色。设置后会清除预设选中状态。',
  'Hex value': '十六进制颜色值',
  'Press Enter or leave the field to apply it.': '按回车或离开输入框即可应用。',
  'Removing the background in your browser…': '正在浏览器中移除背景…',
  'Painting the background in your browser…': '正在浏览器中绘制背景…',
  'Nothing is uploaded. The background above applies as soon as there is a result; removal itself is a separate step and usually takes a few seconds to half a minute.':
    '图片内容不会上传。生成结果后，上方背景设置会立即生效；抠图需单独启动，通常需要几秒到半分钟。',
  'Processing...': '处理中…',
  'Process Again': '重新处理',
  'Remove Background': '移除背景',
  Cancel: '取消',
  'First use downloads a sizable AI model and requires a network connection. Later offline use depends on whether your browser keeps that model cached. Processing speed and maximum image size depend on device memory.':
    '首次使用需联网下载较大的 AI 模型。之后能否离线使用取决于浏览器是否保留模型缓存。处理速度和最大图片尺寸受设备内存影响。',
  'Painting the background.': '正在绘制背景。',
  Result: '结果',
  Original: '原图',
  Download: '下载',
  'Browser tab': '浏览器标签页',
  'Browser tab and bookmarks': '浏览器标签页与书签',
  'iOS home screen': 'iOS 主屏幕',
  'Android home screen': 'Android 主屏幕',
  'Install prompts and WordPress site icon': '安装提示与 WordPress 网站图标',
  'Website and app icons': '网站与应用图标',
  'Website only': '仅网站',
  'Browser tab only': '仅浏览器标签页',
  'Largest icon only': '仅最大图标',
  'No sizes selected': '尚未选择尺寸',
  Source: '原图',
  Remove: '移除',
  'Which sizes do you need?': '需要哪些尺寸？',
  'Choose a set and the icons follow. Every size is still listed below.':
    '选择一组尺寸即可生成图标。下方仍可逐项调整。',
  'Sizes to generate': '生成尺寸',
  'site.webmanifest is included whenever a 192 or 512 px icon is selected.':
    '选择 192 或 512 像素图标时，会同时生成 site.webmanifest。',
  'Rendering icons in your browser…': '正在浏览器中生成图标…',
  'Select at least one size to generate icons.': '请至少选择一个尺寸来生成图标。',
  'Results follow the settings above. Nothing is uploaded.':
    '结果随上方设置更新。文件内容不会上传。',
  'Non-square images are centered with transparent padding. This tool creates PNG icons, not an .ico file.':
    '非正方形图片会居中放置，并填充透明边距。本工具生成 PNG 图标，不生成 .ico 文件。',
  'Generating favicon files.': '正在生成网站图标文件。',
  'Generated Icons': '已生成的图标',
  icon: '个图标',
  'Packaging…': '正在打包…',
  'Download ZIP': '下载 ZIP',
  'HTML Code': 'HTML 代码',
  'Add this to your': '将以下代码添加到',
  'section:': '区域：',
  'Copy HTML': '复制 HTML',
  'The input media could not be inspected.': '无法读取输入媒体的信息。',
  'No decodable animation frames were found.': '未找到可解码的动画帧。',
  'Choose one file to begin.': '选择一个文件开始。',
  'This is a static PNG. Use the Image Converter for static images.':
    '这是一张静态 PNG，请使用图片格式转换工具。',
  'This is a static WebP. Use the Image Converter for static images.':
    '这是一张静态 WebP，请使用图片格式转换工具。',
  'Animated WebP input is not supported here.': '此环境不支持输入动态 WebP。',
  'Ready. The conversion engine will load only when you start.':
    '已就绪。开始转换时才会加载转换引擎。',
  'This file is not supported.': '不支持此文件。',
  'Downloading the local conversion engine (about 10 MB on first use)…':
    '正在下载本地转换引擎（首次约 10 MB）…',
  'Decoding animated WebP frames…': '正在解码动态 WebP 帧…',
  'Inspecting the input…': '正在读取输入信息…',
  'The media codec could not complete this conversion.': '媒体编解码器未能完成转换。',
  'The conversion produced an invalid result.': '转换生成的结果无效。',
  'Conversion cancelled.': '已取消转换。',
  'The file could not be converted in this browser.': '此浏览器无法转换该文件。',
  'Conversion failed. Adjust the settings or choose another file.':
    '转换失败，请调整设置或选择其他文件。',
  'a video or animated image': '一个视频或动图',
  'MP4, WebM, common MOV, GIF, animated WebP, or APNG. One file at a time.':
    '支持 MP4、WebM、常见 MOV、GIF、动态 WebP 和 APNG，每次一个文件。',
  'Animated WebP input is unavailable in this browser. Video, GIF, and APNG input still work, and all three output formats remain available.':
    '此浏览器不支持输入动态 WebP。仍可输入视频、GIF 和 APNG，并可使用全部三种输出格式。',
  'static PNG': '静态 PNG',
  'static WebP': '静态 WebP',
  'Open Image Converter': '打开图片格式转换',
  'What is the animation for?': '动图用于什么场景？',
  'Pick an output and the size, frame rate and quality follow. Every value stays editable below.':
    '选择输出格式后会自动设置尺寸、帧率和质量，下方仍可逐项调整。',
  'Output format': '输出格式',
  'The same choice as the chips above.': '与上方快捷选项相同。',
  'Size and frame rate': '尺寸与帧率',
  'Fewer pixels and fewer frames make a smaller file and a faster conversion.':
    '减少像素和帧数可减小文件并加快转换。',
  'Start time (seconds)': '开始时间（秒）',
  'Maximum duration (seconds)': '最大时长（秒）',
  'Loop count': '循环次数',
  Forever: '无限循环',
  'Play once': '播放一次',
  Twice: '两次',
  'Three times': '三次',
  'Higher keeps more detail and makes a larger file.': '较高质量会保留更多细节，同时增大文件。',
  'Up to': '最多',
  frames: '帧',
  source: '源文件',
  'APNG keeps full-color transparency but can be substantially larger.':
    'APNG 保留全彩透明效果，但文件可能明显增大。',
  'Adjust the size, frame rate, or duration above.': '请调整上方尺寸、帧率或时长。',
  'Converting…': '转换中…',
  'Converting on this device. Keep the tab open.': '正在此设备上转换，请保持标签页打开。',
  'Size and frame count follow the settings. Converting stays a separate step: it runs on this device and takes seconds to minutes.':
    '尺寸和帧数随设置更新。转换需要单独启动，在此设备上运行，耗时可能为几秒到几分钟。',
  'Conversion progress': '转换进度',
  The: '该',
  'result is ready to download, but its inline preview was skipped to avoid another large memory allocation.':
    '结果已可下载。为避免再次分配大量内存，已跳过内嵌预览。',
  'Animated WebP': '动态 WebP',
  Small: '较小',
  Balanced: '均衡',
  High: '较高',
  'Send in chat, forums, and anywhere that only takes GIF': '聊天、论坛及仅支持 GIF 的场景',
  'Web pages and docs, usually the smallest file': '网页与文档，通常文件最小',
  'Full color and transparency, usually the largest file': '全彩与透明效果，通常文件最大',
  'Fit to image': '适应图片',
  'Page matches the image': '页面与图片尺寸一致',
  Landscape: '横向',
  Portrait: '纵向',
  'No valid images were available to create the PDF.': '没有可用于创建 PDF 的有效图片。',
  'The browser did not create a valid PDF Blob.': '浏览器未能创建有效的 PDF 文件。',
  'PDF conversion failed.': 'PDF 转换失败。',
  'Creating PDF.': '正在创建 PDF。',
  'Page size': '页面尺寸',
  'Every page takes this size. Orientation and margin are in Fine-tune below, and the PDF follows all of them.':
    '所有页面使用此尺寸。下方微调可设置方向和边距，PDF 会随设置更新。',
  Orientation: '方向',
  'Which way round a fixed page size is turned.': '固定页面尺寸的横向或纵向排列。',
  'The blank border automatic placement leaves around the page. An image you have moved or resized yourself stays where you put it.':
    '自动排版在页面四周保留的空白边距。已手动移动或缩放的图片会保留原位置。',
  'Selected:': '已选择：',
  'Reset layout': '重置排版',
  'Clear all': '全部清除',
  'Building the PDF in your browser…': '正在浏览器中生成 PDF…',
  'The PDF follows the pages above. Nothing is uploaded.': 'PDF 随上方页面更新。图片内容不会上传。',
  'The exported PDF matches the preview above. Transparent pixels are placed on white before PDF encoding.':
    '导出的 PDF 与上方预览一致。编码 PDF 前，透明像素会填充为白色。',
  page: '页',
  'Download PDF': '下载 PDF',
  'Start new PDF': '新建 PDF',
  'Download it before starting a new PDF — the file is held in this tab only.':
    '请先下载再新建 PDF，文件仅保存在当前标签页中。',
  'A PDF page preview could not be created.': '无法创建 PDF 页面预览。',
  'Choose one PDF to begin.': '选择一个 PDF 开始。',
  'Reading the PDF locally…': '正在本地读取 PDF…',
  'The file does not contain a valid PDF header.': '文件不包含有效的 PDF 标识。',
  'This PDF could not be opened in the browser.': '无法在浏览器中打开此 PDF。',
  'PDF loading failed.': 'PDF 加载失败。',
  'Enter a valid page range.': '请输入有效的页码范围。',
  'The selected PDF pages could not be exported.': '无法导出所选 PDF 页面。',
  'Building the combined PDF in your browser…': '正在浏览器中合并 PDF…',
  'Building one PDF per page in your browser…': '正在浏览器中将每页生成为单独 PDF…',
  'Select at least one page and the download appears here.': '至少选择一页，即可在此下载。',
  'The download follows the pages above. Nothing is uploaded.':
    '下载文件随上方页面更新。文件内容不会上传。',
  'a PDF': '一个 PDF',
  'Choose another PDF': '选择其他 PDF',
  'Select page range': '选择页码范围',
  'Example: 1-3, 5, 8-10': '例如：1-3, 5, 8-10',
  Apply: '应用',
  'Select all': '全选',
  'Clear selection': '清除选择',
  of: '/',
  'pages selected. Page ranges use the current displayed order. Use the controls on each page to rotate, move, or remove it.':
    '页已选中。页码范围按当前显示顺序计算，可使用各页控件旋转、移动或移除页面。',
  Page: '页',
  'Original page': '原始页码',
  'How should the pages come out?': '如何导出页面？',
  'The download rebuilds itself whenever you change the selection, order, or rotation.':
    '修改选择、顺序或旋转角度后，会自动重新生成下载文件。',
  'Moved to a page of its own.': '已移至单独页面。',
  'Drop here as its own page': '拖到此处单独成页',
  'New page': '新页面',
  'Page layout': '页面排版',
  'Drag an image to move it and drag a corner to resize. Drop it on another page to combine the two, or drop it in the space between pages to give it a page of its own. With an image focused: arrows move, Alt+arrows resize,':
    '拖动图片可移动，拖动角点可缩放。拖到另一页可合并，拖到页间空隙可单独成页。图片获得焦点时：方向键移动，Alt+方向键缩放，',
  'rotate, Ctrl+arrows reorder, Alt+PageUp / PageDown combine onto the previous or next page, Alt+Enter splits it onto a new page.':
    '旋转，Ctrl+方向键调整顺序，Alt+PageUp / PageDown 合并到上一页或下一页，Alt+Enter 拆分为新页。',
  'Rotate left': '向左旋转',
  'Rotate right': '向右旋转',
  'Fit page': '适应页面',
  'Fill page': '填满页面',
  'Actual size': '实际尺寸',
  'Move to new page': '移至新页面',
  'Any width, height, and DPI you enter': '自行输入宽度、高度和 DPI',
  '4×6 sheet': '4×6 英寸打印页',
  'A4 sheet': 'A4 打印页',
  'Preparing your photo and print sheet.': '正在生成照片与打印排版。',
  'What is the photo for?': '照片用于什么证件？',
  'Choose a document and the size follows. Every exact value is still below.':
    '选择证件类型即可设置尺寸，下方仍可调整每个数值。',
  'Digital photo output:': '电子照片输出：',
  at: '，',
  'DPI. The print sheet is a PNG; choose matching paper and scaling settings in your print dialog.':
    'DPI。打印排版为 PNG 图片，请在打印对话框中选择对应纸张和缩放设置。',
  'Enter positive width, height, and DPI values.': '宽度、高度和 DPI 必须为正数。',
  'Rendering in your browser…': '正在浏览器中生成…',
  'Both files follow the frame and the settings above. Nothing is uploaded.':
    '两个文件均随取景框和上方设置更新。图片内容不会上传。',
  'Choose another photo': '选择其他照片',
  'Prepared files': '已生成的文件',
  'ID photo options': '证件照设置',
  Unit: '单位',
  Pixels: '像素',
  Millimetres: '毫米',
  Inches: '英寸',
  Width: '宽度',
  Height: '高度',
  'Download format': '下载格式',
  'JPG quality': 'JPG 质量',
  'Print sheet': '打印排版',
  '4 × 6 inches': '4 × 6 英寸',
  'Print margin (mm)': '打印边距（毫米）',
  'Print gap (mm)': '照片间距（毫米）',
  'Include cut lines on print sheet': '在打印排版中显示裁切线',
  'Photo positioning': '照片定位',
  'Position the photo. Use arrow keys to move it; use plus and minus to zoom.':
    '调整照片位置。使用方向键移动，加减键缩放。',
  'Original positioned for the selected ID size': '按所选证件照尺寸定位的原图',
  'Drag to position. Use the buttons or + / − to zoom; arrow keys move. Lines are manual framing guides, not face detection.':
    '拖动可定位，使用按钮或 + / − 缩放，方向键移动。线条仅用于手动取景，不会检测人脸。',
  'Zoom out': '缩小',
  'Zoom in': '放大',
  'Custom ID photo': '自定义证件照',
  'US passport print size reference': '美国护照打印尺寸参考',
  'UK passport paper size reference': '英国护照纸质尺寸参考',
  'Check the receiving authority requirements before using the exported photo.':
    '使用导出照片前，请核对接收机构的要求。',
  'The U.S. Department of State requires an original, unedited photo. This preset is a size reference and does not guarantee acceptance.':
    '美国国务院要求提供未经编辑的原始照片。此预设仅作尺寸参考，不保证获准使用。',
  'UK passport photos must be unaltered. This preset only provides paper size and does not guarantee acceptance.':
    '英国护照照片不得修改。此预设仅提供纸质尺寸参考，不保证获准使用。',
};

export function translateOther(value: string): string {
  if (messages[value]) return messages[value];
  const trimmed = value.trim();
  if (trimmed !== value && trimmed) {
    return value.replace(trimmed, () => translateOther(trimmed));
  }
  const rules: [RegExp, (...captures: string[]) => string][] = [
    [
      /^Background removal stopped because the model made no progress for too long \(last step: (.+), silent for (\d+)s, (\d+) threads?\)\.$/s,
      (stage, seconds, threads) =>
        `抠图模型长时间没有进展，任务已停止。最后步骤：${stage}；已等待 ${seconds} 秒；线程数：${threads}。请检查网络连接和设备可用内存后重试。`,
    ],
    [
      /^(Width|Height|Length|Paper width|Paper height|Photo width|Photo height) must be greater than zero\.$/,
      (label) =>
        `${({ Width: '宽度', Height: '高度', Length: '长度', 'Paper width': '纸张宽度', 'Paper height': '纸张高度', 'Photo width': '照片宽度', 'Photo height': '照片高度' } as Record<string, string>)[label]}必须大于零。`,
    ],
    [/^Back to the (.+) preset$/, (label) => `恢复“${translateOther(label)}”预设`],
    [/^Back to the (.+) set$/, (label) => `恢复“${translateOther(label)}”尺寸组`],
    [/^Back to the (.+) background$/, (label) => `恢复“${translateOther(label)}”背景`],
    [
      /^Back to this page's setup · (.+)$/,
      (setup) => `恢复本页初始设置 · ${translateOther(setup)}`,
    ],
    [/^(.+) · no margin$/, (size) => `${translateOther(size)} · 无边距`],
    [
      /^(.+) · (Landscape|Portrait) · (.+)mm margin$/,
      (size, facing, margin) =>
        `${translateOther(size)} · ${translateOther(facing)} · ${margin} 毫米边距`,
    ],
    [/^Margin: (.+)mm$/, (margin) => `边距：${margin} 毫米`],
    [
      /^(Transparent|White|Red|Blue|Green) · (.+)$/,
      (label, color) => `${translateOther(label)} · ${color}`,
    ],
    [/^Custom · (.+)$/, (color) => `自定义 · ${color}`],
    [/^Remove (?!page \d+$)(.+)$/s, (name) => `移除 ${name}`],
    [/^(.+) preview$/s, (name) => `${name} 预览`],
    [/^(\d+) icons? · (.+)$/, (count, sizes) => `${count} 个图标 · ${sizes}`],
    [
      /^Rendered (\d+) icons? in your browser in (.+)s\. Nothing was uploaded\.$/,
      (count, seconds) => `已在浏览器中生成 ${count} 个图标，用时 ${seconds} 秒。图片内容未上传。`,
    ],
    [
      /^Removed in your browser in (.+)s — nothing was uploaded\. Changing the background above repaints this result without running the model again\.$/,
      (seconds) =>
        `已在浏览器中完成抠图，用时 ${seconds} 秒，图片内容未上传。更换上方背景仅重新绘制结果，不会再次运行模型。`,
    ],
    [/^Creating (.+)…$/, (format) => `正在生成 ${format}…`],
    [/^Create (.+)$/, (format) => `生成 ${format}`],
    [/^Finished in (.+) seconds\.$/, (seconds) => `已完成，用时 ${seconds} 秒。`],
    [
      /^Created on this device in (.+)s\. Your media file was not uploaded\.$/,
      (seconds) => `已在此设备上完成，用时 ${seconds} 秒。媒体文件未上传。`,
    ],
    [/^About (.+)% · (.+)s elapsed$/, (percent, seconds) => `约 ${percent}% · 已用 ${seconds} 秒`],
    [/^(Small|Balanced|High) · (.+)$/, (preset, rest) => `${translateOther(preset)} · ${rest}`],
    [/^(.+) output$/, (dimensions) => `${dimensions} 输出`],
    [/^(.+)px maximum side$/, (pixels) => `最长边 ${pixels} 像素`],
    [
      /^Up to (.+) seconds, and shortened when the source ends first\.$/,
      (seconds) => `最多 ${seconds} 秒，源文件提前结束时会相应缩短。`,
    ],
    [/^WebP quality: (.+)$/, (quality) => `WebP 质量：${quality}`],
    [/^This file exceeds the (.+) MiB limit\.$/, (size) => `此文件超过 ${size} MiB 的限制。`],
    [
      /^Choose a clip between 0 and (.+) seconds\.$/,
      (seconds) => `请选择 0 到 ${seconds} 秒之间的片段。`,
    ],
    [
      /^These settings would create more than (.+) frames\.$/,
      (frames) => `当前设置将生成超过 ${frames} 帧。`,
    ],
    [
      /^This animated WebP exceeds the (.+)-frame input limit\.$/,
      (frames) => `此动态 WebP 超过 ${frames} 帧的输入限制。`,
    ],
    [/^The server returned (.+)\.$/, (status) => `服务器返回状态码 ${status}。`],
    [
      /^Built (\d+) pages? in your browser in (.+)s\. Nothing was uploaded\.$/,
      (count, seconds) => `已在浏览器中生成 ${count} 页，用时 ${seconds} 秒。图片内容未上传。`,
    ],
    [
      /^Photo rendered in (.+) and the print sheet in (.+), both in your browser\. Nothing was uploaded\.$/,
      (photo, sheet) =>
        `照片生成用时 ${photo}，打印排版用时 ${sheet}，均在浏览器中完成。图片内容未上传。`,
    ],
    [/^Rendering (\d+) page previews…$/, (count) => `正在生成 ${count} 页预览…`],
    [
      /^(\d+) pages ready\. Select, reorder, rotate, or remove pages\.$/,
      (count) => `${count} 页已就绪，可选择、排序、旋转或移除页面。`,
    ],
    [
      /^This PDF has (\d+) pages\. This device can process up to (\d+) pages at once\.$/,
      (count, limit) => `此 PDF 共 ${count} 页，此设备一次最多处理 ${limit} 页。`,
    ],
    [
      /^This PDF exceeds the (.+) MiB limit for this device\.$/,
      (size) => `此 PDF 超过本设备 ${size} MiB 的限制。`,
    ],
    [
      /^“(.+)” is not a valid page or page range\.$/,
      (token) => `“${token}”不是有效的页码或页码范围。`,
    ],
    [
      /^Page range “(.+)” must stay between 1 and (\d+)\.$/,
      (token, count) => `页码范围“${token}”必须在 1 到 ${count} 之间。`,
    ],
    [
      /^Page range “(.+)” must run from lower to higher\.$/,
      (token) => `页码范围“${token}”必须从小到大。`,
    ],
    [
      /^Built in your browser in (.+) from (\d+) pages?\. The download follows the pages above; nothing was uploaded\.$/,
      (time, count) =>
        `已在浏览器中处理 ${count} 页，用时 ${time}。下载文件随上方页面更新，文件内容未上传。`,
    ],
    [/^Preview of original PDF page (\d+)$/, (page) => `原 PDF 第 ${page} 页预览`],
    [
      /^Move page (\d+) (earlier|later)$/,
      (page, direction) => `${direction === 'earlier' ? '前移' : '后移'}第 ${page} 页`,
    ],
    [
      /^Rotate page (\d+) (left|right)$/,
      (page, direction) => `向${direction === 'left' ? '左' : '右'}旋转第 ${page} 页`,
    ],
    [/^Remove page (\d+)$/, (page) => `移除第 ${page} 页`],
    [/^Combined onto page (\d+)\.$/, (page) => `已合并到第 ${page} 页。`],
    [/^Moved to a new page (\d+)\.$/, (page) => `已移至新页面 ${page}。`],
    [/^Page moved to position (\d+)\.$/, (page) => `页面已移至第 ${page} 位。`],
    [
      /^(.+) on page (\d+)\. Arrows move, Alt plus arrows resize, brackets rotate\.$/s,
      (name, page) => `${name}，第 ${page} 页。方向键移动，Alt 加方向键缩放，方括号键旋转。`,
    ],
  ];
  for (const [pattern, replacement] of rules) {
    const match = value.match(pattern);
    if (match) return replacement(...match.slice(1));
  }
  // Summaries combine independent labels with measured values.
  if (value.includes(' · '))
    return value
      .split(' · ')
      .map(
        (part) => messages[part] ?? part.replace(/^(.+)s from (.+)s$/, '从 $2 秒开始，时长 $1 秒')
      )
      .join(' · ');
  return localizeErrorMessage(value, 'zh');
}

export function useOtherI18n() {
  const { locale } = useI18n();
  const tr = (value: string): string => (locale === 'zh' ? translateOther(value) : value);
  const node = (value: ReactNode): ReactNode => (typeof value === 'string' ? tr(value) : value);
  const errorText = (value: string | null | undefined): string => {
    if (!value) return '';
    const translated = tr(value);
    return locale === 'zh' && translated === value && /[A-Za-z]/.test(value)
      ? `未能完成处理，请调整设置或选择其他文件后重试。技术详情：${value}`
      : translated;
  };
  const choices = <T extends { label: string; hint?: string }>(values: readonly T[]): T[] =>
    values.map((value) => ({
      ...value,
      label: tr(value.label),
      ...(value.hint === undefined ? {} : { hint: tr(value.hint) }),
    }));
  return { tr, node, choices, locale, errorText };
}
