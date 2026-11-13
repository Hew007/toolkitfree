import type { ImageBudgetAssessment } from '../lib/image-budget';
import { useI18n } from '../i18n/react';
import { localizePath } from '../i18n/locale';

interface InputBudgetNoticeProps {
  assessment: ImageBudgetAssessment;
  onCancel: () => void;
  onContinue: () => void;
}

export default function InputBudgetNotice({
  assessment,
  onCancel,
  onContinue,
}: InputBudgetNoticeProps) {
  const { locale, t } = useI18n();
  const { totals } = assessment;
  const issueMessages = {
    FILE_COUNT: `已选择 ${totals.files} 张图片；减少每批数量可以降低内存压力。`,
    ENCODED_BYTES: `所选文件解码前共 ${(totals.encodedBytes / 1024 / 1024).toFixed(1)} MiB。`,
    PIXELS: `所选图片共约 ${Math.round(totals.knownPixels / 1_000_000)} 百万像素。`,
    WORKING_MEMORY: `本次操作可能需要约 ${(totals.estimatedWorkingBytes / 1024 / 1024).toFixed(1)} MiB 工作内存。`,
    SINGLE_IMAGE_PIXELS: '所选文件中有图片超过 1 亿像素的安全上限。',
  };
  const blocked = assessment.level === 'blocked';
  const isResizer = assessment.profile === 'resizer';
  return (
    <div
      className={`status ${blocked ? 'status-error' : 'status-processing'}`}
      role={blocked ? 'alert' : 'status'}
      data-input-budget={assessment.level}
      style={{ textAlign: 'left' }}
    >
      <strong>
        {blocked
          ? t('This selection is too large to process safely.', '所选文件过大，无法安全处理。')
          : t('This selection may use substantial memory.', '所选文件可能占用大量内存。')}
      </strong>
      <ul style={{ margin: '0.5rem 0 0.75rem 1.25rem' }}>
        {assessment.issues.map((issue) => (
          <li key={issue.code}>{t(issue.message, issueMessages[issue.code])}</li>
        ))}
      </ul>
      <p style={{ marginBottom: '0.75rem' }}>
        {t('Choose fewer files', '请选择更少的文件')}
        {isResizer
          ? t(' or use smaller output dimensions', '，或缩小输出尺寸')
          : t(
              ', use the Image Resizer to shrink large images first',
              '，或先用图片缩放工具缩小大图'
            )}
        {blocked
          ? t('.', '。')
          : t(
              ', or continue and accept the risk of a slow or unresponsive tab.',
              '；也可以继续，但页面可能变慢或无响应。'
            )}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {!blocked && (
          <button type="button" className="btn btn-primary" onClick={onContinue}>
            {t('Continue anyway', '仍然继续')}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t('Choose fewer files', '重新选择更少文件')}
        </button>
        {!isResizer && (
          <a className="btn btn-secondary" href={localizePath('/tools/image-resizer/', locale)}>
            {t('Resize images first', '先缩小图片')}
          </a>
        )}
      </div>
    </div>
  );
}
