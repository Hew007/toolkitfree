import { useCallback, useEffect, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { ToolPresets, type ToolChoice } from './ToolChoices';
import FineTune, { FineTuneField } from './FineTune';
import ToolRunNote from './ToolRunNote';
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
  composeBackgroundColor,
  normalizeHexColor,
  plannedThreadCount,
  removeBackgroundInWorker,
  type BackgroundProgress,
} from '../lib/background-remover';

/**
 * The chip row is the preset table, mapped. Deriving it here rather than writing
 * the labels a second time is what stops a chip from naming one colour while
 * painting another.
 *
 * The chip id is the canvas value, because that is what the tool stores: a chip
 * is lit exactly while `bgColor` still holds what it wrote, so reaching any
 * other colour through the fine-tune panel unlights all of them on its own.
 */
const BACKGROUND_CHOICES: readonly ToolChoice<string>[] = BACKGROUND_PRESETS.map((preset) => ({
  id: preset.value,
  label: preset.label,
}));

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
  /** Threads the successful attempt asked for; 1 means the single-threaded path. */
  threads: number;
  /** True when a threaded attempt failed first and this total includes both. */
  fellBack: boolean;
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
  // The headline sentence is written for the visitor; `detail` is the underlying
  // failure text, shown only when we have nothing more specific to say. Without it
  // every unexpected failure collapses into the same generic line and the cause is
  // visible nowhere but the console — which is exactly how the cross-origin
  // isolation regression reached production undiagnosed.
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [bgColor, setBgColor] = useState(TRANSPARENT_BACKGROUND);
  // The chip to return to when the fine-tune panel offers a way back. Only a chip
  // writes it, so "back" always names a preset the visitor actually chose rather
  // than whichever colour happened to be active before they typed a hex value.
  const [lastPresetValue, setLastPresetValue] = useState<string>(TRANSPARENT_BACKGROUND);
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
        setError({ message: getImageProcessingErrorMessage(composeError) });
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
        // The timing describes the previous file's run. Left standing, its note and
        // its thread attributes would be read as belonging to this one.
        setTiming(null);
      } catch (fileError) {
        setError({ message: getImageProcessingErrorMessage(fileError) });
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
      if (BACKGROUND_PRESETS.some((preset) => preset.value === value)) setLastPresetValue(value);
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
      setHexError('Enter a color like #ff7a45.');
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
    // Without this the "Removed in your browser in X.Xs" note outlives the file it
    // describes and sits under an empty uploader.
    setTiming(null);
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
      const run = await removeBackgroundInWorker(file, trackProgress, controller.signal);
      const removedBlob = run.blob;
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
        setTiming({ totalMs, stages, threads: run.threads, fellBack: run.fellBack });
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
          // The thread count is the only variable that decides whether isolation was
          // worth having, and a fallback is invisible in the result, so both belong on
          // the line someone will paste. `hardwareConcurrency` alone cannot stand in:
          // it is what the machine has, not what the run asked for.
          threads: run.threads,
          fellBack: run.fellBack,
          // The worker can report a stage more than once — initialisation shows up
          // again after inference — so the totals are summed per stage. Keying
          // them directly would let a later entry silently replace an earlier one.
          stages: stages.reduce<Record<string, number>>((totals, entry) => {
            totals[entry.stage] = (totals[entry.stage] ?? 0) + entry.ms;
            return totals;
          }, {}),
          order: stages.map((entry) => `${entry.stage}:${entry.ms}`).join(','),
        });
      }
    } catch (processingError) {
      if (processingError instanceof DOMException && processingError.name === 'AbortError') {
        clearResult();
        setError({ message: 'Background removal was canceled.' });
        setProgress(null);
        return;
      }
      const standardMessage = getImageProcessingErrorMessage(processingError);
      const unrecognized = standardMessage === 'Image processing failed. Please try another file.';
      // `error` at the level Chrome shows by default, not `debug`: a failure nobody
      // can read is a failure nobody can fix.
      console.error('[toolkitfree] background removal failed', processingError, {
        crossOriginIsolated: self.crossOriginIsolated,
        hardwareConcurrency: navigator.hardwareConcurrency,
        // Recomputed rather than captured: reaching here means every attempt failed,
        // including the single-threaded fallback, so there is no successful run to
        // ask. Same pure function on the same inputs, so it reports the same plan.
        plannedThreads: plannedThreadCount(navigator.hardwareConcurrency, self.crossOriginIsolated),
      });
      setError({
        message: unrecognized
          ? 'Background removal could not finish. On first use, check your connection and available device memory, then retry.'
          : standardMessage,
        detail:
          unrecognized && processingError instanceof Error && processingError.message
            ? processingError.message
            : undefined,
      });
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
      setError({ message: getImageProcessingErrorMessage(downloadError) });
    }
  };

  // One recomposition at a time: each colour paints a full-size canvas.
  const colorLocked = processing || composing;

  const activePreset = BACKGROUND_PRESETS.find((preset) => preset.value === bgColor);
  const isCustomColor = activePreset === undefined;
  const lastPresetLabel =
    BACKGROUND_PRESETS.find((preset) => preset.value === lastPresetValue)?.label ?? 'Transparent';
  // The closed row has to answer "what will it paint?" without being opened, so it
  // carries the exact value and not just the name of the chip that set it.
  const fineTuneSummary = activePreset
    ? activePreset.value === TRANSPARENT_BACKGROUND
      ? 'Transparent · PNG alpha'
      : `${activePreset.label} · ${activePreset.value}`
    : `Custom · ${bgColor}`;

  return (
    // `data-active-background` intentionally differs from the presets' `data-background-color`
    // so a selector for a preset swatch never matches this wrapper instead.
    // `data-background-model-runs` lets the regression prove a colour change
    // recomposes locally instead of asking the model for another cutout.
    <div
      data-background-stage={progress?.stage ?? 'idle'}
      data-active-background={bgColor}
      data-background-composing={composing ? 'true' : 'false'}
      data-tool-input={file !== null ? 'present' : 'empty'}
      data-background-model-runs={modelRuns}
      data-background-timing={
        timing ? timing.stages.map((entry) => `${entry.stage}:${entry.ms}`).join(',') : undefined
      }
      data-background-threads={timing?.threads}
      data-background-fell-back={timing ? String(timing.fellBack) : undefined}
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

          <div className="tool-controls">
            {/* `ToolPresets` has no disabled prop, and the lock is not a preference:
                each colour paints a full-size canvas, so two at once would double the
                peak memory of a large photo. A disabled fieldset takes the whole row
                out of the tab order for the duration without re-implementing the chip
                markup, and the dimming says so on screen. */}
            <fieldset
              className="tool-chip-group"
              data-background-chips=""
              disabled={colorLocked}
              style={{ opacity: colorLocked ? 0.55 : undefined }}
            >
              <ToolPresets
                legend="Background"
                help="Pick what goes behind the cutout. Choosing one never starts the AI model — open Fine-tune for any other color."
                presets={BACKGROUND_CHOICES}
                isActive={(preset) => preset.id === bgColor}
                onApply={(preset) => applyColor(preset.id)}
              />
            </fieldset>

            <FineTune
              summary={fineTuneSummary}
              onReset={isCustomColor ? () => applyColor(lastPresetValue) : undefined}
              resetLabel={`Back to the ${lastPresetLabel} background`}
            >
              <FineTuneField
                htmlFor="background-custom-color"
                label="Custom background color"
                hint="Any color, including ones the presets above do not offer. Picking one clears the preset selection."
              >
                <input
                  id="background-custom-color"
                  type="color"
                  data-testid="bg-color-picker"
                  value={bgColor === TRANSPARENT_BACKGROUND ? '#3b82f6' : bgColor}
                  disabled={colorLocked}
                  onChange={(event) => applyColor(event.target.value)}
                  style={{
                    width: 56,
                    height: 44,
                    padding: 2,
                    border: isCustomColor ? '2px solid #2563eb' : '1px solid #ddd8ce',
                    borderRadius: 6,
                    cursor: colorLocked ? 'not-allowed' : 'pointer',
                    background: 'none',
                  }}
                />
              </FineTuneField>

              <FineTuneField
                htmlFor="background-hex"
                label="Hex value"
                hint="Press Enter or leave the field to apply it."
              >
                <input
                  id="background-hex"
                  type="text"
                  data-testid="bg-color-hex"
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
                    width: '9rem',
                    minHeight: 44,
                    padding: '0.375rem 0.5rem',
                    borderRadius: 6,
                    border: hexError ? '1px solid #ef4444' : '1px solid #ddd8ce',
                    fontSize: '0.875rem',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                />
              </FineTuneField>

              {hexError && (
                <p role="alert" style={{ margin: 0, color: '#ef4444', fontSize: '0.75rem' }}>
                  {hexError}
                </p>
              )}
            </FineTune>

            {/* Not the A/B-class idle line: this tool keeps a button, so the file on
                disk does not follow the settings and saying it would be false. What
                does follow is the background, and the note has to say which is which
                — and roughly what pressing the button costs. */}
            <ToolRunNote busy={processing || composing}>
              {processing
                ? 'Removing the background in your browser…'
                : composing
                  ? 'Painting the background in your browser…'
                  : timing
                    ? `Removed in your browser in ${(timing.totalMs / 1000).toFixed(1)}s — nothing was uploaded. Changing the background above repaints this result without running the model again.`
                    : 'Nothing is uploaded. The background above applies as soon as there is a result; removal itself is a separate step and usually takes a few seconds to half a minute.'}
            </ToolRunNote>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
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
          </div>
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
      {/* The run note above carries the wording; this is only what a screen reader
          needs, since that note is not a live region and a recomposition is
          otherwise silent. */}
      {composing && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Painting the background.
        </div>
      )}
      {error && (
        <div className="status status-error" role="alert">
          {error.message}
          {error.detail && (
            <span
              style={{
                display: 'block',
                marginTop: '0.35rem',
                fontSize: '0.8125rem',
                opacity: 0.85,
              }}
            >
              {error.detail}
            </span>
          )}
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
