import { useCallback, useEffect, useRef, useState } from 'react';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  BatchArchiveCancelledError,
  calculateBatchTotals,
  createBatchArchive,
  type BatchFailureResult,
  type BatchSuccessResult,
} from '../lib/batch-results';
import { downloadUrl, formatSize } from '../lib/image-processing';
import { useI18n } from '../i18n/react';
import { localizeErrorMessage } from '../i18n/errors';

interface BatchResultsSummaryProps {
  successes: readonly BatchSuccessResult[];
  failures: readonly BatchFailureResult[];
  archiveName: string;
}

type ArchiveStatus = 'idle' | 'generating' | 'cancelled' | 'error';

export default function BatchResultsSummary({
  successes,
  failures,
  archiveName,
}: BatchResultsSummaryProps) {
  const { locale, t } = useI18n();
  const [status, setStatus] = useState<ArchiveStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const objectUrls = useObjectUrlRegistry();
  const totals = calculateBatchTotals(successes, failures);

  // Resets whenever the result set is replaced, abandoning any archive still being
  // built from the previous one.
  //
  // This keys on the arrays' identity, which makes the caller's contract matter:
  // pass a reference that changes exactly when the results change. State holds
  // that naturally; a `.map()` written inline in the JSX does not — it is a new
  // array on every render, so a tool whose results follow its controls would
  // cancel its own download on every frame of a drag. Memoize anything derived.
  //
  // Identity rather than a content signature on purpose: two runs can produce the
  // same filenames from different bytes — re-encoding the same batch at another
  // quality does exactly that — and a signature would then miss a change that
  // matters and archive stale blobs.
  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    objectUrls.revokePrefix('batch-archive:');
    setStatus('idle');
    setProgress(0);
    setMessage(null);
  }, [successes, failures, objectUrls]);

  const handleDownloadAll = useCallback(async () => {
    if (successes.length === 0 || status === 'generating') return;

    const controller = new AbortController();
    controllerRef.current = controller;
    objectUrls.revokePrefix('batch-archive:');
    setStatus('generating');
    setProgress(0);
    setMessage(null);

    try {
      const blob = await createBatchArchive(successes, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      if (controller.signal.aborted) throw new BatchArchiveCancelledError();

      const url = objectUrls.replace('batch-archive:current', blob);
      downloadUrl(url, archiveName);
      setProgress(100);
      setStatus('idle');
    } catch (error) {
      if (error instanceof BatchArchiveCancelledError || controller.signal.aborted) {
        setStatus('cancelled');
        setMessage('ZIP creation was cancelled. You can try again.');
      } else {
        setStatus('error');
        setMessage(
          'The ZIP file could not be created. Your individual downloads are still available.'
        );
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [archiveName, objectUrls, status, successes]);

  const handleCancel = () => {
    controllerRef.current?.abort();
  };

  if (totals.successCount === 0 && totals.failureCount === 0) return null;

  const sizeChange =
    totals.originalSize > 0
      ? Math.round(((totals.outputSize - totals.originalSize) / totals.originalSize) * 100)
      : 0;

  return (
    <section
      aria-label={t('Batch results', '批量处理结果')}
      data-batch-success-count={totals.successCount}
      data-batch-failure-count={totals.failureCount}
      style={{ marginTop: '1.5rem' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.125rem' }}>
            {t(
              `Results: ${totals.successCount} succeeded, ${totals.failureCount} failed`,
              `处理结果：成功 ${totals.successCount} 个，失败 ${totals.failureCount} 个`
            )}
          </h3>
          {totals.successCount > 0 && (
            <div style={{ color: '#6b665c', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {formatSize(totals.originalSize)} {t('to', '→')} {formatSize(totals.outputSize)}
              {sizeChange !== 0 && ` (${sizeChange > 0 ? '+' : ''}${sizeChange}%)`}
            </div>
          )}
        </div>

        {status === 'generating' ? (
          <button type="button" className="btn btn-secondary" onClick={handleCancel}>
            {t(`Cancel ZIP (${Math.round(progress)}%)`, `取消生成 ZIP（${Math.round(progress)}%）`)}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDownloadAll}
            disabled={totals.successCount === 0}
            data-batch-download
          >
            {status === 'error' || status === 'cancelled'
              ? t('Retry ZIP download', '重试下载 ZIP')
              : t('Download all as ZIP', '全部下载为 ZIP')}
          </button>
        )}
      </div>

      {status === 'generating' && (
        <progress
          aria-label={t('ZIP creation progress', 'ZIP 生成进度')}
          value={progress}
          max={100}
          style={{ width: '100%', marginBottom: '1rem' }}
        />
      )}

      {message && (
        <div
          className={status === 'error' ? 'status status-error' : 'status'}
          role={status === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          data-batch-archive-status={status}
        >
          {localizeErrorMessage(message, locale)}
        </div>
      )}

      {failures.length > 0 && (
        <div className="status status-error" role="alert" style={{ marginBottom: '1rem' }}>
          <strong>
            {t(
              `${failures.length} file${failures.length === 1 ? '' : 's'} could not be processed:`,
              `${failures.length} 个文件处理失败：`
            )}
          </strong>
          <ul style={{ margin: '0.5rem 0 0 1.25rem' }}>
            {failures.map((failure) => (
              <li key={failure.sourceId}>
                <strong>{failure.name}:</strong> {localizeErrorMessage(failure.message, locale)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
