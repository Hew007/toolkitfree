import { useEffect, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import FileList from './FileList';
import DownloadResult from './DownloadResult';
import { formatSize } from '../lib/image-processing';
import {
  ANIMATION_PRESETS,
  DEFAULT_ANIMATION_SETTINGS,
  buildAnimationFfmpegArgs,
  createAnimationOutputName,
  detectAnimationInputFormat,
  getAnimationBudget,
  hasPngAnimationChunk,
  hasWebpAnimationChunk,
  validateAnimationFileSize,
  validateAnimationWorkload,
  type AnimationConversionSettings,
  type AnimationInputFormat,
  type AnimationMetadata,
  type AnimationOutputFormat,
  type AnimationPreset,
  type AnimationRuntimeCapabilities,
} from '../lib/animation-converter';
import {
  AnimationFfmpegRuntime,
  detectAnimationRuntimeCapabilities,
  writeAnimatedWebpFrames,
} from '../lib/animation-runtime';

interface Props {
  defaultOutput?: AnimationOutputFormat;
}

interface ConversionResult {
  name: string;
  size: number;
  url: string;
  previewUrl?: string;
}

const ACCEPTED_INPUTS =
  'video/mp4,video/webm,video/quicktime,image/gif,image/webp,image/apng,image/png,.mp4,.webm,.mov,.m4v,.gif,.webp,.apng,.png';

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (
    window.matchMedia('(max-width: 700px)').matches ||
    (deviceMemory !== undefined && deviceMemory <= 4)
  );
}

function getExtension(file: File, format: AnimationInputFormat): string {
  const extension = file.name.toLowerCase().split('.').pop() || '';
  if (format === 'video')
    return ['mp4', 'webm', 'mov', 'm4v'].includes(extension) ? extension : 'mp4';
  if (format === 'apng') return 'apng';
  return format;
}

