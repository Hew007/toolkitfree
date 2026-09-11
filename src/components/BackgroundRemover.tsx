import { useCallback, useEffect, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  downloadUrl,
  formatSize,
  getImageProcessingErrorMessage,
  validateImageFile,
} from '../lib/image-processing';
import {
  BACKGROUND_PRESETS,
  TRANSPARENT_BACKGROUND,
  backgroundLabelColor,
  composeBackgroundColor,
  normalizeHexColor,
  removeBackgroundInWorker,
  type BackgroundProgress,
} from '../lib/background-remover';

const CHECKERBOARD =
  'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)';

interface ProcessedFile {
  name: string;
  size: number;
  url: string;
  /** Background the shown file was composed with, so the preview never lags the swatch. */
  color: string;
}

/**
 * The transparent cutout the model produced, kept so background changes are pure
 * local recompositions. Only the compressed PNG is cached: a decoded bitmap of a
 * large photo costs far more memory than re-decoding it for the rare colour
 * change, and Transparent reuses this blob without decoding at all.
 */
interface ForegroundCache {
  blob: Blob;
  baseName: string;
}

const INITIAL_PROGRESS: BackgroundProgress = {
  stage: 'runtime',
  label: 'Loading background removal runtime',
  percent: null,
};

/**
 * Wall-clock time per stage. Threads only accelerate inference, while decoding
 * and the final full-resolution composition stay single-threaded, so a total on
 * its own cannot say whether a runtime change helped. The breakdown also goes to
 * the console, where it can be compared between runs.
 */
interface StageTiming {
  stage: string;
  ms: number;
}

interface RunTiming {
  totalMs: number;
  stages: StageTiming[];
}

interface TimingProgress {
  startedAt: number;
  stageStartedAt: number;
  stage: string | null;
  stages: StageTiming[];
}

