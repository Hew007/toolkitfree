import { useCallback, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { ToolChoices, type ToolChoice } from './ToolChoices';
import FineTune, { FineTuneField } from './FineTune';
import ToolRunNote from './ToolRunNote';
import { useAutoRun } from '../hooks/useAutoRun';
import { mapWithConcurrency } from '../lib/async-pool';
import FileList from './FileList';
import DownloadResult from './DownloadResult';
import BatchResultsSummary from './BatchResultsSummary';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  exportCanvas,
  getCanvas2dContext,
  getImageProcessingErrorMessage,
  loadImage,
  type ImageOutputMimeType,
} from '../lib/image-processing';
import {
  OUTPUT_FORMAT_LABELS,
  createUniqueOutputNames,
  getConverterInputConfig,
  getConverterOutputMime,
} from '../lib/image-converter';

interface QueuedFile {
  id: string;
  file: File;
}

/**
 * A finished encode that has no object URL yet. URLs are handed out only once the
 * whole batch is known to still be current — see `runConversion`.
 */
interface EncodedFile {
  sourceId: string;
  sourceName: string;
  outputName: string;
  originalSize: number;
  blob: Blob;
}

interface ConvertedFile extends EncodedFile {
  name: string;
  outputSize: number;
  size: number;
  url: string;
  previewUrl: string;
}

interface FailedFile {
  sourceId: string;
  name: string;
  message: string;
}

type ConversionOutcome =
  { status: 'success'; value: EncodedFile } | { status: 'failure'; value: FailedFile };

interface Props {
  defaultFrom?: string;
  defaultTo?: string;
}

/** Starting quality for the formats that have one. */
const DEFAULT_QUALITY = 92;

/**
 * What each output format is for, and the quality it starts at. The chip row is a
 * projection of this table joined to `OUTPUT_FORMAT_LABELS`, so a format cannot
 * end up with a chip whose label or default has drifted away from the encoder's.
 *
 * Quality is deliberately the same for both lossy formats: this tool changes the
 * container, not the size. Trading detail for bytes is the compressor's job, and
 * a converter that quietly re-encoded at a lower quality would be doing it
 * without being asked.
 */
interface OutputPreset {
  /** What the format is good for. Shown as the chip's hint. */
  purpose: string;
  /** Starting encoder quality, or null for a lossless format that ignores it. */
  quality: number | null;
}

const OUTPUT_PRESETS: Record<ImageOutputMimeType, OutputPreset> = {
  'image/jpeg': {
    purpose: 'Photos and email. Transparency is filled with white.',
    quality: DEFAULT_QUALITY,
  },
  'image/png': {
    purpose: 'Lossless pixels, and transparency is kept.',
    quality: null,
  },
  'image/webp': {
    purpose: 'Web pages. Lossy encoding that keeps transparency.',
    quality: DEFAULT_QUALITY,
  },
};

const OUTPUT_CHOICES: readonly ToolChoice<ImageOutputMimeType>[] = (
  Object.keys(OUTPUT_FORMAT_LABELS) as ImageOutputMimeType[]
).map((mime) => ({
  id: mime,
  label: OUTPUT_FORMAT_LABELS[mime],
  hint: OUTPUT_PRESETS[mime].purpose,
}));

/** One decode plus one encode per file; short enough that a slider still feels live. */
const RECONVERT_DELAY_MS = 320;

/** Stable identities, so clearing twice does not re-run the batch summary's effect. */
const NO_RESULTS: ConvertedFile[] = [];
const NO_FAILURES: FailedFile[] = [];

