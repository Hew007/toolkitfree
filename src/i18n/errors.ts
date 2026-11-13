import type { Locale } from './locale';

const messages: Record<string, string> = {
  'This file is empty. Choose a non-empty image.': '文件为空，请选择包含内容的图片。',
  'Choose a JPG, PNG, or WebP image.': '请选择 JPG、PNG 或 WebP 图片。',
  'This image could not be opened. It may be damaged or unsupported.':
    '无法打开这张图片，文件可能已损坏或格式不受支持。',
  'This image has invalid dimensions.': '图片尺寸无效。',
  'This image is too large for safe browser processing.':
    '图片过大，无法在浏览器中安全处理，请先缩小尺寸。',
  'Your browser could not start image processing.': '浏览器无法启动图片处理，请尝试重新加载页面。',
  'Your browser could not create the output image.': '浏览器无法生成输出图片，请尝试缩小尺寸。',
  'Your browser does not support the requested output format.':
    '浏览器不支持所选输出格式，请选择其他格式。',
  'This file size is invalid or exceeds the allowed limit.': '文件大小无效或超过允许的上限。',
  'The download could not be started.': '无法开始下载，请重试。',
  'Image processing failed. Please try another file.': '图片处理失败，请尝试其他文件。',
  'ZIP creation was cancelled. You can try again.': '已取消生成 ZIP，你可以重试。',
  'The ZIP file could not be created. Your individual downloads are still available.':
    '无法生成 ZIP 文件，你仍可以逐个下载处理结果。',
};

/** Translate application messages only; never pass user content through this helper. */
export function localizeErrorMessage(message: string, locale: Locale): string {
  if (locale === 'en') return message;
  return messages[message] ?? message;
}
