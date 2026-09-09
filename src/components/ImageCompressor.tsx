import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { mapWithConcurrency } from '../lib/async-pool';
import FileList from './FileList';
import BatchResultsSummary from './BatchResultsSummary';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import { useNumberDraft } from '../hooks/useNumberDraft';
import {
  exportCanvas,
  formatSize,
  getCanvas2dContext,
  getImageProcessingErrorMessage,
  loadImage,
  type ImageOutputMimeType,
} from '../lib/image-processing';
import {
  compressToTargetSize,
  dimensionsForMaxWidth,
  type CompressionMode,
} from '../lib/image-compressor';

interface QueuedFile {
  id: string;
  file: File;
}

type CompressionStatus = 'optimized' | 'target-met' | 'target-not-met' | 'kept-original' | 'larger';

interface CompressedFile {
  sourceId: string;
  sourceName: string;
  outputName: string;
  name: string;
  originalSize: number;
  outputSize: number;
  compressedSize: number;
  blob: Blob;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  quality: number | null;
  attempts: number;
  status: CompressionStatus;
  message: string;
  url: string;
  previewUrl: string;
}

interface FailedFile {
  sourceId: string;
  name: string;
  message: string;
}

/** One decode of a source file, encoded once per requested candidate. */
type VariantResults = Partial<Record<VariantId, CompressedFile>>;

type CompressionOutcome =
  { status: 'success'; value: VariantResults } | { status: 'failure'; value: FailedFile };

interface Props {
  defaultMode?: CompressionMode;
  defaultTargetKB?: number;
  defaultFormat?: string;
}

const INPUT_FORMATS: Record<
  string,
  { accept: string; allowedTypes: readonly string[]; hint: string }
> = {
  PNG: { accept: 'image/png', allowedTypes: ['image/png'], hint: 'PNG' },
  JPG: { accept: 'image/jpeg', allowedTypes: ['image/jpeg'], hint: 'JPG or JPEG' },
  Any: {
    accept: 'image/jpeg,image/png,image/webp',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    hint: 'JPG, PNG, or WebP',
  },
};

/**
 * Purposes answer the question a visitor can actually answer. Each one sets the
 * quality and width the fine-tune panel then exposes, so nothing is hidden —
 * only pre-filled.
 */
type PurposeId = 'web' | 'email' | 'chat' | 'print' | 'exact';

interface Purpose {
  id: PurposeId;
  label: string;
  summary: string;
  mode: CompressionMode;
  quality: number;
  maxWidth: number;
}

const PURPOSES: readonly Purpose[] = [
  {
    id: 'web',
    label: 'Web page',
    summary: 'Fast pages, up to 1600 px wide',
    mode: 'quality',
    quality: 78,
    maxWidth: 1600,
  },
  {
    id: 'email',
    label: 'Email attachment',
    summary: 'Smaller files that still read well',
    mode: 'quality',
    quality: 72,
    maxWidth: 2048,
  },
  {
    id: 'chat',
    label: 'Chat and messaging',
    summary: 'Quick to send on mobile data',
    mode: 'quality',
    quality: 70,
    maxWidth: 1280,
  },
  {
    id: 'print',
    label: 'Print',
    summary: 'Keeps the original dimensions',
    mode: 'quality',
    quality: 92,
    maxWidth: 0,
  },
  {
    id: 'exact',
    label: 'Exact size in KB',
    summary: 'Bounded search for a size you set',
    mode: 'target',
    quality: 80,
    maxWidth: 0,
  },
];

/**
 * Three finished candidates instead of one dial. Lossless sources ignore
 * quality, so there the candidates differ by dimensions instead — otherwise a
 * PNG would produce three identical files.
 */
type VariantId = 'smaller' | 'balanced' | 'sharper';

interface VariantProfile {
  id: VariantId;
  label: string;
  note: string;
  qualityDelta: number;
  widthScale: number;
  losslessWidthScale: number;
}

const VARIANTS: readonly VariantProfile[] = [
  {
    id: 'smaller',
    label: 'Smaller',
    note: 'Lowest file size. Soft edges when zoomed in.',
    qualityDelta: -18,
    widthScale: 0.8,
    losslessWidthScale: 0.6,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    note: 'The size this purpose is tuned for.',
    qualityDelta: 0,
    widthScale: 1,
    losslessWidthScale: 0.85,
  },
  {
    id: 'sharper',
    label: 'Sharper',
    note: 'Keeps more detail, and stays the largest.',
    qualityDelta: 12,
    widthScale: 1,
    losslessWidthScale: 1,
  },
];