export default function ImageConverter({ defaultFrom, defaultTo }: Props) {
  const inputConfig = getConverterInputConfig(defaultFrom);
  // A variant page arrives with its target format already decided; the chip row
  // opens on that chip and its preset supplies the starting quality.
  const initialFormat = getConverterOutputMime(defaultTo);

  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [outputFormat, setOutputFormat] = useState<ImageOutputMimeType>(initialFormat);
  const [quality, setQuality] = useState(OUTPUT_PRESETS[initialFormat].quality ?? DEFAULT_QUALITY);
  const [tuned, setTuned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [results, setResults] = useState<ConvertedFile[]>(NO_RESULTS);
  const [failures, setFailures] = useState<FailedFile[]>(NO_FAILURES);
  const nextFileId = useRef(0);
  const objectUrls = useObjectUrlRegistry();

  const formatLabel = OUTPUT_FORMAT_LABELS[outputFormat];
  const lossless = OUTPUT_PRESETS[outputFormat].quality === null;

  /** Any change to this string makes every encoded file stale. */
  const settingsKey = useMemo(
    () =>
      JSON.stringify({
        files: files.map((entry) => entry.id),
        outputFormat,
        // A lossless format ignores it, so dragging the slider must not re-encode.
        quality: lossless ? null : quality,
      }),
    [files, lossless, outputFormat, quality]
  );

  const handleFiles = useCallback((newFiles: File[]) => {
    if (newFiles.length === 0) return;
    setFiles((previous) => [
      ...previous,
      ...newFiles.map((file) => ({
        id: `file-${++nextFileId.current}`,
        file,
      })),
    ]);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  }, []);

  const handleFormat = useCallback((mime: ImageOutputMimeType) => {
    setOutputFormat(mime);
    setQuality(OUTPUT_PRESETS[mime].quality ?? DEFAULT_QUALITY);
    setTuned(false);
  }, []);

  const encodeFile = useCallback(
    async (queuedFile: QueuedFile, outputName: string): Promise<EncodedFile> => {
      const image = await loadImage(queuedFile.file, {
        allowedTypes: inputConfig.allowedTypes,
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const context = getCanvas2dContext(canvas);
      if (outputFormat === 'image/jpeg') {
        // JPG carries no alpha channel, so transparent pixels need something to
        // land on rather than whatever the canvas happens to hold.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(image, 0, 0);

      const blob = await exportCanvas(canvas, outputFormat, lossless ? undefined : quality / 100);

      return {
        sourceId: queuedFile.id,
        sourceName: queuedFile.file.name,
        outputName,
        originalSize: queuedFile.file.size,
        blob,
      };
    },
    [inputConfig.allowedTypes, lossless, outputFormat, quality]
  );

  const runConversion = useCallback(
    async (queued: QueuedFile[], isCurrent: () => boolean) => {
      setBusy(true);
      const startedAt = performance.now();
      const outputNames = createUniqueOutputNames(
        queued.map(({ file }) => file.name),
        outputFormat
      );

      const outcomes: ConversionOutcome[] = await mapWithConcurrency(
        queued,
        2,
        async (queuedFile, index) => {
          try {
            return { status: 'success', value: await encodeFile(queuedFile, outputNames[index]) };
          } catch (conversionError) {
            return {
              status: 'failure',
              value: {
                sourceId: queuedFile.id,
                name: queuedFile.file.name,
                message: getImageProcessingErrorMessage(conversionError),
              },
            };
          }
        }
      );

      // A newer settings change already superseded this run. Bailing out here,
      // before a single object URL has been registered, is what keeps a stale run
      // from revoking the URL a fresher one has already put behind a rendered
      // `src`: the registry keys are per source file, so two live runs would
      // otherwise write the same key and cancel each other.
      if (!isCurrent()) return;

      setResults(
        outcomes
          .filter(
            (outcome): outcome is Extract<ConversionOutcome, { status: 'success' }> =>
              outcome.status === 'success'
          )
          .map(({ value }) => {
            const url = objectUrls.replace(`result:${value.sourceId}`, value.blob);
            return {
              ...value,
              name: value.outputName,
              outputSize: value.blob.size,
              size: value.blob.size,
              url,
              previewUrl: url,
            };
          })
      );
      setFailures(
        outcomes
          .filter(
            (outcome): outcome is Extract<ConversionOutcome, { status: 'failure' }> =>
              outcome.status === 'failure'
          )
          .map((outcome) => outcome.value)
      );
      setElapsedMs(Math.round(performance.now() - startedAt));
      setBusy(false);
    },
    [encodeFile, objectUrls, outputFormat]
  );

  // No submit button: a conversion is one decode and one encode, so the result
  // follows the controls instead of waiting behind them.
  useAutoRun({
    key: settingsKey,
    enabled: files.length > 0,
    delayMs: RECONVERT_DELAY_MS,
    onInvalidate: () => {
      objectUrls.revokePrefix('result:');
      setResults(NO_RESULTS);
      setFailures(NO_FAILURES);
      setElapsedMs(null);
      setBusy(false);
    },
    run: (isCurrent) => runConversion(files, isCurrent),
  });

  const fineTuneSummary = `${formatLabel} · ${lossless ? 'lossless' : `quality ${quality}%`}`;

  return (
    <div aria-busy={busy}>
      {busy && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Converting images.
        </div>
      )}
      <FileUploader
        accept={inputConfig.accept}
        multiple={true}
        budgetProfile="converter"
        currentFiles={files.map(({ file }) => file)}
        onFilesSelected={handleFiles}
      />
      <p className="tool-hint">Accepted input: {inputConfig.hint}</p>

      <FileList files={files.map(({ file }) => file)} onRemove={handleRemove} />

      {files.length > 0 && (
        <div className="tool-controls">
          <ToolChoices
            name="converter-output-format"
            legend="Convert to"
            help="Pick the format you need. Conversion follows your choice, and the exact values stay editable below."
            choices={OUTPUT_CHOICES}
            value={outputFormat}
            onChange={(choice) => handleFormat(choice.id)}
          />

          <FineTune
            summary={fineTuneSummary}
            onReset={tuned ? () => handleFormat(outputFormat) : undefined}
            resetLabel={`Back to the ${formatLabel} default`}
          >
            <FineTuneField
              htmlFor="converter-output-quality"
              label={`Quality: ${quality}%`}
              hidden={lossless}
              hint="Applies to JPG and WebP. Higher keeps more detail and writes a larger file."
            >
              <input
                id="converter-output-quality"
                aria-label="Output Quality"
                type="range"
                min="10"
                max="100"
                value={quality}
                onChange={(event) => {
                  setQuality(Number(event.target.value));
                  setTuned(true);
                }}
              />
            </FineTuneField>
            {lossless && (
              <p className="tool-hint">
                PNG is lossless, so it has no quality setting. Every decoded pixel is written out
                unchanged.
              </p>
            )}
          </FineTune>

          <ToolRunNote busy={busy}>
            {busy
              ? 'Converting in your browser…'
              : elapsedMs !== null
                ? `Converted in your browser in ${(elapsedMs / 1000).toFixed(1)}s. Nothing was uploaded.`
                : 'Results follow the settings above. Nothing is uploaded.'}
          </ToolRunNote>
        </div>
      )}

      <BatchResultsSummary
        successes={results}
        failures={failures}
        archiveName="toolkitfree-converted-images.zip"
      />

      {results.length > 0 && (
        <div>
          {results.map((result) => (
            <DownloadResult key={result.sourceId} {...result} />
          ))}
        </div>
      )}
    </div>
  );
}