export default function BackgroundRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<BackgroundProgress | null>(null);
  const [result, setResult] = useState<ProcessedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState(TRANSPARENT_BACKGROUND);
  const [hexDraft, setHexDraft] = useState('');
  const [hexError, setHexError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [modelRuns, setModelRuns] = useState(0);
  const [timing, setTiming] = useState<RunTiming | null>(null);
  const timingRef = useRef<TimingProgress | null>(null);
  const objectUrls = useObjectUrlRegistry();
  const processingController = useRef<AbortController | null>(null);
  const foreground = useRef<ForegroundCache | null>(null);
  // Bumped by every recomposition and by anything that invalidates the cutout,
  // so a slower earlier composition can never overwrite a newer background.
  const compositionToken = useRef(0);

  const cancelProcessing = useCallback(() => {
    processingController.current?.abort();
    processingController.current = null;
  }, []);

  const releaseForeground = useCallback(() => {
    compositionToken.current += 1;
    foreground.current = null;
    setComposing(false);
  }, []);

  useEffect(() => cancelProcessing, [cancelProcessing]);
  useEffect(() => releaseForeground, [releaseForeground]);

  const clearResult = useCallback(() => {
    releaseForeground();
    objectUrls.revoke('background:result');
    setResult(null);
  }, [objectUrls, releaseForeground]);

  /**
   * Recomposes the cached cutout onto `color` in the browser. Never touches the
   * model, and leaves the current result on screen until the new one is ready.
   * Callers must keep this serialized: only one full-size canvas at a time.
   */
  const composeWithColor = useCallback(
    async (color: string) => {
      const cache = foreground.current;
      if (!cache) return;
      compositionToken.current += 1;
      const token = compositionToken.current;
      setComposing(true);
      try {
        const blob =
          color === TRANSPARENT_BACKGROUND
            ? cache.blob
            : await composeBackgroundColor(cache.blob, color);
        if (token !== compositionToken.current) return;
        const url = objectUrls.replace('background:result', blob);
        setResult({ name: `${cache.baseName}_no_bg.png`, size: blob.size, url, color });
        setError(null);
      } catch (composeError) {
        if (token !== compositionToken.current) return;
        setError(getImageProcessingErrorMessage(composeError));
      } finally {
        if (token === compositionToken.current) setComposing(false);
      }
    },
    [objectUrls]
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      const nextFile = files[0];
      if (!nextFile) return;
      try {
        validateImageFile(nextFile);
        clearResult();
        setFile(nextFile);
        setPreviewUrl(objectUrls.replace('background:preview', nextFile));
        setError(null);
        setProgress(null);
      } catch (fileError) {
        setError(getImageProcessingErrorMessage(fileError));
      }
    },
    [clearResult, objectUrls]
  );

  const applyColor = useCallback(
    (value: string) => {
      // The controls are disabled while a run or a recomposition is in flight,
      // but the guard has to live here too: keyboard, blur and programmatic
      // callers must not start a second full-size canvas in parallel.
      if (processing || composing) return;
      setBgColor(value);
      setHexError(null);
      setHexDraft(value === TRANSPARENT_BACKGROUND ? '' : value);
      // With a cutout in hand this is a local recomposition; the existing result
      // stays visible and the model is not consulted again.
      void composeWithColor(value);
    },
    [composeWithColor, composing, processing]
  );

  const commitHex = useCallback(() => {
    if (hexDraft.trim() === '') {
      setHexError(null);
      return;
    }
    const normalized = normalizeHexColor(hexDraft);
    if (!normalized) {
      setHexError('Enter a colour like #ff7a45.');
      return;
    }
    applyColor(normalized);
  }, [applyColor, hexDraft]);

  /** Closes the stage that just ended, then records the new one. */
  const trackProgress = useCallback((next: BackgroundProgress) => {
    const state = timingRef.current;
    if (state && next.stage !== state.stage) {
      const now = performance.now();
      if (state.stage) {
        state.stages.push({ stage: state.stage, ms: Math.round(now - state.stageStartedAt) });
      }
      state.stage = next.stage;
      state.stageStartedAt = now;
    }
    setProgress(next);
  }, []);

  const handleRemove = useCallback(() => {
    cancelProcessing();
    releaseForeground();
    objectUrls.revokeAll();
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setProgress(null);
  }, [cancelProcessing, objectUrls, releaseForeground]);

  const removeBackground = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    clearResult();
    setTiming(null);
    const startedAt = performance.now();
    timingRef.current = {
      startedAt,
      stageStartedAt: startedAt,
      stage: INITIAL_PROGRESS.stage,
      stages: [],
    };
    setProgress(INITIAL_PROGRESS);
    const controller = new AbortController();
    processingController.current = controller;

    try {
      // The 'runtime' stage above must stay visible until the worker reports its
      // first progress event. Overwriting it here batched into the same render,
      // so the user never saw it and it never reached the DOM.
      const removedBlob = await removeBackgroundInWorker(file, trackProgress, controller.signal);
      setModelRuns((runs) => runs + 1);

      // Close the stage the worker finished on, so the model side is fully
      // accounted for before the composition below is timed separately.
      const modelDoneAt = performance.now();
      const tracked = timingRef.current;
      if (tracked?.stage) {
        tracked.stages.push({
          stage: tracked.stage,
          ms: Math.round(modelDoneAt - tracked.stageStartedAt),
        });
        tracked.stage = null;
      }

      // Cache the cutout so later background changes stay local.
      foreground.current = {
        blob: removedBlob,
        baseName: file.name.replace(/\.[^.]+$/, '') || 'image',
      };

      // The remaining paint step reports itself through the composing status.
      setProgress(null);
      await composeWithColor(bgColor);
      if (controller.signal.aborted) {
        throw new DOMException('Background removal was canceled.', 'AbortError');
      }

      if (tracked) {
        const stages = [
          ...tracked.stages,
          { stage: 'compose', ms: Math.round(performance.now() - modelDoneAt) },
        ];
        const totalMs = Math.round(performance.now() - tracked.startedAt);
        setTiming({ totalMs, stages });
        // Threads only speed up inference. Comparing these numbers between runs
        // is the only way to tell whether a runtime change is worth having.
        // Deliberately `info` rather than `debug`: Chrome hides `debug` behind
        // the Verbose log level, which is off by default, so a line logged at
        // that level is one nobody reads — the same trap the removal library
        // fell into with its own cross-origin warning.
        console.info('[toolkitfree] background removal timing', {
          totalMs,
          crossOriginIsolated: self.crossOriginIsolated,
          hardwareConcurrency: navigator.hardwareConcurrency,
          stages: Object.fromEntries(stages.map((entry) => [entry.stage, entry.ms])),
        });
      }
    } catch (processingError) {
      if (processingError instanceof DOMException && processingError.name === 'AbortError') {
        clearResult();
        setError('Background removal was canceled.');
        setProgress(null);
        return;
      }
      const standardMessage = getImageProcessingErrorMessage(processingError);
      setError(
        standardMessage === 'Image processing failed. Please try another file.'
          ? 'Background removal could not finish. On first use, check your connection and available device memory, then retry.'
          : standardMessage
      );
      setProgress(null);
    } finally {
      if (processingController.current === controller) processingController.current = null;
      setProcessing(false);
    }
  };

  // The previous result stays on screen while a new background is painted, so it
  // must not be downloadable until its bytes match the selected colour.
  const downloadReady = result !== null && !composing && result.color === bgColor;

  const handleDownload = () => {
    if (!result || !downloadReady) return;
    try {
      downloadUrl(result.url, result.name);
    } catch (downloadError) {
      setError(getImageProcessingErrorMessage(downloadError));
    }
  };

  // One recomposition at a time: each colour paints a full-size canvas.
  const colorLocked = processing || composing;

  const isCustomColor =
    bgColor !== TRANSPARENT_BACKGROUND &&
    !BACKGROUND_PRESETS.some((preset) => preset.value === bgColor);

  return (
    // `data-active-background` intentionally differs from the presets' `data-background-color`
    // so a selector for a preset swatch never matches this wrapper instead.
    // `data-background-model-runs` lets the regression prove a colour change
    // recomposes locally instead of asking the model for another cutout.
    <div
      data-background-stage={progress?.stage ?? 'idle'}
      data-active-background={bgColor}
      data-background-composing={composing ? 'true' : 'false'}
      data-background-model-runs={modelRuns}
      data-background-timing={
        timing ? timing.stages.map((entry) => `${entry.stage}:${entry.ms}`).join(',') : undefined
      }
      aria-busy={processing || composing}
    >
      {!file ? (
        <FileUploader
          accept="image/jpeg,image/png,image/webp"
          multiple={false}
          budgetProfile="background"
          onFilesSelected={handleFiles}
        />
      ) : (
        <>
          <div className="file-item" style={{ marginBottom: '1rem' }}>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Original preview"
                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
              />
            )}
            <span className="file-item-name">{file.name}</span>
            <span className="file-item-size">{formatSize(file.size)}</span>
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              className="file-item-remove"
              onClick={handleRemove}
              disabled={processing}
            >
              x
            </button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                display: 'block',
                marginBottom: '0.5rem',
              }}
            >
              Background Color
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {BACKGROUND_PRESETS.map((option) => {
                const selected = bgColor === option.value;
                const isTransparent = option.value === TRANSPARENT_BACKGROUND;
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-background-color={option.value}
                    aria-pressed={selected}
                    disabled={colorLocked}
                    onClick={() => applyColor(option.value)}
                    style={{
                      padding: '0.375rem 1rem',
                      borderRadius: 6,
                      border: selected ? '2px solid #2563eb' : '1px solid #e7e3db',
                      background: isTransparent ? CHECKERBOARD : option.swatch,
                      backgroundSize: isTransparent ? '12px 12px' : undefined,
                      backgroundPosition: isTransparent
                        ? '0 0, 0 6px, 6px -6px, -6px 0px'
                        : undefined,
                      cursor: colorLocked ? 'not-allowed' : 'pointer',
                      fontSize: '0.8rem',
                      color: backgroundLabelColor(option.swatch),
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}

              <span aria-hidden="true" style={{ color: '#ddd8ce' }}>
                |
              </span>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.8rem',
                }}
              >
                <span>Custom</span>
                <input
                  type="color"
                  data-testid="bg-color-picker"
                  value={isCustomColor ? bgColor : '#3b82f6'}
                  disabled={colorLocked}
                  onChange={(event) => applyColor(event.target.value)}
                  style={{
                    width: 36,
                    height: 30,
                    padding: 2,
                    border: isCustomColor ? '2px solid #2563eb' : '1px solid #ddd8ce',
                    borderRadius: 6,
                    cursor: colorLocked ? 'not-allowed' : 'pointer',
                    background: 'none',
                  }}
                />
              </label>

              <input
                type="text"
                data-testid="bg-color-hex"
                aria-label="Background colour hex value"
                aria-invalid={hexError !== null}
                placeholder="#ff7a45"
                value={hexDraft}
                disabled={colorLocked}
                maxLength={7}
                onChange={(event) => {
                  setHexDraft(event.target.value);
                  setHexError(null);
                }}
                onBlur={commitHex}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  commitHex();
                }}
                style={{
                  width: '7.5rem',
                  padding: '0.375rem 0.5rem',
                  borderRadius: 6,
                  border: hexError ? '1px solid #ef4444' : '1px solid #ddd8ce',
                  fontSize: '0.8rem',
                  fontFamily: 'ui-monospace, monospace',
                }}
              />
            </div>
            {hexError && (
              <p
                role="alert"
                style={{ margin: '0.375rem 0 0', color: '#ef4444', fontSize: '0.75rem' }}
              >
                {hexError}
              </p>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={removeBackground}
            disabled={processing}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
          >
            {processing ? 'Processing...' : result ? 'Process Again' : 'Remove Background'}
          </button>
          {processing && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cancelProcessing}
              style={{ fontSize: '1rem', padding: '0.75rem 2rem', marginLeft: '0.5rem' }}
            >
              Cancel
            </button>
          )}
          <p style={{ marginTop: '0.5rem', color: '#6b665c', fontSize: '0.8125rem' }}>
            First use downloads a sizable AI model and requires a network connection. Later offline
            use depends on whether your browser keeps that model cached. Processing speed and
            maximum image size depend on device memory.
          </p>
        </>
      )}

      {progress && (
        <div
          className="status status-processing"
          role="status"
          aria-live="polite"
          data-progress-stage={progress.stage}
        >
          {progress.label}
          {progress.percent === null ? '...' : `: ${progress.percent}%`}
        </div>
      )}
      {timing && !processing && !composing && (
        <p className="tool-run-note">
          <span className="run-dot" aria-hidden="true" />
          Removed in your browser in {(timing.totalMs / 1000).toFixed(1)}s. Nothing was uploaded.
        </p>
      )}
      {composing && (
        <div className="status status-processing" role="status" aria-live="polite">
          Applying background color...
        </div>
      )}
      {error && (
        <div className="status status-error" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Result</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            {previewUrl && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#6b665c', marginBottom: '0.25rem' }}>
                  Original
                </div>
                <img
                  src={previewUrl}
                  alt="Original"
                  style={{
                    maxWidth: 200,
                    maxHeight: 200,
                    borderRadius: 4,
                    border: '1px solid #e7e3db',
                  }}
                />
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b665c', marginBottom: '0.25rem' }}>
                Result
              </div>
              <img
                src={result.url}
                alt="Result"
                style={{
                  maxWidth: 200,
                  maxHeight: 200,
                  borderRadius: 4,
                  border: '1px solid #e7e3db',
                  backgroundImage:
                    result.color === TRANSPARENT_BACKGROUND ? CHECKERBOARD : undefined,
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              />
            </div>
          </div>
          <div className="result-item" data-background-result={result.name}>
            <div className="result-info">
              <div>
                <div className="file-item-name">{result.name}</div>
                <div className="file-item-size">{formatSize(result.size)}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="btn btn-primary"
              disabled={!downloadReady}
            >
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
