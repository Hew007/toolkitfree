import type { ImageBudgetAssessment } from '../lib/image-budget';

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
          ? 'This selection is too large to process safely.'
          : 'This selection may use substantial memory.'}
      </strong>
      <ul style={{ margin: '0.5rem 0 0.75rem 1.25rem' }}>
        {assessment.issues.map((issue) => (
          <li key={issue.code}>{issue.message}</li>
        ))}
      </ul>
      <p style={{ marginBottom: '0.75rem' }}>
        Choose fewer files
        {isResizer
          ? ' or use smaller output dimensions'
          : ', use the Image Resizer to shrink large images first'}
        {blocked ? '.' : ', or continue and accept the risk of a slow or unresponsive tab.'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {!blocked && (
          <button type="button" className="btn btn-primary" onClick={onContinue}>
            Continue anyway
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Choose fewer files
        </button>
        {!isResizer && (
          <a className="btn btn-secondary" href="/tools/image-resizer">
            Resize images first
          </a>
        )}
      </div>
    </div>
  );
}