async function inspectBrowserMedia(
  file: File,
  format: AnimationInputFormat
): Promise<AnimationMetadata | null> {
  const url = URL.createObjectURL(file);
  try {
    if (format === 'video') {
      return await new Promise((resolve) => {
        const video = document.createElement('video');
        const done = (metadata: AnimationMetadata | null) => {
          video.removeAttribute('src');
          video.load();
          resolve(metadata);
        };
        video.preload = 'metadata';
        video.onloadedmetadata = () =>
          done({
            width: video.videoWidth,
            height: video.videoHeight,
            durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
          });
        video.onerror = () => done(null);
        video.src = url;
      });
    }
    const bitmap = await createImageBitmap(file);
    const metadata = { width: bitmap.width, height: bitmap.height, durationSeconds: 20 };
    bitmap.close();
    return metadata;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function probeInput(
  ffmpeg: NonNullable<AnimationFfmpegRuntime['ffmpeg']>,
  inputName: string,
  signal: AbortSignal
): Promise<AnimationMetadata> {
  const probeName = 'animation-probe.json';
  const exitCode = await ffmpeg.ffprobe(
    [
      '-v',
      'error',
      '-count_frames',
      '-show_entries',
      'stream=width,height,nb_read_frames:format=duration',
      '-of',
      'json',
      inputName,
      '-o',
      probeName,
    ],
    -1,
    { signal }
  );
  if (exitCode !== 0) throw new Error('The input media could not be inspected.');
  const raw = await ffmpeg.readFile(probeName, 'utf8', { signal });
  await ffmpeg.deleteFile(probeName).catch(() => undefined);
  const parsed = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
  const stream = parsed.streams?.[0] || {};
  const durationSeconds = Number(parsed.format?.duration || 0);
  const metadata = {
    width: Number(stream.width || 0),
    height: Number(stream.height || 0),
    durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 20,
    frameCount: Number(stream.nb_read_frames || 0) || undefined,
  };
  if (!metadata.width || !metadata.height)
    throw new Error('No decodable animation frames were found.');
  return metadata;
}

function outputMime(format: AnimationOutputFormat): string {
  if (format === 'gif') return 'image/gif';
  if (format === 'webp') return 'image/webp';
  return 'image/apng';
}

export default function AnimationConverter({ defaultOutput = 'gif' }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [inputFormat, setInputFormat] = useState<AnimationInputFormat | null>(null);
  const [metadata, setMetadata] = useState<AnimationMetadata | null>(null);
  const [capabilities, setCapabilities] = useState<AnimationRuntimeCapabilities | null>(null);
  const [settings, setSettings] = useState<AnimationConversionSettings>({
    ...DEFAULT_ANIMATION_SETTINGS,
    outputFormat: defaultOutput,
  });
  const [status, setStatus] = useState('Choose one file to begin.');
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const runtimeRef = useRef(new AnimationFfmpegRuntime());
  const abortRef = useRef<AbortController | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const budget = useMemo(() => getAnimationBudget(isMobileDevice()), []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    void detectAnimationRuntimeCapabilities().then(setCapabilities);
    return () => {
      abortRef.current?.abort();
      runtime.terminate();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!converting) return;
    const started = performance.now();
    setElapsedSeconds(0);
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((performance.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [converting]);

  const clearResult = () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResult(null);
  };

  const chooseFiles = async (files: File[]) => {
    const nextFile = files[0];
    if (!nextFile) return;
    clearResult();
    setError('');
    setMetadata(null);
    try {
      const format = detectAnimationInputFormat(nextFile);
      validateAnimationFileSize(nextFile, format, budget);
      const header = new Uint8Array(await nextFile.slice(0, 1024 * 1024).arrayBuffer());
      if (format === 'apng' && !hasPngAnimationChunk(header)) {
        throw new Error('This is a static PNG. Use the Image Converter for static images.');
      }
      if (format === 'webp') {
        if (!hasWebpAnimationChunk(header)) {
          throw new Error('This is a static WebP. Use the Image Converter for static images.');
        }
        if (capabilities && !capabilities.animatedWebpInput) {
          throw new Error(capabilities.reason || 'Animated WebP input is not supported here.');
        }
      }
      const inspected = await inspectBrowserMedia(nextFile, format);
      setFile(nextFile);
      setInputFormat(format);
      setMetadata(inspected);
      setSettings((previous) => ({
        ...previous,
        ...(budget.maxFrames === 150
          ? { preset: 'small' as const, ...ANIMATION_PRESETS.small }
          : {}),
        startSeconds: 0,
        durationSeconds:
          format === 'video'
            ? Math.max(0.1, Math.min(6, inspected?.durationSeconds || 6))
            : budget.maxFrames === 150
              ? 10
              : 12,
      }));
      setStatus('Ready. The conversion engine will load only when you start.');
    } catch (selectionError) {
      setFile(null);
      setInputFormat(null);
      setStatus('Choose one file to begin.');
      setError(
        selectionError instanceof Error ? selectionError.message : 'This file is not supported.'
      );
    }
  };

  const updatePreset = (preset: AnimationPreset) => {
    clearResult();
    setSettings((previous) => ({ ...previous, preset, ...ANIMATION_PRESETS[preset] }));
  };

  const removeFile = () => {
    abortRef.current?.abort();
    clearResult();
    setFile(null);
    setInputFormat(null);
    setMetadata(null);
    setError('');
    setStatus('Choose one file to begin.');
  };

  const convert = async () => {
    if (!file || !inputFormat || converting) return;
    clearResult();
    setError('');
    setConverting(true);
    setProgress(0.01);
    setStatus('Loading the local conversion engine (usually 5–30 seconds)…');
    const controller = new AbortController();
    abortRef.current = controller;
    let ffmpeg: NonNullable<AnimationFfmpegRuntime['ffmpeg']> | null = null;
    let inputName = `input.${getExtension(file, inputFormat)}`;
    let outputName = createAnimationOutputName(file.name, settings.outputFormat);
    let temporaryFiles: string[] = [];
    const started = performance.now();
    try {
      ffmpeg = await runtimeRef.current.load(controller.signal, setProgress);
      setStatus(
        inputFormat === 'webp' ? 'Decoding animated WebP frames…' : 'Inspecting the input…'
      );

      let actualMetadata: AnimationMetadata;
      let concatInput = false;
      if (inputFormat === 'webp') {
        const extracted = await writeAnimatedWebpFrames(
          ffmpeg,
          file,
          budget,
          controller.signal,
          setProgress
        );
        inputName = extracted.inputName;
        temporaryFiles = extracted.temporaryFiles;
        actualMetadata = extracted.metadata;
        concatInput = true;
      } else {
        await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()), {
          signal: controller.signal,
        });
        temporaryFiles.push(inputName);
        if (metadata) {
          actualMetadata = {
            ...metadata,
            durationSeconds:
              metadata.durationSeconds > 0 ? metadata.durationSeconds : settings.durationSeconds,
          };
        } else {
          actualMetadata = await probeInput(ffmpeg, inputName, controller.signal);
        }
      }

      const effectiveDuration = Math.min(
        settings.durationSeconds,
        Math.max(0.1, actualMetadata.durationSeconds - settings.startSeconds)
      );
      const effectiveSettings = { ...settings, durationSeconds: effectiveDuration };
      validateAnimationWorkload(actualMetadata, inputFormat, effectiveSettings, budget);
      setMetadata(actualMetadata);
      outputName = createAnimationOutputName(file.name, settings.outputFormat);
      const virtualOutput = `output.${settings.outputFormat === 'apng' ? 'apng' : settings.outputFormat}`;

      const onFfmpegProgress = ({ progress: value }: { progress: number }) => {
        if (Number.isFinite(value)) setProgress(Math.min(0.98, 0.5 + Math.max(0, value) * 0.48));
      };
      ffmpeg.on('progress', onFfmpegProgress);
      setStatus(`Creating ${settings.outputFormat.toUpperCase()}…`);
      try {
        const exitCode = await ffmpeg.exec(
          buildAnimationFfmpegArgs(
            inputName,
            virtualOutput,
            inputFormat,
            effectiveSettings,
            concatInput
          ),
          -1,
          { signal: controller.signal }
        );
        if (exitCode !== 0) throw new Error('The media codec could not complete this conversion.');
      } finally {
        ffmpeg.off('progress', onFfmpegProgress);
      }

      const bytes = await ffmpeg.readFile(virtualOutput, undefined, { signal: controller.signal });
      if (typeof bytes === 'string') throw new Error('The conversion produced an invalid result.');
      const blob = new Blob([Uint8Array.from(bytes).buffer], {
        type: outputMime(settings.outputFormat),
      });
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResult({
        name: outputName,
        size: blob.size,
        url,
        previewUrl: blob.size <= budget.maxOutputBytes ? url : undefined,
      });
      await ffmpeg.deleteFile(virtualOutput).catch(() => undefined);
      setProgress(1);
      setStatus(`Finished in ${((performance.now() - started) / 1000).toFixed(1)} seconds.`);
    } catch (conversionError) {
      if (controller.signal.aborted) {
        setStatus('Conversion cancelled.');
      } else {
        setError(
          conversionError instanceof Error
            ? conversionError.message
            : 'The file could not be converted in this browser.'
        );
        setStatus('Conversion failed. Adjust the settings or choose another file.');
      }
    } finally {
      if (ffmpeg) {
        for (const name of temporaryFiles) await ffmpeg.deleteFile(name).catch(() => undefined);
      }
      abortRef.current = null;
      setConverting(false);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    runtimeRef.current.terminate();
  };

  const estimatedFrames = Math.ceil(settings.durationSeconds * settings.fps);

  return (
    <div className="animation-converter" data-animation-converter aria-busy={converting}>
      <FileUploader
        accept={ACCEPTED_INPUTS}
        multiple={false}
        currentFiles={file ? [file] : []}
        onFilesSelected={(files) => void chooseFiles(files)}
        singleFileLabel="a video or animated image"
      />
      <p className="tool-hint">
        MP4, WebM, common MOV, GIF, animated WebP, or APNG. One file at a time.
      </p>
      {capabilities && !capabilities.animatedWebpInput && (
        <div className="notice-card" role="status">
          Animated WebP input is unavailable in this browser. Video, GIF, and APNG input still work,
          and all three output formats remain available.
        </div>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}{' '}
          {(error.includes('static PNG') || error.includes('static WebP')) && (
            <a href="/tools/image-converter/">Open Image Converter</a>
          )}
        </div>
      )}
      {file && <FileList files={[file]} onRemove={removeFile} />}

      {file && inputFormat && (
        <div className="animation-settings">
          <div className="settings-grid">
            <label>
              Output format
              <select
                value={settings.outputFormat}
                onChange={(event) => {
                  clearResult();
                  setSettings((previous) => ({
                    ...previous,
                    outputFormat: event.target.value as AnimationOutputFormat,
                  }));
                }}
              >
                <option value="gif">GIF</option>
                <option value="webp">Animated WebP</option>
                <option value="apng">APNG</option>
              </select>
            </label>
            <label>
              Preset
              <select
                value={settings.preset}
                onChange={(event) => updatePreset(event.target.value as AnimationPreset)}
              >
                <option value="small">Small · 480px · 8fps</option>
                <option value="balanced">Balanced · 640px · 12fps</option>
                <option value="high">High · 960px · 15fps</option>
              </select>
            </label>
            <label>
              Start time (seconds)
              <input
                type="number"
                min="0"
                max={Math.max(0, (metadata?.durationSeconds || 300) - 0.1)}
                step="0.1"
                value={settings.startSeconds}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    startSeconds: Number(event.target.value) || 0,
                  }))
                }
              />
            </label>
            <label>
              Maximum duration (seconds)
              <input
                type="number"
                min="0.1"
                max="20"
                step="0.1"
                value={settings.durationSeconds}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    durationSeconds: Number(event.target.value) || 0.1,
                  }))
                }
              />
            </label>
            <label>
              Loop count
              <select
                value={settings.loopCount}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    loopCount: Number(event.target.value),
                  }))
                }
              >
                <option value="0">Forever</option>
                <option value="1">Play once</option>
                <option value="2">Twice</option>
                <option value="3">Three times</option>
              </select>
            </label>
            {settings.outputFormat === 'webp' && (
              <label>
                WebP quality: {settings.quality}
                <input
                  type="range"
                  min="40"
                  max="95"
                  value={settings.quality}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      quality: Number(event.target.value),
                    }))
                  }
                />
              </label>
            )}
          </div>
          <div className="conversion-summary">
            <span>{settings.maxSide}px maximum side</span>
            <span>{settings.fps} fps</span>
            <span>Up to {estimatedFrames} frames</span>
            {metadata && (
              <span>
                {metadata.width} × {metadata.height} source
              </span>
            )}
          </div>
          {settings.outputFormat === 'apng' && (
            <p className="tool-hint">
              APNG keeps full-color transparency but can be substantially larger.
            </p>
          )}
          <div className="action-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void convert()}
              disabled={converting}
            >
              {converting ? 'Converting…' : `Create ${settings.outputFormat.toUpperCase()}`}
            </button>
            {converting && (
              <button type="button" className="btn btn-secondary" onClick={cancel}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {(converting || progress > 0) && (
        <div className="conversion-progress" role="status" aria-live="polite">
          <div
            className={`conversion-progress-track${converting ? ' is-active' : ''}`}
            role="progressbar"
            aria-label="Conversion progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span
              className="conversion-progress-fill"
              style={{ width: `${Math.max(progress * 100, converting ? 5 : 0)}%` }}
            />
          </div>
          <div className="conversion-progress-details">
            <span>{status}</span>
            <span className="conversion-progress-percent">
              {progress >= 1
                ? `100% · ${elapsedSeconds}s`
                : `About ${Math.round(progress * 100)}% · ${elapsedSeconds}s elapsed`}
            </span>
          </div>
        </div>
      )}
      {result && (
        <div className="conversion-result">
          <DownloadResult {...result} />
          {!result.previewUrl && (
            <p className="tool-hint">
              The {formatSize(result.size)} result is ready to download, but its inline preview was
              skipped to avoid another large memory allocation.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
