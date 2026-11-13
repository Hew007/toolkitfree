import type { FaqItem } from '../data/content-types';
import { chineseVariants } from './pages.ts';

export const chineseVariantFaq: Record<string, FaqItem[]> = {
  'jpg-to-png': [
    {
      question: 'JPG 转成 PNG 后为什么文件反而更大？',
      answer:
        'JPG 已经使用有损编码压缩过照片，PNG 要无损保存解码后的像素，往往需要更多空间。PNG 不会恢复原来被 JPG 丢弃的细节。',
    },
  ],
  'png-to-jpg': [
    {
      question: 'PNG 的透明背景转 JPG 后会怎样？',
      answer:
        'JPG 不支持透明通道，透明区域需要被合成为不透明背景。请在结果预览中检查背景颜色，尤其是白色标志和半透明边缘。',
    },
  ],
  'webp-to-jpg': [
    {
      question: '为什么要把 WebP 改成 JPG？',
      answer:
        '某些旧软件或上传表单不接受 WebP。转换为 JPG 可以满足这些入口的格式要求，但透明度会丢失，有损重新编码也可能改变细节。',
    },
  ],
  'jpg-to-webp': [
    {
      question: 'JPG 转 WebP 一定能节省空间吗？',
      answer:
        '不一定。原图已经压缩的程度、图像内容和所选质量都会影响输出。比较真实文件大小，只有质量与体积符合用途时再采用新文件。',
    },
  ],
  'png-to-webp': [
    {
      question: 'PNG 转 WebP 能保留透明边缘吗？',
      answer:
        'WebP 支持透明通道，但编码设置可能改变图像颜色和细节。请放大检查标志、文字和半透明边缘，不要把格式转换理解为像素完全不变。',
    },
  ],
  'webp-to-png': [
    {
      question: 'WebP 转 PNG 是无损恢复吗？',
      answer:
        'PNG 无损保存浏览器解码得到的像素，但如果源 WebP 已有有损压缩，之前丢失的信息不能恢复。转换主要解决格式兼容和后续保存需求。',
    },
  ],
  'heic-to-jpg': [
    {
      question: '为什么这里没有 HEIC 转换按钮？',
      answer:
        '本工具尚未实现 HEIC 解码，不会展示无法兑现的转换入口。可以先在相册或支持 HEIC 的应用中导出 JPG，再使用本站的尺寸和压缩工具。',
    },
  ],
  'tiff-to-jpg': [
    {
      question: '能打开多页 TIFF 吗？',
      answer:
        '不能。当前工具没有 TIFF 解码器，也不支持多页 TIFF 提取。请使用支持该格式的软件先导出所需页面为 JPG 或 PNG。',
    },
  ],
  'png-to-gif': [
    {
      question: '能把一张 PNG 直接导出为 GIF 吗？',
      answer:
        '当前图片转换器没有 GIF 编码器，只输出 JPG、PNG 和 WebP。视频转动画工具提供的是视频到 GIF 的流程，不是静态 PNG 的替代入口。',
    },
  ],
  'gif-to-png': [
    {
      question: 'GIF 转 PNG 后动画还在吗？',
      answer:
        '不在。这里将浏览器解码出的静态帧导出为 PNG，不会提取所有帧，也不输出 APNG。需要动画时应使用合适的动画处理流程。',
    },
  ],
  'bmp-to-png': [
    {
      question: '为什么有的 BMP 无法转换？',
      answer:
        'BMP 有多种位深和编码变体，当前流程依赖浏览器解码。浏览器不支持的文件会读取失败，改扩展名不能解决编码兼容问题。',
    },
  ],
  'svg-to-png': [
    {
      question: 'SVG 中的字体和外链图片一定会显示吗？',
      answer:
        '不一定。外部资源、安全限制和浏览器对 SVG 特性的支持都可能影响渲染。导出前请检查字体、外链图片和滤镜，PNG 输出也不再是可任意缩放的矢量图。',
    },
  ],
  'compress-png': [
    {
      question: 'PNG 质量调低后为什么体积不变？',
      answer:
        '浏览器的 PNG 导出不使用有损质量参数。可以降低最大宽度，或者在能接受像素变化时比较 WebP；重新编码 PNG 本身不保证变小。',
    },
  ],
  'compress-jpg': [
    {
      question: 'JPG 压缩应该选哪个质量值？',
      answer:
        '先比较默认三档结果，再检查人物、文字和细密纹理。没有适用于所有照片的固定质量值；优先选择满足体积限制且视觉可接受的结果。',
    },
  ],
  'compress-for-email': [
    {
      question: '一张图片变小后就一定能发邮件吗？',
      answer:
        '不一定。邮件服务通常限制所有附件合计大小，并可能计入传输编码开销。请检查每个附件与总大小，必要时减少附件数量。',
    },
  ],
  'compress-for-web': [
    {
      question: '网页配图应该保留原始尺寸吗？',
      answer:
        '通常应按实际展示尺寸和像素密度准备，避免无用的大尺寸。文字或截图缩小过多会影响可读性，请在真实展示尺寸下比较。',
    },
  ],
  'compress-for-whatsapp': [
    {
      question: '预先压缩能避免 WhatsApp 再次处理吗？',
      answer:
        '不能保证。本站控制下载文件，聊天平台可能根据发送方式再次压缩或缩放。请在实际发送后检查接收端效果。',
    },
  ],
  'compress-to-100kb': [
    {
      question: '“达到目标”是根据估算还是实际文件判断？',
      answer:
        '根据生成的真实 Blob 大小判断。只有输出不超过 100 KB 目标时才标记达标；有限搜索未达到目标时会明确显示最接近的结果。',
    },
  ],
  'resize-for-instagram': [
    {
      question: 'Instagram 页面默认是帖子还是快拍尺寸？',
      answer:
        '默认是 1080 × 1080 的方形帖子预设。需要 1080 × 1920 快拍时，请在工具中选择相应预设或自定义尺寸，并检查平台预览。',
    },
  ],
  'resize-for-facebook': [
    {
      question: '820 × 312 的封面在手机上会完整显示吗？',
      answer:
        '不能保证。桌面和移动端可能采用不同可见比例，头像也可能遮住部分区域。将重要文字放在中央，并在平台两种视图中检查。',
    },
  ],
  'resize-for-twitter': [
    {
      question: 'X 的头图为什么仍被裁掉一部分？',
      answer:
        '1500 × 500 是本页输出预设，不保证每种设备显示完整边缘。平台界面、头像和屏幕比例都可能改变可见区域，请保留安全边距。',
    },
  ],
  'resize-for-youtube': [
    {
      question: '1280 × 720 的缩略图能自动满足大小限制吗？',
      answer:
        '不能。像素尺寸和文件体积是不同指标。生成后查看文件大小，必要时再压缩，并以 YouTube 当前上传入口的要求为准。',
    },
  ],
  'resize-for-linkedin': [
    {
      question: 'LinkedIn 预设可以直接作为个人背景图吗？',
      answer:
        '本页默认 1200 × 627 是帖子图片预设，个人背景图和公司主页有其他展示比例。请按实际入口调整尺寸，不要混用。',
    },
  ],
  'resize-for-tiktok': [
    {
      question: '竖图中的文字放在哪里更稳妥？',
      answer:
        '1080 × 1920 画面中应给顶部、底部和右侧界面控件留出空间。应用的覆盖区域可能变化，发布前请查看平台实际预览。',
    },
  ],
  'resize-to-1920x1080': [
    {
      question: '非 16:9 的图片怎么避免拉伸？',
      answer:
        '默认精确缩放会改变原图比例。启用保持比例可将图片适配到目标框内；如果必须得到完整的 1920 × 1080 画面，请先按 16:9 裁剪。',
    },
  ],
  'crop-to-square': [
    {
      question: '正方形头像上传后为什么角落消失？',
      answer:
        '工具输出正方形图片，但许多平台按圆形显示头像。将人脸或标志放在中心，为四角留空，并检查圆形预览。',
    },
  ],
  'crop-to-16-9': [
    {
      question: '16:9 裁剪会把图片拉宽吗？',
      answer:
        '裁剪选择一个 16:9 的区域，主要移除选区外内容，不以拉伸代替构图。可拖动和缩放图片以保留主体，下载前检查上下边界。',
    },
  ],
  'crop-to-4-3': [
    {
      question: '4:3 裁剪适合什么图片？',
      answer:
        '它适合希望采用传统相机或演示画面比例的构图。是否适合具体上传入口仍取决于要求；裁剪会去掉选区外的原始内容。',
    },
  ],
  'crop-to-3-2': [
    {
      question: '3:2 裁剪能保证打印为 6 × 4 英寸吗？',
      answer: '3:2 只确定比例，不确定纸张上的物理尺寸。打印时还要设置照片尺寸、缩放和打印机边距。',
    },
  ],
  'free-crop': [
    {
      question: '自由裁剪与固定比例有什么不同？',
      answer:
        '自由裁剪允许独立决定选区形状，适合去掉多余边缘。若平台要求严格的宽高比，应改用固定比例并核对输出尺寸。',
    },
  ],
  'split-into-2': [
    {
      question: '默认是左右分割还是上下分割？',
      answer:
        '本页默认一行两列，生成左右两块。需要上下两块时把行列改为两行一列，也可以拖动分割线改变两块的大小。',
    },
  ],
  'split-into-4': [
    {
      question: '四块图片必须一样大吗？',
      answer:
        '默认两行两列等分。拖动横向或纵向分割线后可得到不同大小的区域，导出前请查看每块预览和尺寸。',
    },
  ],
  'instagram-grid': [
    {
      question: '九宫格应该按什么顺序发布？',
      answer:
        '工具按网格导出图片，但平台主页如何排列取决于发布顺序和当前展示规则。先确认平台排列方向，再安排上传；本站不会自动发布。',
    },
  ],
  'split-for-printing': [
    {
      question: '分块文件包含打印重叠边和裁切标记吗？',
      answer:
        '不包含。本工具导出图片区域，不自动生成纸张排版、重叠区或裁切标记。需要精确拼接时应在打印排版软件中继续设置。',
    },
  ],
  'jpg-to-pdf': [
    {
      question: 'JPG 转 PDF 后文字可以搜索吗？',
      answer:
        '不可以。本工具把图片放入 PDF 页面，不执行 OCR。图片里的文字仍是图像，若需要搜索文字，应另用 OCR 工具。',
    },
  ],
  'png-to-pdf': [
    {
      question: 'PNG 中的透明背景在 PDF 里应该怎么检查？',
      answer:
        '请查看工具预览并打开下载的 PDF，确认透明区域的合成效果。如果需要固定底色，可以先把图片处理为指定背景再生成 PDF。',
    },
  ],
  'image-to-a4-pdf': [
    {
      question: 'A4 页面会把不同尺寸的图片拉伸吗？',
      answer:
        '工具将图片适配到所选纸张与页边距中。输出前检查方向和预览，不同宽高比可能留白；打印时还要核对打印机缩放。',
    },
  ],
  'multiple-images-to-pdf': [
    {
      question: '如何决定合并后的页面顺序？',
      answer:
        '上传后在页面编辑区调整顺序，必要时旋转或移除页面。导出使用编辑区当前页面顺序，下载前请逐页检查。',
    },
  ],
  'image-to-pdf-no-margin': [
    {
      question: '无边距 PDF 就能无边距打印吗？',
      answer:
        '不能保证。PDF 页边距为零和打印机支持无边距是两回事。打印机可能保留不可打印区域或缩放页面，请查看设备设置。',
    },
  ],
  'photo-to-pdf': [
    {
      question: '照片转 PDF 会提高照片的分辨率吗？',
      answer:
        '不会。PDF 只是组织和呈现已有图片的文档格式，不能增加源照片的真实细节。请使用足够清晰的原始照片。',
    },
  ],
  'extract-pages-from-pdf': [
    {
      question: '提取页面后原 PDF 会被修改吗？',
      answer:
        '不会。工具读取原文件并将选中页面复制到新 PDF，原始文件保持不变。新文件不应被视为保留原文档数字签名等文档级特性。',
    },
  ],
  'split-pdf-into-pages': [
    {
      question: '下载得到的是多个文件还是一个压缩包？',
      answer:
        '每个选中页面生成一份独立 PDF，并以一个 ZIP 文件下载。解压后即可逐页使用；未选择的页面不会导出。',
    },
  ],
  'png-to-favicon': [
    {
      question: '透明 PNG 标志适合生成图标吗？',
      answer:
        '适合，但要同时检查浅色和深色背景上的辨识度。输出是多个尺寸的 PNG 与清单文件，不会生成 ICO。',
    },
  ],
  'jpg-to-favicon': [
    {
      question: 'JPG 的白色背景会自动去掉吗？',
      answer:
        '不会。图标生成只缩放和导出，不做背景分割。需要透明底时，请先准备透明 PNG 或使用背景移除工具检查结果。',
    },
  ],
  'logo-to-favicon': [
    {
      question: '复杂标志缩小后看不清怎么办？',
      answer:
        '尝试使用标志中的简化图形，减少细线与小字，并检查 16 和 32 像素预览。大图清晰并不代表小图也可辨认。',
    },
  ],
  'favicon-for-wordpress': [
    {
      question: '下载 512 像素图标后会自动更新 WordPress 吗？',
      answer:
        '不会。你需要在 WordPress 的站点图标设置中上传该 PNG 并保存。主题或缓存可能影响显示，保存后应重新检查网页。',
    },
  ],
  'video-to-webp': [
    {
      question: '动态 WebP 在所有平台都会播放吗？',
      answer:
        '不会保证所有接收平台都支持动画 WebP，有些入口可能只显示静态帧或拒绝上传。请在目标平台实际测试，必要时选择 GIF。',
    },
  ],
  'video-to-apng': [
    {
      question: '为什么 APNG 比视频大很多？',
      answer:
        'APNG 按动画图片方式保存帧，与视频的压缩方式不同。高分辨率、长时段和高帧率会迅速增加体积，适当减少这些设置后再比较。',
    },
  ],
};
for (const slug of Object.keys(chineseVariants)) {
  if (!chineseVariantFaq[slug]?.length) throw new Error(`Missing Chinese FAQ: ${slug}`);
}