const MAX_WIDTH_CHOICES = [0, 3840, 2048, 1920, 1600, 1280, 800, 400] as const;

/** Recomputing on every keystroke would be wasteful; this is short enough to feel immediate. */
const RECOMPRESS_DELAY_MS = 320;

/**
 * All three candidates are encoded up front only while the batch is small
 * enough for that to stay quick. Above these limits the selected candidate is
 * encoded on its own and the others are offered on demand.
 */
const COMPARE_ALL_MAX_FILES = 6;
const COMPARE_ALL_MAX_BYTES = 30 * 1024 * 1024;

interface VariantRun {
  status: 'running' | 'ready';
  results: CompressedFile[];
  failures: FailedFile[];
  elapsedMs: number;
}

type VariantRuns = Partial<Record<VariantId, VariantRun>>;

function resultColor(status: CompressionStatus): string {
  if (status === 'optimized' || status === 'target-met') return 'var(--color-success)';
  if (status === 'target-not-met' || status === 'larger') return 'var(--color-caution)';
  return 'var(--color-text-muted)';
}

function clampQuality(value: number): number {
  return Math.min(96, Math.max(10, Math.round(value)));
}

function scaleDimension(value: number, scale: number): number {
  return Math.max(1, Math.round(value * scale));
}

export default function ImageCompressor({
  defaultMode = 'quality',
  defaultTargetKB = 100,
  defaultFormat = 'Any',
}: Props) {
  const inputFormat = INPUT_FORMATS[defaultFormat] ?? INPUT_FORMATS.Any;
  const defaultPurpose = PURPOSES.find((purpose) =>
    defaultMode === 'target' ? purpose.id === 'exact' : purpose.id === 'web'
  ) as Purpose;

  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [purposeId, setPurposeId] = useState<PurposeId>(defaultPurpose.id);
  const [quality, setQuality] = useState(defaultPurpose.quality);
  const [maxWidth, setMaxWidth] = useState(defaultPurpose.maxWidth);
  const [targetKB, setTargetKB] = useState(defaultTargetKB);
  const [tuned, setTuned] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<VariantId>('balanced');
  const [runs, setRuns] = useState<VariantRuns>({});
  const nextFileId = useRef(0);
  const runIdRef = useRef(0);
  const objectUrls = useObjectUrlRegistry();

  const purpose = PURPOSES.find((entry) => entry.id === purposeId) ?? defaultPurpose;
  const mode = purpose.mode;
  const totalBytes = files.reduce((sum, entry) => sum + entry.file.size, 0);
  const compareAll =
    files.length > 0 &&
    files.length <= COMPARE_ALL_MAX_FILES &&
    totalBytes <= COMPARE_ALL_MAX_BYTES;

  /** Any change to this string invalidates every encoded candidate. */
  const settingsKey = useMemo(
    () =>
      JSON.stringify({
        files: files.map((entry) => entry.id),
        mode,
        quality,
        maxWidth,
        targetKB: mode === 'target' ? targetKB : null,
      }),
    [files, mode, quality, maxWidth, targetKB]
  );

  const targetKBProps = useNumberDraft({
    value: targetKB,
    min: 1,
    max: 10000,
    onCommit: setTargetKB,
  });

  const handleFiles = useCallback((newFiles: File[]) => {
    if (newFiles.length === 0) return;
    setFiles((previous) => [
      ...previous,
      ...newFiles.map((file) => ({ id: `file-${++nextFileId.current}`, file })),
    ]);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  }, []);

  const handlePurpose = useCallback((next: Purpose) => {
    setPurposeId(next.id);
    setQuality(next.quality);
    setMaxWidth(next.maxWidth);
    setTuned(false);
  }, []);

  const compressFile = useCallback(
    async (
      queuedFile: QueuedFile,
      variants: readonly VariantProfile[]
    ): Promise<VariantResults> => {
      // The source is decoded once and then encoded once per candidate.
      const image = await loadImage(queuedFile.file, {
        allowedTypes: inputFormat.allowedTypes,
      });
      const outputType = queuedFile.file.type as ImageOutputMimeType;
      const lossless = outputType === 'image/png';
      const originalWidth = image.naturalWidth;
      const originalHeight = image.naturalHeight;
      const startDimensions = dimensionsForMaxWidth(originalWidth, originalHeight, maxWidth);

      const encode = async (width: number, height: number, encodeQuality?: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = getCanvas2dContext(canvas);
        context.drawImage(image, 0, 0, width, height);
        return exportCanvas(canvas, outputType, lossless ? undefined : encodeQuality);
      };

      const encoded: VariantResults = {};

      for (const variant of variants) {
        let blob: Blob;
        let width = startDimensions.width;
        let height = startDimensions.height;
        let outputQuality: number | null = lossless ? null : quality / 100;
        let attempts = 1;
        let status: CompressionStatus;
        let message: string;

        if (mode === 'target') {
          const targetBytes = Math.round(targetKB * 1024);
          if (queuedFile.file.size <= targetBytes) {
            blob = queuedFile.file;
            width = originalWidth;
            height = originalHeight;
            outputQuality = null;
            attempts = 0;
            status = 'target-met';
            message = `Already within the ${targetKB} KB target; original kept.`;
          } else {
            const targetResult = await compressToTargetSize({
              sourceWidth: width,
              sourceHeight: height,
              outputType,
              targetBytes,
              encode,
            });
            blob = targetResult.blob;
            width = targetResult.width;
            height = targetResult.height;
            outputQuality = targetResult.quality;
            attempts = targetResult.attempts;

            if (targetResult.metTarget) {
              status = 'target-met';
              message = `Target met: ${formatSize(blob.size)} is within ${targetKB} KB.`;
            } else if (blob.size >= queuedFile.file.size) {
              blob = queuedFile.file;
              width = originalWidth;
              height = originalHeight;
              outputQuality = null;
              status = 'target-not-met';
              message = `Target not met after ${attempts} attempts; original kept because no smaller result was found.`;
            } else {
              status = 'target-not-met';
              message = `Target not met after ${attempts} attempts; closest result kept.`;
            }
          }
        } else {
          const scale = lossless ? variant.losslessWidthScale : variant.widthScale;
          width = scaleDimension(width, scale);
          height = scaleDimension(height, scale);
          outputQuality = lossless ? null : clampQuality(quality + variant.qualityDelta) / 100;

          const candidate = await encode(width, height, outputQuality ?? undefined);
          const dimensionsChanged = width !== originalWidth || height !== originalHeight;

          if (!dimensionsChanged && candidate.size >= queuedFile.file.size) {
            blob = queuedFile.file;
            width = originalWidth;
            height = originalHeight;
            outputQuality = null;
            status = 'kept-original';
            message = 'No smaller result was found; original kept.';
          } else {
            blob = candidate;
            status = candidate.size < queuedFile.file.size ? 'optimized' : 'larger';
            message =
              status === 'optimized'
                ? 'File size reduced.'
                : 'Dimensions changed, but the output file is larger than the original.';
          }
        }

        const url = objectUrls.replace(`result:${variant.id}:${queuedFile.id}`, blob);
        encoded[variant.id] = {
          sourceId: queuedFile.id,
          sourceName: queuedFile.file.name,
          outputName: queuedFile.file.name,
          name: queuedFile.file.name,
          originalSize: queuedFile.file.size,
          outputSize: blob.size,
          compressedSize: blob.size,
          blob,
          originalWidth,
          originalHeight,
          width,
          height,
          quality: outputQuality,
          attempts,
          status,
          message,
          url,
          previewUrl: url,
        };
      }

      return encoded;
    },
    [inputFormat.allowedTypes, maxWidth, mode, objectUrls, quality, targetKB]
  );

  const runVariants = useCallback(
    async (variants: readonly VariantProfile[], queued: QueuedFile[], runId: number) => {
      setRuns((previous) => {
        const next = { ...previous };
        for (const variant of variants) {
          next[variant.id] = {
            status: 'running',
            results: previous[variant.id]?.results ?? [],
            failures: previous[variant.id]?.failures ?? [],
            elapsedMs: 0,
          };
        }
        return next;
      });

      const startedAt = performance.now();
      const outcomes: CompressionOutcome[] = await mapWithConcurrency(queued, 2, async (file) => {
        try {
          return { status: 'success', value: await compressFile(file, variants) };
        } catch (processingError) {
          return {
            status: 'failure',
            value: {
              sourceId: file.id,
              name: file.file.name,
              message: getImageProcessingErrorMessage(processingError),
            },
          };
        }
      });

      // A newer settings change already invalidated this run.
      if (runIdRef.current !== runId) return;

      const elapsedMs = Math.round(performance.now() - startedAt);
      const failures = outcomes
        .filter(
          (outcome): outcome is Extract<CompressionOutcome, { status: 'failure' }> =>
            outcome.status === 'failure'
        )
        .map((outcome) => outcome.value);

      setRuns((previous) => {
        const next = { ...previous };
        for (const variant of variants) {
          next[variant.id] = {
            status: 'ready',
            results: outcomes
              .filter(
                (outcome): outcome is Extract<CompressionOutcome, { status: 'success' }> =>
                  outcome.status === 'success'
              )
              .map((outcome) => outcome.value[variant.id])
              .filter((result): result is CompressedFile => Boolean(result)),
            failures,
            elapsedMs,
          };
        }
        return next;
      });
    },
    [compressFile]
  );

  // No submit button: the result follows the controls. Work is debounced and a
  // newer change abandons the previous run rather than queueing behind it.
  useEffect(() => {
    runIdRef.current += 1;
    objectUrls.revokePrefix('result:');
    setRuns({});

    if (files.length === 0) return;

    const runId = runIdRef.current;
    const queued = files;
    const wanted =
      mode === 'target'
        ? VARIANTS.filter((variant) => variant.id === 'balanced')
        : compareAll
          ? VARIANTS
          : VARIANTS.filter((variant) => variant.id === selectedVariant);

    const timer = setTimeout(() => {
      void runVariants(wanted, queued, runId);
    }, RECOMPRESS_DELAY_MS);

    return () => clearTimeout(timer);
    // `selectedVariant` intentionally drives this only through `compareAll`:
    // when every candidate is encoded up front, switching cards is free.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey, compareAll, mode, objectUrls, runVariants]);

  const activeVariantId: VariantId = mode === 'target' ? 'balanced' : selectedVariant;
  const activeRun = runs[activeVariantId];
  const busy = Object.values(runs).some((run) => run?.status === 'running');
  const results = activeRun?.status === 'ready' ? activeRun.results : [];
  const failures = activeRun?.status === 'ready' ? activeRun.failures : [];

  const handleSelectVariant = useCallback(
    (variant: VariantProfile) => {
      setSelectedVariant(variant.id);
      if (compareAll || runs[variant.id] || files.length === 0) return;
      void runVariants([variant], files, runIdRef.current);
    },
    [compareAll, files, runVariants, runs]
  );

  const totalOutput = results.reduce((sum, result) => sum + result.outputSize, 0);
  const totalOriginal = results.reduce((sum, result) => sum + result.originalSize, 0);
  const fineTuneSummary = [
    mode === 'target' ? `Target ${targetKB} KB` : `Quality ${quality}%`,
    maxWidth === 0 ? 'original width' : `max width ${maxWidth} px`,
  ].join(' · ');

  return (
    <div aria-busy={busy}>
      {busy && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Compressing images.
        </div>
      )}
      <FileUploader
        accept={inputFormat.accept}
        multiple={true}
        budgetProfile="compressor"
        currentFiles={files.map(({ file }) => file)}
        onFilesSelected={handleFiles}
      />
      <p className="tool-hint">Accepted input: {inputFormat.hint}</p>

      <FileList files={files.map(({ file }) => file)} onRemove={handleRemove} />

      <div className="compressor-controls">
        <fieldset className="tool-chip-group">
          <legend>What is it for?</legend>
          <p className="tool-chip-help">
            Choose a purpose and the settings follow. You can still change every value below.
          </p>
          <div className="tool-chip-row">
            {PURPOSES.map((entry) => (
              <label
                key={entry.id}
                className={`tool-chip${purposeId === entry.id ? ' is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="compressor-purpose"
                  value={entry.id}
                  checked={purposeId === entry.id}
                  onChange={() => handlePurpose(entry)}
                />
                <span className="tool-chip-label">{entry.label}</span>
                <span className="tool-chip-hint">{entry.summary}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === 'target' && (
          <div className="compressor-target-row">
            <label htmlFor="compressor-target-size">Target size</label>
            <div className="compressor-target-input">
              <input
                className="field-input"
                id="compressor-target-size"
                aria-label="Target Size (KB)"
                type="number"
                min="1"
                max="10000"
                step="1"
                {...targetKBProps}
              />
              <span>KB</span>
            </div>
            <p className="tool-hint">
              Quality and dimensions are searched within bounds. Each result says whether the target
              was actually met.
            </p>
          </div>
        )}

        {files.length > 0 && mode !== 'target' && (
          <fieldset className="variant-fieldset">
            <legend>Pick a result</legend>
            <div className="variant-options">
              {VARIANTS.map((variant) => {
                const run = runs[variant.id];
                const ready = run?.status === 'ready';
                const size = ready
                  ? run.results.reduce((sum, result) => sum + result.outputSize, 0)
                  : null;
                return (
                  <label
                    key={variant.id}
                    className={`variant-option${selectedVariant === variant.id ? ' is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="compressor-variant"
                      value={variant.id}
                      checked={selectedVariant === variant.id}
                      onChange={() => handleSelectVariant(variant)}
                    />
                    <span className="variant-option-label">{variant.label}</span>
                    <span className="variant-option-size">
                      {ready && size !== null
                        ? formatSize(size)
                        : run?.status === 'running'
                          ? 'Working…'
                          : 'Select to encode'}
                    </span>
                    <span className="variant-option-note">{variant.note}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {files.length > 0 && (
          <>
            <details className="fine-tune">
              <summary>
                <span>Fine-tune</span>
                <span className="fine-tune-summary">{fineTuneSummary}</span>
              </summary>
              <div className="fine-tune-body">
                <div className="fine-tune-field">
                  <label htmlFor="compressor-quality">Quality: {quality}%</label>
                  <input
                    id="compressor-quality"
                    aria-label="Compression Quality"
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={(event) => {
                      setQuality(Number(event.target.value));
                      setTuned(true);
                    }}
                  />
                  <p className="tool-hint">
                    Applies to JPG and WebP. PNG is lossless, so its candidates differ by width
                    instead.
                  </p>
                </div>

                <div className="fine-tune-field">
                  <label htmlFor="compressor-max-width">Starting max width</label>
                  <select
                    id="compressor-max-width"
                    aria-label="Starting Max Width"
                    value={maxWidth}
                    onChange={(event) => {
                      setMaxWidth(Number(event.target.value));
                      setTuned(true);
                    }}
                  >
                    {MAX_WIDTH_CHOICES.map((width) => (
                      <option key={width} value={width}>
                        {width === 0 ? 'Original width' : `${width} px`}
                      </option>
                    ))}
                  </select>
                </div>

                {tuned && (
                  <button
                    type="button"
                    className="fine-tune-reset"
                    onClick={() => handlePurpose(purpose)}
                  >
                    Back to the {purpose.label} preset
                  </button>
                )}
              </div>
            </details>

            <p className="tool-run-note">
              <span className={`run-dot${busy ? ' is-busy' : ''}`} aria-hidden="true" />
              {busy
                ? 'Encoding in your browser…'
                : activeRun?.status === 'ready'
                  ? `Encoded in your browser in ${(activeRun.elapsedMs / 1000).toFixed(1)}s. Nothing was uploaded.`
                  : 'Results follow the settings above. Nothing is uploaded.'}
            </p>

            {!compareAll && mode !== 'target' && (
              <p className="tool-hint">
                Large batch: only the selected candidate is encoded automatically. Choosing another
                one encodes it.
              </p>
            )}
          </>
        )}
      </div>

      <BatchResultsSummary
        successes={results}
        failures={failures}
        archiveName="toolkitfree-compressed-images.zip"
      />

      {results.length > 0 && (
        <div>
          {totalOriginal > 0 && results.length > 1 && (
            <p className="compressor-total">
              {results.length} files: {formatSize(totalOriginal)} to {formatSize(totalOutput)}
            </p>
          )}
          {results.map((result) => {
            const smaller = result.compressedSize < result.originalSize;
            return (
              <div key={result.sourceId} className="result-item">
                <div className="result-info">
                  <img src={result.previewUrl} alt={result.name} className="result-preview" />
                  <div>
                    <div className="file-item-name">{result.name}</div>
                    <div className="file-item-size">
                      {formatSize(result.originalSize)} to {formatSize(result.compressedSize)}
                      {smaller &&
                        ` (-${Math.round((1 - result.compressedSize / result.originalSize) * 100)}%)`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {result.originalWidth}x{result.originalHeight} to {result.width}x
                      {result.height}
                      {result.quality !== null && ` | quality ${Math.round(result.quality * 100)}%`}
                      {mode === 'target' &&
                        ` | ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: resultColor(result.status) }}>
                      {result.message}
                    </div>
                  </div>
                </div>
                <a href={result.url} download={result.outputName} className="btn btn-primary">
                  Download
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
