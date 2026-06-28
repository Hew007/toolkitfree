import { useCallback, useEffect, useRef, useState } from 'react';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  BatchArchiveCancelledError,
  calculateBatchTotals,
  createBatchArchive,
  type BatchFailureResult,
  type BatchSuccessResult,
} from '../lib/batch-results';
import {
  downloadUrl,
  formatSize,
} from '../lib/image-processing';

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
  const [status, setStatus] = useState<ArchiveStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const objectUrls = useObjectUrlRegistry();
  const totals = calculateBatchTotals(successes, failures);

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
        setMessage('The ZIP file could not be created. Your individual downloads are still available.');
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [archiveName, objectUrls, status, successes]);

  const handleCancel = () => {
    controllerRef.current?.abort();
  };

  if (totals.successCount === 0 && totals.failureCount === 0) return null;

  const sizeChange = totals.originalSize > 0
    ? Math.round(((totals.outputSize - totals.originalSize) / totals.originalSize) * 100)
    : 0;

  return (
    <section
      aria-label="Batch results"
      data-batch-success-count={totals.successCount}
      data-batch-failure-count={totals.failureCount}
      style={{ marginTop: '1.5rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.125rem' }}>
            Results: {totals.successCount} succeeded, {totals.failureCount} failed
          </h3>
          {totals.successCount > 0 && (
            <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {formatSize(totals.originalSize)} to {formatSize(totals.outputSize)}
              {sizeChange !== 0 && ` (${sizeChange > 0 ? '+' : ''}${sizeChange}%)`}
            </div>
          )}
        </div>

        {status === 'generating' ? (
          <button type="button" className="btn btn-secondary" onClick={handleCancel}>
            Cancel ZIP ({Math.round(progress)}%)
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDownloadAll}
            disabled={totals.successCount === 0}
            data-batch-download
          >
            {status === 'error' || status === 'cancelled' ? 'Retry ZIP download' : 'Download all as ZIP'}
          </button>
        )}
      </div>

      {status === 'generating' && (
        <progress
          aria-label="ZIP creation progress"
          value={progress}
          max={100}
          style={{ width: '100%', marginBottom: '1rem' }}
        />
      )}

      {message && (
        <div className={status === 'error' ? 'status status-error' : 'status'} role={status === 'error' ? 'alert' : 'status'} aria-live="polite" data-batch-archive-status={status}>
          {message}
        </div>
      )}

      {failures.length > 0 && (
        <div className="status status-error" role="alert" style={{ marginBottom: '1rem' }}>
          <strong>{failures.length} file{failures.length === 1 ? '' : 's'} could not be processed:</strong>
          <ul style={{ margin: '0.5rem 0 0 1.25rem' }}>
            {failures.map((failure) => (
              <li key={failure.sourceId}>
                <strong>{failure.name}:</strong> {failure.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
